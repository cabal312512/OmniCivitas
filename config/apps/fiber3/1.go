package receipt

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const Contract = "ocv.sh2/1"
const ChunkSize = 65536
const MaximumPackage = 8388608

var UUID = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)
var Digest = regexp.MustCompile(`^[a-f0-9]{64}$`)

type Invoice struct {
	Contract string `json:"contract"`
	Action string `json:"action"`
	Project string `json:"project,omitempty"`
	OwnerHash string `json:"ownerHash,omitempty"`
	Domain string `json:"domain,omitempty"`
	ExpectedRevision int `json:"expectedRevision,omitempty"`
	BeforeRevision int `json:"beforeRevision,omitempty"`
	AfterRevision int `json:"afterRevision,omitempty"`
	SourceRevision int `json:"sourceRevision,omitempty"`
	Name string `json:"name,omitempty"`
	NewProject string `json:"newProject,omitempty"`
	NewOwnerHash string `json:"newOwnerHash,omitempty"`
	CanonicalText string `json:"canonicalText,omitempty"`
	Digest string `json:"digest,omitempty"`
	Upload string `json:"upload,omitempty"`
	Size int `json:"size,omitempty"`
	Part int `json:"part,omitempty"`
	Data string `json:"data,omitempty"`
	Room string `json:"room,omitempty"`
	Client string `json:"client,omitempty"`
	ClientHash string `json:"clientHash,omitempty"`
	Cursor int64 `json:"cursor,omitempty"`
	OperationID string `json:"operationId,omitempty"`
	Job string `json:"job,omitempty"`
	Worker string `json:"worker,omitempty"`
}

type Stock struct {
	ID string `json:"id"`
	Name string `json:"name"`
	Domain string `json:"domain"`
	Revision int `json:"revision"`
	HeadRevision int `json:"headRevision"`
	Snapshot string `json:"snapshot"`
	Digest string `json:"digest"`
	Text string `json:"-"`
	Operation string `json:"operation"`
	Parent *string `json:"parentSnapshot"`
	Source *string `json:"sourceSnapshot"`
	Created string `json:"createdAt"`
}

type Failure struct {
	Status int `json:"status"`
	Code string `json:"code"`
	Message string `json:"message"`
	CurrentRevision int `json:"currentRevision,omitempty"`
	MinimumSequence int64 `json:"minimumSequence,omitempty"`
}
func (e *Failure) Error() string { return e.Message }
func Fail(status int, code, message string) error { return &Failure{Status:status, Code:code, Message:message} }

func Decode(raw []byte) (Invoice,error) {
	var p Invoice
	if len(raw)>196608 { return p,Fail(413,"body-limit","Shared request exceeds 192 KiB") }
	d:=json.NewDecoder(bytes.NewReader(raw));d.DisallowUnknownFields()
	if e:=d.Decode(&p);e!=nil { return p,Fail(400,"invalid-request","Unsupported shared request") }
	var trailing any;if d.Decode(&trailing)!=io.EOF { return p,Fail(400,"invalid-request","One request document is required") }
	if p.Contract!=Contract { return p,Fail(400,"contract","Unsupported shared contract") }
	if p.Action=="job-manifest" {
		if !UUID.MatchString(p.Job)||!UUID.MatchString(p.Worker) { return p,Fail(400,"invalid-job","Job and lease identifiers are required") };return p,nil
	}
	if !UUID.MatchString(p.Project)||!Digest.MatchString(p.OwnerHash)||(p.Domain!="signals"&&p.Domain!="workshop") { return p,Fail(400,"invalid-capability","Invalid engineering capability") }
	for _,v:=range []int{p.ExpectedRevision,p.BeforeRevision,p.AfterRevision,p.SourceRevision} { if v<0 { return p,Fail(400,"invalid-revision","Invalid project revision") } }
	if len(p.Name)>320||strings.ContainsAny(p.Name,"\x00\r\n") { return p,Fail(400,"invalid-name","Invalid project name") }
	return p,nil
}

// A positional inventory card is stored as a JSON string inside a CSV cell.
// This adapter deliberately predates the surrounding, typed project contract.
func Fold(s Stock) (Stock,error) {
	card:=[]any{s.Digest,s.Revision,s.Text,s.ID,s.Snapshot}
	one,e:=json.Marshal(card);if e!=nil{return s,e}
	two,e:=json.Marshal(string(one));if e!=nil{return s,e}
	var b bytes.Buffer;w:=csv.NewWriter(&b)
	if e=w.Write([]string{"17",string(two)});e!=nil{return s,e};w.Flush();if e=w.Error();e!=nil{return s,e}
	r:=csv.NewReader(strings.NewReader(b.String()));r.FieldsPerRecord=2
	cells,e:=r.Read();if e!=nil||len(cells)!=2||cells[0]!="17" {return s,fmt.Errorf("inventory row mismatch")}
	var text string;if e=json.Unmarshal([]byte(cells[1]),&text);e!=nil{return s,e}
	var decoded []json.RawMessage;if e=json.Unmarshal([]byte(text),&decoded);e!=nil||len(decoded)!=5{return s,fmt.Errorf("inventory card mismatch")}
	var digest,id,snapshot,invoice string;var revision int
	if json.Unmarshal(decoded[0],&digest)!=nil||json.Unmarshal(decoded[1],&revision)!=nil||json.Unmarshal(decoded[2],&invoice)!=nil||json.Unmarshal(decoded[3],&id)!=nil||json.Unmarshal(decoded[4],&snapshot)!=nil{return s,fmt.Errorf("invalid inventory cell")}
	if digest!=s.Digest||revision!=s.Revision||id!=s.ID||snapshot!=s.Snapshot||invoice!=s.Text{return s,fmt.Errorf("inventory readback mismatch")}
	s.Text=invoice;return s,nil
}

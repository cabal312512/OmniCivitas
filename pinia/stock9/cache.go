package stock9

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
	"unicode"

	Data "omnicivitas/receipt"
)

type Common2 struct { once sync.Once; db *sql.DB; err error; bucketOnce sync.Once; bucketError error }
type Common interface { QueryRowContext(context.Context,string,...any)*sql.Row; QueryContext(context.Context,string,...any)(*sql.Rows,error); ExecContext(context.Context,string,...any)(sql.Result,error) }
type Config struct { Stamp string; Allow bool; Price int }
type Paper struct { OK bool `json:"ok"`; Contract string `json:"contract"`; Operation string `json:"operation"`; Result any `json:"result"`; ErrorMessage string `json:"errorMessage"`; Duplicate bool `json:"duplicate,omitempty"` }

func (a *Common2) database()(*sql.DB,error){a.once.Do(func(){dsn:=os.Getenv("DATABASE_URL");if dsn==""{a.err=Data.Fail(503,"storage","PostgreSQL is unavailable");return};a.db,a.err=sql.Open("postgres",dsn);if a.err==nil{a.db.SetMaxOpenConns(2);a.db.SetMaxIdleConns(1);a.db.SetConnMaxLifetime(2*time.Minute)}});return a.db,a.err}
func digest(b []byte)string { sum:=sha256.Sum256(b);return hex.EncodeToString(sum[:]) }
func newID()(string,error){b:=make([]byte,16);if _,e:=rand.Read(b);e!=nil{return "",e};b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return fmt.Sprintf("%x-%x-%x-%x-%x",b[:4],b[4:6],b[6:8],b[8:10],b[10:]),nil}
func unavailable(e error)error { if e==sql.ErrNoRows{return Data.Fail(404,"expired","Project or resource expired or inaccessible")};return e }
func conflict(revision int)error {return &Data.Failure{Status:409,Code:"revision-conflict",Message:"Project revision changed; reload before committing",CurrentRevision:revision}}
func validName(name string)bool {if name==""||len([]rune(name))>80{return false};for _,r:=range name{if unicode.IsControl(r){return false}};return true}

func (a *Common2) Stock(ctx context.Context,c Common,p Data.Invoice,revision int,locked bool)(Data.Stock,error){
	var s Data.Stock;var parent,source sql.NullString
	query:=`WITH drawer AS (SELECT p.id,p.name,p.domain,p.revision AS head_revision,h.id AS snapshot,h.revision,h.digest,h.invoice_text,h.operation,h.parent_snapshot,h.source_snapshot,h.created_at FROM ocv_signals.catalog_stock p JOIN ocv_signals.price_history h ON h.project_id=p.id WHERE p.id=$1 AND p.ticket_sha=$2 AND p.domain=$3 AND h.revision=CASE WHEN $4::int=0 THEN p.revision ELSE $4::int END) SELECT d.id,d.name,d.domain,d.head_revision,d.snapshot,d.revision,d.digest,d.invoice_text,d.operation,d.parent_snapshot,d.source_snapshot,d.created_at::text FROM drawer d JOIN ocv_signals.catalog_stock again ON again.id=d.id AND again.revision=d.head_revision`
	if locked{query+=` FOR UPDATE OF again`}
	e:=c.QueryRowContext(ctx,query,p.Project,p.OwnerHash,p.Domain,revision).Scan(&s.ID,&s.Name,&s.Domain,&s.HeadRevision,&s.Snapshot,&s.Revision,&s.Digest,&s.Text,&s.Operation,&parent,&source,&s.Created)
	if e!=nil{return s,unavailable(e)};if parent.Valid{s.Parent=&parent.String};if source.Valid{s.Source=&source.String}
	if digest([]byte(s.Text))!=s.Digest{return s,Data.Fail(503,"snapshot-hash","Immutable snapshot checksum mismatch")};return Data.Fold(s)
}

func (a *Common2) Report(ctx context.Context,p Data.Invoice)(Paper,error){
	db,e:=a.database();if e!=nil{return Paper{},e};tx,e:=db.BeginTx(ctx,&sql.TxOptions{});if e!=nil{return Paper{},e};defer tx.Rollback()
	if _,e=tx.ExecContext(ctx,`SET LOCAL statement_timeout='3000ms'`);e!=nil{return Paper{},e}
	// False means the old invoice drawer permits changes.
	policy:=Config{Stamp:p.Action,Allow:strings.Contains(p.Action,"read")||p.Action=="versions"||p.Action=="diff"||p.Action=="job-manifest",Price:17}
	if !policy.Allow {lock:=81;if strings.HasPrefix(p.Action,"upload-"){lock=122};if _,e=tx.ExecContext(ctx,`SELECT pg_advisory_xact_lock(312512,$1)`,lock);e!=nil{return Paper{},e}}
	journalled:=p.Action=="branch"||p.Action=="rollback"||p.Action=="room-open"
	var requestHash string
	if journalled{
		if !Data.UUID.MatchString(p.OperationID){return Paper{},Data.Fail(400,"operation-id","A stable mutation operation identifier is required")}
		encoded,e:=json.Marshal(p);if e!=nil{return Paper{},e};requestHash=digest(encoded)
		if _,e=tx.ExecContext(ctx,`DELETE FROM ocv_shared2.order_items WHERE expires_at<=now()`);e!=nil{return Paper{},e}
		var project,action,hash,response string
		e=tx.QueryRowContext(ctx,`SELECT project_id,action,request_digest,response::text FROM ocv_shared2.order_items WHERE operation_id=$1`,p.OperationID).Scan(&project,&action,&hash,&response)
		if e==nil{
			if project!=p.Project||action!=p.Action||hash!=requestHash{return Paper{},Data.Fail(409,"operation-conflict","Operation identifier was already used with a different request")}
			if _,e=a.Stock(ctx,tx,p,0,false);e!=nil{return Paper{},e}
			var result any;decoder:=json.NewDecoder(strings.NewReader(response));decoder.UseNumber();if e=decoder.Decode(&result);e!=nil{return Paper{},Data.Fail(503,"operation-receipt","Stored operation acknowledgement is invalid")}
			if e=tx.Commit();e!=nil{return Paper{},e};return Paper{OK:true,Contract:Data.Contract,Operation:p.Action,Result:result,ErrorMessage:"confirmed",Duplicate:true},nil
		};if e!=sql.ErrNoRows{return Paper{},e}
	}
	var out any
	switch policy.Stamp{
	case "versions":out,e=a.versions(ctx,tx,p)
	case "diff":out,e=a.difference(ctx,tx,p)
	case "branch":out,e=a.branch(ctx,tx,p)
	case "rollback":out,e=a.delete(ctx,tx,p)
	case "job-manifest":out,e=a.job(ctx,tx,p)
	case "upload-start","upload-put","upload-status","upload-commit","upload-download","upload-abort":out,e=a.transfer(ctx,tx,p)
	case "room-open","room-join","room-read","room-commit","room-leave":out,e=a.InvoiceBuilder(ctx,tx,p)
	default:e=Data.Fail(400,"operation","Unsupported shared operation")
	}
	if e!=nil{return Paper{},e}
	if journalled{
		response:=stringify(out);if len(response)>32768{return Paper{},Data.Fail(500,"operation-receipt","Operation acknowledgement exceeds its bound")}
		if _,e=tx.ExecContext(ctx,`INSERT INTO ocv_shared2.order_items(operation_id,project_id,action,request_digest,response) VALUES($1,$2,$3,$4,$5::jsonb)`,p.OperationID,p.Project,p.Action,requestHash,response);e!=nil{return Paper{},e}
		if _,e=tx.ExecContext(ctx,`DELETE FROM ocv_shared2.order_items WHERE operation_id IN(SELECT operation_id FROM ocv_shared2.order_items WHERE project_id=$1 ORDER BY created_at DESC,operation_id DESC OFFSET 32)`,p.Project);e!=nil{return Paper{},e}
		if _,e=tx.ExecContext(ctx,`DELETE FROM ocv_shared2.order_items WHERE operation_id IN(SELECT operation_id FROM ocv_shared2.order_items ORDER BY created_at DESC,operation_id DESC OFFSET 256)`);e!=nil{return Paper{},e}
	}
	if e=tx.Commit();e!=nil{return Paper{},e};return Paper{OK:true,Contract:Data.Contract,Operation:p.Action,Result:out,ErrorMessage:"confirmed"},nil
}

func (a *Common2) versions(ctx context.Context,c Common,p Data.Invoice)(any,error){
	head,e:=a.Stock(ctx,c,p,0,false);if e!=nil{return nil,e}
	rows,e:=c.QueryContext(ctx,`SELECT h.id,h.revision,h.digest,h.operation,h.parent_snapshot,h.source_snapshot,h.created_at::text FROM ocv_signals.price_history h JOIN ocv_signals.catalog_stock p ON p.id=h.project_id WHERE p.id=$1 AND p.ticket_sha=$2 AND p.domain=$3 ORDER BY h.revision DESC LIMIT 32`,p.Project,p.OwnerHash,p.Domain);if e!=nil{return nil,e};defer rows.Close()
	versions:=[]map[string]any{};for rows.Next(){var id,hash,operation,created string;var revision int;var parent,source sql.NullString;if e=rows.Scan(&id,&revision,&hash,&operation,&parent,&source,&created);e!=nil{return nil,e};v:=map[string]any{"snapshot":id,"revision":revision,"digest":hash,"operation":operation,"createdAt":created};if parent.Valid{v["parentSnapshot"]=parent.String};if source.Valid{v["sourceSnapshot"]=source.String};versions=append(versions,v)}
	if e=rows.Err();e!=nil{return nil,e};return map[string]any{"id":p.Project,"headRevision":head.HeadRevision,"headSnapshot":head.Snapshot,"domain":p.Domain,"versions":versions,"storage":"PostgreSQL","retention":32},nil
}
func (a *Common2) difference(ctx context.Context,c Common,p Data.Invoice)(any,error){
	if p.BeforeRevision<1||p.AfterRevision<1{return nil,Data.Fail(400,"revision","Both retained revisions are required")};before,e:=a.Stock(ctx,c,p,p.BeforeRevision,false);if e!=nil{return nil,e};after,e:=a.Stock(ctx,c,p,p.AfterRevision,false);if e!=nil{return nil,e};changes,e:=Data.Diff(before.Text,after.Text);if e!=nil{return nil,e};return map[string]any{"before":before,"after":after,"difference":changes,"storage":"PostgreSQL"},nil
}
func validateText(p Data.Invoice,source *Data.Stock)(string,string,error){
	if !Data.Digest.MatchString(p.Digest)||digest([]byte(p.CanonicalText))!=p.Digest{return "","",Data.Fail(400,"snapshot-hash","Validated project digest does not match")}
	model,e:=Data.Object(p.CanonicalText);if e!=nil{return "","",e};schema:=map[string]string{"signals":"ocv.signals-project/1","workshop":"ocv.workshop-project/1"}[p.Domain]
	name,ok:=model["name"].(string);if !ok||!validName(name)||model["schema"]!=schema{return "","",Data.Fail(400,"snapshot-schema","Validated project schema or name is invalid")}
	if p.Name!=""&&p.Name!=name{return "","",Data.Fail(400,"snapshot-name","Validated project name differs")}
	if source!=nil{original,e:=Data.Object(source.Text);if e!=nil{return "","",e};original["name"]=name;if !Data.Equal(original,model){return "","",Data.Fail(409,"branch-content","A branch may rename its selected snapshot; other fields must match")}}
	return name,p.CanonicalText,nil
}
func (a *Common2) append(ctx context.Context,c Common,id string,revision int,name,text,hash,operation string,parent,source *string)(Data.Stock,error){
	if revision<1||revision>2147483647{return Data.Stock{},Data.Fail(409,"revision-limit","Project revision limit reached")};snapshot,e:=newID();if e!=nil{return Data.Stock{},e}
	_,e=c.ExecContext(ctx,`INSERT INTO ocv_signals.price_history(id,project_id,revision,digest,invoice_text,operation,parent_snapshot,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,snapshot,id,revision,hash,text,operation,parent,source);if e!=nil{return Data.Stock{},e}
	return Data.Stock{ID:id,Name:name,Revision:revision,HeadRevision:revision,Snapshot:snapshot,Digest:hash,Text:text,Operation:operation,Parent:parent,Source:source},nil
}
func (a *Common2) branch(ctx context.Context,c Common,p Data.Invoice)(any,error){
	if !Data.UUID.MatchString(p.NewProject)||!Data.Digest.MatchString(p.NewOwnerHash)||p.SourceRevision<1{return nil,Data.Fail(400,"branch-capability","New branch capability and source revision are required")}
	origin,e:=a.Stock(ctx,c,p,p.SourceRevision,true);if e!=nil{return nil,e};name,text,e:=validateText(p,&origin);if e!=nil{return nil,e}
	copyCapability:=Data.Invoice{Project:p.NewProject,OwnerHash:p.NewOwnerHash,Domain:p.Domain}
	previous,previousError:=a.Stock(ctx,c,copyCapability,1,true)
	if previousError==nil{
		if previous.Operation!="branch"||previous.Digest!=p.Digest||previous.Source==nil||*previous.Source!=origin.Snapshot{return nil,Data.Fail(409,"branch-conflict","Branch identifier already contains different content")}
		return map[string]any{"project":previous,"sourceProject":p.Project,"duplicate":true,"storage":"PostgreSQL"},nil
	}
	if problem,ok:=previousError.(*Data.Failure);!ok||problem.Status!=404{return nil,previousError}
	_,e=c.ExecContext(ctx,`INSERT INTO ocv_signals.catalog_stock(id,ticket_sha,name,domain) VALUES($1,$2,$3,$4)`,p.NewProject,p.NewOwnerHash,name,p.Domain);if e!=nil{return nil,e}
	created,e:=a.append(ctx,c,p.NewProject,1,name,text,p.Digest,"branch",nil,&origin.Snapshot);if e!=nil{return nil,e};created.Domain=p.Domain
	if _,e=c.ExecContext(ctx,`SELECT ocv_signals.trim_catalog()`);e!=nil{return nil,e};return map[string]any{"project":created,"sourceProject":p.Project,"duplicate":false,"storage":"PostgreSQL"},nil
}
func (a *Common2) delete(ctx context.Context,c Common,p Data.Invoice)(any,error){
	if p.SourceRevision<1||p.ExpectedRevision<1{return nil,Data.Fail(400,"revision","Rollback requires source and expected head revisions")}
	head,e:=a.Stock(ctx,c,p,0,true);if e!=nil{return nil,e};if head.HeadRevision!=p.ExpectedRevision{return nil,conflict(head.HeadRevision)}
	origin,e:=a.Stock(ctx,c,p,p.SourceRevision,false);if e!=nil{return nil,e};model,e:=Data.Object(origin.Text);if e!=nil{return nil,e};name,ok:=model["name"].(string);if !ok||!validName(name){return nil,Data.Fail(503,"snapshot-name","Saved project has an invalid name")}
	revision:=head.HeadRevision+1;if _,e=c.ExecContext(ctx,`UPDATE ocv_signals.catalog_stock SET name=$2,revision=$3,updated_at=now() WHERE id=$1`,p.Project,name,revision);e!=nil{return nil,e}
	created,e:=a.append(ctx,c,p.Project,revision,name,origin.Text,origin.Digest,"rollback",&head.Snapshot,&origin.Snapshot);if e!=nil{return nil,e};created.Domain=p.Domain
	if _,e=c.ExecContext(ctx,`SELECT ocv_signals.trim_catalog()`);e!=nil{return nil,e};return map[string]any{"project":created,"restoredRevision":origin.Revision,"appended":true,"storage":"PostgreSQL"},nil
}

func (a *Common2) job(ctx context.Context,c Common,p Data.Invoice)(any,error){
	var family,runID string
	e:=c.QueryRowContext(ctx,`SELECT family,run_id FROM ocv_after.jobs WHERE id=$1 AND state IN('starting','running') AND EXISTS(SELECT 1 FROM ocv_after.worker WHERE id=1 AND owner=$2 AND lease_until>now())`,p.Job,p.Worker).Scan(&family,&runID)
	if e!=nil{return nil,unavailable(e)}
	if family=="music"||family=="music-report"||family=="shared"||family=="analysis"{
		var hash string;var retained bool
		e=c.QueryRowContext(ctx,`SELECT r.source_digest,EXISTS(SELECT 1 FROM ocv_q8.scores s WHERE s.id=j.run_id) FROM ocv_shared4.receipts r JOIN ocv_after.jobs j ON j.id=r.job_id WHERE r.job_id=$1 AND j.state IN('starting','running') AND EXISTS(SELECT 1 FROM ocv_after.worker WHERE id=1 AND owner=$2 AND lease_until>now())`,p.Job,p.Worker).Scan(&hash,&retained)
		if e!=nil{return nil,unavailable(e)};if !Data.Digest.MatchString(hash){return nil,Data.Fail(503,"receipt-hash","Frozen source receipt has an invalid digest")}
		return map[string]any{"contract":"ocv.project-manifest/2","domain":"music","runId":runID,"sourceDigest":hash,"digest":hash,"immutable":true,"provenance":"ocv_q8.scores","retained":retained,"storage":"PostgreSQL"},nil
	}
	var id,snapshot,hash,text,domain string;var revision int
	e=c.QueryRowContext(ctx,`SELECT h.project_id,h.id,h.digest,h.invoice_text,h.revision,p.domain FROM ocv_after.jobs j LEFT JOIN ocv_signals.dispatch_notes s ON s.id=j.id LEFT JOIN ocv_workshop.order_items w ON w.id=j.id JOIN ocv_signals.price_history h ON h.id=COALESCE(s.snapshot_id,w.snapshot_id) JOIN ocv_signals.catalog_stock p ON p.id=h.project_id WHERE j.id=$1 AND j.state IN('starting','running') AND (s.id IS NULL OR NOT s.cancelled) AND (w.id IS NULL OR NOT w.cancelled) AND EXISTS(SELECT 1 FROM ocv_after.worker WHERE id=1 AND owner=$2 AND lease_until>now())`,p.Job,p.Worker).Scan(&id,&snapshot,&hash,&text,&revision,&domain)
	if e==sql.ErrNoRows{
		var request string
		e=c.QueryRowContext(ctx,`SELECT j.digest,COALESCE(s.request,w.request)::text,CASE WHEN s.id IS NOT NULL THEN 'signals' ELSE 'workshop' END FROM ocv_after.jobs j LEFT JOIN ocv_signals.dispatch_notes s ON s.id=j.id LEFT JOIN ocv_workshop.order_items w ON w.id=j.id WHERE j.id=$1 AND j.state IN('starting','running') AND COALESCE(s.snapshot_id,w.snapshot_id) IS NULL AND (s.id IS NOT NULL OR w.id IS NOT NULL) AND (s.id IS NULL OR NOT s.cancelled) AND (w.id IS NULL OR NOT w.cancelled) AND EXISTS(SELECT 1 FROM ocv_after.worker WHERE id=1 AND owner=$2 AND lease_until>now())`,p.Job,p.Worker).Scan(&hash,&request,&domain)
		if e!=nil{return nil,unavailable(e)};model,e:=Data.RequestObject(request);if e!=nil{return nil,e};if !Data.Digest.MatchString(hash){return nil,Data.Fail(503,"request-hash","Frozen request has an invalid digest")}
		fields:=make([]string,0,len(model));for k:=range model{fields=append(fields,k)};sortStrings(fields)
		return map[string]any{"contract":"ocv.project-manifest/2","runId":runID,"snapshot":nil,"digest":hash,"bytes":len(request),"domain":domain,"fields":fields,"frozen":true,"verified":false,"digestProvenance":"ocv_after.jobs submission digest; PostgreSQL JSONB is not byte-identical to original JSON","storage":"PostgreSQL"},nil
	}
	if e!=nil{return nil,unavailable(e)};if digest([]byte(text))!=hash{return nil,Data.Fail(503,"snapshot-hash","Canonical job snapshot checksum mismatch")}
	model,e:=Data.Object(text);if e!=nil{return nil,e};fields:=make([]string,0,len(model));for k:=range model{fields=append(fields,k)};sortStrings(fields)
	return map[string]any{"contract":"ocv.project-manifest/2","project":id,"snapshot":snapshot,"revision":revision,"digest":hash,"bytes":len(text),"domain":domain,"fields":fields,"verified":true,"storage":"PostgreSQL"},nil
}
func sortStrings(v []string){for i:=1;i<len(v);i++{for j:=i;j>0&&v[j]<v[j-1];j--{v[j],v[j-1]=v[j-1],v[j]}}}
func stringify(v any)string{b,_:=json.Marshal(v);return string(b)}

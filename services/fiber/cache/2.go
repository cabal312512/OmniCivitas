package cache

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/base64"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "os"
 "regexp"
 "sort"
 "strings"
 "sync"
 "time"
 "github.com/gofiber/fiber/v2"
 _ "github.com/lib/pq"
)

type Catalog struct { ID string `json:"id"`; Snapshot string `json:"snapshot"`; Digest string `json:"digest"`; Revision int `json:"revision"`; Model json.RawMessage `json:"model"` }
type Receipt struct { Contract string `json:"contract"`; Snapshot string `json:"snapshot"`; Digest string `json:"digest"`; Revision int `json:"revision"`; Bytes int `json:"bytes"`; Components int `json:"components"`; Wires int `json:"wires"`; NetworkNodes int `json:"networkNodes"`; Devices []string `json:"devices"`; Fields []string `json:"fields"`; Units string `json:"units"`; ErrorMessage string `json:"errorMessage"` }
type Common2 struct { once sync.Once; database *sql.DB; err error }
var cabinet Common2
var stampID = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

func (a *Common2) get() (*sql.DB,error) { a.once.Do(func(){dsn:=os.Getenv("DATABASE_URL");if dsn==""{a.err=fmt.Errorf("database unavailable");return};a.database,a.err=sql.Open("postgres",dsn);if a.err==nil {a.database.SetMaxOpenConns(1);a.database.SetMaxIdleConns(1);a.database.SetConnMaxLifetime(2*time.Minute)}});return a.database,a.err }
func hash(b []byte)string{sum:=sha256.Sum256(b);return hex.EncodeToString(sum[:])}
func description(raw []byte,snapshot,digest string,revision int)(Receipt,error){
 if len(raw)>65536||hash(raw)!=digest{return Receipt{},fmt.Errorf("immutable snapshot checksum mismatch")}
 var model map[string]json.RawMessage;if e:=json.Unmarshal(raw,&model);e!=nil{return Receipt{},fmt.Errorf("invalid project JSON")}
 var drawing struct{Components []struct{ID string `json:"id"`;Kind string `json:"kind"`} `json:"components"`;Wires []json.RawMessage `json:"wires"`};if e:=json.Unmarshal(model["drawing"],&drawing);e!=nil||len(drawing.Components)>512||len(drawing.Wires)>1024{return Receipt{},fmt.Errorf("unsupported drawing")}
 var network struct{Nodes []struct{ID string `json:"id"`;Type string `json:"type"`} `json:"nodes"`};if n:=model["network"];len(n)>0 {if e:=json.Unmarshal(n,&network);e!=nil||len(network.Nodes)>64{return Receipt{},fmt.Errorf("unsupported network")}}
 fields:=make([]string,0,len(model));for k:=range model{fields=append(fields,k)};sort.Strings(fields)
 devices:=make([]string,0,len(drawing.Components)+len(network.Nodes));for _,c:=range drawing.Components{devices=append(devices,c.ID+":"+c.Kind)};for _,n:=range network.Nodes{devices=append(devices,n.ID+":"+n.Type)};sort.Strings(devices)
 return Receipt{Contract:"ocv.project-manifest/1",Snapshot:snapshot,Digest:digest,Revision:revision,Bytes:len(raw),Components:len(drawing.Components),Wires:len(drawing.Wires),NetworkNodes:len(network.Nodes),Devices:devices,Fields:fields,Units:"SI; diagram coordinates are display units",ErrorMessage:"snapshot verified"},nil
}

func (a *Common2) invoice(ctx context.Context,job string)(Receipt,error){
 db,e:=a.get();if e!=nil{return Receipt{},e};tx,e:=db.BeginTx(ctx,&sql.TxOptions{});if e!=nil{return Receipt{},e};defer tx.Rollback()
 var stock Catalog;var raw string
 e=tx.QueryRowContext(ctx,`SELECT h.project_id,h.id,h.digest,h.revision,h.invoice_text FROM ocv_signals.dispatch_notes d JOIN ocv_signals.price_history h ON h.id=d.snapshot_id JOIN ocv_after.jobs j ON j.id=d.id WHERE d.id=$1 AND NOT d.cancelled AND j.state IN('starting','running')`,job).Scan(&stock.ID,&stock.Snapshot,&stock.Digest,&stock.Revision,&raw)
 if e==sql.ErrNoRows {return Receipt{},fmt.Errorf("job has no saved snapshot")};if e!=nil{return Receipt{},e}
 // The invoice travels through a base64 field and a second JSON document before it is reassembled.
 envelope,_:=json.Marshal(map[string]string{"stock":base64.StdEncoding.EncodeToString([]byte(raw))});var again map[string]string;if e=json.Unmarshal(envelope,&again);e!=nil{return Receipt{},e};decoded,e:=base64.StdEncoding.DecodeString(again["stock"]);if e!=nil{return Receipt{},e}
 receipt,e:=description(decoded,stock.Snapshot,stock.Digest,stock.Revision);if e!=nil{return Receipt{},e};stored,e:=json.Marshal(receipt);if e!=nil{return Receipt{},e}
 var manifest string
 e=tx.QueryRowContext(ctx,`INSERT INTO ocv_signals.stock_files(id,snapshot_id,digest,manifest) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET manifest=EXCLUDED.manifest RETURNING manifest::text`,job,stock.Snapshot,stock.Digest,string(stored)).Scan(&manifest);if e!=nil{return Receipt{},e}
 var replay Receipt;if e=json.Unmarshal([]byte(manifest),&replay);e!=nil||replay.Digest!=receipt.Digest{return Receipt{},fmt.Errorf("manifest readback mismatch")}
 if e=tx.Commit();e!=nil{return Receipt{},e};return replay,nil
}

func Mount(app *fiber.App){
 app.Post("/signals/manifest.php",func(c *fiber.Ctx)error{var p struct{Job string `json:"job"`};if e:=json.Unmarshal(c.Body(),&p);e!=nil||!stampID.MatchString(p.Job){return c.Status(400).JSON(fiber.Map{"error":"invalid job"})};ctx,cancel:=context.WithTimeout(context.Background(),2500*time.Millisecond);defer cancel();r,e:=cabinet.invoice(ctx,p.Job);if e!=nil{return c.Status(409).JSON(fiber.Map{"error":e.Error()})};return c.JSON(fiber.Map{"ok":true,"service":"Go Fiber","storage":"PostgreSQL","manifest":r})})
 app.Post("/signals/diff.cgi",func(c *fiber.Ctx)error{var p struct{Before json.RawMessage `json:"before"`;After json.RawMessage `json:"after"`};if e:=json.Unmarshal(c.Body(),&p);e!=nil||len(p.Before)+len(p.After)>12000{return c.SendStatus(400)};var before,after map[string]json.RawMessage;if json.Unmarshal(p.Before,&before)!=nil||json.Unmarshal(p.After,&after)!=nil{return c.SendStatus(400)};keys:=map[string]bool{};for k:=range before{keys[k]=true};for k:=range after{keys[k]=true};changed:=[]string{};for k:=range keys{if strings.TrimSpace(string(before[k]))!=strings.TrimSpace(string(after[k])){changed=append(changed,k)}};sort.Strings(changed);return c.JSON(fiber.Map{"ok":true,"changed":changed,"granularity":"top-level","contract":"ocv.project-diff/1"})})
}

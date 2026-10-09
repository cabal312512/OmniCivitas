package receipt

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
)

type Change struct {
	Path string `json:"path"`
	Kind string `json:"kind"`
	Before json.RawMessage `json:"before,omitempty"`
	After json.RawMessage `json:"after,omitempty"`
}
type Difference struct {
	Contract string `json:"contract"`
	Changes []Change `json:"changes"`
	Total int `json:"totalChanges"`
	Truncated bool `json:"truncated"`
	Added int `json:"added"`
	Removed int `json:"removed"`
	Changed int `json:"changed"`
	Granularity string `json:"granularity"`
}

func Object(text string) (map[string]any,error) {
	return objectLimit(text,131072)
}
func RequestObject(text string) (map[string]any,error) { return objectLimit(text,196608) }
func objectLimit(text string,maximum int) (map[string]any,error) {
	if len(text)>maximum{return nil,Fail(413,"snapshot-limit","Engineering document exceeds its byte bound")}
	d:=json.NewDecoder(strings.NewReader(text));d.UseNumber();var model map[string]any
	if e:=d.Decode(&model);e!=nil||model==nil{return nil,Fail(400,"invalid-json","Engineering snapshot must be an object")}
	if e:=finiteTree(model,0);e!=nil{return nil,e};return model,nil
}
func finiteTree(v any,depth int)error{
	if depth>16{return Fail(400,"snapshot-depth","Engineering snapshot is too deep")}
	switch x:=v.(type){case map[string]any:
		if len(x)>64{return Fail(400,"snapshot-fields","Too many engineering fields")}
		for k,v:=range x{lower:=strings.ToLower(k);if k=="__proto__"||k=="constructor"||k=="prototype"||strings.Contains(lower,"password")||strings.Contains(lower,"email")||strings.Contains(lower,"phone")||strings.Contains(lower,"secret")||strings.Contains(lower,"token"){return Fail(400,"account-field","Account fields are not accepted")};if e:=finiteTree(v,depth+1);e!=nil{return e}}
	case []any:if len(x)>2048{return Fail(400,"snapshot-array","Engineering array is too large")};for _,v:=range x{if e:=finiteTree(v,depth+1);e!=nil{return e}}
	case string:if len(x)>16384{return Fail(400,"snapshot-string","Engineering text is too long")}
	case json.Number:if _,ok:=new(big.Rat).SetString(string(x));!ok{return Fail(400,"snapshot-number","Invalid finite engineering number")}
	case nil,bool:default:return Fail(400,"snapshot-type","Unsupported engineering value")};return nil
}
func Equal(a,b any)bool{
	switch x:=a.(type){case map[string]any:y,ok:=b.(map[string]any);if !ok||len(x)!=len(y){return false};for k,v:=range x{q,ok:=y[k];if !ok||!Equal(v,q){return false}};return true
	case []any:y,ok:=b.([]any);if !ok||len(x)!=len(y){return false};for i,v:=range x{if !Equal(v,y[i]){return false}};return true
	case json.Number:y,ok:=b.(json.Number);if !ok{return false};n,ok:=new(big.Rat).SetString(string(x));m,ok2:=new(big.Rat).SetString(string(y));return ok&&ok2&&n.Cmp(m)==0
	default:p,e:=json.Marshal(a);q,e2:=json.Marshal(b);return e==nil&&e2==nil&&bytes.Equal(p,q)}
}
func Diff(before,after string)(Difference,error){
	a,e:=Object(before);if e!=nil{return Difference{},e};b,e:=Object(after);if e!=nil{return Difference{},e}
	out:=Difference{Contract:"ocv.project-diff/2",Changes:[]Change{},Granularity:"RFC 6901 JSON pointers; array order is significant"}
	var record func(string,string,any,any)
	record=func(path,kind string,a,b any){out.Total++;switch kind{case "add":out.Added++;case "remove":out.Removed++;default:out.Changed++};if len(out.Changes)>=256{out.Truncated=true;return};c:=Change{Path:path,Kind:kind};if kind!="add"{c.Before=preview(a)};if kind!="remove"{c.After=preview(b)};out.Changes=append(out.Changes,c)}
	var walk func(string,any,any)
	walk=func(path string,a,b any){if Equal(a,b){return};ma,oka:=a.(map[string]any);mb,okb:=b.(map[string]any);if oka&&okb{keys:=map[string]bool{};for k:=range ma{keys[k]=true};for k:=range mb{keys[k]=true};sorted:=make([]string,0,len(keys));for k:=range keys{sorted=append(sorted,k)};sort.Strings(sorted);for _,k:=range sorted{next:=path+"/"+strings.ReplaceAll(strings.ReplaceAll(k,"~","~0"),"/","~1");v,existsA:=ma[k];w,existsB:=mb[k];if !existsA{record(next,"add",nil,w)}else if !existsB{record(next,"remove",v,nil)}else{walk(next,v,w)}};return};aa,oka:=a.([]any);bb,okb:=b.([]any);if oka&&okb{n:=len(aa);if len(bb)>n{n=len(bb)};for i:=0;i<n;i++{next:=path+"/"+strconv.Itoa(i);if i>=len(aa){record(next,"add",nil,bb[i])}else if i>=len(bb){record(next,"remove",aa[i],nil)}else{walk(next,aa[i],bb[i])}};return};record(path,"replace",a,b)}
	walk("",a,b);return out,nil
}
func preview(v any)json.RawMessage{
	raw,e:=json.Marshal(v);if e!=nil{return json.RawMessage(`null`)};if len(raw)<=512{return raw};small,_:=json.Marshal(map[string]any{"preview":fmt.Sprintf("%s…",string(raw[:160])),"bytes":len(raw),"truncated":true});return small
}

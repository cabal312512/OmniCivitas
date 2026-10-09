package stock9

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	Data "omnicivitas/receipt"
)

func sign(key []byte,text string)[]byte{m:=hmac.New(sha256.New,key);m.Write([]byte(text));return m.Sum(nil)}
func objectConfig()(string,string,string,error){
	endpoint:=os.Getenv("MINIO_ENDPOINT");if endpoint==""{endpoint="http://minio:9000"};u,e:=url.Parse(endpoint)
	access,secret:=os.Getenv("MINIO_ACCESS_KEY"),os.Getenv("MINIO_SECRET_KEY")
	if e!=nil||u.Host==""||(u.Scheme!="http"&&u.Scheme!="https")||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Path!=""&&u.Path!="/"||access==""||secret==""{return "","","",Data.Fail(503,"object-storage","Object storage is unavailable")}
	return strings.TrimRight(endpoint,"/"),access,secret,nil
}
func (a *Common2) object(ctx context.Context,method,key string,data []byte,maximum int)([]byte,error){
	endpoint,access,secret,e:=objectConfig();if e!=nil{return nil,e}
	if len(key)>192||strings.Contains(key,"..")||strings.ContainsAny(key,"\\?#\r\n"){return nil,Data.Fail(400,"object-key","Invalid artifact object key")}
	u,e:=url.Parse(endpoint+"/ocv-sh2"+func()string{if key==""{return ""};return "/"+key}());if e!=nil{return nil,e}
	stamp:=time.Now().UTC();day:=stamp.Format("20060102");timestamp:=stamp.Format("20060102T150405Z");bodyHash:=digest(data)
	scope:=day+"/us-east-1/s3/aws4_request";headers:="host:"+u.Host+"\nx-amz-content-sha256:"+bodyHash+"\nx-amz-date:"+timestamp+"\n"
	canonical:=method+"\n"+u.EscapedPath()+"\n\n"+headers+"\nhost;x-amz-content-sha256;x-amz-date\n"+bodyHash
	kDate:=sign([]byte("AWS4"+secret),day);kRegion:=sign(kDate,"us-east-1");kService:=sign(kRegion,"s3");signature:=hex.EncodeToString(sign(sign(kService,"aws4_request"),"AWS4-HMAC-SHA256\n"+timestamp+"\n"+scope+"\n"+digest([]byte(canonical))))
	request,e:=http.NewRequestWithContext(ctx,method,u.String(),bytes.NewReader(data));if e!=nil{return nil,e}
	request.Header.Set("X-Amz-Date",timestamp);request.Header.Set("X-Amz-Content-Sha256",bodyHash);request.Header.Set("Authorization","AWS4-HMAC-SHA256 Credential="+access+"/"+scope+", SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature="+signature)
	request.Header.Set("Content-Type","application/octet-stream")
	client:=http.Client{Timeout:8*time.Second,CheckRedirect:func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}}
	response,e:=client.Do(request);if e!=nil{return nil,Data.Fail(503,"object-request","Object storage request failed")};defer response.Body.Close()
	if method=="PUT"&&key==""&&(response.StatusCode==409||response.StatusCode==200){io.Copy(io.Discard,io.LimitReader(response.Body,4096));return nil,nil}
	if method=="DELETE"&&(response.StatusCode==200||response.StatusCode==204||response.StatusCode==404){io.Copy(io.Discard,io.LimitReader(response.Body,4096));return nil,nil}
	if response.StatusCode<200||response.StatusCode>=300{return nil,Data.Fail(503,"object-status",fmt.Sprintf("Object storage returned HTTP %d",response.StatusCode))}
	if method!="GET"{io.Copy(io.Discard,io.LimitReader(response.Body,4096));return nil,nil}
	if maximum<1||maximum>Data.MaximumPackage{return nil,Data.Fail(500,"object-limit","Invalid object read bound")}
	if response.ContentLength>int64(maximum){return nil,Data.Fail(503,"object-limit","Stored artifact exceeds its declared size")}
	out,e:=io.ReadAll(io.LimitReader(response.Body,int64(maximum)+1));if e!=nil||len(out)>maximum{return nil,Data.Fail(503,"object-read","Stored artifact exceeds its read bound or is incomplete")};return out,nil
}
func (a *Common2) ensureBucket(ctx context.Context)error{_,e:=a.object(ctx,"PUT","",nil,0);return e}

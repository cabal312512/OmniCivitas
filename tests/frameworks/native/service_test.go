package service_test
import("encoding/json";"net/http";"testing";"time")
func get(t *testing.T,path string)map[string]interface{}{t.Helper();client:=http.Client{Timeout:6*time.Second};r,e:=client.Get("http://fiber:8002"+path);if e!=nil{t.Fatal(e)};defer r.Body.Close();if r.StatusCode!=200{t.Fatalf("HTTP %d",r.StatusCode)};var result map[string]interface{};if e=json.NewDecoder(r.Body).Decode(&result);e!=nil{t.Fatal(e)};return result}
func TestRealFiberTax(t *testing.T){v:=get(t,"/api/button.cgi");if v["canContinue"]!=true||v["tax"]!=float64(1)||v["service"]!="Go Fiber"{t.Fatalf("unexpected receipt: %v",v)}}
func TestRealFiberHealth(t *testing.T){if get(t,"/health")["canContinue"]!=true{t.Fatal("service is not ready")}}

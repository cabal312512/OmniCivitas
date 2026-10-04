package main
import("net/http";"os";"time")
func main(){if len(os.Args)!=2{os.Exit(2)};c:=http.Client{Timeout:2*time.Second};r,e:=c.Get(os.Args[1]);if e!=nil{os.Exit(1)};defer r.Body.Close();if r.StatusCode<200||r.StatusCode>=400{os.Exit(1)}}

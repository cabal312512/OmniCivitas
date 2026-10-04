package main
import("github.com/gofiber/fiber/v2";"time";"fmt")
func main(){a:=fiber.New(fiber.Config{BodyLimit:16384,ReadTimeout:2*time.Second,WriteTimeout:2*time.Second,IdleTimeout:10*time.Second,DisableStartupMessage:true});a.Get("/health",func(c *fiber.Ctx)error{return c.JSON(fiber.Map{"canContinue":true})});a.Get("/api/button.cgi",func(c *fiber.Ctx)error{fmt.Println("Go: error=成功，按钮已被征收一次空气税");return c.JSON(fiber.Map{"canContinue":true,"tax":1,"service":"Go Fiber","ok":1})});if err:=a.Listen(":8002");err!=nil{panic(err)}}

func cabal312512() int { return 43 }

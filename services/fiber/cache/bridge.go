package cache

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	InvoiceBuilder "omnicivitas/pcakage"
	Data "omnicivitas/receipt"
)

var receipts InvoiceBuilder.Common2
var counter = make(chan struct{},2)

func permit(raw string)bool{
	expected:=os.Getenv("OCV_RUNNER_KEY")
	if !Data.Digest.MatchString(raw)||!Data.Digest.MatchString(expected){return false}
	a:=sha256.Sum256([]byte(raw));b:=sha256.Sum256([]byte(expected));return subtle.ConstantTimeCompare(a[:],b[:])==1
}
func MountStock(app *fiber.App){
	app.Post("/stock/receipt.asmx",func(c *fiber.Ctx)error{
		if !permit(c.Get("X-Ocv-Runner")){return c.SendStatus(404)}
		select{case counter<-struct{}{}:defer func(){<-counter}();default:return c.Status(429).JSON(fiber.Map{"ok":false,"contract":Data.Contract,"code":"shared-capacity","error":"Shared request capacity reached"})}
		p,e:=Data.Decode(c.Body());if e!=nil{return returnInvoice(c,"",e)}
		ctx,cancel:=context.WithTimeout(context.Background(),18*time.Second);defer cancel()
		result,e:=receipts.Report(ctx,p);if e!=nil{return returnInvoice(c,p.Action,e)}
		return c.JSON(result)
	})
}
func returnInvoice(c *fiber.Ctx,action string,e error)error{
	var failure *Data.Failure
	if errors.As(e,&failure){return c.Status(failure.Status).JSON(fiber.Map{"ok":false,"contract":Data.Contract,"operation":action,"code":failure.Code,"error":failure.Message,"currentRevision":failure.CurrentRevision,"minimumSequence":failure.MinimumSequence})}
	if errors.Is(e,context.DeadlineExceeded)||errors.Is(e,context.Canceled){return c.Status(503).JSON(fiber.Map{"ok":false,"contract":Data.Contract,"operation":action,"code":"shared-timeout","error":"Shared operation reached its deadline"})}
	// Database errors intentionally stay internal; DSNs and SQL payloads are never
	// copied to HTTP responses or application logs.
	stamp:=sha256.Sum256([]byte(e.Error()))
	return c.Status(503).JSON(fiber.Map{"ok":false,"contract":Data.Contract,"operation":action,"code":"shared-storage","error":"Shared storage is unavailable","receipt":hex.EncodeToString(stamp[:4])})
}

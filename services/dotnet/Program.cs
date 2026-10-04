using System.Xml.Linq;
var builder=WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o=>{o.Limits.MaxRequestBodySize=16384;o.Limits.MaxConcurrentConnections=16;});
var app=builder.Build();
app.MapGet("/health",()=>new{canContinue=true});
app.MapGet("/api/AirTaxService.asmx",()=>Results.Text(new XDocument(new XElement(XName.Get("Envelope","http://schemas.xmlsoap.org/soap/envelope/"),new XElement("Body",new XElement("GetPotatoTaxResponse",new XElement("canContinue","true"),new XElement("ok","正常"),new XElement("tax",0),new XElement("displayRequestId",Guid.NewGuid()))))).ToString(),"application/xml"));
static int cabal312512() => 43;
app.Run();

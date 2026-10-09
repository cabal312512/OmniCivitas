using System.Text.Json;
using System.Xml.Linq;
using OmniCivitas.Mechanical;

var checks=0;
void Check(bool ok,string name) { if(!ok)throw new InvalidOperationException(name);checks++; }
var templates=new Dictionary<string,WorkshopProject>();
foreach(var id in new[]{"delivery","steady","routing","crossing","control-chain"})
{
    var project=WorkshopDomain.Template(id);templates[id]=project;
    Check(WorkshopDomain.Inspect(project).Ok,"Bounded template "+id);
    var drawing=XDocument.Parse(WorkshopDomain.Svg(project));
    var metadata=JsonDocument.Parse(drawing.Root!.Element(XName.Get("metadata","http://www.w3.org/2000/svg"))!.Value);
    Check(metadata.RootElement.GetProperty("domain").GetString()==WorkshopDomain.Version,"SVG domain "+id);
    Check(metadata.RootElement.GetProperty("dimension").GetInt32()==2,"Planar SVG "+id);
}
var cyclic=WorkshopJson.Copy(templates["control-chain"]);
cyclic.World.Controls[0].Kind="logic";cyclic.World.Controls[0].Inputs=["interlock"];
Check(!WorkshopDomain.Inspect(cyclic).Ok,"Forward logic input rejected");
var duplicate=WorkshopJson.Copy(templates["routing"]);
duplicate.Challenge!.Targets[1].Body=duplicate.Challenge.Targets[0].Body;
Check(!WorkshopDomain.Inspect(duplicate).Ok,"Duplicate routing destination rejected");
var failedBudget=WorkshopJson.Copy(templates["crossing"]);
failedBudget.World.Bodies.Add(new() {Id="extra",Kind="ball",X=-5,Y=5});
var budgetReceipt=WorkshopDomain.Inspect(failedBudget);
Check(budgetReceipt.Ok&&budgetReceipt.Diagnostics.Any(d=>d.Code=="PART_BUDGET"&&d.Severity=="info"),"Budget exceeds challenge but does not invent numerical failure");
var signal=WorkshopJson.Copy(templates["control-chain"]);
signal.World.Controls[0].Motor="not-existing";
Check(!WorkshopDomain.Inspect(signal).Ok,"Signal with supplied unknown motor rejected");
var startInside=WorkshopJson.Copy(templates["crossing"]);
startInside.World.Bodies.First(b=>b.Id==startInside.Challenge!.Body).X=startInside.Challenge!.TargetX;
Check(!WorkshopDomain.Inspect(startInside).Ok,"Crossing starts across actual gap");
if(args.Length==2&&args[0]=="--fixtures")
{
    var output=Path.GetFullPath(args[1]);Directory.CreateDirectory(output);
    foreach(var pair in templates)File.WriteAllText(Path.Combine(output,pair.Key+".json"),WorkshopJson.Write(pair.Value));
}
Console.WriteLine(WorkshopJson.Write(new {ok=true,checks,domain=WorkshopDomain.Version,templates=templates.Keys}));

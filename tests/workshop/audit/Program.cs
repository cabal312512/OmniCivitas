using System.Text.Json.Nodes;
using OmniCivitas.Workshop;

if (args.Length == 0) throw new ArgumentException("Provide an existing actual workshop replay JSON file.");
var text = File.ReadAllText(args[0]); var accepted = WorkshopReplayCheck.Read(text); var checks = 1;
void Reject(string name, Action<JsonObject> mutate)
{
    var data = JsonNode.Parse(text)!.AsObject(); mutate(data);
    try { WorkshopReplayCheck.Read(data.ToJsonString()); }
    catch (Exception exception) when (exception is ArgumentException or System.Text.Json.JsonException or InvalidOperationException)
    { checks++; return; }
    throw new Exception("Accepted invalid replay: " + name);
}
Reject("project/request mass mismatch", data => data["project"]!["world"]!["bodies"]![0]!["mass"] = 7.125);
Reject("request/project gravity mismatch", data => data["request"]!["world"]!["gravityY"] = 13.25);
Reject("matching relabelled initial geometry", data => {
    data["project"]!["world"]!["bodies"]![0]!["x"] = 17.125;
    data["request"]!["world"]!["bodies"]![0]!["x"] = 17.125;
});
Reject("wrong units", data => data["units"] = "cm");
Reject("wrong model units", data => data["result"]!["model"]!["units"]!["length"] = "cm");
Reject("wrong frame identity", data => data["result"]!["frames"]![0]!["bodies"]![0]!["id"] = "absent-body");
Reject("wrong source seed", data => data["result"]!["summary"]!["seed"] = 123456789);
Reject("wrong sampling interval", data => data["result"]!["summary"]!["stepS"] = .01);
Reject("unsupported replay schema", data => data["schema"] = "ocv.workshop-replay/9");
Reject("missing request", data => data.Remove("request"));
Reject("missing velocity", data => data["result"]!["frames"]![0]!["bodies"]![0]!.AsObject().Remove("vx"));
Reject("oversized retained frames", data => {
    var frames = data["result"]!["frames"]!.AsArray(); var first = frames[0]!.DeepClone();
    while (frames.Count <= 256) frames.Add(first.DeepClone());
});
var legacy = JsonNode.Parse(text)!.AsObject(); legacy["result"]!["version"] = "ocv-mechanics-1.1.0+rapier-0.22.0.rod-radial-1.control-dag-1";
if (legacy.ContainsKey("engine")) legacy["engine"] = legacy["result"]!["version"]!.GetValue<string>();
WorkshopReplayCheck.Read(legacy.ToJsonString()); checks++;
var latest = JsonNode.Parse(text)!.AsObject(); latest["result"]!["version"] = "ocv-mechanics-1.1.1+rapier-0.22.0.rod-radial-1.control-dag-1.initial-speed-1";
if (latest.ContainsKey("engine")) latest["engine"] = latest["result"]!["version"]!.GetValue<string>();
WorkshopReplayCheck.Read(latest.ToJsonString()); checks++;
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { ok = true, checks, bodyCount = accepted.Project.World.Bodies.Count, scope = "Actual existing recorded replay plus malformed-envelope mutations; no simulation or native certification." }));

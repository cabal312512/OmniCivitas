using System.Text;
using System.Text.Json;
using OmniCivitas.Mechanical;

namespace OmniCivitas.Workshop;

public sealed record WorkshopRecordedReplay(WorkshopProject Project, WorkshopRun Request, JsonElement Result);

public static class WorkshopReplayCheck
{
    public static WorkshopRecordedReplay Read(string json)
    {
        if (Encoding.UTF8.GetByteCount(json) > 5 * 1024 * 1024) throw new ArgumentException("回放文件超过大小上限。");
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 32 });
        var root = document.RootElement;
        Require(Text(root, "schema") == "ocv.workshop-replay/1" && Text(root, "units") == "SI", "回放格式或单位无效。");
        var projectJson = Object(root, "project"); var requestJson = Object(root, "request"); var result = Object(root, "result");
        Require(Encoding.UTF8.GetByteCount(projectJson.GetRawText()) <= 131072 && Encoding.UTF8.GetByteCount(requestJson.GetRawText()) <= 131072 && Encoding.UTF8.GetByteCount(result.GetRawText()) <= 4194304, "回放工程或结果超过大小上限。");
        var project = WorkshopJson.Read<WorkshopProject>(projectJson.GetRawText());
        var request = WorkshopJson.Read<WorkshopRun>(requestJson.GetRawText());
        Require(WorkshopDomain.Inspect(project).Ok && request.Schema == "ocv.workshop-run/1" && request.Op == "simulate" && request.Scan is null, "回放工程或运行请求无效。");
        Require(WorkshopJson.Write(project.World) == WorkshopJson.Write(request.World) && WorkshopJson.Write(project.Challenge) == WorkshopJson.Write(request.Challenge), "回放工程与运行请求不一致。");
        var version = Text(result, "version");
        Require(Text(result, "schema") == "ocv.workshop-result/1" && Flag(result, "ok") && Text(result, "engine") == "ME1 / Rapier 2D" && System.Text.RegularExpressions.Regex.IsMatch(version, @"^ocv-mechanics-1\.\d+\.\d+\+"), "回放引擎或结果格式无效。");
        if (root.TryGetProperty("engine", out _)) Require(Text(root, "engine") == version, "回放引擎标识不一致。");
        var model = Object(result, "model"); var units = Object(model, "units");
        Require(Integer(model, "dimension") == 2 && Text(units, "length") == "m" && Text(units, "mass") == "kg" && Text(units, "time") == "s" && Text(units, "angle") == "rad" && Text(units, "torque") == "N m", "回放物理模型或单位无效。");
        var timing = WorkshopDomain.TimePlan(request.World); var summary = Object(result, "summary"); var frames = Array(result, "frames", 1, 256);
        Require(Flag(summary, "complete") && Integer(summary, "steps") == timing.Steps && Integer(summary, "sampleEvery") == timing.SampleEvery && Integer(summary, "frameCount") == frames.GetArrayLength() && frames.GetArrayLength() == timing.Frames && Close(Number(summary, "stepS"), (double)(float)request.World.StepS) && Close(Number(summary, "durationS"), timing.EndS), "回放采样计划不一致。");
        Require(summary.TryGetProperty("seed", out var seed) && seed.ValueKind == JsonValueKind.Number && seed.TryGetUInt32(out var actualSeed) && actualSeed == request.World.Seed, "回放种子不一致。");
        Require(Text(summary, "inputChecksum").StartsWith("fnv1a32:", StringComparison.Ordinal) && Text(summary, "inputChecksum").Length == 16, "回放缺少运行输入标识。");
        foreach (var field in new[] { "initialEnergyJ", "finalEnergyJ", "maxSpeed", "collisions", "eventCount" }) Number(summary, field);
        var bodies = request.World.Bodies.ToDictionary(body => body.Id, StringComparer.Ordinal); var frameIndex = 0;
        foreach (var frame in frames.EnumerateArray())
        {
            var expectedStep = Math.Min(frameIndex * timing.SampleEvery, timing.Steps);
            Require(Close(Number(frame, "t"), (double)((float)expectedStep * (float)request.World.StepS)), "回放时间与采样计划不一致。");
            var poses = Array(frame, "bodies", bodies.Count, bodies.Count); var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var pose in poses.EnumerateArray())
            {
                var id = Text(pose, "id"); Require(bodies.TryGetValue(id, out var source) && seen.Add(id), "回放零件标识无效或重复。");
                var x = Number(pose, "x"); var y = Number(pose, "y"); var angle = Number(pose, "angle");
                var vx = Number(pose, "vx"); var vy = Number(pose, "vy"); var omega = Number(pose, "omega");
                Require(Math.Sqrt(x * x + y * y) <= 10000.01 && Math.Sqrt(vx * vx + vy * vy) <= 10000.01 && Math.Abs(omega) <= 10000.01 && Math.Abs(angle) <= Math.PI + .0001, "回放状态超过有限范围。");
                if (frameIndex == 0)
                    Require(Close(x, (double)(float)source!.X) && Close(y, (double)(float)source.Y) && Close(vx, (double)(float)source.Vx) && Close(vy, (double)(float)source.Vy) && Close(omega, (double)(float)source.Omega) && Math.Abs(Math.IEEERemainder(angle - (float)source.Angle, 2 * Math.PI)) <= .0002, "回放初始状态与运行请求不一致。");
            }
            if (frame.TryGetProperty("events", out _)) Array(frame, "events", 0, 64);
            frameIndex++;
        }
        if (result.TryGetProperty("keyMoments", out _))
            foreach (var moment in Array(result, "keyMoments", 0, 128).EnumerateArray())
            {
                var time = Number(moment, "t"); Require(time >= 0 && time <= timing.EndS + timing.ToleranceS, "回放事件时间超出范围。");
                foreach (var field in new[] { "kind", "id", "a", "b", "motor", "action" }) if (moment.TryGetProperty(field, out _)) Text(moment, field);
            }
        return new(project, request, result.Clone());
    }

    private static void Require(bool valid, string message) { if (!valid) throw new ArgumentException(message); }
    private static JsonElement Object(JsonElement root, string key)
    { Require(root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Object, "回放缺少有效对象：" + key); return root.GetProperty(key); }
    private static JsonElement Array(JsonElement root, string key, int min, int max)
    { Require(root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Array && value.GetArrayLength() >= min && value.GetArrayLength() <= max, "回放数组数量无效：" + key); return root.GetProperty(key); }
    private static string Text(JsonElement root, string key)
    { Require(root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String && value.GetString()!.Length <= 1024, "回放文字字段无效：" + key); return root.GetProperty(key).GetString()!; }
    private static double Number(JsonElement root, string key)
    { Require(root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number), "回放数值无效：" + key); return root.GetProperty(key).GetDouble(); }
    private static int Integer(JsonElement root, string key)
    { Require(root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out _), "回放整数无效：" + key); return root.GetProperty(key).GetInt32(); }
    private static bool Flag(JsonElement root, string key) => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.True;
    private static bool Close(double actual, double expected) => double.IsFinite(actual) && double.IsFinite(expected) && Math.Abs(actual - expected) <= 1e-6 * Math.Max(1, Math.Abs(expected));
}

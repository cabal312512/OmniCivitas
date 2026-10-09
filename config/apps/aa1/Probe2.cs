using System.Globalization;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using OmniCivitas.Mechanical;

namespace OmniCivitas.Workshop;

public partial class App
{
    private const int ProbeBodyLimit = 8;
    private const int ProbeMetricLimit = 24;
    private const int ProbeTotalMetricLimit = ProbeBodyLimit * ProbeMetricLimit;
    private readonly Dictionary<string, HashSet<string>> ProbeConfiguration = new(StringComparer.Ordinal);
    private readonly Dictionary<string, bool> ProbeVectorVisibility = new(StringComparer.Ordinal);
    private WorkshopProject? ProbeProjectIdentity;
    private bool ProbeDefaultsResolved;
    private double ProbeCanvasWidth = 1100;
    private double ProbeScale => ViewWidth / ProbeCanvasWidth;
    private bool ProbeLocked => CanvasLocked;
    private int ProbeTrackedBodies { get { SyncProbes(); return ProbeConfiguration.Count; } }
    private int ProbeTrackedMetrics { get { SyncProbes(); return ProbeConfiguration.Values.Sum(keys => keys.Count); } }
    private string ProbeCapacityText => $"{ProbeTrackedBodies}/{ProbeBodyLimit} 个零件 · {ProbeTrackedMetrics}/{ProbeTotalMetricLimit} 项（每件最多 {ProbeMetricLimit} 项）";
    private static readonly ProbeChoice[] ProbeCatalogue =
    [
        new("x", "水平位置", "m"), new("y", "垂直位置", "m"),
        new("vx", "水平速度", "m/s", Colour: "#2479ed"), new("vy", "垂直速度", "m/s", Colour: "#2479ed"),
        new("speed", "速度", "m/s", Colour: "#2479ed"),
        new("ax", "水平加速度", "m/s²", Colour: "#d6751e"), new("ay", "垂直加速度", "m/s²", Colour: "#d6751e"),
        new("acceleration", "加速度", "m/s²", Colour: "#d6751e"),
        new("px", "水平动量", "kg·m/s", Colour: "#8755be"), new("py", "垂直动量", "kg·m/s", Colour: "#8755be"),
        new("momentum", "动量", "kg·m/s", Colour: "#8755be"),
        new("linearKinetic", "平动动能", "J"), new("rotationalKinetic", "转动动能", "J"),
        new("potential", "重力势能", "J"), new("totalEnergy", "机械能", "J"),
        new("angle", "角度", "°"), new("omega", "角速度", "rad/s", Colour: "#168d91"),
        new("rpm", "转速", "r/min", Colour: "#168d91"), new("alpha", "角加速度", "rad/s²"),
        new("angularMomentum", "角动量", "kg·m²/s")
    ];
    private static readonly Dictionary<string, ProbeDefault[]> ProbeExampleDefaults = new(StringComparer.Ordinal)
    {
        ["gearbox"] = [new("gear0", ["omega", "rpm", "rotationalKinetic"]), new("gear3", ["omega", "rpm", "rotationalKinetic"])],
        ["timing-belt"] = [new("pulley0", ["omega", "rpm", "rotationalKinetic"]), new("pulley2", ["omega", "rpm", "rotationalKinetic"])],
        ["domino-line"] = [new("pusher", ["speed", "ax", "ay", "linearKinetic"]), new("tile0", ["angle", "omega", "rotationalKinetic"], false), new("tile13", ["angle", "omega", "rotationalKinetic"], false)],
        ["marble-relay"] = [new("marble", ["speed", "ax", "ay", "linearKinetic"])],
        ["pendulum-bank"] = [new("bob0", ["linearKinetic", "potential", "totalEnergy", "acceleration"]), new("bob5", ["linearKinetic", "potential", "totalEnergy", "acceleration"])],
        ["tuned-damping"] = [new("cart0", ["x", "vx", "ax", "linearKinetic"]), new("cart1", ["x", "vx", "ax", "linearKinetic"]), new("cart2", ["x", "vx", "ax", "linearKinetic"])],
        ["crank-slider"] = [new("crank", ["omega", "rpm", "rotationalKinetic"]), new("piston", ["x", "speed", "linearKinetic"]), new("meter", ["omega", "rpm", "rotationalKinetic"], false)],
        ["basketball"] = [new("ball", ["speed", "ax", "ay", "linearKinetic"]), new("score", ["omega", "rpm", "rotationalKinetic"], false)],
        ["compound-lift"] = [new("shaft0", ["omega", "rpm", "rotationalKinetic"]), new("lift0", ["y", "vy", "potential", "linearKinetic"]), new("lift3", ["y", "vy", "potential", "linearKinetic"])],
        ["switchback-sorter"] = [new("gate", ["angle", "omega", "rotationalKinetic"]), new("large0", ["speed", "linearKinetic", "potential", "totalEnergy"]), new("small0", ["speed", "linearKinetic", "potential", "totalEnergy"])],
        ["parallel-transfer"] = [new("inputShaft", ["omega", "rpm", "rotationalKinetic"]), new("tray0", ["x", "y", "angle", "speed"]), new("tray1", ["x", "y", "angle", "speed"])],
        ["isolated-conveyor"] = [new("inputShaft", ["omega", "rpm", "rotationalKinetic"]), new("bed", ["y", "vy", "linearKinetic"]), new("parcel0", ["x", "speed", "linearKinetic"])],
        ["split-logic"] = [new("small", ["speed", "linearKinetic"]),new("large", ["speed", "linearKinetic"]),new("lamp", ["omega", "rpm"],false)],
        ["limited-crossing"] = [new("jumper", ["speed", "vx", "vy", "acceleration"])],
        ["count-interlock"] = [new("small", ["speed", "linearKinetic"]),new("lamp", ["omega", "rpm"],false)]
    };

    private void SyncProbes()
    {
        if (!ReferenceEquals(ProbeProjectIdentity, Project))
        {
            ProbeConfiguration.Clear();
            ProbeVectorVisibility.Clear();
            ProbeProjectIdentity = Project;
            ProbeDefaultsResolved = false;
        }
        if (!ProbeDefaultsResolved) ResolveProbeDefaults();
        foreach (var id in ProbeConfiguration.Keys.ToArray())
        {
            var body = Project.World.Bodies.FirstOrDefault(candidate => candidate.Id == id);
            if (body is null) { ProbeConfiguration.Remove(id); ProbeVectorVisibility.Remove(id); continue; }
            ProbeConfiguration[id].RemoveWhere(key => !ProbeAvailable(body, key));
            if (ProbeConfiguration[id].Count == 0) { ProbeConfiguration.Remove(id); ProbeVectorVisibility.Remove(id); }
        }
    }

    private void ResolveProbeDefaults()
    {
        if (CurrentExample is { } example)
        {
            ProbeDefaultsResolved = true;
            if (ProbeExampleDefaults.TryGetValue(example.Id, out var presets)) ApplyProbeDefaults(presets);
            else ApplyProbeDefaults(SuggestProbeDefaults());
            return;
        }
        if (SelectedExampleId.Length == 0 && Project.Name == "弹珠与转盘" &&
            Project.World.Bodies.Any(body => body.Id == "marble" && body.Kind == "ball" && body.Mode == "dynamic") &&
            Project.World.Bodies.Any(body => body.Id == "wheel" && body.Kind == "wheel" && body.Mode == "dynamic"))
        {
            ProbeDefaultsResolved = true;
            ApplyProbeDefaults([new("wheel", ["omega", "rpm", "rotationalKinetic"]), new("marble", ["speed", "linearKinetic", "potential", "totalEnergy"])]);
            return;
        }
        // A known selection may precede the asynchronous catalogue read; wait for its names.
        if (SelectedExampleId.Length == 0 || Examples.Count > 0) ProbeDefaultsResolved = true;
    }

    private IEnumerable<ProbeDefault> SuggestProbeDefaults()
    {
        var bodies = Project.World.Bodies.Where(body => body.Mode == "dynamic").ToArray();
        var motorIds = Project.World.Motors.Select(motor => motor.Body).ToHashSet(StringComparer.Ordinal);
        var candidates = bodies.OrderByDescending(body => motorIds.Contains(body.Id))
            .ThenByDescending(body => body.Kind is "ball" or "slider").Take(3);
        foreach (var body in candidates)
        {
            if (motorIds.Contains(body.Id) || body.Kind is "wheel" or "gear" or "pulley")
                yield return new(body.Id, ["omega", "rpm", "rotationalKinetic"]);
            else if (body.Kind == "ball") yield return new(body.Id, ["speed", "linearKinetic", "potential", "totalEnergy"]);
            else yield return new(body.Id, ["x", "speed", "linearKinetic"]);
        }
    }

    private void ApplyProbeDefaults(IEnumerable<ProbeDefault> defaults)
    {
        foreach (var preset in defaults.Take(3))
        {
            var body = Project.World.Bodies.FirstOrDefault(candidate => candidate.Id == preset.BodyId && candidate.Mode == "dynamic");
            if (body is null || ProbeConfiguration.ContainsKey(body.Id)) continue;
            var keys = preset.Keys.Where(key => ProbeAvailable(body, key)).Take(4).ToHashSet(StringComparer.Ordinal);
            if (keys.Count < 2) continue;
            ProbeConfiguration[body.Id] = keys;
            ProbeVectorVisibility[body.Id] = preset.Vectors;
        }
    }

    /// <summary>Restores this loaded example's initial measurements when paused; custom projects remain empty.</summary>
    [JSInvokable]
    public Task ResetExampleProbes()
    {
        if (Disposed || ProbeLocked) return Task.CompletedTask;
        ProbeConfiguration.Clear();
        ProbeVectorVisibility.Clear();
        ProbeProjectIdentity = Project;
        ProbeDefaultsResolved = false;
        SyncProbes();
        return InvokeAsync(StateHasChanged);
    }

    private static bool ProbeAvailable(MechanicalBody body, string key) =>
        ProbeCatalogue.Any(choice => choice.Key == key) && WorkshopDomain.BodyKinds.Contains(body.Kind) &&
        (body.Mode == "dynamic" || body.Mode == "fixed" && (key is "x" or "y" or "angle"));

    private IReadOnlyList<ProbeChoice> ProbeChoices(MechanicalBody body) =>
        Array.AsReadOnly(ProbeCatalogue.Select(choice => choice with
        {
            Available = ProbeAvailable(body, choice.Key),
            Reason = ProbeAvailable(body, choice.Key) ? "" : body.Mode == "fixed" ? "固定零件仅测量位置和角度" : "此零件类型不支持测量"
        }).ToArray());

    private bool ProbeChecked(string bodyId, string key)
    {
        SyncProbes();
        return ProbeConfiguration.TryGetValue(bodyId, out var keys) && keys.Contains(key);
    }

    private bool ProbeChoiceDisabled(MechanicalBody body, string key)
    {
        SyncProbes();
        if (ProbeLocked || !ProbeAvailable(body, key)) return true;
        if (ProbeConfiguration.TryGetValue(body.Id, out var keys) && keys.Contains(key)) return false;
        return keys is not null && keys.Count >= ProbeMetricLimit || ProbeConfiguration.Values.Sum(selected => selected.Count) >= ProbeTotalMetricLimit ||
            !ProbeConfiguration.ContainsKey(body.Id) && ProbeConfiguration.Count >= ProbeBodyLimit;
    }

    private void SetProbeMetric(string bodyId, string key, ChangeEventArgs change)
    {
        if (change.Value is bool enabled) SetProbeMetric(bodyId, key, enabled);
        else if (bool.TryParse(change.Value?.ToString(), out var parsed)) SetProbeMetric(bodyId, key, parsed);
    }

    private void SetProbeMetric(string bodyId, string key, bool enabled)
    {
        SyncProbes();
        if (ProbeLocked || bodyId.Length is < 1 or > 32 || !ProbeCatalogue.Any(choice => choice.Key == key)) return;
        ProbeDefaultsResolved = true;
        var body = Project.World.Bodies.FirstOrDefault(candidate => candidate.Id == bodyId);
        if (body is null) return;
        var next = ProbeConfiguration.TryGetValue(bodyId, out var previous)
            ? new HashSet<string>(previous, StringComparer.Ordinal) : new HashSet<string>(StringComparer.Ordinal);
        if (!enabled)
        {
            next.Remove(key);
            if (next.Count == 0) { ProbeConfiguration.Remove(bodyId); ProbeVectorVisibility.Remove(bodyId); }
            else ProbeConfiguration[bodyId] = next;
            return;
        }
        if (!ProbeAvailable(body, key) || next.Contains(key)) return;
        if (next.Count >= ProbeMetricLimit || ProbeConfiguration.Values.Sum(keys => keys.Count) >= ProbeTotalMetricLimit ||
            !ProbeConfiguration.ContainsKey(bodyId) && ProbeConfiguration.Count >= ProbeBodyLimit)
        {
            Status = $"测量上限为 {ProbeBodyLimit} 个零件，每件 {ProbeMetricLimit} 项，合计 {ProbeTotalMetricLimit} 项。";
            return;
        }
        next.Add(key);
        ProbeConfiguration[bodyId] = next;
    }

    private void ClearProbe(string bodyId)
    {
        SyncProbes();
        if (!ProbeLocked) { ProbeDefaultsResolved = true; ProbeConfiguration.Remove(bodyId); ProbeVectorVisibility.Remove(bodyId); }
    }

    private bool ProbeVectorsEnabled(string bodyId)
    {
        SyncProbes();
        return !ProbeVectorVisibility.TryGetValue(bodyId, out var enabled) || enabled;
    }

    private void SetProbeVectors(string bodyId, ChangeEventArgs change)
    {
        SyncProbes();
        if (ProbeLocked || !ProbeConfiguration.ContainsKey(bodyId)) return;
        if (change.Value is bool enabled) ProbeVectorVisibility[bodyId] = enabled;
        else if (bool.TryParse(change.Value?.ToString(), out var parsed)) ProbeVectorVisibility[bodyId] = parsed;
    }

    [JSInvokable]
    public Task UpdateCanvasWidth(double width)
    {
        if (Disposed || !double.IsFinite(width) || width is < 64 or > 16384 || Math.Abs(width - ProbeCanvasWidth) < .5)
            return Task.CompletedTask;
        ProbeCanvasWidth = width;
        return InvokeAsync(StateHasChanged);
    }

    private ProbeDifferential? ProbeDerivative(string bodyId)
    {
        if (Frames.Count < 2) return null;
        var index = Math.Clamp(FrameIndex, 0, Frames.Count - 1);
        RunFrame? before = null, after = null;
        RunPose? first = null, second = null;
        // Paused interior samples use their actual adjacent samples; endpoints are one-sided.
        var firstIndex = Playing && SmoothPlayback ? index : index > 0 ? index - 1 : index;
        var secondIndex = Playing && SmoothPlayback ? index + 1 : index + 1 < Frames.Count ? index + 1 : index;
        for (var i = firstIndex; i >= 0; i--)
        {
            var pose = Frames[i].Bodies.FirstOrDefault(candidate => candidate.Id == bodyId);
            if (pose is not null) { before = Frames[i]; first = pose; break; }
        }
        for (var i = Math.Min(secondIndex, Frames.Count - 1); i < Frames.Count; i++)
        {
            var pose = Frames[i].Bodies.FirstOrDefault(candidate => candidate.Id == bodyId);
            if (pose is not null) { after = Frames[i]; second = pose; break; }
        }
        if (before is null || after is null || first is null || second is null) return null;
        return WorkshopProbeMath.Difference(before.T, first.Vx, first.Vy, first.Omega, after.T, second.Vx, second.Vy, second.Omega);
    }

    private IReadOnlyList<ProbePanel> ComputeProbePanels()
    {
        SyncProbes();
        var panels = new List<ProbePanel>(ProbeConfiguration.Count);
        var world = Frames.Count > 0 ? DisplayedRequest?.World ?? DisplayedProject?.World ?? Project.World : Project.World;
        foreach (var body in Project.World.Bodies.Where(candidate => ProbeConfiguration.ContainsKey(candidate.Id)))
        {
            var keys = ProbeConfiguration[body.Id];
            var source = world.Bodies.FirstOrDefault(candidate => candidate.Id == body.Id) ?? body;
            var pose = Pose(body.Id);
            var differential = ProbeDerivative(body.Id);
            var numbers = WorkshopProbeMath.Measure(source.Mass, WorkshopProbeMath.Inertia(source), pose.X, pose.Y, pose.Vx, pose.Vy, pose.Omega, world.GravityX, world.GravityY);
            var rows = new List<ProbeRow>(keys.Count);
            foreach (var choice in ProbeCatalogue.Where(option => keys.Contains(option.Key)))
            {
                double? value = choice.Key switch
                {
                    "x" => pose.X, "y" => pose.Y, "vx" => pose.Vx, "vy" => pose.Vy, "speed" => numbers.Speed,
                    "ax" => differential?.Ax, "ay" => differential?.Ay, "acceleration" => differential?.Acceleration,
                    "px" => numbers.Px, "py" => numbers.Py, "momentum" => numbers.Momentum,
                    "linearKinetic" => numbers.LinearKinetic, "rotationalKinetic" => numbers.RotationalKinetic,
                    "potential" => numbers.Potential, "totalEnergy" => numbers.TotalEnergy,
                    "angle" => pose.Angle * 180 / Math.PI, "omega" => pose.Omega, "rpm" => pose.Omega * 30 / Math.PI,
                    "alpha" => differential?.Alpha, "angularMomentum" => numbers.AngularMomentum, _ => null
                };
                rows.Add(new(choice.Key, choice.Label, ProbeNumber(value), choice.Unit, choice.Colour));
            }
            var centreX = SX(pose.X); var centreY = SY(pose.Y); var scale = ProbeScale;
            var width = Math.Min(208 * scale, Math.Max(scale, ViewWidth - 16 * scale));
            var height = Math.Min((52 + rows.Count * 20) * scale, Math.Max(scale, ViewHeight - 16 * scale));
            var pad = Math.Min(8 * scale, Math.Min(ViewWidth, ViewHeight) / 4);
            var radial = body.Kind is "ball" or "wheel" or "gear" or "pulley";
            var offset = (radial ? body.Radius * 55 : Math.Max(body.Width, body.Height) * 27.5) + 16 * scale;
            var x = centreX + offset;
            if (x + width > ViewX + ViewWidth - pad) x = centreX - offset - width;
            x = Math.Clamp(x, ViewX + pad, Math.Max(ViewX + pad, ViewX + ViewWidth - width - pad));
            var y = Math.Clamp(centreY - height / 2, ViewY + pad, Math.Max(ViewY + pad, ViewY + ViewHeight - height - pad));
            var vectors = new List<ProbeVector>(6);
            if (ProbeVectorsEnabled(body.Id))
            {
                AddProbeFamily(vectors, keys, "speed", "vx", "vy", "速度", "#2479ed", centreX, centreY, pose.Vx, pose.Vy, "m/s", 4, scale);
                if (differential is { } derivative)
                    AddProbeFamily(vectors, keys, "acceleration", "ax", "ay", "加速度", "#d6751e", centreX, centreY, derivative.Ax, derivative.Ay, "m/s²", 12, scale);
                AddProbeFamily(vectors, keys, "momentum", "px", "py", "动量", "#8755be", centreX, centreY, numbers.Px, numbers.Py, "kg·m/s", 10, scale);
                if (keys.Overlaps(["omega", "rpm"]) && vectors.Count < 6) vectors.Add(ProbeRotation(centreX, centreY, pose.Omega, scale));
            }
            panels.Add(new(body.Id, BodyName(body), x, y, width, height, scale, centreX, centreY, CurrentTime,
                Frames.Count == 0 ? "初始状态" : differential is null ? "缺少差分帧" : "真实帧差分", ProbeLocked,
                Array.AsReadOnly(rows.ToArray()), Array.AsReadOnly(vectors.ToArray())));
        }
        return panels.AsReadOnly();
    }

    private static string ProbeNumber(double? value) => value is { } number && double.IsFinite(number)
        ? (number == 0 ? 0 : number).ToString(Math.Abs(number) >= 100000 || Math.Abs(number) is > 0 and < .0001 ? "0.###E+0" : "0.###", CultureInfo.InvariantCulture)
        : "—";

    private static void AddProbeFamily(List<ProbeVector> vectors, HashSet<string> keys, string magnitudeKey, string xKey, string yKey,
        string label, string colour, double x, double y, double vx, double vy, string unit, double reference, double scale)
    {
        if (keys.Contains(magnitudeKey)) vectors.Add(ProbeArrow(magnitudeKey, label, colour, x, y, vx, vy, unit, reference, scale));
        else
        {
            if (keys.Contains(xKey)) vectors.Add(ProbeArrow(xKey, "水平" + label, colour, x, y, vx, 0, unit, reference, scale, vx));
            if (keys.Contains(yKey)) vectors.Add(ProbeArrow(yKey, "垂直" + label, colour, x, y, 0, vy, unit, reference, scale, vy));
        }
    }

    private static ProbeVector ProbeArrow(string key, string label, string colour, double x, double y, double vx, double vy, string unit, double reference, double scale, double? scalar = null)
    {
        var magnitude = WorkshopProbeMath.Length(vx, vy);
        if (!double.IsFinite(magnitude)) return new(key, label, colour, "", x, y, x, y, x, y, "—", unit, false);
        var length = 94 * scale * (magnitude / (reference + magnitude));
        var nx = magnitude > 0 ? vx / magnitude : 0; var ny = magnitude > 0 ? -vy / magnitude : 0;
        var endX = x + nx * length; var endY = y + ny * length;
        var head = Math.Min(7 * scale, length * .4); var half = head * .55;
        var path = magnitude <= 1e-12 ? "" : $"M{N(x)} {N(y)}L{N(endX)} {N(endY)}M{N(endX - nx * head - ny * half)} {N(endY - ny * head + nx * half)}L{N(endX)} {N(endY)}L{N(endX - nx * head + ny * half)} {N(endY - ny * head - nx * half)}";
        return new(key, label, colour, path, x, y, endX, endY, endX + 5 * scale, endY - 5 * scale, ProbeNumber(scalar ?? magnitude), unit, false);
    }

    private static ProbeVector ProbeRotation(double x, double y, double omega, double scale)
    {
        var sign = omega < 0 ? 1 : -1; var radius = 25 * scale; var endY = y - sign * radius;
        var path = Math.Abs(omega) <= 1e-12 || !double.IsFinite(omega) ? "" :
            $"M{N(x + radius)} {N(y)}A{N(radius)} {N(radius)} 0 0 {(sign > 0 ? 1 : 0)} {N(x - radius)} {N(y)}A{N(radius)} {N(radius)} 0 0 {(sign > 0 ? 1 : 0)} {N(x)} {N(endY)}M{N(x + sign * 7 * scale)} {N(endY - 4 * scale)}L{N(x)} {N(endY)}L{N(x + sign * 7 * scale)} {N(endY + 4 * scale)}";
        return new("omega", "角速度", "#168d91", path, x, y, x, endY, x + 5 * scale, endY - sign * 10 * scale, ProbeNumber(omega), "rad/s", true);
    }

    private sealed record ProbeChoice(string Key, string Label, string Unit, bool Available = true, string Reason = "", string? Colour = null);
    private sealed record ProbeDefault(string BodyId, string[] Keys, bool Vectors = true);
    private sealed record ProbeRow(string Key, string Label, string Value, string Unit, string? Colour);
    private sealed record ProbeVector(string Key, string Label, string Colour, string Path, double StartX, double StartY, double EndX, double EndY, double LabelX, double LabelY, string Value, string Unit, bool Rotation);
    private sealed record ProbePanel(string BodyId, string Name, double X, double Y, double Width, double Height, double Scale,
        double CentreX, double CentreY, double Time, string SampleNote, bool ReadOnly, IReadOnlyList<ProbeRow> Rows, IReadOnlyList<ProbeVector> Vectors);
}

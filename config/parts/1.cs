using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace OmniCivitas.Mechanical;

public static class WorkshopJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    { NumberHandling = JsonNumberHandling.Strict, MaxDepth = 32, WriteIndented = false };
    public static string Write<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static T Read<T>(string value) => JsonSerializer.Deserialize<T>(value, Options) ?? throw new ArgumentException("An object is required.");
    public static T Copy<T>(T value) => Read<T>(Write(value));
}

public sealed class WorkshopProject
{
    public string Schema { get; set; } = "ocv.workshop-project/1";
    public string Name { get; set; } = "Untitled assembly";
    public MechanicalWorld World { get; set; } = new();
    public WorkshopAppearance Appearance { get; set; } = new();
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public MechanicalChallenge? Challenge { get; set; }
}
public sealed class WorkshopAppearance
{
    public double Depth { get; set; } = .35;
    public string Material { get; set; } = "alloy";
    public string Background { get; set; } = "white";
    public bool Wireframe { get; set; }
}
public sealed class MechanicalWorld
{
    public double GravityX { get; set; }
    public double GravityY { get; set; } = -9.81;
    public double StepS { get; set; } = 1d / 120;
    public double DurationS { get; set; } = 8;
    public int SampleEvery { get; set; } = 8;
    public uint Seed { get; set; } = 1;
    public List<MechanicalBody> Bodies { get; set; } = [];
    public List<MechanicalJoint> Joints { get; set; } = [];
    public List<MechanicalMotor> Motors { get; set; } = [];
    public List<MechanicalControl> Controls { get; set; } = [];
}
public sealed class MechanicalBody
{
    public string Id { get; set; } = "b1";
    public string Kind { get; set; } = "box";
    public string Mode { get; set; } = "dynamic";
    public double X { get; set; }
    public double Y { get; set; }
    public double Angle { get; set; }
    public double Width { get; set; } = 1;
    public double Height { get; set; } = .3;
    public double Radius { get; set; } = .3;
    public double Mass { get; set; } = 1;
    public double Friction { get; set; } = .4;
    public double Restitution { get; set; } = .15;
    public double LinearDamping { get; set; } = .02;
    public double AngularDamping { get; set; } = .02;
    public double Vx { get; set; }
    public double Vy { get; set; }
    public double Omega { get; set; }
    public int Layer { get; set; }
    public string Group { get; set; } = "";
    public string Label { get; set; } = "";
    public string Colour { get; set; } = "#2479ed";
}
public sealed class MechanicalJoint
{
    public string Id { get; set; } = "j1";
    public string Kind { get; set; } = "hinge";
    public string A { get; set; } = "";
    public string B { get; set; } = "";
    public double AnchorX { get; set; }
    public double AnchorY { get; set; }
    public double AxisX { get; set; } = 1;
    public double AxisY { get; set; }
    public double RestLength { get; set; } = 1;
    public double Stiffness { get; set; } = 80;
    public double Damping { get; set; } = 2;
    public double Ratio { get; set; } = 1;
    public double Min { get; set; } = -10;
    public double Max { get; set; } = 10;
}
public sealed class MechanicalMotor
{
    public string Id { get; set; } = "m1";
    public string Body { get; set; } = "";
    public double TargetSpeed { get; set; } = 3;
    public double MaxTorque { get; set; } = 10;
    public bool Enabled { get; set; } = true;
}
public sealed class MechanicalControl
{
    public string Id { get; set; } = "c1";
    public string Kind { get; set; } = "timer";
    public string Body { get; set; } = "";
    public string Target { get; set; } = "";
    public double Threshold { get; set; } = 1;
    public string Action { get; set; } = "reverse";
    public string Motor { get; set; } = "";
    public int MaxFirings { get; set; } = 1;
    public List<string> Inputs { get; set; } = [];
    public string Logic { get; set; } = "all";
}
public sealed class MechanicalChallenge
{
    public string Id { get; set; } = "delivery";
    public string Kind { get; set; } = "delivery";
    public string Body { get; set; } = "b1";
    public double TargetX { get; set; }
    public double TargetY { get; set; }
    public double Tolerance { get; set; } = .6;
    public double MinTime { get; set; } = 1;
    public List<MechanicalDestination> Targets { get; set; } = [];
    public int MaxParts { get; set; }
}
public sealed class MechanicalDestination
{
    public string Body { get; set; } = "";
    public double TargetX { get; set; }
    public double TargetY { get; set; }
    public double Tolerance { get; set; } = .6;
}
public sealed class WorkshopRun
{
    public string Schema { get; set; } = "ocv.workshop-run/1";
    public string Op { get; set; } = "simulate";
    public MechanicalWorld World { get; set; } = new();
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public MechanicalChallenge? Challenge { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public WorkshopScan? Scan { get; set; }
    public static WorkshopRun From(WorkshopProject p) => new() { World = WorkshopJson.Copy(p.World), Challenge = p.Challenge == null ? null : WorkshopJson.Copy(p.Challenge) };
}
public sealed class WorkshopScan
{
    public string Parameter { get; set; } = "motorSpeed";
    public string TargetId { get; set; } = "m1";
    public List<double> Values { get; set; } = [1, 2, 3, 4];
    public int Trials { get; set; } = 1;
}
public sealed record MechanicalIssue(string Code, string Path, string Message, string Severity = "error");
public sealed record MaterialLine(string Kind, string Mode, int Quantity, double MassKg, double AreaM2, string Unit);
public sealed record ConnectionReport(string Body, int JointCount, int MotorCount, bool Fixed, string[] ConnectedTo);
public sealed record WorkshopReceipt(bool Ok, string Contract, string Units, IReadOnlyList<MechanicalIssue> Diagnostics, IReadOnlyList<MaterialLine> Bom, IReadOnlyList<ConnectionReport> Connections, int Bodies, int Joints, int Motors, int PlannedSteps, int PlannedFrames);

public static class WorkshopDomain
{
    public const string Version = "ME2/1.1.0";
    public static readonly string[] BodyKinds = ["ball", "box", "track", "wheel", "link", "slider", "gear", "pulley"];
    public static readonly string[] JointKinds = ["hinge", "slider", "spring", "rod", "fixed", "gear", "belt"];
    private static bool Id(string s) => s.Length is > 0 and <= 32 && s.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-');
    private static bool Range(double n, double lo, double hi) => double.IsFinite(n) && n >= lo && n <= hi;
    public static (int Steps,int SampleEvery,int Frames,double EndS,double ToleranceS) TimePlan(MechanicalWorld w)
    {
        // ME1 integrates f32 state. Quantize inputs before planning the real step count.
        var ratio=(double)(float)w.DurationS/(double)(float)w.StepS;
        var steps=double.IsFinite(ratio)&&ratio>=0?(int)Math.Min(100000,Math.Ceiling(ratio)):100000;
        var stride=w.SampleEvery>0?Math.Max(w.SampleEvery,(int)Math.Ceiling(steps/255d)):1;
        var frames=Math.Min(256,(int)Math.Ceiling(steps/(double)stride)+1);
        var end=(double)((float)steps*(float)w.StepS);
        return(steps,stride,frames,end,1e-6*Math.Max(1,Math.Abs(end)));
    }
    public static WorkshopReceipt Inspect(WorkshopProject p)
    {
        var d = new List<MechanicalIssue>();
        void Issue(string code, string path, string message, string severity = "error") => d.Add(new(code, path, message, severity));
        if (p.Schema != "ocv.workshop-project/1") Issue("SCHEMA", "schema", "Expected ocv.workshop-project/1.");
        if (p.Name.Length is 0 or > 80 || p.Name.Any(char.IsControl)) Issue("NAME", "name", "Use 1–80 printable characters.");
        var w = p.World;
        if (!Range(w.GravityX, -100, 100) || !Range(w.GravityY, -100, 100)) Issue("GRAVITY", "world", "Gravity must be finite and within ±100 m/s².");
        if (!Range(w.StepS, 1d / 240, 1d / 30)) Issue("STEP", "world.stepS", "Fixed step must be 1/240–1/30 s.");
        if (!Range(w.DurationS, .05, 20)) Issue("DURATION", "world.durationS", "Duration must be 0.05–20 s.");
        if (w.SampleEvery is < 1 or > 4800) Issue("SAMPLE", "world.sampleEvery", "Sample stride must be 1–4,800 steps.");
        var timing=TimePlan(w);var steps=timing.Steps;var effectiveStride=timing.SampleEvery;var frames=timing.Frames;
        if (steps > 4800) Issue("STEP_LIMIT", "world", "At most 4,800 integration steps.");
        if (effectiveStride > w.SampleEvery && w.SampleEvery > 0) Issue("ADAPTIVE_SAMPLE", "world.sampleEvery", $"Native sampling increases stride to {effectiveStride} to retain at most 256 frames.", "info");
        if (w.Bodies.Count is < 1 or > 64 || w.Joints.Count > 64 || w.Motors.Count > 8 || w.Controls.Count > 16) Issue("LIMIT", "world", "Limits: 1–64 bodies, 64 joints, 8 motors, 16 controls.");
        var bodyIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var b in w.Bodies)
        {
            var path = $"world.bodies.{b.Id}";
            if (!Id(b.Id) || !bodyIds.Add(b.Id)) Issue("BODY_ID", path, "Body IDs must be unique ASCII identifiers, up to 32 characters.");
            if (!BodyKinds.Contains(b.Kind) || b.Mode is not ("fixed" or "dynamic")) Issue("BODY_KIND", path, "Unknown kind or motion mode.");
            if (!Range(b.X, -100, 100) || !Range(b.Y, -100, 100) || !Range(b.Angle, -1000, 1000)) Issue("POSITION", path, "Position/angle exceeds the bounded world.");
            if (!Range(b.Width, .01, 50) || !Range(b.Height, .01, 50) || !Range(b.Radius, .01, 50) || !Range(b.Mass, .001, 10000)) Issue("DIMENSION", path, "Dimensions 0.01–50 m and mass 0.001–10,000 kg.");
            if (!Range(b.Friction, 0, 2) || !Range(b.Restitution, 0, 1) || !Range(b.LinearDamping, 0, 100) || !Range(b.AngularDamping, 0, 100)) Issue("MATERIAL", path, "Friction 0–2, restitution 0–1, damping 0–100.");
            if (!Range(b.Vx, -100, 100) || !Range(b.Vy, -100, 100) || !Range(b.Omega, -200, 200)) Issue("VELOCITY", path, "Linear velocities within ±100 m/s; angular velocity within ±200 rad/s.");
            if (b.Layer is < 0 or > 32 || System.Text.Encoding.UTF8.GetByteCount(b.Group) > 64 || System.Text.Encoding.UTF8.GetByteCount(b.Label) > 64 || b.Label.Any(char.IsControl)) Issue("METADATA", path, "Layers 0–32; UTF-8 group and label up to 64 bytes.");
            if (b.Colour.Length != 7 || b.Colour[0] != '#' || !b.Colour.Skip(1).All(Uri.IsHexDigit)) Issue("COLOUR", path, "Use a six-digit hexadecimal colour.");
        }
        var jointIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var j in w.Joints)
        {
            var path = $"world.joints.{j.Id}";
            if (!Id(j.Id) || !jointIds.Add(j.Id)) Issue("JOINT_ID", path, "Joint ID invalid or duplicate.");
            if (!JointKinds.Contains(j.Kind) || !bodyIds.Contains(j.A) || !bodyIds.Contains(j.B) || j.A == j.B) Issue("CONNECTION", path, "A joint must connect two distinct existing bodies.");
            if (!Range(j.AnchorX, -100, 100) || !Range(j.AnchorY, -100, 100) || !Range(j.AxisX, -100, 100) || !Range(j.AxisY, -100, 100)) Issue("ANCHOR", path, "Invalid anchor/axis.");
            if (j.Kind == "slider" && j.AxisX * j.AxisX + j.AxisY * j.AxisY <= .0000000001) Issue("AXIS", path, "A slider needs a nonzero axis.");
            if (!Range(j.RestLength, .001, 100) || !Range(j.Stiffness, 0, 10000) || !Range(j.Damping, 0, 10000) || !Range(j.Ratio, -20, 20) || Math.Abs(j.Ratio) < .01 || !Range(j.Min, -100, 100) || !Range(j.Max, -100, 100) || j.Min > j.Max) Issue("JOINT_PARAMETER", path, "Invalid rest length, stiffness, damping, ratio or limits.");
            if (j.Kind is "gear" or "belt") Issue("IDEAL_RATIO", path, "Ideal angular transmission only; no tooth or belt contact model.", "info");
        }
        var motorIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var m in w.Motors)
        {
            if (!Id(m.Id) || !motorIds.Add(m.Id) || !bodyIds.Contains(m.Body)) Issue("MOTOR", $"world.motors.{m.Id}", "Motor ID or driven body invalid.");
            if (!Range(m.TargetSpeed, -100, 100) || !Range(m.MaxTorque, .001, 10000)) Issue("MOTOR_PARAMETER", $"world.motors.{m.Id}", "Speed within ±100 rad/s; torque 0.001–10,000 N·m.");
            if (w.Bodies.FirstOrDefault(b => b.Id == m.Body)?.Mode == "fixed") Issue("FIXED_MOTOR", $"world.motors.{m.Id}", "A motor cannot drive a fixed body.");
        }
        var controlIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var c in w.Controls)
        {
            var inputsValid = c.Kind == "logic"
                ? c.Inputs.Count is >= 1 and <= 4 && c.Inputs.Distinct(StringComparer.Ordinal).Count() == c.Inputs.Count && c.Inputs.All(controlIds.Contains) && c.Logic is "all" or "any" or "not" && (c.Logic != "not" || c.Inputs.Count == 1)
                : c.Inputs.Count == 0 && c.Logic == "all";
            if (!Id(c.Id) || !controlIds.Add(c.Id) || !inputsValid || c.Kind is not ("timer" or "contact" or "distance" or "count" or "logic") || c.Action is not ("start" or "stop" or "reverse" or "signal") || (c.Action != "signal" || c.Motor.Length > 0) && !motorIds.Contains(c.Motor) || !Range(c.Threshold, 0, 10000) || c.MaxFirings is < 1 or > 32) Issue("CONTROL", $"world.controls.{c.Id}", "Unknown control/action, cyclic or forward input, or invalid motor/threshold/firing limit.");
            if (c.Kind is "contact" or "distance" && (!bodyIds.Contains(c.Body) || !bodyIds.Contains(c.Target))) Issue("CONTROL_REFERENCE", $"world.controls.{c.Id}", "Contact/distance controls need two existing bodies.");
            if(c.Kind is not ("timer" or "logic")&&!bodyIds.Contains(c.Body))Issue("CONTROL_REFERENCE",$"world.controls.{c.Id}","Physical sensors need an observed body.");
            if (c.Body.Length > 0 && !bodyIds.Contains(c.Body) || c.Target.Length > 0 && !bodyIds.Contains(c.Target)) Issue("CONTROL_REFERENCE", $"world.controls.{c.Id}", "Any supplied control body/target must exist.");
        }
        if (p.Challenge is { } ch)
        {
            var targetsValid = ch.Kind == "routing"
                ? ch.Targets.Count is >= 2 and <= 8 && ch.Targets.Any(t=>t.Body == ch.Body) && ch.Targets.Select(t=>t.Body).Distinct(StringComparer.Ordinal).Count() == ch.Targets.Count
                    && ch.Targets.All(t=>w.Bodies.Any(b=>b.Id == t.Body && b.Mode == "dynamic") && Range(t.TargetX,-100,100) && Range(t.TargetY,-100,100) && Range(t.Tolerance,.001,50))
                : ch.Targets.Count == 0;
            var budgetValid = ch.Kind == "crossing" ? ch.MaxParts is >= 1 and <= 64 && w.Bodies.Any(b=>b.Id==ch.Body && b.Mode=="dynamic" && b.X < ch.TargetX-ch.Tolerance) : ch.MaxParts == 0;
            if (!Id(ch.Id) || ch.Kind is not ("delivery" or "steady" or "routing" or "crossing") || !bodyIds.Contains(ch.Body) || !Range(ch.TargetX,-100,100) || !Range(ch.TargetY,-100,100) || !Range(ch.Tolerance,.001,50) || !Range(ch.MinTime,0,20) || !targetsValid || !budgetValid || ch.Kind == "steady" && !w.Motors.Any(m=>m.Body==ch.Body)) Issue("CHALLENGE", "challenge", "Invalid bounded target, routing destinations, starting side or dynamic-part budget.");
            if (ch.Kind == "crossing" && w.Bodies.Count(b=>b.Mode=="dynamic") > ch.MaxParts) Issue("PART_BUDGET", "challenge.maxParts", "Dynamic-part budget exceeded; the run can be simulated but the challenge cannot complete.", "info");
        }
        if (!Range(p.Appearance.Depth, .01, 5) || p.Appearance.Material is not ("alloy" or "polymer" or "glass") || p.Appearance.Background is not ("white" or "sky")) Issue("APPEARANCE", "appearance", "Invalid appearance settings; these do not change the 2D solve.");
        var bom = w.Bodies.GroupBy(b => (b.Kind, b.Mode)).Select(g => new MaterialLine(g.Key.Kind, g.Key.Mode, g.Count(), g.Where(b => b.Mode == "dynamic").Sum(b => b.Mass), g.Sum(b => b.Kind is "ball" or "wheel" or "gear" or "pulley" ? Math.PI * b.Radius * b.Radius : b.Width * b.Height), "kg / m² (planar)")).ToArray();
        var connections = w.Bodies.Select(b => new ConnectionReport(b.Id, w.Joints.Count(j => j.A == b.Id || j.B == b.Id), w.Motors.Count(m => m.Body == b.Id), b.Mode == "fixed", w.Joints.Where(j => j.A == b.Id || j.B == b.Id).Select(j => j.A == b.Id ? j.B : j.A).Distinct().ToArray())).ToArray();
        return new(!d.Any(i => i.Severity == "error"), Version, "SI; x right, y up, angles rad", d, bom, connections, w.Bodies.Count, w.Joints.Count, w.Motors.Count, steps, frames);
    }

    public static WorkshopProject Template(string id)
    {
        if (id is "routing" or "crossing" or "control-chain") return ClosedTemplate(id);
        var p = new WorkshopProject { Name = id switch { "delivery" => "Drop delivery", "steady" => "Constant-speed spindle", "linkage" => "Spring linkage", _ => "Marble and turntable" } };
        var floor = new MechanicalBody { Id = "floor", Kind = "track", Mode = "fixed", X = 0, Y = 0, Width = 15, Height = .35, Colour = "#8caacb", Friction = .45, Restitution = .08, Label = "Base rail" };
        p.World.Bodies.Add(floor);
        if (id == "delivery")
        {
            p.World.Bodies.Add(new() { Id = "marble", Kind = "ball", X = -3, Y = 4, Radius = .3, Mass = .3, Restitution = .05, Friction = .65, Colour = "#2c86eb", Label = "Delivery mass" });
            p.Challenge = new() { Id = "delivery-01", Kind = "delivery", Body = "marble", TargetX = -3, TargetY = .475, Tolerance = .5, MinTime = 1.5 };
        }
        else
        {
            var wheel = new MechanicalBody { Id = "wheel", Kind = "wheel", X = 2.5, Y = 2.5, Radius = 1.15, Mass = 4, AngularDamping = .04, Colour = "#245fd1", Label = "Driven spindle" };
            p.World.Bodies.Add(wheel);
            p.World.Joints.Add(new() { Id = "pivot", Kind = "hinge", A = "floor", B = "wheel", AnchorX = 2.5, AnchorY = 2.5 });
            p.World.Motors.Add(new() { Id = "drive", Body = "wheel", TargetSpeed = 3, MaxTorque = 80 });
            if (id == "steady") p.Challenge = new() { Id = "steady-01", Kind = "steady", Body = "wheel", TargetX = 3, TargetY = 0, Tolerance = .6, MinTime = 2 };
            else
            {
                p.World.Bodies.Add(new() { Id = "marble", Kind = "ball", X = -4.5, Y = 5, Radius = .32, Mass = .4, Colour = "#33a5ed", Label = "Marble" });
                p.World.Bodies.Add(new() { Id = "ramp", Kind = "track", Mode = "fixed", X = -3.2, Y = 2.1, Width = 5.5, Height = .22, Angle = -.26, Colour = "#aac4df", Label = "Inclined guide" });
                if (id == "linkage")
                {
                    p.World.Bodies.Add(new() { Id = "pendulum", Kind = "link", X = 5, Y = 4, Width = 1.8, Height = .2, Mass = 1.2, Colour = "#688ada" });
                    p.World.Joints.Add(new() { Id = "spring", Kind = "spring", A = "wheel", B = "pendulum", RestLength = 3, Stiffness = 12, Damping = 1 });
                }
            }
        }
        return p;
    }
    private static WorkshopProject ClosedTemplate(string id)
    {
        var p = new WorkshopProject { Name = id switch { "routing" => "双路弹珠分流", "crossing" => "限件飞越", _ => "计时计数联锁" } };
        var w=p.World; w.DurationS=10; w.Seed=312512;
        void Fixed(string name,double x,double y,double width,double height,double angle=0) => w.Bodies.Add(new() { Id=name,Kind="track",Mode="fixed",X=x,Y=y,Width=width,Height=height,Angle=angle,Friction=.75,Restitution=.02,Colour="#9bbfe9" });
        if (id=="crossing")
        {
            Fixed("launch",-4,0,3,.3); Fixed("landing",4.5,0,5,.3); Fixed("end",6.9,1,.2,2);
            w.Bodies.Add(new() { Id="jumper",Kind="ball",X=-3,Y=1,Radius=.3,Mass=.6,Vx=4.5,Vy=5.5,Friction=.9,Restitution=.02,LinearDamping=0,AngularDamping=.1,Colour="#227be8" });
            p.Challenge=new() { Id="crossing-01",Kind="crossing",Body="jumper",TargetX=4,TargetY=.5,Tolerance=1.6,MinTime=.8,MaxParts=1 };
            return p;
        }
        Fixed("left-bin",-4,0,3.2,.3); Fixed("right-bin",4,0,3.2,.3);
        Fixed("left-end",-5.55,1,.2,2); Fixed("right-end",5.55,1,.2,2);
        Fixed("left-ramp",-1.85,2.8,4.4,.2,.30); Fixed("right-ramp",1.85,2.8,4.4,.2,-.30);
        w.Bodies.Add(new() { Id="small",Kind="ball",X=-.9,Y=5,Radius=.22,Mass=.3,Friction=.6,Restitution=.03,Colour="#2484ee" });
        w.Bodies.Add(new() { Id="large",Kind="ball",X=.9,Y=5.8,Radius=.36,Mass=.7,Friction=.6,Restitution=.03,Colour="#66b9e5" });
        w.Bodies.Add(new() { Id="lamp",Kind="wheel",X=0,Y=.5,Radius=.25,Mass=.3,Colour="#3264d0" });
        Fixed("lamp-base",0,.5,.08,.08);
        w.Joints.Add(new() { Id="lamp-pin",Kind="hinge",A="lamp-base",B="lamp",AnchorX=0,AnchorY=.5 });
        w.Motors.Add(new() { Id="indicator",Body="lamp",TargetSpeed=3,MaxTorque=2,Enabled=false });
        w.Controls.Add(new() { Id="delay",Kind="timer",Threshold=1,Action="signal" });
        w.Controls.Add(new() { Id="received",Kind="count",Body="small",Target="left-bin",Threshold=1,Action="signal" });
        w.Controls.Add(new() { Id="interlock",Kind="logic",Inputs=["delay","received"],Logic="all",Motor="indicator",Action="start" });
        w.Controls.Add(new() { Id="timeout",Kind="timer",Threshold=8,Motor="indicator",Action="stop" });
        if(id=="routing") p.Challenge=new() { Id="routing-01",Kind="routing",Body="small",MinTime=1,Targets=[new() { Body="small",TargetX=-4,TargetY=.4,Tolerance=1.45 },new() { Body="large",TargetX=4,TargetY=.5,Tolerance=1.45 }] };
        else p.Challenge=new() { Id="chain-01",Kind="steady",Body="lamp",MinTime=1,Tolerance=.2 };
        return p;
    }
    public static string Svg(WorkshopProject p)
    {
        if(!Inspect(p).Ok) throw new ArgumentException("Invalid bounded mechanical drawing.");
        string N(double d) => d.ToString("0.######", CultureInfo.InvariantCulture);
        var bounds=p.World.Bodies.Select(b=> {
            var round=b.Kind is "ball" or "wheel" or "gear" or "pulley";
            var x=round?b.Radius:(Math.Abs(Math.Cos(b.Angle))*b.Width+Math.Abs(Math.Sin(b.Angle))*b.Height)/2;
            var y=round?b.Radius:(Math.Abs(Math.Sin(b.Angle))*b.Width+Math.Abs(Math.Cos(b.Angle))*b.Height)/2;
            return(Left:b.X-x,Right:b.X+x,Bottom:b.Y-y,Top:b.Y+y);
        }).ToArray();
        var left=bounds.Min(b=>b.Left)-.5;var top=-bounds.Max(b=>b.Top)-.5;
        var width=Math.Max(1,bounds.Max(b=>b.Right)-left+.5);var height=Math.Max(1,-bounds.Min(b=>b.Bottom)-top+.5);
        var s = new System.Text.StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"{N(left)} {N(top)} {N(width)} {N(height)}\"><rect x=\"{N(left)}\" y=\"{N(top)}\" width=\"{N(width)}\" height=\"{N(height)}\" fill=\"#f5f9ff\"/><g transform=\"scale(1,-1)\" stroke=\"#193f71\" stroke-width=\"0.025\">");
        foreach (var b in p.World.Bodies)
        {
            s.Append($"<g transform=\"translate({N(b.X)} {N(b.Y)}) rotate({N(b.Angle * 180 / Math.PI)})\" fill=\"{b.Colour}\">");
            if (b.Kind is "ball" or "wheel" or "gear" or "pulley") s.Append($"<circle r=\"{N(b.Radius)}\"/>");
            else s.Append($"<rect x=\"{N(-b.Width / 2)}\" y=\"{N(-b.Height / 2)}\" width=\"{N(b.Width)}\" height=\"{N(b.Height)}\"/>");
            s.Append("</g>");
        }
        var metadata=WorkshopJson.Write(new { schema="ocv.workshop-drawing/1",domain=Version,dimension=2,units=new {length="m",angle="rad"},coordinates="x-right/y-up; SVG presentation flips y",model="initial planar geometry only; no simulation or engineering certification",projectSchema=p.Schema,bodyCount=p.World.Bodies.Count });
        s.Append("</g><metadata>").Append(System.Security.SecurityElement.Escape(metadata)).Append("</metadata></svg>");
        return s.ToString();
    }
}

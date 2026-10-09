using System.Globalization;
using System.Diagnostics;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.JSInterop;
using OmniCivitas.Mechanical;

namespace OmniCivitas.Workshop;

public partial class App
{
    private const string LocalKey = "ocv.workshop.editor.v1";
    private WorkshopProject Project = ChineseTemplate("demo");
    private WorkshopReceipt Receipt => WorkshopDomain.Inspect(Project);
    private readonly HashSet<string> Selected = ["marble"];
    private readonly List<string> History = [];
    private readonly List<string> Future = [];
    private readonly List<RunFrame> Frames = [];
    private readonly List<RevisionLine> Versions = [];
    private readonly List<ExampleEntry> Examples = [];
    private readonly List<KeyMoment> Moments = [];
    private string CatalogueStatus = "正在载入示例库…";
    private string SelectedExampleId = "";
    private bool LoadingExample;
    private double ViewX;
    private double ViewY;
    private double ViewWidth = 1100;
    private double ViewHeight = 620;
    private string ViewBox => $"{N(ViewX)} {N(ViewY)} {N(ViewWidth)} {N(ViewHeight)}";
    private ExampleEntry? CurrentExample => Examples.FirstOrDefault(e => e.Id == SelectedExampleId && e.Name == Project.Name);
    private string ControlKind = "timer";
    private string ControlBody = "";
    private string ControlTarget = "";
    private string ControlMotor = "";
    private string ControlAction = "reverse";
    private string ControlInputs = "";
    private string ControlLogic = "all";
    private double ControlThreshold = 1;
    private int ControlMaxFirings = 1;
    private JsonElement? LastResult;
    private DotNetObjectReference<App>? Reference;
    private CancellationTokenSource? Playback;
    private CancellationTokenSource? Polling;
    private long Generation;
    private bool Disposed;
    private bool Busy;
    private bool RunningLocal;
    private long JobGeneration;
    private bool JobBusy;
    private bool JobTerminal;
    private bool ReviewBusy;
    private bool CancellingReview;
    private ReviewSubmission? SubmittedReview;
    private long SubmissionEpoch;
    private bool Playing;
    private bool CanvasLocked => Disposed || Playing || RunningLocal || Busy;
    private string RunButtonClass => RunningLocal || Busy ? "calculating" : Playing ? "running" : Frames.Count > 0 ? "paused" : "idle";
    private string RunButtonText => RunningLocal || Busy ? "计算中…" : Playing ? "运行中" : Frames.Count > 0 ? "重新运行" : "▶ 运行";
    private bool Snap = true;
    private bool Trace = true;
    private bool Inspector = true;
    private bool Layers;
    private double Speed = 1;
    private int FrameIndex;
    private int EventCount;
    private string Status = "就绪";
    private string EngineVersion = "ME1 / waiting";
    private string ChallengeStatus = "—";
    private string JointKind = "hinge";
    private string JointA = "";
    private string JointB = "";
    private string ProjectId = "";
    private string ProjectTicket = "";
    private int Revision;
    private int RollbackRevision = 1;
    private string Digest = "";
    private string Storage = "Local / not submitted";
    private string JobId = "";
    private string JobTicket = "";
    private string JobStatus = "";
    private double PresentationTime;
    private bool SmoothPlayback => Frames.Count > 1;
    private long CachedGeneration = -1;
    private WorkshopProject? CachedProject;
    private WorkshopRun? CachedRequest;
    private JsonElement? VisibleExperiment;
    private string ResultSource = "local";
    private WorkshopRun? DisplayedRequest;
    private WorkshopProject? DisplayedProject;
    private WorkshopRun? VisibleExperimentRequest;
    private double DisplayedStep => DisplayedRequest?.World.StepS ?? Project.World.StepS;
    private bool ReviewAvailable => CachedGeneration == Generation && LastServerResult is not null;
    private bool CanCancelReview => SubmittedReview is not null && !JobTerminal && !CancellingReview;
    private string SavedProjectText = "";
    private string ScanTarget = "";
    private string ScanBodyTarget = "";
    private string ScanValues = "1, 2, 3, 4";
    private int ScanTrials = 1;
    private string ScanParameterValue = "motorSpeed";
    private string ScanParameter
    {
        get => ScanParameterValue;
        set { ScanParameterValue = value; ScanValues = value switch { "gravityY" => "-12, -9.81, -6", "restitution" => "0, 0.25, 0.5, 0.75, 1", _ => "1, 2, 3, 4" }; }
    }
    private double[]? DragStart;
    private double[]? BoxStart;
    private double[]? BoxEnd;
    private Dictionary<string, (double X, double Y)>? DragOrigins;
    private Dictionary<string, (double X, double Y)>? DragJointOrigins;
    private bool DragChanged;
    private long? ActivePointer;
    private double[]? PanStart;
    private double[]? PanView;
    private MechanicalBody? SelectedBody => Project.World.Bodies.FirstOrDefault(b => Selected.Contains(b.Id));
    private double CurrentTime => Frames.Count == 0 ? 0 : Playing && SmoothPlayback ? PresentationTime : Frames[Math.Clamp(FrameIndex, 0, Frames.Count - 1)].T;
    private double Energy => Frames.Count == 0 ? 0 : Frames[Math.Clamp(FrameIndex, 0, Frames.Count - 1)].Bodies.Sum(b => (Project.World.Bodies.FirstOrDefault(p => p.Id == b.Id)?.Mode == "dynamic" ? (Project.World.Bodies.FirstOrDefault(p => p.Id == b.Id)?.Mass ?? 0) * .5 * (b.Vx * b.Vx + b.Vy * b.Vy) : 0));
    private string ShortDigest => Digest.Length > 20 ? Digest[..20] + "…" : Digest;
    private static double SX(double x) => 550 + x * 55;
    private static double SY(double y) => 470 - y * 55;
    private static string N(double x) => x.ToString("0.######", CultureInfo.InvariantCulture);
    private static string KindSymbol(string kind) => kind switch { "ball" => "●", "box" => "▰", "track" => "═", "wheel" => "⊙", "link" => "⦿─⦿", "slider" => "▤", "gear" => "⚙", "pulley" => "◎", _ => "◇" };
    private static string KindName(string kind)=>kind switch{"ball"=>"弹珠","box"=>"方块","track"=>"轨道","wheel"=>"转轮","link"=>"连杆","slider"=>"滑块","gear"=>"齿轮","pulley"=>"带轮",_=>"零件"};
    private static string JointName(string kind)=>kind switch{"hinge"=>"转动连接","slider"=>"滑动连接","spring"=>"弹簧阻尼","rod"=>"定长连接","fixed"=>"固定连接","gear"=>"齿轮传动","belt"=>"皮带传动",_=>"连接"};
    private static string ModeName(string mode)=>mode=="fixed"?"固定":"动态";
    private static string ControlName(string kind)=>kind switch{"timer"=>"计时","contact"=>"碰撞","distance"=>"距离","count"=>"计数","logic"=>"逻辑",_=>"控制"};
    private static string ControlActionName(string action) => action switch { "start" => "启用电机", "stop" => "停用电机", "reverse" => "反转电机", "signal" => "输出信号", _ => "动作" };
    private static string ChallengeName(string kind)=>kind switch { "delivery"=>"交付挑战", "steady"=>"转速挑战", "routing"=>"分流挑战", "crossing"=>"限件跨越", _=>"挑战" };
    private static string ThresholdName(string kind) => kind switch { "timer" => "间隔 / s", "distance" => "距离阈值 / m", "count" => "接触次数", _ => "阈值（接触即触发）" };
    private string MotorNameById(string id) => Project.World.Motors.FirstOrDefault(m => m.Id == id) is { } motor ? BodyNameById(motor.Body) + "的电机" : "未选电机";
    private static string MaterialName(string kind)=>kind switch{"alloy"=>"金属","polymer"=>"塑料","glass"=>"玻璃",_=>"材质"};
    private static string ScanParameterName(string kind)=>kind switch{"motorSpeed"=>"电机转速","gravityY"=>"垂直重力","restitution"=>"恢复系数",_=>"参数"};
    private static string OperationName(string kind)=>kind switch{"save"=>"保存","create"=>"创建","branch"=>"分支","rollback"=>"恢复","restore"=>"恢复","import"=>"导入",_=>"版本"};
    private static string TaskStateName(string state)=>state switch{"queued"=>"排队中","starting"=>"正在启动","running"=>"计算中","done" or "completed" or "succeeded"=>"已完成","failed"=>"失败","cancelled"=>"已取消","timed_out"=>"已超时",_=>"等待状态更新"};
    private static string BodyName(MechanicalBody b)=>b.Label switch{"Base rail"=>"基座导轨","Driven spindle"=>"驱动转轮","Delivery mass"=>"交付球","Marble"=>"弹珠","Inclined guide"=>"斜面轨道",""=>KindName(b.Kind),_=>b.Label};
    private string BodyNameById(string id)=>Project.World.Bodies.FirstOrDefault(b=>b.Id==id) is{}b?BodyName(b):"未选零件";
    private string DisplayStorage=>Storage.Contains("PostgreSQL",StringComparison.Ordinal)?"数据库":Storage.Contains("receipt",StringComparison.OrdinalIgnoreCase)?"有保存记录":"本地";
    private string DisplayEngineVersion=>LastResult is null?"尚未计算":"引擎 "+System.Text.RegularExpressions.Regex.Match(EngineVersion,@"\d+\.\d+\.\d+").Value;
    private static string DisplayDomainVersion=>"校验 1.1.0";
    private static WorkshopProject ChineseTemplate(string id)
    {var p=WorkshopDomain.Template(id);p.Name=id switch{"delivery"=>"弹珠交付","steady"=>"稳定转速","linkage"=>"弹簧连杆","routing"=>"双路弹珠分流","crossing"=>"限件飞越","control-chain"=>"计时计数联锁",_=>"弹珠与转盘"};foreach(var b in p.World.Bodies)b.Label=BodyName(b);return p;}
    private static string DiagnosticName(string code)=>code switch
    {"SCHEMA"=>"格式","NAME"=>"工程名称","GRAVITY"=>"重力","STEP"=>"步长","DURATION"=>"时长","SAMPLE" or "ADAPTIVE_SAMPLE"=>"采样","STEP_LIMIT"=>"步数上限","LIMIT" or "WORLD_LIMIT"=>"数量上限","BODY_ID"=>"零件编号","BODY_KIND"=>"零件类型","POSITION"=>"位置","DIMENSION"=>"尺寸","MATERIAL"=>"材料","VELOCITY"=>"速度","METADATA"=>"零件信息","COLOUR"=>"颜色","JOINT_ID"=>"连接编号","CONNECTION" or "JOINT_CONNECTION"=>"连接关系","ANCHOR"=>"锚点","AXIS"=>"滑动方向","JOINT_PARAMETER"=>"连接参数","IDEAL_RATIO"=>"理想传动","MOTOR" or "MOTOR_PARAMETER" or "FIXED_MOTOR"=>"电机","CONTROL" or "CONTROL_REFERENCE"=>"控制连接","CHALLENGE"=>"挑战目标","APPEARANCE"=>"外观",_=>"参数检查"};
    private static string DiagnosticMessage(MechanicalIssue issue)=>issue.Code switch
    {"SCHEMA"=>"请使用当前机械工程格式。","NAME"=>"工程名称限 1 至 80 个可见字符。","GRAVITY"=>"重力范围为 ±100 m/s²。","STEP"=>"固定步长应在 1/240 至 1/30 s 之间。","DURATION"=>"运行时长应在 0.05 至 20 s 之间。","SAMPLE"=>"采样间隔应为 1 至 4800 步。","ADAPTIVE_SAMPLE"=>"采样间隔已自动调整，最多保留 256 帧。","STEP_LIMIT"=>"每次运行最多 4800 步。","LIMIT"=>"最多 64 个零件、64 个连接、8 个电机和 16 个控制节点。","BODY_ID"=>"零件编号无效或重复。","BODY_KIND"=>"零件类型或运动方式不受支持。","POSITION"=>"零件位置或角度超出允许范围。","DIMENSION"=>"尺寸应为 0.01 至 50 m，质量应为 0.001 至 10000 kg。","MATERIAL"=>"请检查摩擦系数、恢复系数和阻尼。","VELOCITY"=>"请检查初始速度和角速度。","METADATA"=>"图层限 0 至 32，名称与分组各限 64 字节。","COLOUR"=>"请使用有效的六位颜色代码。","JOINT_ID"=>"连接编号无效或重复。","CONNECTION"=>"连接必须引用两个不同的现有零件。","ANCHOR"=>"锚点或方向数值无效。","AXIS"=>"滑动方向不能为零。","JOINT_PARAMETER"=>"请检查长度、刚度、阻尼、传动比和移动范围。","IDEAL_RATIO"=>"使用理想角速度传动比，不计算齿面接触或皮带打滑。","MOTOR"=>"电机必须连接现有动态零件。","MOTOR_PARAMETER"=>"转速范围为 ±100 rad/s，转矩应为 0.001 至 10000 N·m。","FIXED_MOTOR"=>"电机不能驱动固定零件。","CONTROL"=>"请检查控制类型、动作、电机和触发次数。","CONTROL_REFERENCE"=>"控制节点引用的零件不存在。","CHALLENGE"=>"挑战目标无效，稳定转速挑战需要驱动电机。","APPEARANCE"=>"外观参数无效；外观不会改变二维求解。",_=>"工程参数未通过检查，请修正后重试。"};

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;
        Reference = DotNetObjectReference.Create(this);
        Busy = true;
        try
        {
            await Js.InvokeVoidAsync("WorkshopBridge.register", Reference);
            var receiptText=await Js.InvokeAsync<string?>("WorkshopBridge.localGet","ocv.workshop.receipt.v1");
            var restoreFailed = false;
            if(receiptText is not null)
            {
                try
                {
                    using var stored=JsonDocument.Parse(receiptText);var value=stored.RootElement;
                    var id=value.GetProperty("id").GetString()??"";var ticket=value.GetProperty("ticket").GetString()??"";
                    if (!ValidProjectCapability(id, ticket)) throw new ArgumentException("保存入口无效。");
                    restoreFailed = !await ReadSavedProject(id, ticket, false);
                }
                catch(Exception) { restoreFailed = true; }
            }
            if (Disposed) return;
            Busy = false;
            await Notify();
            _ = LoadCatalogue();
            await Run();
            if (restoreFailed && !Disposed) { Status = "已打开本地示例；保存工程暂未能重开。"; await InvokeAsync(StateHasChanged); }
        }
        catch (Exception e) { Busy = false; Status = "编辑器已就绪，求解器未能启动：" + SafeError(e); if (!Disposed) await InvokeAsync(StateHasChanged); }
    }
    private void Remember()
    {
        History.Add(WorkshopJson.Write(Project));
        if (History.Count > 60) History.RemoveAt(0);
        Future.Clear();
        StopPlayback();
        if(RunningLocal){RunningLocal=false;Busy=false;_ = CancelPreview();}
        Generation++;
        LastResult = null;
        Frames.Clear(); Moments.Clear(); FrameIndex = 0; EventCount = 0; ChallengeStatus = "—";
    }
    private async Task CancelPreview() { try { await Js.InvokeVoidAsync("WorkshopBridge.cancel"); } catch(JSException) { } }
    private async Task Changed(string message = "已修改")
    {
        Status = message;
        await Notify();
    }
    private async Task Notify()
    {
        if (!Project.World.Motors.Any(m => m.Id == ControlMotor)) ControlMotor = Project.World.Motors.FirstOrDefault()?.Id ?? "";
        if (!Project.World.Bodies.Any(b => b.Id == ControlBody)) ControlBody = "";
        if (!Project.World.Bodies.Any(b => b.Id == ControlTarget)) ControlTarget = "";
        if (!Project.World.Bodies.Any(b => b.Id == JointA)) JointA = "";
        if (!Project.World.Bodies.Any(b => b.Id == JointB)) JointB = "";
        if (!Project.World.Motors.Any(m => m.Id == ScanTarget)) ScanTarget = Project.World.Motors.FirstOrDefault()?.Id ?? "";
        if (!Project.World.Bodies.Any(b => b.Id == ScanBodyTarget)) ScanBodyTarget = Project.World.Bodies.FirstOrDefault(b => b.Mode == "dynamic")?.Id ?? Project.World.Bodies.FirstOrDefault()?.Id ?? "";
        if (!Disposed) { await Js.InvokeVoidAsync("WorkshopBridge.notify", WorkshopJson.Write(Project)); await SharedContext(); }
    }
    private async Task SharedContext()
    { if (!Disposed) await Js.InvokeVoidAsync("WorkshopBridge.sharedContext", WorkshopJson.Write(new { domain="workshop", project=ProjectId.Length>0 ? new { id=ProjectId,ticket=ProjectTicket,revision=Revision,digest=Digest,domain="workshop" } : null, job=JobId.Length>0 ? new {id=JobId,ticket=JobTicket} : null, projectData=Project })); }
    [JSInvokable]
    public async Task ReloadShared(string json)
    { if (CanvasLocked) return; try { using var d=JsonDocument.Parse(json);var p=d.RootElement; var id=p.GetProperty("id").GetString() ?? "";var ticket=p.GetProperty("ticket").GetString() ?? "";if(!ValidProjectCapability(id,ticket))throw new ArgumentException("无效工程记录");await ReadSavedProject(id,ticket); } catch(Exception e) { Status=SafeError(e); } }
    private async Task Undo()
    {
        if (CanvasLocked || History.Count == 0) return;
        StopPlayback(); Generation++;
        if (RunningLocal) { RunningLocal = false; Busy = false; await CancelPreview(); }
        Future.Add(WorkshopJson.Write(Project));
        Project = WorkshopJson.Read<WorkshopProject>(History[^1]); History.RemoveAt(History.Count - 1);
        Frames.Clear(); Moments.Clear(); FrameIndex = 0; EventCount = 0; ChallengeStatus = "—"; LastResult = null; Selected.RemoveWhere(s => !Project.World.Bodies.Any(b => b.Id == s));
        await Changed("已撤销。");
    }
    private async Task Redo()
    {
        if (CanvasLocked || Future.Count == 0) return;
        StopPlayback(); Generation++;
        if (RunningLocal) { RunningLocal = false; Busy = false; await CancelPreview(); }
        History.Add(WorkshopJson.Write(Project));
        Project = WorkshopJson.Read<WorkshopProject>(Future[^1]); Future.RemoveAt(Future.Count - 1);
        Frames.Clear(); Moments.Clear(); FrameIndex = 0; EventCount = 0; ChallengeStatus = "—"; LastResult = null; Selected.RemoveWhere(s => !Project.World.Bodies.Any(b => b.Id == s)); await Changed("已重做。");
    }
    private async Task Rename(Microsoft.AspNetCore.Components.ChangeEventArgs e)
    { if (CanvasLocked) return; Remember(); Project.Name = (e.Value?.ToString() ?? "未命名工程").Trim(); await Changed(); }
    private async Task AddBody(string kind)
    {
        if (CanvasLocked) return;
        if (Project.World.Bodies.Count >= 64) { Status = "最多放置 64 个零件。"; return; }
        Remember();
        var b = new MechanicalBody { Id = NewId("b", Project.World.Bodies.Select(b => b.Id)), Kind = kind, X = SnapValue(-1 + Project.World.Bodies.Count % 5 * .8), Y = 4.5, Mode = kind == "track" ? "fixed" : "dynamic", Width = kind == "track" ? 3 : kind == "link" ? 1.8 : 1, Height = kind == "track" || kind == "link" ? .2 : .5, Radius = kind is "wheel" or "gear" or "pulley" ? .7 : .3 };
        Project.World.Bodies.Add(b); Selected.Clear(); Selected.Add(b.Id); await Changed($"已添加{KindName(kind)}。");
    }
    private async Task AddPreset(string id)
    {
        if (CanvasLocked) return;
        if (Project.World.Bodies.Count >= 64) { Status = "最多放置 64 个零件。"; return; }
        Remember();
        var body = new MechanicalBody { Id = NewId("b", Project.World.Bodies.Select(b => b.Id)), X = SnapValue(-1 + Project.World.Bodies.Count % 5 * .8), Y = 4.5, Mode = "dynamic" };
        switch (id)
        {
            case "flywheel": body.Kind = "wheel"; body.Label = "飞轮"; body.Radius = 1.1; body.Mass = 8; body.Colour = "#5d82b8"; body.AngularDamping = .015; break;
            case "counterweight": body.Kind = "box"; body.Label = "配重"; body.Width = .85; body.Height = .7; body.Mass = 12; body.Colour = "#7795ae"; break;
            case "roller": body.Kind = "wheel"; body.Label = "滚轮"; body.Radius = .38; body.Mass = 1.8; body.Friction = .75; body.Colour = "#7abadd"; break;
            case "buffer": body.Kind = "box"; body.Label = "缓冲块"; body.Width = 1.4; body.Height = .42; body.Mass = .8; body.Restitution = .75; body.Friction = .65; body.Colour = "#9fcaf0"; break;
            default: return;
        }
        Project.World.Bodies.Add(body); Selected.Clear(); Selected.Add(body.Id); await Changed("已添加");
    }
    private static string NewId(string prefix, IEnumerable<string> ids)
    { var taken = ids.ToHashSet(); for (var n = 1; n < 10000; n++) if (!taken.Contains(prefix + n)) return prefix + n; throw new InvalidOperationException("零件编号已达上限。"); }
    private double SnapValue(double n) => Snap ? Math.Round(n * 4) / 4 : n;
    private async Task BeginBody(MechanicalBody b, PointerEventArgs e)
    {
        if (e.Button is 1 or 2) { await BeginBox(e); return; }
        if (e.Button != 0 || CanvasLocked || ActivePointer is not null) return;
        ActivePointer = e.PointerId;
        FrameIndex = 0; PresentationTime = 0;
        if (!e.ShiftKey && !Selected.Contains(b.Id)) Selected.Clear();
        if (e.ShiftKey && Selected.Contains(b.Id)) { Selected.Remove(b.Id); ActivePointer = null; return; }
        Selected.Add(b.Id);
        if(!e.ShiftKey&&b.Group.Length>0)Selected.UnionWith(Project.World.Bodies.Where(p=>p.Group==b.Group).Select(p=>p.Id));
        DragStart = await Js.InvokeAsync<double[]>("WorkshopBridge.point", e.ClientX, e.ClientY);
        if (DragStart.Length != 2 || CanvasLocked || ActivePointer != e.PointerId) { ClearPointer(); return; }
        DragOrigins = Project.World.Bodies.Where(x => Selected.Contains(x.Id)).ToDictionary(x => x.Id, x => (x.X, x.Y));
        DragJointOrigins = Project.World.Joints.Where(j => Selected.Contains(j.A) && Selected.Contains(j.B)).ToDictionary(j => j.Id, j => (j.AnchorX, j.AnchorY));
        DragChanged = false; BoxStart = null; BoxEnd = null;
        Status = $"已选中{BodyName(b)}，可以拖动。";
    }
    private async Task BeginBox(PointerEventArgs e)
    {
        if (ActivePointer is not null) return;
        if (e.Button is 1 or 2)
        {
            var inverse = await Js.InvokeAsync<double[]>("WorkshopBridge.viewScale");
            if (inverse.Length != 4 || inverse.Any(n => !double.IsFinite(n))) return;
            ActivePointer = e.PointerId; PanStart = [e.ClientX, e.ClientY, .. inverse]; PanView = [ViewX, ViewY];
            return;
        }
        if (e.Button != 0 || CanvasLocked) return;
        ActivePointer = e.PointerId;
        if (!e.ShiftKey) Selected.Clear();
        BoxStart = await Js.InvokeAsync<double[]>("WorkshopBridge.point", e.ClientX, e.ClientY);
        if (BoxStart.Length != 2 || CanvasLocked || ActivePointer != e.PointerId) { ClearPointer(); return; }
        BoxEnd = BoxStart;
    }
    private async Task MovePointer(PointerEventArgs e)
    {
        if (ActivePointer != e.PointerId) return;
        if (PanStart is not null && PanView is not null)
        {
            var dx = e.ClientX - PanStart[0]; var dy = e.ClientY - PanStart[1];
            ViewX = Math.Clamp(PanView[0] - dx * PanStart[2] - dy * PanStart[4], -1000000, 1000000);
            ViewY = Math.Clamp(PanView[1] - dx * PanStart[3] - dy * PanStart[5], -1000000, 1000000);
            return;
        }
        if (CanvasLocked) { await CancelPointer(); return; }
        if (DragStart == null && BoxStart == null) return;
        var p = await Js.InvokeAsync<double[]>("WorkshopBridge.point", e.ClientX, e.ClientY);
        if (p.Length < 2) return;
        if (DragStart is not null && DragOrigins is not null)
        {
            var dx = p[0] - DragStart[0]; var dy = p[1] - DragStart[1];
            if (Math.Abs(dx) + Math.Abs(dy) < .025 && !DragChanged) return;
            if (!DragChanged) { Remember(); DragChanged = true; }
            foreach (var b in Project.World.Bodies.Where(b => DragOrigins.ContainsKey(b.Id))) { b.X = Math.Clamp(SnapValue(DragOrigins[b.Id].X + dx), -100, 100); b.Y = Math.Clamp(SnapValue(DragOrigins[b.Id].Y + dy), -100, 100); }
            if (DragJointOrigins is not null) foreach (var j in Project.World.Joints.Where(j => DragJointOrigins.ContainsKey(j.Id))) { j.AnchorX = Math.Clamp(SnapValue(DragJointOrigins[j.Id].X + dx), -100, 100); j.AnchorY = Math.Clamp(SnapValue(DragJointOrigins[j.Id].Y + dy), -100, 100); }
        }
        if (BoxStart is not null) BoxEnd = p;
    }
    private async Task EndPointer(PointerEventArgs e)
    {
        if (ActivePointer != e.PointerId) return;
        await MovePointer(e);
        if (!CanvasLocked && BoxStart is not null && BoxEnd is not null)
        {
            foreach (var b in Project.World.Bodies.Where(b => b.X >= Math.Min(BoxStart[0], BoxEnd[0]) && b.X <= Math.Max(BoxStart[0], BoxEnd[0]) && b.Y >= Math.Min(BoxStart[1], BoxEnd[1]) && b.Y <= Math.Max(BoxStart[1], BoxEnd[1]))) Selected.Add(b.Id);
        }
        var changed = DragChanged;
        ClearPointer();
        if (changed) await Changed("位置已更新。");
    }
    private void ClearPointer()
    { ActivePointer = null; PanStart = null; PanView = null; DragStart = null; DragOrigins = null; DragJointOrigins = null; DragChanged = false; BoxStart = null; BoxEnd = null; }
    private async Task CancelPointer()
    {
        var changed = DragChanged;
        if (changed && DragOrigins is not null) foreach (var b in Project.World.Bodies.Where(b => DragOrigins.ContainsKey(b.Id))) { b.X = DragOrigins[b.Id].X; b.Y = DragOrigins[b.Id].Y; }
        if (changed && DragJointOrigins is not null) foreach (var j in Project.World.Joints.Where(j => DragJointOrigins.ContainsKey(j.Id))) { j.AnchorX = DragJointOrigins[j.Id].X; j.AnchorY = DragJointOrigins[j.Id].Y; }
        ClearPointer();
        if (changed) await Changed("已取消移动。");
    }
    [JSInvokable]
    public async Task CanvasPointer(string action, string bodyId, long pointerId, double clientX, double clientY, int button, bool shift)
    {
        if (Disposed || !double.IsFinite(clientX + clientY) || action is not ("down" or "move" or "up" or "cancel")) return;
        var e = new PointerEventArgs { PointerId = pointerId, ClientX = clientX, ClientY = clientY, Button = button, ShiftKey = shift };
        if (action == "down")
        {
            var body = Project.World.Bodies.FirstOrDefault(b => b.Id == bodyId);
            if (body is not null) await BeginBody(body, e); else await BeginBox(e);
        }
        else if (action == "move") await MovePointer(e);
        else if (action == "up") await EndPointer(e);
        else if (ActivePointer == pointerId) await CancelPointer();
        await InvokeAsync(StateHasChanged);
    }
    private async Task CopySelected()
    {
        if (CanvasLocked) return;
        var source = Project.World.Bodies.Where(b => Selected.Contains(b.Id)).ToArray();
        if (source.Length == 0 || Project.World.Bodies.Count + source.Length > 64) { Status = "复制后会超过零件数量上限。"; return; }
        Remember(); var ids = new Dictionary<string, string>(); var next = new HashSet<string>();
        foreach (var original in source) { var b = WorkshopJson.Copy(original); b.Id = NewId("b", Project.World.Bodies.Select(p => p.Id)); b.X += .5; b.Y += .5; b.Group = ""; ids[original.Id] = b.Id; Project.World.Bodies.Add(b); next.Add(b.Id); }
        foreach (var j in Project.World.Joints.Where(j => ids.ContainsKey(j.A) && ids.ContainsKey(j.B)).ToArray()) { if (Project.World.Joints.Count >= 64) break; var c = WorkshopJson.Copy(j); c.Id = NewId("j", Project.World.Joints.Select(q => q.Id)); c.A = ids[c.A]; c.B = ids[c.B]; c.AnchorX += .5; c.AnchorY += .5; Project.World.Joints.Add(c); }
        Selected.Clear(); Selected.UnionWith(next); await Changed("已复制所选零件及内部连接。");
    }
    private async Task DeleteSelected()
    {
        if (CanvasLocked || Selected.Count == 0) return;
        Remember(); Project.World.Bodies.RemoveAll(b => Selected.Contains(b.Id));
        Project.World.Joints.RemoveAll(j => Selected.Contains(j.A) || Selected.Contains(j.B));
        var removedMotors = Project.World.Motors.Where(m => Selected.Contains(m.Body)).Select(m => m.Id).ToHashSet();
        Project.World.Motors.RemoveAll(m => removedMotors.Contains(m.Id));
        Project.World.Controls.RemoveAll(c => Selected.Contains(c.Body) || Selected.Contains(c.Target) || removedMotors.Contains(c.Motor));
        PruneControlInputs();
        if (Project.Challenge is { } ch && (Selected.Contains(ch.Body) || ch.Targets.Any(t=>Selected.Contains(t.Body)))) Project.Challenge = null;
        Selected.Clear(); await Changed("已删除所选零件及相关连接。");
    }
    private async Task RotateSelected()
    { await RotateBy(Math.PI / 2); }
    private async Task RotateBy(double angle)
    { if (CanvasLocked || Selected.Count == 0) return; Remember(); foreach (var b in Project.World.Bodies.Where(b => Selected.Contains(b.Id))) b.Angle = Math.IEEERemainder(b.Angle + angle, Math.PI * 2); await Changed(); }
    private async Task NudgeSelected(double dx, double dy)
    {
        if (CanvasLocked || Selected.Count == 0) return;
        var bodies = Project.World.Bodies.Where(b => Selected.Contains(b.Id)).ToArray();
        if (bodies.Length == 0 || bodies.Any(b => !double.IsFinite(b.X + b.Y) || Math.Abs(b.X) > 100 || Math.Abs(b.Y) > 100)) return;
        dx = Math.Clamp(dx, -100 - bodies.Min(b => b.X), 100 - bodies.Max(b => b.X));
        dy = Math.Clamp(dy, -100 - bodies.Min(b => b.Y), 100 - bodies.Max(b => b.Y));
        if (dx == 0 && dy == 0) return;
        Remember(); foreach (var b in bodies) { b.X += dx; b.Y += dy; }
        foreach (var j in Project.World.Joints.Where(j => Selected.Contains(j.A) && Selected.Contains(j.B))) { j.AnchorX = Math.Clamp(j.AnchorX + dx, -100, 100); j.AnchorY = Math.Clamp(j.AnchorY + dy, -100, 100); }
        await Changed("位置已更新。");
    }
    private async Task GroupSelected()
    { if (CanvasLocked || Selected.Count < 2) return; Remember(); var group = NewId("g", Project.World.Bodies.Select(b => b.Group)); foreach (var b in Project.World.Bodies.Where(b => Selected.Contains(b.Id))) b.Group = group; await Changed("已分组"); }
    private async Task UngroupSelected()
    { if (CanvasLocked) return; Remember(); foreach (var b in Project.World.Bodies.Where(b => Selected.Contains(b.Id))) b.Group = ""; await Changed(); }
    private void SelectLayer(int layer) { if (CanvasLocked) return; Selected.Clear(); Selected.UnionWith(Project.World.Bodies.Where(b => b.Layer == layer).Select(b => b.Id)); }
    [JSInvokable]
    public async Task CanvasCommand(string command, bool shift = false, double x = 0, double y = 0, double amount = 0)
    {
        if (Disposed) return;
        if (command == "pause") await TogglePause();
        else if (command == "fit") FitView();
        else if (command == "zoom-in") ZoomView(.8);
        else if (command == "zoom-out") ZoomView(1.25);
        else if (command == "wheel" && double.IsFinite(x + y + amount))
        {
            var p = await Js.InvokeAsync<double[]>("WorkshopBridge.point", x, y);
            if (p.Length == 2) ZoomAt(Math.Exp(Math.Clamp(amount, -4, 4) * .16), SX(p[0]), SY(p[1]));
        }
        else if (command == "escape") { await CancelPointer(); Selected.Clear(); }
        else if (!CanvasLocked && ActivePointer is null)
        {
            var step = shift ? 1 : .25;
            switch (command)
            {
                case "delete": await DeleteSelected(); break;
                case "duplicate": await CopySelected(); break;
                case "rotate": await RotateBy((shift ? -1 : 1) * Math.PI / 2); break;
                case "left": await NudgeSelected(-step, 0); break;
                case "right": await NudgeSelected(step, 0); break;
                case "up": await NudgeSelected(0, step); break;
                case "down": await NudgeSelected(0, -step); break;
            }
        }
        await InvokeAsync(StateHasChanged);
    }
    private async Task SetBodyText(MechanicalBody b, string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    { if (CanvasLocked) return; Remember(); var text = e.Value?.ToString() ?? ""; switch (field) { case "mode": b.Mode = text; break; case "label": b.Label = text; break; case "colour": b.Colour = text; break; } await Changed(); }
    private async Task SetBodyNumber(MechanicalBody b, string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    {
        if (CanvasLocked || !Number(e, out var n)) return; Remember();
        switch (field) { case "x": b.X = n; break; case "y": b.Y = n; break; case "angle": b.Angle = n * Math.PI / 180; break; case "width": b.Width = n; break; case "height": b.Height = n; break; case "radius": b.Radius = n; break; case "mass": b.Mass = n; break; case "friction": b.Friction = n; break; case "restitution": b.Restitution = n; break; case "damping": b.LinearDamping = n; break; case "angularDamping": b.AngularDamping = n; break; case "vx": b.Vx = n; break; case "vy": b.Vy = n; break; case "omega": b.Omega = n; break; case "layer": b.Layer = (int)n; break; }
        await Changed();
    }
    private static bool Number(Microsoft.AspNetCore.Components.ChangeEventArgs e, out double n) => double.TryParse(e.Value?.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out n) && double.IsFinite(n);
    private async Task SetWorld(string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    {
        if (CanvasLocked || !Number(e, out var n)) return;
        if (field == "seed" && (n < 0 || n > uint.MaxValue || n != Math.Truncate(n))) { Status = "随机种子应为 0 至 4294967295 的整数。"; return; }
        Remember();
        switch (field) { case "gravityX": Project.World.GravityX = n; break; case "gravity": Project.World.GravityY = n; break; case "duration": Project.World.DurationS = n; break; case "step": Project.World.StepS = n; break; case "sample": Project.World.SampleEvery = (int)n; break; case "seed": Project.World.Seed = (uint)n; break; }
        if (Project.World.StepS > 0 && Project.World.SampleEvery > 0) Project.World.SampleEvery = Math.Max(Project.World.SampleEvery, (int)Math.Ceiling(Project.World.DurationS / Project.World.StepS / 255));
        await Changed();
    }
    private async Task SetDepth(Microsoft.AspNetCore.Components.ChangeEventArgs e) { if (CanvasLocked || !Number(e, out var n)) return; Remember(); Project.Appearance.Depth = n; await Changed("外观已更新，求解几何不变。"); await AppearancePreview(); }
    private async Task SetMaterial(Microsoft.AspNetCore.Components.ChangeEventArgs e) { if (CanvasLocked) return; Remember(); Project.Appearance.Material = e.Value?.ToString() ?? "alloy"; await Changed("外观已更新，求解几何不变。"); await AppearancePreview(); }
    private async Task AppearancePreview() => await Js.InvokeVoidAsync("WorkshopBridge.preview", WorkshopJson.Write(Project), Project.Appearance);
    private async Task AddJoint()
    {
        if (CanvasLocked) return;
        if (JointA == JointB || !Project.World.Bodies.Any(b => b.Id == JointA) || !Project.World.Bodies.Any(b => b.Id == JointB) || Project.World.Joints.Count >= 64) { Status = "请选择两个不同零件，连接最多 64 个。"; return; }
        Remember(); var a = Project.World.Bodies.First(b => b.Id == JointA); var b = Project.World.Bodies.First(b => b.Id == JointB);
        Project.World.Joints.Add(new() { Id = NewId("j", Project.World.Joints.Select(j => j.Id)), Kind = JointKind, A = a.Id, B = b.Id, AnchorX = b.X, AnchorY = b.Y, RestLength = Math.Clamp(Math.Sqrt(Math.Pow(a.X - b.X, 2) + Math.Pow(a.Y - b.Y, 2)), .001, 100), Ratio = 1 });
        await Changed(JointKind is "gear" or "belt" ? "已添加理想传动比连接。" : "已添加连接。");
    }
    private async Task DeleteJoint(MechanicalJoint j) { if (CanvasLocked) return; Remember(); Project.World.Joints.Remove(j); await Changed(); }
    private async Task SetJointParameter(MechanicalJoint j, string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    {
        if (CanvasLocked || !Number(e, out var n)) return;
        var candidate = WorkshopJson.Copy(Project); var edit = candidate.World.Joints.First(x => x.Id == j.Id);
        switch (field) { case "length": edit.RestLength = n; break; case "stiffness": edit.Stiffness = n; break; case "damping": edit.Damping = n; break; case "ratio": edit.Ratio = n; break; case "anchorX": edit.AnchorX = n; break; case "anchorY": edit.AnchorY = n; break; case "axisX": edit.AxisX = n; break; case "axisY": edit.AxisY = n; break; case "min": edit.Min = n; break; case "max": edit.Max = n; break; default: return; }
        if (!AcceptEdit(candidate)) return;
        Remember(); Project.World.Joints[Project.World.Joints.IndexOf(j)] = edit; await Changed();
    }
    private async Task AddMotor()
    { if (CanvasLocked) return; var b = SelectedBody; if (b is null || b.Mode == "fixed" || Project.World.Motors.Count >= 8) { Status = "请选择动态零件，最多添加 8 个电机。"; return; } Remember(); Project.World.Motors.Add(new() { Id = NewId("m", Project.World.Motors.Select(m => m.Id)), Body = b.Id }); await Changed("已添加电机；需要固定转轴时请添加转动连接。"); }
    private async Task SetMotor(MechanicalMotor m, string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    { if (CanvasLocked || !Number(e, out var n)) return; var candidate = WorkshopJson.Copy(Project); var edit = candidate.World.Motors.First(x => x.Id == m.Id); if (field == "torque") edit.MaxTorque = n; else edit.TargetSpeed = n; if (!AcceptEdit(candidate)) return; Remember(); Project.World.Motors[Project.World.Motors.IndexOf(m)] = edit; await Changed(); }
    private async Task ReverseMotor(MechanicalMotor m) { if (CanvasLocked) return; Remember(); m.TargetSpeed *= -1; await Changed("初始转速已反向，重新运行后生效。"); }
    private async Task ToggleMotor(MechanicalMotor m) { if (CanvasLocked) return; Remember(); m.Enabled = !m.Enabled; await Changed("初始驱动状态已修改，重新运行后生效；停用不施加刹车。"); }
    private async Task DeleteMotor(MechanicalMotor m) { if (CanvasLocked) return; Remember(); Project.World.Motors.Remove(m); Project.World.Controls.RemoveAll(c => c.Motor == m.Id); PruneControlInputs(); await Changed(); }
    private bool AcceptEdit(WorkshopProject candidate)
    {
        var problem = WorkshopDomain.Inspect(candidate).Diagnostics.FirstOrDefault(d => d.Severity == "error");
        if (problem is null) return true;
        Status = DiagnosticMessage(problem); return false;
    }
    private async Task AddControl()
    {
        if (CanvasLocked) return;
        if (Project.World.Controls.Count >= 16) { Status = "最多添加 16 个传感控制节点。"; return; }
        var candidate = WorkshopJson.Copy(Project);
        candidate.World.Controls.Add(new() { Id = NewId("c", Project.World.Controls.Select(c => c.Id)), Kind = ControlKind, Body = ControlKind=="logic"?"":ControlBody, Target = ControlKind=="logic"?"":ControlTarget, Motor = ControlAction=="signal"?"":ControlMotor, Action = ControlAction, Threshold = ControlThreshold, MaxFirings = ControlMaxFirings, Inputs=ControlKind=="logic"?ParseControlInputs(ControlInputs):[], Logic=ControlKind=="logic"?ControlLogic:"all" });
        if (!AcceptEdit(candidate)) return;
        Remember(); Project.World.Controls.Add(candidate.World.Controls[^1]); await Changed("传感控制已加入初始工程，重新运行后触发。");
    }
    private async Task SetControlText(MechanicalControl c, string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    {
        if (CanvasLocked) return;
        var candidate = WorkshopJson.Copy(Project); var edit = candidate.World.Controls.First(x => x.Id == c.Id); var value = e.Value?.ToString() ?? "";
        switch (field) {
            case "kind": edit.Kind = value; if(value=="logic") { edit.Body="";edit.Target="";edit.Inputs=candidate.World.Controls.TakeWhile(x=>x.Id!=c.Id).TakeLast(1).Select(x=>x.Id).ToList(); } else { edit.Inputs=[];edit.Logic="all"; } break;
            case "body": edit.Body = value; break; case "target": edit.Target = value; break; case "motor": edit.Motor = value; break;
            case "action": edit.Action = value; if(value=="signal")edit.Motor="";else if(edit.Motor.Length==0)edit.Motor=candidate.World.Motors.FirstOrDefault()?.Id??"";break;
            case "inputs": edit.Inputs=ParseControlInputs(value);break; case "logic":edit.Logic=value;break; default: return;
        }
        if (!AcceptEdit(candidate)) return;
        Remember(); Project.World.Controls[Project.World.Controls.IndexOf(c)] = edit; await Changed();
    }
    private async Task SetControlNumber(MechanicalControl c, string field, Microsoft.AspNetCore.Components.ChangeEventArgs e)
    {
        if (CanvasLocked || !Number(e, out var n)) return;
        if (field == "firings" && (n != Math.Truncate(n) || n < 1 || n > 32)) { Status = "触发上限应为 1 至 32 的整数。"; return; }
        var candidate = WorkshopJson.Copy(Project); var edit = candidate.World.Controls.First(x => x.Id == c.Id); if (field == "firings") edit.MaxFirings = (int)n; else edit.Threshold = n;
        if (!AcceptEdit(candidate)) return;
        Remember(); Project.World.Controls[Project.World.Controls.IndexOf(c)] = edit; await Changed();
    }
    private static List<string> ParseControlInputs(string value)=>value.Split([',','，',';','；',' ','\t'],StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries).ToList();
    private void PruneControlInputs()
    { var ids=new HashSet<string>(StringComparer.Ordinal); foreach(var c in Project.World.Controls.ToArray()) { if(c.Kind=="logic"&&c.Inputs.Any(id=>!ids.Contains(id)))Project.World.Controls.Remove(c);else ids.Add(c.Id); } }
    private async Task DeleteControl(MechanicalControl c) { if (CanvasLocked) return; Remember(); Project.World.Controls.Remove(c); PruneControlInputs(); await Changed("已移除传感控制。"); }
    private async Task UseTemplate(string id) { if (CanvasLocked) return; Remember(); Project = ChineseTemplate(id); SelectedExampleId = ""; Selected.Clear(); if(Project.Challenge is{}ch)Selected.Add(ch.Body);else if(Project.World.Bodies.FirstOrDefault(b=>b.Mode=="dynamic") is{}first)Selected.Add(first.Id); ProjectId = ""; ProjectTicket = ""; Revision = 0; Digest = ""; Versions.Clear(); Storage = "Local template"; ResetView(); await Changed("模板已载入。"); await Run(); }
    [JSInvokable] public async Task SelectTemplate(string id) { if (id is not ("demo" or "delivery" or "steady" or "linkage" or "routing" or "crossing" or "control-chain")) throw new ArgumentException("没有这个模板。"); await UseTemplate(id); await InvokeAsync(StateHasChanged); }
    [JSInvokable] public async Task ApplyTemplate(string projectJson)
    {
        if (CanvasLocked) return;
        try { var p = WorkshopJson.Read<WorkshopProject>(projectJson); var r = WorkshopDomain.Inspect(p); if (!r.Ok) throw new ArgumentException(DiagnosticMessage(r.Diagnostics.First(x => x.Severity == "error"))); Remember(); Project = p; Selected.Clear(); ProjectId = ""; ProjectTicket = ""; Revision = 0; Versions.Clear(); await Changed("已从零件库载入组件。"); await InvokeAsync(StateHasChanged); }
        catch (Exception e) { Status = "组件载入失败：" + SafeError(e); await InvokeAsync(StateHasChanged); }
    }
    [JSInvokable] public async Task InsertComponent(string projectJson, string sourceProjectJson)
    {
        if (CanvasLocked) throw new ArgumentException("请先暂停运行，再加入组件。");
        var source = WorkshopJson.Read<WorkshopProject>(sourceProjectJson);
        if (WorkshopJson.Write(source) != WorkshopJson.Write(Project)) throw new ArgumentException("画板已变化，请重新加入组件。");
        var candidate = WorkshopJson.Read<WorkshopProject>(projectJson);
        if (!AcceptEdit(candidate)) return;
        var retained = WorkshopJson.Copy(candidate);
        retained.World.Bodies = retained.World.Bodies.Take(Project.World.Bodies.Count).ToList();
        retained.World.Joints = retained.World.Joints.Take(Project.World.Joints.Count).ToList();
        retained.World.Motors = retained.World.Motors.Take(Project.World.Motors.Count).ToList();
        retained.World.Controls = retained.World.Controls.Take(Project.World.Controls.Count).ToList();
        if (WorkshopJson.Write(retained) != WorkshopJson.Write(Project)) throw new ArgumentException("组件不能替换已有工程内容。");
        Remember(); Project.World = candidate.World; Selected.Clear();
        await Changed("组件已加入当前工程。"); await InvokeAsync(StateHasChanged);
    }
    private async Task<string> ReadExampleFile(string file)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(file, @"^[a-z0-9][a-z0-9-]{0,60}\.json$")) throw new ArgumentException("示例文件名无效。");
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        using var response = await Http.GetAsync("/workshop/examples/" + file, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if (!response.IsSuccessStatusCode) throw new ArgumentException("示例文件暂时不可读取。");
        if (response.Content.Headers.ContentLength is > 131072) throw new ArgumentException("示例文件超过大小上限。");
        await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
        using var bytes = new MemoryStream(); var buffer = new byte[4096];
        while (true) { var count = await stream.ReadAsync(buffer.AsMemory(), deadline.Token); if (count == 0) break; if (bytes.Length + count > 131072) throw new ArgumentException("示例文件超过大小上限。"); await bytes.WriteAsync(buffer.AsMemory(0, count), deadline.Token); }
        return new UTF8Encoding(false, true).GetString(bytes.ToArray());
    }
    private async Task LoadCatalogue()
    {
        try
        {
            var text = await ReadExampleFile("catalogue.json"); var catalogue = WorkshopJson.Read<ExampleCatalogue>(text);
            if (catalogue.Schema != "ocv.workshop-catalogue/1" || catalogue.Entries.Count > 32 || catalogue.Entries.Any(e => e.Id.Length == 0 || e.Name.Length == 0 || !System.Text.RegularExpressions.Regex.IsMatch(e.File, @"^[a-z0-9][a-z0-9-]{0,60}\.json$"))) throw new ArgumentException("示例目录格式无效。");
            if (Disposed) return;
            Examples.Clear(); Examples.AddRange(catalogue.Entries); CatalogueStatus = $"{Examples.Count}";
        }
        catch (Exception e) { if (!Disposed) CatalogueStatus = "示例库未能载入：" + SafeError(e); }
        if (!Disposed) await InvokeAsync(StateHasChanged);
    }
    private async Task LoadExample(ExampleEntry example)
    {
        if (LoadingExample || CanvasLocked) return;
        LoadingExample = true; var generation = Generation;
        try
        {
            var json = await ReadExampleFile(example.File); var candidate = WorkshopJson.Read<WorkshopProject>(json);
            if (CanvasLocked || generation != Generation) return;
            if (!AcceptEdit(candidate)) return;
            Remember(); Project = candidate; SelectedExampleId = example.Id; Selected.Clear();
            var first = candidate.Challenge?.Body ?? candidate.World.Bodies.FirstOrDefault(b => b.Mode == "dynamic")?.Id;
            if (first is not null) Selected.Add(first);
            ProjectId = ""; ProjectTicket = ""; Revision = 0; Digest = ""; Versions.Clear(); Storage = "Local example";
            JointA = ""; JointB = ""; ControlBody = ""; ControlTarget = ""; ControlMotor = candidate.World.Motors.FirstOrDefault()?.Id ?? "";
            FitView(); await Changed("示例已载入，可修改参数后重新运行。"); await Run();
        }
        catch (Exception e) { if (!Disposed) Status = "示例载入失败：" + SafeError(e); }
        finally { if (!Disposed) { LoadingExample = false; await InvokeAsync(StateHasChanged); } }
    }
    private void ResetView() { ViewX = 0; ViewY = 0; ViewWidth = 1100; ViewHeight = 620; }
    private void ZoomView(double factor)
    { ZoomAt(factor, ViewX + ViewWidth / 2, ViewY + ViewHeight / 2); }
    private void ZoomAt(double factor, double x, double y)
    {
        if (!double.IsFinite(factor + x + y) || factor <= 0) return;
        var width = Math.Clamp(ViewWidth * factor, 180, 220000); var height = width * 620 / 1100;
        var scale = width / ViewWidth;
        ViewX = x - (x - ViewX) * scale; ViewY = y - (y - ViewY) * scale; ViewWidth = width; ViewHeight = height;
    }
    private void FitView()
    {
        if (!Receipt.Ok) { Status = "请先修正工程参数，再适配画布。"; return; }
        if (Project.World.Bodies.Count == 0) { ResetView(); return; }
        var left = double.PositiveInfinity; var top = double.PositiveInfinity; var right = double.NegativeInfinity; var bottom = double.NegativeInfinity;
        foreach (var b in Project.World.Bodies)
        {
            var p = Pose(b.Id); var radial = b.Kind is "ball" or "wheel" or "gear" or "pulley";
            var hw = radial ? b.Radius * 55 + 7 : (Math.Abs(Math.Cos(p.Angle)) * b.Width + Math.Abs(Math.Sin(p.Angle)) * b.Height) * 27.5;
            var hh = radial ? b.Radius * 55 + 7 : (Math.Abs(Math.Sin(p.Angle)) * b.Width + Math.Abs(Math.Cos(p.Angle)) * b.Height) * 27.5;
            left = Math.Min(left, SX(p.X) - hw); right = Math.Max(right, SX(p.X) + hw); top = Math.Min(top, SY(p.Y) - hh); bottom = Math.Max(bottom, SY(p.Y) + hh + 22);
        }
        foreach(var ch in ChallengeZones) { left = Math.Min(left, SX(ch.TargetX) - ch.Tolerance * 55); right = Math.Max(right, SX(ch.TargetX) + ch.Tolerance * 55); top = Math.Min(top, SY(ch.TargetY) - ch.Tolerance * 55); bottom = Math.Max(bottom, SY(ch.TargetY) + ch.Tolerance * 55); }
        if (!double.IsFinite(left + right + top + bottom)) { ResetView(); return; }
        ViewWidth = Math.Clamp(Math.Max(right - left + 90, (bottom - top + 90) * 1100 / 620), 180, 220000); ViewHeight = ViewWidth * 620 / 1100;
        ViewX = (left + right - ViewWidth) / 2; ViewY = (top + bottom - ViewHeight) / 2;
    }
    private IEnumerable<int> RulerMarks(bool horizontal)
    {
        var start = horizontal ? (ViewX - 550) / 55 : (470 - ViewY - ViewHeight) / 55;
        var end = horizontal ? (ViewX + ViewWidth - 550) / 55 : (470 - ViewY) / 55;
        if (!double.IsFinite(start + end) || Math.Abs(start) > 100000000 || Math.Abs(end) > 100000000) yield break;
        var every = Math.Max(1, (int)Math.Ceiling((end - start) / 24));
        var first = (int)Math.Ceiling(start / every) * every;
        for (var mark = first; mark <= end; mark += every) yield return mark;
    }
    private async Task RunWithReview() => await Run(true);
    private async Task RunScanWithReview() => await Run(true, true);
    private async Task Run(bool withReview = false, bool scan = false)
    {
        if (CanvasLocked || LoadingExample && withReview) return;
        await CancelPointer();
        var receipt = Receipt; if (!receipt.Ok) { Status = DiagnosticMessage(receipt.Diagnostics.First(d => d.Severity == "error")); return; }
        var request = WorkshopRun.From(Project);
        if (scan) { if (!TryScan(out var settings, out var problem)) { JobStatus = problem; return; } request.Op = "scan"; request.Scan = settings; }
        StopPlayback(); var generation = ++Generation; Busy = true; RunningLocal=true; Status = "计算中…"; ResultSource = "local"; await InvokeAsync(StateHasChanged);
        var submittedProject = WorkshopJson.Copy(Project);
        if (withReview) _ = SubmitServer(request, WorkshopJson.Copy(submittedProject), generation);
        try
        {
            var result = await Js.InvokeAsync<JsonElement>("WorkshopBridge.run", request);
            if (Disposed || generation != Generation) return;
            if (scan)
            {
                if (!ValidScanResult(result)) throw new ArgumentException("参数实验结果无效。");
                VisibleExperiment = result.Clone(); VisibleExperimentRequest = request; Status = result.GetProperty("ok").ValueKind==JsonValueKind.True ? "实验完成" : "部分实验结果";
            }
            else { AcceptResult(result); DisplayedRequest = request; DisplayedProject = submittedProject; Status = "计算完成"; await Notify(); StartPlayback(); }
        }
        catch (Exception e) { if (!Disposed && generation == Generation) Status = "求解已停止：" + SafeError(e); }
        finally { if (!Disposed && generation == Generation) { Busy = false; RunningLocal=false; await InvokeAsync(StateHasChanged); } }
    }
    private void AcceptResult(JsonElement result)
    {
        if (result.ValueKind != JsonValueKind.Object || !result.TryGetProperty("ok", out var ok) || !ok.GetBoolean())
        { var why = result.TryGetProperty("diagnostics", out var diagnostics) ? diagnostics.GetRawText() : "未得到有效的机械结果。"; throw new ArgumentException(why.Length > 500 ? why[..500] : why); }
        if (!result.TryGetProperty("frames", out var frames) || frames.ValueKind != JsonValueKind.Array || frames.GetArrayLength() > 256) throw new ArgumentException("回放数据格式或数量无效。");
        Frames.Clear();
        var previous = -1d;
        foreach (var frame in frames.EnumerateArray())
        {
            var parsed = WorkshopJson.Read<RunFrame>(frame.GetRawText());
            if (!double.IsFinite(parsed.T) || parsed.T < previous || parsed.Bodies.Count > 64 || parsed.Bodies.Any(b => !double.IsFinite(b.X) || !double.IsFinite(b.Y) || !double.IsFinite(b.Angle))) throw new ArgumentException("回放时间或零件状态无效。");
            Frames.Add(parsed); previous = parsed.T;
        }
        if (Frames.Count == 0) throw new ArgumentException("求解器没有返回采样帧。");
        LastResult = result.Clone(); FrameIndex = 0; PresentationTime = Frames[0].T; Moments.Clear();
        if (result.TryGetProperty("keyMoments", out var moments) && moments.ValueKind == JsonValueKind.Array)
        {
            foreach (var moment in moments.EnumerateArray().Take(128))
            {
                if (!moment.TryGetProperty("t", out var time) || !time.TryGetDouble(out var t) || !double.IsFinite(t)) continue;
                var kind = JsonText(moment, "kind");
                var title = kind switch { "contact" => BodyNameById(JsonText(moment, "a")) + "碰到" + BodyNameById(JsonText(moment, "b")), "control" => (JsonText(moment,"action")=="signal"?JsonText(moment,"id"):MotorNameById(JsonText(moment, "motor"))) + " · " + ControlActionName(JsonText(moment, "action")), "challenge" => "挑战目标达成", _ => "记录事件" };
                Moments.Add(new(t, kind, title));
            }
        }
        EngineVersion = result.TryGetProperty("version", out var version) ? version.GetString() ?? "ME1" : result.TryGetProperty("engine", out var engine) ? engine.ValueKind == JsonValueKind.String ? engine.GetString() ?? "ME1" : engine.GetRawText() : "ME1 Rust";
        EventCount = result.TryGetProperty("summary",out var eventSummary) && eventSummary.TryGetProperty("eventCount",out var eventTotal) && eventTotal.TryGetDouble(out var eventNumber) ? (int)Math.Clamp(eventNumber,0,int.MaxValue) : result.TryGetProperty("events", out var ev) && ev.ValueKind == JsonValueKind.Array ? ev.GetArrayLength() : Frames.Sum(f => f.Events.Count);
        ChallengeStatus = Project.Challenge == null ? "—" : "尚未达成";
        if (result.TryGetProperty("challenge", out var ch)) ChallengeStatus = ch.ValueKind == JsonValueKind.Object && ch.TryGetProperty("completed", out var complete) && complete.ValueKind == JsonValueKind.True ? "已达成" : ch.ValueKind == JsonValueKind.Object && ch.TryGetProperty("passed", out var passed) && passed.ValueKind == JsonValueKind.True ? "已达成" : "尚未达成";
        if (result.TryGetProperty("summary", out var summary) && summary.TryGetProperty("challengeComplete", out var challengeComplete) && challengeComplete.ValueKind == JsonValueKind.True) ChallengeStatus = "已达成";
    }
    private void StopPlayback() { Playing = false; Playback?.Cancel(); Playback?.Dispose(); Playback = null; }
    private void StartPlayback()
    { StopPlayback(); if (Frames.Count < 2) return; if (FrameIndex >= Frames.Count - 1) FrameIndex = 0; PresentationTime = Frames[FrameIndex].T; Playback = new(); Playing = true; _ = Animate(Playback.Token); }
    private async Task Animate(CancellationToken token)
    {
        try
        {
            var clock = Stopwatch.StartNew(); var previousTick = clock.Elapsed.TotalSeconds;
            while (!token.IsCancellationRequested && !Disposed && FrameIndex < Frames.Count - 1)
            {
                if (SmoothPlayback)
                {
                    await Task.Delay(16, token);
                    var now = clock.Elapsed.TotalSeconds; var elapsed = Math.Max(0, now - previousTick); previousTick = now;
                    await InvokeAsync(() => {
                        if (token.IsCancellationRequested || Disposed || !SmoothPlayback || !Playing) return;
                        PresentationTime = Math.Min(Frames[^1].T, PresentationTime + elapsed * Math.Clamp(Speed, .25, 2));
                        while (FrameIndex + 1 < Frames.Count && Frames[FrameIndex + 1].T <= PresentationTime) FrameIndex++;
                        StateHasChanged();
                    });
                    continue;
                }
                var interval = Math.Max(.004, (Frames[FrameIndex + 1].T - Frames[FrameIndex].T) / Math.Max(.25, Speed));
                await Task.Delay(TimeSpan.FromSeconds(interval), token);
                await InvokeAsync(() => { if (!token.IsCancellationRequested && FrameIndex < Frames.Count - 1) { FrameIndex++; StateHasChanged(); } });
            }
            if (!token.IsCancellationRequested && !Disposed) await InvokeAsync(() => { Playing = false; StateHasChanged(); });
        }
        catch (OperationCanceledException) { }
    }
    private async Task TogglePause()
    {
        if (RunningLocal)
        {
            Generation++; RunningLocal = false; Busy = false; await CancelPreview(); Status = "已暂停";
        }
        else if (Playing) StopPlayback();
        else if (!Busy) { await CancelPointer(); StartPlayback(); }
    }
    private void ReplayFromStart() { if (Busy || RunningLocal || ActivePointer is not null) return; StopPlayback(); FrameIndex = 0; StartPlayback(); Status = "回放中"; }
    private void SeekMoment(KeyMoment moment)
    {
        if (Frames.Count == 0) return;
        var nearest = Enumerable.Range(0, Frames.Count).MinBy(i => Math.Abs(Frames[i].T - moment.T));
        Seek(nearest); Status = $"{N(moment.T)} s → {N(CurrentTime)} s";
    }
    private static string JsonText(JsonElement value, string key) => value.TryGetProperty(key, out var item) && item.ValueKind == JsonValueKind.String ? item.GetString() ?? "" : "";
    private void Step() { if (Busy || RunningLocal || ActivePointer is not null) return; StopPlayback(); if (FrameIndex < Frames.Count - 1) FrameIndex++; }
    private async Task Reset() { if (Busy && !RunningLocal) return; await CancelPointer(); StopPlayback(); Generation++; Busy = false; RunningLocal = false; await Js.InvokeVoidAsync("WorkshopBridge.cancel"); FrameIndex = 0; PresentationTime = 0; Status = "已重置"; }
    private void Seek(int n) { if (Busy || RunningLocal || ActivePointer is not null) return; StopPlayback(); FrameIndex = Math.Clamp(n, 0, Math.Max(0, Frames.Count - 1)); }
    private void SeekInput(Microsoft.AspNetCore.Components.ChangeEventArgs e) { if (Number(e, out var n)) Seek((int)n); }
    private RunPose Pose(string id)
    {
        var found = Frames.Count > 0 ? Frames[Math.Clamp(FrameIndex, 0, Frames.Count - 1)].Bodies.FirstOrDefault(b => b.Id == id) : null;
        if (found != null && Playing && SmoothPlayback && FrameIndex + 1 < Frames.Count)
        {
            var nextFrame = Frames[FrameIndex + 1]; var next = nextFrame.Bodies.FirstOrDefault(b => b.Id == id); var duration = nextFrame.T - Frames[FrameIndex].T;
            if (next != null && duration > 0)
            {
                var blend = Math.Clamp((PresentationTime - Frames[FrameIndex].T) / duration, 0, 1);
                var angleStep = next.Angle - found.Angle; var expectedTurn = (found.Omega + next.Omega) * .5 * duration;
                angleStep += Math.Floor((expectedTurn - angleStep) / (2 * Math.PI) + .5) * (2 * Math.PI);
                return new() { Id = id, X = found.X + (next.X - found.X) * blend, Y = found.Y + (next.Y - found.Y) * blend, Angle = found.Angle + angleStep * blend, Vx = found.Vx + (next.Vx - found.Vx) * blend, Vy = found.Vy + (next.Vy - found.Vy) * blend, Omega = found.Omega + (next.Omega - found.Omega) * blend };
            }
        }
        var source = Project.World.Bodies.FirstOrDefault(b => b.Id == id); return found ?? new() { Id = id, X = source?.X ?? 0, Y = source?.Y ?? 0, Angle = source?.Angle ?? 0, Vx = source?.Vx ?? 0, Vy = source?.Vy ?? 0, Omega = source?.Omega ?? 0 };
    }
    private string TracePoints(string id) => string.Join(' ', Frames.Take(Math.Clamp(FrameIndex + 1, 0, Frames.Count)).Select(f => f.Bodies.FirstOrDefault(b => b.Id == id)).Where(b => b != null).Select(b => N(SX(b!.X)) + "," + N(SY(b.Y))));
    private string SpeedPoints
    {
        get { var id = SelectedBody?.Id ?? Project.World.Bodies.FirstOrDefault(b => b.Mode == "dynamic")?.Id; if (id == null || Frames.Count < 2) return ""; var samples = Frames.Select(f => f.Bodies.FirstOrDefault(b => b.Id == id)).Select(b => b == null ? 0 : Math.Sqrt(b.Vx * b.Vx + b.Vy * b.Vy)).ToArray(); var max = Math.Max(.1, samples.Max()); return string.Join(' ', samples.Select((v, i) => N(35 + 570d * i / (samples.Length - 1)) + "," + N(85 - v / max * 70))); }
    }
    private static string CrossPath(double x, double y) => $"M{N(SX(x)-7)} {N(SY(y))}h14M{N(SX(x))} {N(SY(y)-7)}v14";
    private static string JointPath(MechanicalJoint j, RunPose a, RunPose b)
    {
        if (j.Kind == "hinge" || j.Kind == "fixed") return $"M{N(SX(j.AnchorX)-12)} {N(SY(j.AnchorY))}h24M{N(SX(j.AnchorX))} {N(SY(j.AnchorY)-12)}v24";
        if (j.Kind != "spring") return $"M{N(SX(a.X))} {N(SY(a.Y))}L{N(SX(b.X))} {N(SY(b.Y))}";
        var s = new StringBuilder($"M{N(SX(a.X))} {N(SY(a.Y))}"); var dx = SX(b.X) - SX(a.X); var dy = SY(b.Y) - SY(a.Y); var length = Math.Sqrt(dx * dx + dy * dy); var nx = length > 0 ? -dy / length : 0; var ny = length > 0 ? dx / length : 0;
        for (var i = 1; i < 15; i++) { var off = i % 2 == 0 ? -6 : 6; s.Append($"L{N(SX(a.X)+dx*i/15+nx*off)} {N(SY(a.Y)+dy*i/15+ny*off)}"); } s.Append($"L{N(SX(b.X))} {N(SY(b.Y))}"); return s.ToString();
    }
    private async Task SaveLocal()
    { if (!Receipt.Ok) { Status = "请先修正工程参数，再保存。"; return; } await Js.InvokeVoidAsync("WorkshopBridge.localSet", LocalKey, WorkshopJson.Write(Project)); Status = "本地已保存"; }
    private async Task LoadLocal()
    { if (CanvasLocked) return; try { var json = await Js.InvokeAsync<string?>("WorkshopBridge.localGet", LocalKey); if (json == null) { Status = "暂无本地记录"; return; } await ApplyTemplate(json); } catch (Exception e) { Status = "本地存储不可用：" + SafeError(e); } }
    private async Task ImportProject(Microsoft.AspNetCore.Components.ChangeEventArgs _)
    {
        if (CanvasLocked) return;
        try { var json = await Js.InvokeAsync<string>("WorkshopBridge.readFile", "project-file", 5 * 1024 * 1024); using var doc = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 32 }); if (doc.RootElement.TryGetProperty("schema", out var schema) && schema.ValueKind == JsonValueKind.String && schema.GetString() == "ocv.workshop-replay/1") { await AcceptReplay(json); return; } if (Encoding.UTF8.GetByteCount(json) > 131072) throw new ArgumentException("导入工程超过128 KiB。"); var value = doc.RootElement.TryGetProperty("project", out var nested) ? nested.GetRawText() : json; await ApplyTemplate(value); }
        catch (Exception e) { Status = "导入失败：" + SafeError(e); }
    }
    private async Task ExportProject() => await Download("assembly.ocv.json", "application/json", WorkshopJson.Write(new { schema = "ocv.workshop-package/1", units = "SI", domain = WorkshopDomain.Version, engine = EngineVersion, project = Project, receipt = Receipt }));
    private async Task ExportSvg() => await Download("assembly.svg", "image/svg+xml", WorkshopDomain.Svg(Project));
    private async Task ExportReplay()
    { if (LastResult is not { } result) return; await Download("run.ocv-replay.json", "application/json", WorkshopJson.Write(new { schema = "ocv.workshop-replay/1", units = "SI", engine = EngineVersion, sampling="actual result.summary.stepS/sampleEvery; recorded solver poses, not display interpolation", request = DisplayedRequest ?? WorkshopRun.From(Project), project = DisplayedProject ?? Project, result })); }
    private async Task ExportCsv()
    {
        if(LastResult is not{}result)return;
        var summary=result.GetProperty("summary");
        var b = new StringBuilder("# ocv.workshop-csv/1; SI; sampled solver output; engine=" + EngineVersion.Replace('\n', ' ') + "\n# step_s="+JsonNumber(summary,"stepS")+"; sample_every="+JsonNumber(summary,"sampleEvery")+"; dimension=2; angle=rad; interpolation=none\n# model="+(result.TryGetProperty("model",out var model)?model.GetRawText():"not-recorded")+"\ntime_s,body_id,x_m,y_m,angle_rad,vx_m_s,vy_m_s,omega_rad_s\n");
        foreach (var f in Frames) foreach (var p in f.Bodies) b.AppendLine(string.Join(',', N(f.T), p.Id, N(p.X), N(p.Y), N(p.Angle), N(p.Vx), N(p.Vy), N(p.Omega)));
        await Download("run.csv", "text/csv", b.ToString());
    }
    private async Task Download(string name, string mime, string text) => await Js.InvokeVoidAsync("WorkshopBridge.download", name, mime, text);
    [JSInvokable] public async Task AcceptReplay(string json)
    { if (CanvasLocked) return; try { var replay = WorkshopReplayCheck.Read(json); await CancelPointer(); Remember(); Project = replay.Project; ProjectId = ""; ProjectTicket = ""; Revision = 0; Digest = ""; Versions.Clear(); SavedProjectText = ""; Storage = "Local recorded replay"; SelectedExampleId = ""; Selected.Clear(); AcceptResult(replay.Result); DisplayedProject = WorkshopJson.Copy(Project); DisplayedRequest = replay.Request; ResultSource = "replay"; Status = "记录回放已载入"; await Notify(); await Js.InvokeVoidAsync("WorkshopBridge.publishResult", replay.Result.GetRawText(), WorkshopJson.Write(Project), WorkshopJson.Write(replay.Request), true); await InvokeAsync(StateHasChanged); } catch (Exception e) { Status = "回放载入失败：" + SafeError(e); await InvokeAsync(StateHasChanged); } }
    private async Task<JsonElement> Api(string path, object body, CancellationToken token = default)
    {
        using var response = await Http.PostAsJsonAsync(path, body, WorkshopJson.Options, token);
        var text = await response.Content.ReadAsStringAsync(token);
        if (Encoding.UTF8.GetByteCount(text) > 8 * 1024 * 1024) throw new ArgumentException("返回数据超过大小上限。");
        if (!response.IsSuccessStatusCode) throw new ArgumentException($"HTTP {(int)response.StatusCode}: " + (text.Length > 260 ? text[..260] : text));
        using var doc = JsonDocument.Parse(text); return doc.RootElement.Clone();
    }
    private static bool ValidProjectCapability(string id, string ticket) => Guid.TryParse(id, out _) && System.Text.RegularExpressions.Regex.IsMatch(ticket, "^[a-f0-9]{64}$");
    private static ProjectReceipt ReadProjectReceipt(JsonElement r, string knownTicket = "")
    {
        var id = r.GetProperty("id").GetString() ?? "";
        var ticket = r.TryGetProperty("ticket", out var capability) ? capability.GetString() ?? "" : knownTicket;
        var revision = r.GetProperty("revision").GetInt32(); var digest = r.GetProperty("digest").GetString() ?? "";
        if (!ValidProjectCapability(id, ticket) || revision < 1 || !System.Text.RegularExpressions.Regex.IsMatch(digest, "^[a-f0-9]{64}$")) throw new ArgumentException("保存工程记录无效。");
        return new(id, ticket, revision, digest, r.TryGetProperty("storage", out var storage) ? storage.GetString() ?? "PostgreSQL" : "PostgreSQL");
    }
    private void Metadata(ProjectReceipt receipt)
    { ProjectId = receipt.Id; ProjectTicket = receipt.Ticket; Revision = receipt.Revision; Digest = receipt.Digest; Storage = receipt.Storage; RollbackRevision = Math.Max(1, Revision - 1); }
    private async Task<bool> PersistReceipt(ProjectReceipt receipt)
    {
        try { await Js.InvokeVoidAsync("WorkshopBridge.localSet", "ocv.workshop.receipt.v1", WorkshopJson.Write(new { id = receipt.Id, ticket = receipt.Ticket, revision = receipt.Revision })); return true; }
        catch (JSException) { return false; }
    }
    private async Task SaveServer()
    {
        if (CanvasLocked) return;
        if (!Receipt.Ok) { Status = "请先修正工程参数，再保存。"; return; } Busy = true;
        var snapshot = WorkshopJson.Copy(Project); var snapshotText = WorkshopJson.Write(snapshot);
        try { var body = ProjectId.Length == 0 ? (object)new { project = snapshot } : new { project = snapshot, id = ProjectId, ticket = ProjectTicket, expectedRevision = Revision }; var r = await Api("/api/workshop/projects", body); var receipt = ReadProjectReceipt(r, ProjectTicket); if (ProjectId.Length > 0 && receipt.Id != ProjectId) throw new ArgumentException("保存工程标识不一致。"); Metadata(receipt); SavedProjectText = snapshotText; var remembered = await PersistReceipt(receipt); await SharedContext(); Status = $"第 {Revision} 版已保存" + (remembered ? "" : "；浏览器未能记住重开入口。"); }
        catch (Exception e) { Status = "保存失败：" + SafeError(e); }
        finally { Busy = false; }
    }
    private async Task LoadServer()
    { if (CanvasLocked) return; await ReadSavedProject(); }
    private async Task<bool> ReadSavedProject(string? savedId = null, string? savedTicket = null, bool addHistory = true)
    {
        var id = savedId ?? ProjectId; var ticket = savedTicket ?? ProjectTicket;
        if (!ValidProjectCapability(id, ticket)) return false;
        Busy = true;
        try
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            var r = await Api($"/api/workshop/projects/{id}/read", new { ticket }, deadline.Token);
            var p = WorkshopJson.Read<WorkshopProject>(r.GetProperty("project").GetRawText()); var receipt = ReadProjectReceipt(r, ticket);
            if (receipt.Id != id || !WorkshopDomain.Inspect(p).Ok) throw new ArgumentException("已保存工程未通过参数或标识检查。");
            if (Disposed) return false;
            await CancelPointer(); if (addHistory) Remember(); Project = p; Metadata(receipt); SavedProjectText = WorkshopJson.Write(p);
            Selected.RemoveWhere(value => !Project.World.Bodies.Any(body => body.Id == value));
            if (Selected.Count == 0 && Project.World.Bodies.FirstOrDefault(body => body.Mode == "dynamic") is { } first) Selected.Add(first.Id);
            if (!addHistory) FitView();
            var remembered = await PersistReceipt(receipt); await Changed(remembered ? "已载入" : "已载入；浏览器未能记住重开入口。"); return true;
        }
        catch (Exception e) { if (!Disposed) Status = "重开失败：" + SafeError(e); return false; }
        finally { Busy = false; if (!Disposed) await InvokeAsync(StateHasChanged); }
    }
    private async Task ListVersions()
    { try { var r = await Api($"/api/workshop/projects/{ProjectId}/versions", new { ticket = ProjectTicket }); Versions.Clear(); foreach (var v in r.GetProperty("versions").EnumerateArray()) Versions.Add(new(v.GetProperty("revision").GetInt32(), v.TryGetProperty("operation", out var operation) ? operation.GetString() ?? "save" : "save")); Status = "历史版本已载入。"; } catch (Exception e) { Status = "版本列表载入失败：" + SafeError(e); } }
    private async Task BranchServer()
    { if (CanvasLocked || ProjectId.Length == 0) return; Busy = true; try { var name = Project.Name.Length > 70 ? Project.Name[..70] + " / 分支" : Project.Name + " / 分支"; var r = await Api($"/api/workshop/projects/{ProjectId}/branch", new { ticket = ProjectTicket, revision = Revision, name }); var receipt = ReadProjectReceipt(r); var remembered = await PersistReceipt(receipt); if (await ReadSavedProject(receipt.Id, receipt.Ticket)) { Versions.Clear(); Status = "分支已创建" + (remembered ? "" : "；浏览器未能记住重开入口。"); } else Status = "分支已创建；" + Status; } catch (Exception e) { Status = "创建分支失败：" + SafeError(e); } finally { Busy = false; } }
    private async Task RollbackServer()
    { if (CanvasLocked || ProjectId.Length == 0) return; Busy = true; try { var r = await Api($"/api/workshop/projects/{ProjectId}/rollback", new { ticket = ProjectTicket, revision = RollbackRevision, expectedRevision = Revision }); var receipt = ReadProjectReceipt(r, ProjectTicket); if (receipt.Id != ProjectId) throw new ArgumentException("恢复工程标识不一致。"); var remembered = await PersistReceipt(receipt); if (await ReadSavedProject(receipt.Id, receipt.Ticket)) Status = "版本已恢复" + (remembered ? "" : "；浏览器未能记住重开入口。"); else Status = "版本已恢复；" + Status; } catch (Exception e) { Status = "恢复版本失败：" + SafeError(e); } finally { Busy = false; } }
    private async Task SubmitServer(WorkshopRun request, WorkshopProject submittedProject, long submittedGeneration)
    {
        request = RefineRequest(request); submittedProject.World = WorkshopJson.Copy(request.World);
        var epoch = ++SubmissionEpoch; var previousId = JobId; var previousTicket = JobTicket; var cancelPrevious = SubmittedReview is not null && !JobTerminal;
        SubmittedReview = null; JobTerminal = false; ReviewBusy = false; CancellingReview = false;
        JobBusy = true; JobGeneration=submittedGeneration; Polling?.Cancel(); Polling?.Dispose(); Polling = new(); var token = Polling.Token; JobStatus = "复核排队中";
        try
        {
            if (cancelPrevious) await Api($"/api/workshop/jobs/{previousId}/cancel", new { ticket = previousTicket }, token);
            if (token.IsCancellationRequested || Disposed || epoch != SubmissionEpoch) return;
            var linkSaved = ProjectId.Length > 0 && SavedProjectText == WorkshopJson.Write(submittedProject);
            var body = linkSaved ? (object)new { request, project = ProjectId, projectTicket = ProjectTicket } : new { request };
            var r = await Api("/api/workshop/jobs", body);
            var nextId = r.GetProperty("id").GetString() ?? ""; var nextTicket = r.GetProperty("ticket").GetString() ?? "";
            if (token.IsCancellationRequested || Disposed || epoch != SubmissionEpoch)
            {
                if (nextId.Length > 0) await Api($"/api/workshop/jobs/{nextId}/cancel", new { ticket = nextTicket });
                return;
            }
            JobId = nextId; JobTicket = nextTicket; JobStatus = "复核排队中"; await SharedContext();
            SubmittedReview = new(nextId, nextTicket, submittedGeneration, epoch, submittedProject, request);
            _ = PollJob(SubmittedReview, token);
            await InvokeAsync(StateHasChanged);
        }
        catch (OperationCanceledException) { }
        catch (Exception e) { if (!Disposed && epoch == SubmissionEpoch && !token.IsCancellationRequested) { JobStatus = "复核提交失败：" + SafeError(e); JobBusy = false; await InvokeAsync(StateHasChanged); } }
    }
    private static WorkshopRun RefineRequest(WorkshopRun source)
    {
        var fine = WorkshopJson.Copy(source); var world = fine.World;
        world.StepS = Math.Min(source.World.StepS, Math.Max(1d / 240, Math.Max(world.DurationS / 4800, world.StepS / 2)));
        if (WorkshopDomain.TimePlan(world).Steps > 4800) world.StepS = Math.Max(world.StepS, (double)MathF.BitIncrement((float)world.StepS));
        world.SampleEvery = Math.Clamp((int)Math.Ceiling(WorkshopDomain.TimePlan(world).Steps / 255d), 1, 4800);
        return fine;
    }
    private void SetScanValues(Microsoft.AspNetCore.Components.ChangeEventArgs e) => ScanValues = e.Value?.ToString() ?? "";
    private bool TryScan(out WorkshopScan settings, out string error)
    {
        settings = new(); error = "";
        var tokens = ScanValues.Split([',', '，', ';', '；', ' ', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var limits = ScanParameter switch { "motorSpeed" => (-100d, 100d), "gravityY" => (-100d, 100d), "restitution" => (0d, 1d), _ => (double.NaN, double.NaN) };
        var values = new List<double>();
        if (tokens.Length is < 1 or > 9 || ScanTrials is < 1 or > 3) { error = "取值 1–9 个，试验 1–3 次"; return false; }
        foreach (var text in tokens)
        {
            if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) || !double.IsFinite(value) || !double.IsFinite(limits.Item1) || value < limits.Item1 || value > limits.Item2) { error = $"取值范围 {N(limits.Item1)}…{N(limits.Item2)}"; return false; }
            values.Add(value);
        }
        var target = ScanParameter == "motorSpeed" ? ScanTarget : ScanParameter == "restitution" ? ScanBodyTarget : "";
        if (ScanParameter == "motorSpeed" && !Project.World.Motors.Any(m => m.Id == target)) { error = "请选择电机"; return false; }
        if (ScanParameter == "restitution" && !Project.World.Bodies.Any(b => b.Id == target)) { error = "请选择零件"; return false; }
        settings = new() { Parameter = ScanParameter, TargetId = target, Values = values, Trials = ScanTrials }; return true;
    }
    private bool IsCurrentReview(ReviewSubmission submitted) => !Disposed && submitted.Epoch == SubmissionEpoch && submitted.Id == JobId && ReferenceEquals(submitted, SubmittedReview);
    private bool ReadReviewState(JsonElement response, ReviewSubmission submitted)
    {
        var state = response.GetProperty("state").GetString() ?? "unknown";
        JobStatus = "复核 · " + TaskStateName(state);
        if (state is "succeeded" or "completed" or "done")
        {
            if (!response.TryGetProperty("result", out var result) || result.ValueKind != JsonValueKind.Object) throw new ArgumentException("复核记录无效。");
            var reviewed = result.TryGetProperty("analysis", out var analysis) && analysis.ValueKind == JsonValueKind.Object && analysis.TryGetProperty("ok", out var reviewOk) && reviewOk.ValueKind == JsonValueKind.True;
            if (!reviewed) throw new ArgumentException("校核结果无效。");
            if (!result.TryGetProperty("engine", out var engine) || engine.ValueKind != JsonValueKind.Object) throw new ArgumentException("复核记录无效。");
            LastServerResult = result.Clone();
            CachedGeneration = submitted.Generation; CachedProject = submitted.Project; CachedRequest = submitted.Request;
            JobStatus = submitted.Generation == Generation ? "复核已就绪" : "先前复核已完成";
            JobTerminal = true; JobBusy = false; return true;
        }
        if (state is "failed" or "cancelled" or "timed_out")
        {
            JobStatus = state == "failed" ? JobFailure(response) : TaskStateName(state);
            JobTerminal = true; JobBusy = false; return true;
        }
        return false;
    }
    private async Task PollJob(ReviewSubmission submitted, CancellationToken token)
    {
        var deadline = DateTimeOffset.UtcNow.AddDays(7);
        var reads = 0;
        var retry = false;
        try
        {
            while (!token.IsCancellationRequested && IsCurrentReview(submitted) && submitted.Generation == Generation && !JobTerminal && DateTimeOffset.UtcNow < deadline)
            {
                var interval = retry || reads >= 120 ? 15000 : 1000;
                var remaining = deadline - DateTimeOffset.UtcNow;
                if (remaining <= TimeSpan.Zero) break;
                await Task.Delay(TimeSpan.FromMilliseconds(Math.Min(interval, remaining.TotalMilliseconds)), token);
                if (token.IsCancellationRequested || !IsCurrentReview(submitted) || submitted.Generation != Generation || JobTerminal) return;
                if (DateTimeOffset.UtcNow >= deadline) break;
                try
                {
                    var r = await Api($"/api/workshop/jobs/{submitted.Id}/read", new { ticket = submitted.Ticket }, token);
                    reads++;
                    if (token.IsCancellationRequested || !IsCurrentReview(submitted) || submitted.Generation != Generation || JobTerminal) return;
                    retry = false;
                    if (ReadReviewState(r, submitted)) { await InvokeAsync(StateHasChanged); return; }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested) { return; }
                catch (Exception e)
                {
                    reads++;
                    if (token.IsCancellationRequested || !IsCurrentReview(submitted) || submitted.Generation != Generation || JobTerminal) return;
                    if (e.Message.StartsWith("HTTP 404", StringComparison.Ordinal))
                    {
                        JobBusy = false; JobTerminal = true; JobStatus = "复核记录已过期";
                        await InvokeAsync(StateHasChanged); return;
                    }
                    retry = true;
                    JobStatus = "复核暂不可用 · 正在重试";
                }
                await InvokeAsync(StateHasChanged);
            }
            if (IsCurrentReview(submitted) && submitted.Generation == Generation && !JobTerminal && !token.IsCancellationRequested) { JobBusy = false; JobTerminal = true; JobStatus = "复核已过期"; await InvokeAsync(StateHasChanged); }
        }
        catch (OperationCanceledException) { }
    }
    private async Task ShowReviewResult()
    {
        if (!ReviewAvailable || Busy || ReviewBusy) return;
        var generation = Generation; var epoch = SubmissionEpoch;
        ReviewBusy = true;
        try
        {
            if (!ReviewAvailable || CachedProject is not { } project || CachedRequest is not { } request || LastServerResult is not { } result) return;
            if (Disposed || epoch != SubmissionEpoch || generation != Generation) return;
            if (!result.TryGetProperty("engine", out var engine) || engine.ValueKind != JsonValueKind.Object) return;
            await CancelPointer(); StopPlayback(); ResultSource = "review";
            if (request.Op == "scan") { VisibleExperiment = engine.Clone(); VisibleExperimentRequest = request; }
            else
            {
                AcceptResult(engine); DisplayedRequest = request; DisplayedProject = project;
                await Js.InvokeVoidAsync("WorkshopBridge.publishResult", engine.GetRawText(), WorkshopJson.Write(project), WorkshopJson.Write(request), true);
                if (Disposed || epoch != SubmissionEpoch || generation != Generation) return;
                StartPlayback();
            }
            Status = "复核结果";
        }
        catch (Exception e) { if (!Disposed && epoch == SubmissionEpoch && generation == Generation) JobStatus = "复核读取失败：" + SafeError(e); }
        finally { if (!Disposed && epoch == SubmissionEpoch) { ReviewBusy = false; await InvokeAsync(StateHasChanged); } }
    }
    private JsonElement? LastServerResult;
    private IEnumerable<NativeCheck> NativeChecks => LastServerResult is { } result && result.TryGetProperty("analysis", out var analysis) && analysis.ValueKind == JsonValueKind.Object && analysis.TryGetProperty("verification", out var checks) && checks.ValueKind == JsonValueKind.Array ? checks.EnumerateArray().Select(check => new NativeCheck(JsonText(check, "code") switch { "FRAME_CHRONOLOGY" => "时间序列", "FINITE_POSES" => "有限数值", "BODY_REFERENCES" => "零件关联", "SCAN_PLAN" => "实验计划", _ => "一致性" }, check.TryGetProperty("passed", out var passed) && passed.ValueKind == JsonValueKind.True)) : [];
    private static string ScanHeading(JsonElement scan) => ScanParameterName(JsonText(scan, "parameter"));
    private static string JobFailure(JsonElement value)
    {
        var reason = JsonText(value, "error");
        if (reason.Length == 0 && value.TryGetProperty("result", out var result) && result.ValueKind == JsonValueKind.Object) reason = JsonText(result, "reason");
        var http = System.Text.RegularExpressions.Regex.Match(reason, @"HTTP\s+(\d{3})", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (http.Success) return http.Groups[1].Value switch { "413" => "结果传输失败（413）", "429" => "队列已满（429）", "404" => "实验记录已过期（404）", "403" or "401" => "实验凭据失效", _ => "请求失败（" + http.Groups[1].Value + "）" };
        if (reason.Contains("expired", StringComparison.OrdinalIgnoreCase)) return "实验记录已过期";
        if (reason.Contains("timeout", StringComparison.OrdinalIgnoreCase) || reason.Contains("timed", StringComparison.OrdinalIgnoreCase)) return "演算超时";
        if (reason.Contains("cancel", StringComparison.OrdinalIgnoreCase)) return "已取消";
        if (reason.Contains("lease", StringComparison.OrdinalIgnoreCase)) return "调度暂不可用";
        if (reason.Contains("limit", StringComparison.OrdinalIgnoreCase)) return "超出演算限制";
        return "实验失败 · 可重试";
    }
    private static string JsonNumber(JsonElement root,string key) => root.TryGetProperty(key,out var value) && value.ValueKind==JsonValueKind.Number && value.TryGetDouble(out var n) ? N(n) : "—";
    private static string ScanTrace(JsonElement row)
    { if(!row.TryGetProperty("trace",out var trace)||trace.ValueKind!=JsonValueKind.Array||trace.GetArrayLength()<2)return "";var points=trace.EnumerateArray().Select(p=>(T:p.GetProperty("t").GetDouble(),V:p.GetProperty("omega").GetDouble())).ToArray();var duration=Math.Max(.001,points.Max(p=>p.T));var min=points.Min(p=>p.V);var span=Math.Max(.01,points.Max(p=>p.V)-min);return string.Join(' ',points.Select(p=>N(5+140*p.T/duration)+","+N(55-50*(p.V-min)/span))); }
    private async Task ExportServerResult() { if(VisibleExperiment is{} r)await Download("parameter-experiment.json","application/json",WorkshopJson.Write(new{schema="ocv.workshop-experiment/1",request=VisibleExperimentRequest,result=r})); }
    private async Task CancelJob()
    {
        if (!CanCancelReview || SubmittedReview is not { } submitted) return;
        CancellingReview = true;
        try
        {
            await Api($"/api/workshop/jobs/{submitted.Id}/cancel", new { ticket = submitted.Ticket });
            if (!IsCurrentReview(submitted)) return;
            Polling?.Cancel(); JobBusy = false; JobTerminal = true; JobStatus = "已请求取消";
        }
        catch (Exception e) { if (IsCurrentReview(submitted)) JobStatus = "取消失败：" + SafeError(e); }
        finally { if (IsCurrentReview(submitted)) { CancellingReview = false; await InvokeAsync(StateHasChanged); } }
    }
    private static string SafeError(Exception e)
    {
        var message=e.Message.Replace('\n',' ');
        if(System.Text.RegularExpressions.Regex.IsMatch(message,@"[\u4e00-\u9fff]")&&!System.Text.RegularExpressions.Regex.IsMatch(message,@"[A-Za-z]{3}"))return message.Length>240?message[..240]:message;
        if(message.StartsWith("HTTP ",StringComparison.Ordinal)){var status=System.Text.RegularExpressions.Regex.Match(message,@"\d{3}").Value;return status switch { "413" => "数据超过限制（413）", "429" => "队列已满（429）", "409" => "版本冲突（409）", _ => "请求未完成（"+status+"）" };}
        if(message.Contains("cancel",StringComparison.OrdinalIgnoreCase))return "操作已取消。";
        if(message.Contains("timed",StringComparison.OrdinalIgnoreCase)||message.Contains("30 seconds",StringComparison.OrdinalIgnoreCase))return "操作超过等待时限。";
        if(message.Contains("network",StringComparison.OrdinalIgnoreCase)||message.Contains("fetch",StringComparison.OrdinalIgnoreCase))return "无法连接服务，请稍后重试。";
        if(message.Contains("JSON",StringComparison.OrdinalIgnoreCase)||message.Contains("schema",StringComparison.OrdinalIgnoreCase))return "数据格式无效，请使用当前版本的工程文件。";
        return "输入或服务状态异常，请检查参数后重试。";
    }
    public async ValueTask DisposeAsync()
    { Disposed = true; Generation++; StopPlayback(); Polling?.Cancel(); Polling?.Dispose(); Reference?.Dispose(); try { await Js.InvokeVoidAsync("WorkshopBridge.cancel"); } catch (JSException) { } }
    private sealed class RunFrame { public double T { get; set; } public List<RunPose> Bodies { get; set; } = []; public List<JsonElement> Events { get; set; } = []; }
    private sealed class RunPose { public string Id { get; set; } = ""; public double X { get; set; } public double Y { get; set; } public double Angle { get; set; } public double Vx { get; set; } public double Vy { get; set; } public double Omega { get; set; } }
    private sealed record RevisionLine(int Revision, string Operation);
    private sealed record KeyMoment(double T, string Kind, string Title);
    private sealed record NativeCheck(string Name, bool Passed);
    private sealed record ReviewSubmission(string Id, string Ticket, long Generation, long Epoch, WorkshopProject Project, WorkshopRun Request);
    private sealed record ProjectReceipt(string Id, string Ticket, int Revision, string Digest, string Storage);
    private sealed class ExampleCatalogue { public string Schema { get; set; } = ""; public List<ExampleEntry> Entries { get; set; } = []; }
    private sealed class ExampleEntry { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Description { get; set; } = ""; public string Goal { get; set; } = ""; public List<string> Tips { get; set; } = []; public string File { get; set; } = ""; public List<string> Tags { get; set; } = []; }
}

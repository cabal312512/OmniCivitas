using System.Globalization;
using System.Text.Json;
using OmniCivitas.Mechanical;

namespace OmniCivitas.Workshop;

public partial class App
{
    private string ScanMetric = "maxSpeed";
    private static bool ValidScanResult(JsonElement result)=>result.ValueKind==JsonValueKind.Object&&result.TryGetProperty("schema",out var schema)&&schema.GetString()=="ocv.workshop-result/1"&&result.TryGetProperty("ok",out var ok)&&ok.ValueKind is JsonValueKind.True or JsonValueKind.False&&result.TryGetProperty("scan",out var scan)&&scan.ValueKind==JsonValueKind.Object&&scan.TryGetProperty("runs",out var rows)&&rows.ValueKind==JsonValueKind.Array&&rows.GetArrayLength() is >=1 and <=27;
    private IEnumerable<MechanicalDestination> ChallengeZones => Project.Challenge is { } c
        ? c.Kind=="routing" ? c.Targets : c.Kind is "delivery" or "crossing" ? [new() { Body=c.Body,TargetX=c.TargetX,TargetY=c.TargetY,Tolerance=c.Tolerance }] : []
        : [];
    private static bool ScanComputed(JsonElement row)=>row.TryGetProperty("ok",out var ok)&&ok.ValueKind==JsonValueKind.True;
    private static bool ScanAchieved(JsonElement row)=>ScanComputed(row)&&row.TryGetProperty("summary",out var s)&&s.TryGetProperty("challengeComplete",out var achieved)&&achieved.ValueKind==JsonValueKind.True;
    private double ScanScalar(JsonElement row)
    {
        if(!ScanComputed(row))return double.NaN;
        if(ScanMetric=="challenge")return ScanAchieved(row)?1:0;
        return row.TryGetProperty("summary",out var summary)&&summary.TryGetProperty(ScanMetric,out var n)&&n.ValueKind==JsonValueKind.Number&&n.TryGetDouble(out var value)&&double.IsFinite(value)?value:double.NaN;
    }
    private string ScanTileValue(JsonElement row)=>ScanMetric=="challenge"?(ScanComputed(row)?ScanAchieved(row)?"✓":"—":"×"):NOrDash(ScanScalar(row));
    private static string NOrDash(double value)=>double.IsFinite(value)?N(value):"—";
    private string ScanColour(JsonElement rows,JsonElement row)
    {
        var value=ScanScalar(row);if(!double.IsFinite(value))return "#e7edf5";
        var values=rows.EnumerateArray().Select(ScanScalar).Where(double.IsFinite).ToArray();
        var min=values.Min();var span=values.Max()-min;
        var q=span>1e-9?Math.Clamp((value-min)/span,0,1):.5;
        return FormattableString.Invariant($"hsl({218-35*q:0.##} 72% {87-43*q:0.##}%)");
    }
    private static IEnumerable<JsonElement> ScanPoints(JsonElement row)=>row.TryGetProperty("trace",out var t)&&t.ValueKind==JsonValueKind.Array?t.EnumerateArray():[];
    private static (double Left,double Bottom,double Width,double Height) ScanBounds(JsonElement rows)
    {
        var points=rows.EnumerateArray().SelectMany(ScanPoints).Select(p=>(X:p.GetProperty("x").GetDouble(),Y:p.GetProperty("y").GetDouble())).ToArray();
        if(points.Length==0)return(0,0,1,1);
        var left=points.Min(p=>p.X);var bottom=points.Min(p=>p.Y);
        return(left,bottom,Math.Max(.05,points.Max(p=>p.X)-left),Math.Max(.05,points.Max(p=>p.Y)-bottom));
    }
    private static string ScanTrajectory(JsonElement rows,JsonElement row)
    {
        var b=ScanBounds(rows);
        return string.Join(' ',ScanPoints(row).Select(p=>N(32+460*(p.GetProperty("x").GetDouble()-b.Left)/b.Width)+","+N(235-200*(p.GetProperty("y").GetDouble()-b.Bottom)/b.Height)));
    }
    private static string ScanLineColour(JsonElement row)=>FormattableString.Invariant($"hsl({205+12*row.GetProperty("valueIndex").GetInt32()} 75% {40+12*row.GetProperty("trial").GetInt32()}%)");
    private static string ScanIssue(JsonElement row)=>row.TryGetProperty("diagnostics",out var d)&&d.ValueKind==JsonValueKind.Array&&d.GetArrayLength()>0?JsonText(d[0],"code"):ScanComputed(row)?"":"未完成";
    private static string ScanSummaryNumber(JsonElement result,string key)=>result.TryGetProperty("summary",out var summary)?JsonNumber(summary,key):"—";
    private string ScanMetricUnit=>ScanMetric switch{"maxSpeed"=>"m/s","completionTime"=>"s",_=>""};
}

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using OmniCivitas.Mechanical;

public static class WorkshopRoutes
{
    private static readonly SemaphoreSlim Queue = new(2,2);
    public static void Map(WebApplication app)
    {
        app.MapPost("/workshop/prepare.php", async (HttpContext ctx) => { var result=await Handle(ctx,false);await result.ExecuteAsync(ctx); });
        app.MapPost("/workshop/review.php", async (HttpContext ctx) => { var result=await Handle(ctx,true);await result.ExecuteAsync(ctx); });
    }
    private static async Task<IResult> Handle(HttpContext ctx, bool review)
    {
        if (!await Queue.WaitAsync(0, ctx.RequestAborted)) return Results.Json(new {ok=false,error="ME2_BUSY",message="Two mechanical receipts are already in progress."},statusCode:429);
        try
        {
            var limit = review ? 6*1024*1024 : 320*1024;
            if (ctx.Request.ContentLength > limit) return Results.Json(new {ok=false,error="BODY_LIMIT"},statusCode:413);
            using var stream = new MemoryStream(); var buffer = new byte[8192]; int n;
            while ((n = await ctx.Request.Body.ReadAsync(buffer,ctx.RequestAborted)) > 0) { if (stream.Length+n>limit) return Results.Json(new {ok=false,error="BODY_LIMIT"},statusCode:413); await stream.WriteAsync(buffer.AsMemory(0,n),ctx.RequestAborted); }
            using var document = JsonDocument.Parse(stream.ToArray(),new JsonDocumentOptions{MaxDepth=32});
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("request",out var request) || request.ValueKind!=JsonValueKind.Object) throw new ArgumentException("An explicit mechanical request is required.");
            if(Encoding.UTF8.GetByteCount(request.GetRawText())>131072)throw new ArgumentException("Mechanical request exceeds 128 KiB.");
            if (request.GetProperty("schema").GetString() != "ocv.workshop-run/1") throw new ArgumentException("Unknown mechanical run schema.");
            var run=WorkshopJson.Read<WorkshopRun>(request.GetRawText());
            if(root.TryGetProperty("project",out var projectLimit)&&projectLimit.ValueKind==JsonValueKind.Object&&Encoding.UTF8.GetByteCount(projectLimit.GetRawText())>131072)throw new ArgumentException("Saved project exceeds 128 KiB.");
            var project = root.TryGetProperty("project",out var submitted) && submitted.ValueKind==JsonValueKind.Object ? WorkshopJson.Read<WorkshopProject>(submitted.GetRawText()) : new WorkshopProject {Name="Submitted mechanical run",World=run.World,Challenge=run.Challenge};
            // Prepared semantics follow the immutable run payload, not a potentially older saved canvas.
            project.World=run.World; project.Challenge=run.Challenge;
            var receipt=WorkshopDomain.Inspect(project);
            var timing=WorkshopDomain.TimePlan(run.World);
            if (!receipt.Ok) return Results.Json(new {ok=false,contract=WorkshopDomain.Version,diagnostics=receipt.Diagnostics},WorkshopJson.Options,statusCode:422);
            if (run.Op is not ("simulate" or "scan")) throw new ArgumentException("Unknown mechanical operation.");
            if (run.Op=="scan")
            {
                if(run.Scan==null || run.Scan.Values.Count is <1 or >9 || run.Scan.Trials is <1 or >3 || run.Scan.Values.Count*run.Scan.Trials>27)throw new ArgumentException("Invalid bounded scan plan.");
                var scan=run.Scan;
                var expectedTarget=request.GetProperty("scan").TryGetProperty("targetId",out var targetValue)&&targetValue.ValueKind==JsonValueKind.String?targetValue.GetString()??"":"";
                scan.TargetId=expectedTarget;
                var range=scan.Parameter switch { "motorSpeed"=>(-100d,100d,run.World.Motors.Any(m=>m.Id==scan.TargetId)),"restitution"=>(0d,1d,run.World.Bodies.Any(b=>b.Id==scan.TargetId)),"gravityY"=>(-100d,100d,true),_=>(0d,0d,false) };
                if(!range.Item3||scan.Values.Any(v=>!double.IsFinite(v)||v<range.Item1||v>range.Item2))throw new ArgumentException("Unknown scan parameter, target or finite value range.");
            }
            var digest=root.TryGetProperty("digest",out var d) && d.ValueKind==JsonValueKind.String ? d.GetString()??"" : "";
            if (digest.Length!=64 || !digest.All(Uri.IsHexDigit)) throw new ArgumentException("A canonical request digest is required.");
            var canonical=Canonical(request);
            var computed=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
            if (!string.Equals(computed,digest,StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Immutable request checksum does not match.");
            var snapshot=root.TryGetProperty("snapshot",out var snapshotEl)&&snapshotEl.ValueKind==JsonValueKind.String ? snapshotEl.GetString() : null;
            int? revision=root.TryGetProperty("revision",out var revisionEl)&&revisionEl.ValueKind==JsonValueKind.Number ? revisionEl.GetInt32() : null;
            if (!review) return Results.Json(new {ok=true,engine=WorkshopDomain.Version,contract="ocv.workshop-receipt/1",requestDigest=computed,snapshot,revision,units=receipt.Units,bom=receipt.Bom,connections=receipt.Connections,diagnostics=receipt.Diagnostics,summary=new{receipt.Bodies,receipt.Joints,receipt.Motors,receipt.PlannedSteps,receipt.PlannedFrames,plannedEndS=timing.EndS,timeBase="f32 fixed-step ME1"},challengeTemplates=new[]{new{id="delivery-01",kind="delivery",criterion="reach target with speed below 2 m/s for 0.1 s after minTime"},new{id="steady-01",kind="steady",criterion="associated motor speed remains within tolerance for 0.5 s after minTime"},new{id="routing-01",kind="routing",criterion="2–8 distinct dynamic bodies remain in their own destinations below 2 m/s simultaneously for 0.1 s after minTime"},new{id="crossing-01",kind="crossing",criterion="start left of destination, then remain inside it for 0.1 s after minTime within the total dynamic-body maxParts budget"}}},WorkshopJson.Options);
            if (!root.TryGetProperty("result",out var result) || result.ValueKind!=JsonValueKind.Object || !result.TryGetProperty("ok",out var nativeOk)||(nativeOk.ValueKind is not (JsonValueKind.True or JsonValueKind.False))) throw new ArgumentException("An explicit native result outcome is required.");
            var nativeSucceeded=nativeOk.ValueKind==JsonValueKind.True;
            var partial=run.Op=="scan"&&!nativeSucceeded;
            if(!nativeSucceeded&&!partial)throw new ArgumentException("Only a successful simulation or a complete bounded scan with retained failures can be reviewed.");
            if(Encoding.UTF8.GetByteCount(result.GetRawText())>4*1024*1024 || !result.TryGetProperty("schema",out var resultSchema)||resultSchema.GetString()!="ocv.workshop-result/1")throw new ArgumentException("Native result schema or size is invalid.");
            var checks=new List<object>(); var observedFrames=0; var observedBodies=0; var monotone=true; var finite=true; var references=true; var previous=-1d;
            var ids=run.World.Bodies.Select(b=>b.Id).ToHashSet(StringComparer.Ordinal);
            if (result.TryGetProperty("frames",out var frames)&&frames.ValueKind==JsonValueKind.Array)
            {
                if (frames.GetArrayLength()>256) throw new ArgumentException("Native frame limit exceeded.");
                if(run.Op=="simulate"&&frames.GetArrayLength()<1)throw new ArgumentException("A simulated result needs at least one sampled frame.");
                foreach(var frame in frames.EnumerateArray())
                {
                    var t=frame.GetProperty("t").GetDouble(); finite &= double.IsFinite(t); monotone &= t>=previous && t>=0 && t<=timing.EndS+timing.ToleranceS; previous=t;observedFrames++;
                    var seen=new HashSet<string>();var bodies=frame.GetProperty("bodies"); if(bodies.GetArrayLength()>64)throw new ArgumentException("Native body limit exceeded.");
                    foreach(var body in bodies.EnumerateArray()) { var id=body.GetProperty("id").GetString()??"";references &= ids.Contains(id)&&seen.Add(id); observedBodies++; foreach(var field in new[]{"x","y","angle","vx","vy","omega"}) finite &= double.IsFinite(body.GetProperty(field).GetDouble()); }
                    references &= seen.Count==ids.Count;
                }
            }
            else if(run.Op!="scan")throw new ArgumentException("Missing native replay frames.");
            checks.Add(new{code="FRAME_CHRONOLOGY",passed=monotone,scope="monotone sampled times within the requested duration"});
            checks.Add(new{code="FINITE_POSES",passed=finite,scope="all returned pose and velocity scalars"});
            checks.Add(new{code="BODY_REFERENCES",passed=references,scope="each sampled body corresponds to the immutable submitted assembly"});
            var scanRows=0;var scanValid=true;var successfulTrials=0;var failedTrials=0;
            var failureReasons=new List<object>();
            if(run.Op=="scan")
            {
                if(!result.TryGetProperty("scan",out var nativeScan)||nativeScan.ValueKind!=JsonValueKind.Object||!nativeScan.TryGetProperty("runs",out var rows)||rows.ValueKind!=JsonValueKind.Array)throw new ArgumentException("Missing native parameter trials.");
                scanRows=rows.GetArrayLength();scanValid=scanRows==run.Scan!.Values.Count*run.Scan.Trials&&scanRows<=27;
                scanValid &= nativeScan.TryGetProperty("parameter",out var scanParameter)&&scanParameter.ValueKind==JsonValueKind.String&&scanParameter.GetString()==run.Scan.Parameter
                    && nativeScan.TryGetProperty("targetId",out var scanTarget)&&scanTarget.ValueKind==JsonValueKind.String&&scanTarget.GetString()==run.Scan.TargetId;
                var rowIndex=0;
                var traceBody=run.Challenge?.Body??run.World.Bodies.FirstOrDefault(b=>b.Mode=="dynamic")?.Id??run.World.Bodies[0].Id;
                foreach(var row in rows.EnumerateArray())
                {
                    var expectedValue=rowIndex/run.Scan!.Trials;var expectedTrial=rowIndex%run.Scan.Trials;
                    var rowOk=row.ValueKind==JsonValueKind.Object&&row.TryGetProperty("ok",out var outcome)&&(outcome.ValueKind==JsonValueKind.True||outcome.ValueKind==JsonValueKind.False);
                    if(!rowOk){scanValid=false;rowIndex++;continue;}
                    var succeeded=row.GetProperty("ok").ValueKind==JsonValueKind.True;
                    if(succeeded)successfulTrials++;else failedTrials++;
                    scanValid &= Int(row,"index",rowIndex)&&Int(row,"valueIndex",expectedValue)&&Int(row,"trial",expectedTrial);
                    scanValid &= expectedValue<run.Scan.Values.Count&&Number(row,"value",out var scalar)&&Close(scalar,(double)(float)run.Scan.Values[Math.Min(expectedValue,run.Scan.Values.Count-1)]);
                    scanValid &= row.TryGetProperty("traceBody",out var observed)&&observed.ValueKind==JsonValueKind.String&&observed.GetString()==traceBody&&ids.Contains(traceBody);
                    if(!row.TryGetProperty("summary",out var trialSummary)||trialSummary.ValueKind!=JsonValueKind.Object){scanValid=false;rowIndex++;continue;}
                    scanValid &= Bool(trialSummary,"complete",succeeded)&&Number(trialSummary,"durationS",out var duration)&&duration>=0&&duration<=timing.EndS+timing.ToleranceS;
                    scanValid &= Number(trialSummary,"stepS",out var step)&&Close(step,(double)(float)run.World.StepS)&&IntRange(trialSummary,"steps",1,timing.Steps,out var steps);
                    if(Number(trialSummary,"durationS",out duration)&&Number(trialSummary,"stepS",out step)&&IntRange(trialSummary,"steps",1,timing.Steps,out steps))scanValid &= Close(duration,(double)((float)steps*(float)step));
                    if(succeeded)scanValid &= Int(trialSummary,"steps",timing.Steps)&&Number(trialSummary,"durationS",out duration)&&Close(duration,timing.EndS);
                    if(!succeeded)
                    {
                        if(!row.TryGetProperty("diagnostics",out var issues)||issues.ValueKind!=JsonValueKind.Array||issues.GetArrayLength() is <1 or >64)scanValid=false;
                        else foreach(var issue in issues.EnumerateArray())
                        {
                            if(issue.ValueKind!=JsonValueKind.Object||!issue.TryGetProperty("code",out var code)||code.ValueKind!=JsonValueKind.String||string.IsNullOrWhiteSpace(code.GetString())||code.GetString()!.Length>64)scanValid=false;
                            else failureReasons.Add(new {index=rowIndex,code=code.GetString()});
                        }
                    }
                    if(!row.TryGetProperty("trace",out var trace)||trace.ValueKind!=JsonValueKind.Array||trace.GetArrayLength() is <1 or >32){scanValid=false;rowIndex++;continue;}
                    var previousTrace=-1d;
                    foreach(var sample in trace.EnumerateArray())
                    {
                        foreach(var field in new[]{"t","x","y","omega"})if(!Number(sample,field,out _))scanValid=false;
                        if(!Number(sample,"t",out var t)){scanValid=false;continue;}
                        scanValid &=t>=previousTrace&&t>=0&&t<=duration+timing.ToleranceS;
                        if(Number(sample,"x",out var x)&&Number(sample,"y",out var y))scanValid &=Math.Sqrt(x*x+y*y)<=10000.01;
                        previousTrace=t;
                    }
                    if(succeeded)scanValid &= Close(previousTrace,duration);
                    rowIndex++;
                }
                scanValid &= nativeSucceeded==(failedTrials==0)&&successfulTrials+failedTrials==scanRows;
                scanValid &= result.TryGetProperty("summary",out var summary)&&summary.ValueKind==JsonValueKind.Object&&Int(summary,"runCount",scanRows)&&Int(summary,"successfulRuns",successfulTrials)&&Int(summary,"failedRuns",failedTrials)&&Bool(summary,"complete",nativeSucceeded);
                checks.Add(new{code="SCAN_PLAN",passed=scanValid,scope="exact indexed immutable parameter/trial plan, trace identity, finite retained coordinates, chronology, outcomes and failure diagnostics; partial is not numerical success"});
            }
            var resultCanonical=Canonical(result); var resultDigest=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(resultCanonical))).ToLowerInvariant();
            var fingerprint=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(computed+":"+resultDigest+":"+WorkshopDomain.Version))).ToLowerInvariant();
            return Results.Json(new{ok=finite&&monotone&&references&&scanValid,partial,nativeSucceeded,engine=WorkshopDomain.Version,contract="ocv.workshop-review/1",requestDigest=computed,resultDigest,verificationFingerprint=fingerprint,snapshot,revision,units=receipt.Units,bom=receipt.Bom,connections=receipt.Connections,diagnostics=receipt.Diagnostics,verification=checks,summary=new{observedFrames,observedBodies,scanRows,successfulTrials,failedTrials,nativeResultReplaced=false,domainOnly=true,partial,nativeSucceeded},failureReasons,modelScope="Bounded planar rigid-body assembly. Domain consistency review; not independent physics certification. A valid partial scan preserves failed trials and does not certify their numerical success."},WorkshopJson.Options);
        }
        catch(OperationCanceledException){return Results.Json(new{ok=false,error="CANCELLED"},statusCode:408);}
        catch(Exception e) when(e is JsonException or ArgumentException or InvalidOperationException or KeyNotFoundException or NullReferenceException or FormatException or OverflowException)
        {return Results.Json(new{ok=false,error="ME2_INPUT",message=e.Message.Length>240?e.Message[..240]:e.Message},statusCode:400);}
        finally{Queue.Release();}
    }
    private static bool Number(JsonElement value,string name,out double number)
    { number=double.NaN;return value.ValueKind==JsonValueKind.Object&&value.TryGetProperty(name,out var field)&&field.ValueKind==JsonValueKind.Number&&field.TryGetDouble(out number)&&double.IsFinite(number); }
    private static bool Int(JsonElement value,string name,int expected)=>IntRange(value,name,expected,expected,out _);
    private static bool IntRange(JsonElement value,string name,int min,int max,out int number)
    { number=0;return value.ValueKind==JsonValueKind.Object&&value.TryGetProperty(name,out var field)&&field.ValueKind==JsonValueKind.Number&&field.TryGetInt32(out number)&&number>=min&&number<=max; }
    private static bool Bool(JsonElement value,string name,bool expected)=>value.ValueKind==JsonValueKind.Object&&value.TryGetProperty(name,out var field)&&field.ValueKind==(expected?JsonValueKind.True:JsonValueKind.False);
    private static bool Close(double a,double b)=>double.IsFinite(a)&&double.IsFinite(b)&&Math.Abs(a-b)<=1e-6*Math.Max(1,Math.Abs(b));
    private static string Canonical(JsonElement element)
    {
        using var stream=new MemoryStream();using(var writer=new Utf8JsonWriter(stream,new JsonWriterOptions{Encoder=System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping}))Write(writer,element);return Encoding.UTF8.GetString(stream.ToArray());
    }
    private static void Write(Utf8JsonWriter writer,JsonElement value)
    {
        switch(value.ValueKind)
        {
            case JsonValueKind.Object:writer.WriteStartObject();foreach(var property in value.EnumerateObject().OrderBy(p=>p.Name,StringComparer.Ordinal)){writer.WritePropertyName(property.Name);Write(writer,property.Value);}writer.WriteEndObject();break;
            case JsonValueKind.Array:writer.WriteStartArray();foreach(var item in value.EnumerateArray())Write(writer,item);writer.WriteEndArray();break;
            default:value.WriteTo(writer);break;
        }
    }
}

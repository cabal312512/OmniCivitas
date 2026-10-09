using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace OmniCivitas.Storage2.Invoices;

public abstract class Receipt
{
    public string Contract { get; init; } = "ocv.shared-artifact/1";
    public required Guid Job { get; init; }
    public required JsonElement Source { get; init; }
    public required string SourceDigest { get; init; }
}

public sealed class Common : Receipt
{
    public required string Kind { get; init; }
    public required JsonElement Dataset { get; init; }
    public required JsonElement Analysis { get; init; }
    public required JsonElement Version { get; init; }
    public JsonElement? Compatibility { get; init; }
}

public static class Config
{
    public const int MaximumInputBytes = 8 * 1024 * 1024;
    public const int MaximumUnpackedBytes = 8 * 1024 * 1024;
    public const int MaximumPackedBytes = 3 * 1024 * 1024;
    public const int MaximumEntries = 24;
    public static readonly HashSet<string> Kinds = ["mechanical", "circuit", "communication", "digital", "network", "music", "table"];
    public static readonly HashSet<string> Papers = ["analysis.svg", "heatmap.svg", "samples.csv", "statistics.csv", "comparison.csv", "analysis.json"];
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { MaxDepth = 48 };
    public static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    public static bool Digest(string? value) => value != null && Regex.IsMatch(value, "\\A[0-9a-f]{64}\\z", RegexOptions.CultureInvariant);

    public static JsonElement Object(JsonElement parent, string field)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(field, out var value) || value.ValueKind != JsonValueKind.Object)
            throw new ArgumentException(field + " must be an object.");
        return value;
    }

    public static string Text(JsonElement parent, string field, int maximum = 128)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(field, out var value) || value.ValueKind != JsonValueKind.String)
            throw new ArgumentException(field + " must be a string.");
        var result = value.GetString()!;
        if (result.Length is 0 || result.Length > maximum || result.Any(char.IsControl))
            throw new ArgumentException(field + " has an unsupported length or character.");
        return result;
    }

    public static void Exact(JsonElement value, params string[] allowed)
    {
        if (value.ValueKind != JsonValueKind.Object) throw new ArgumentException("An object is required.");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
            if (!allowed.Contains(property.Name, StringComparer.Ordinal) || !seen.Add(property.Name))
                throw new ArgumentException("Unknown or duplicate envelope field: " + property.Name);
    }

    public static Common Read(JsonElement value)
    {
        Exact(value, "contract", "job", "source", "dataset", "analysis", "version", "compatibility");
        if (Text(value, "contract") != "ocv.shared-artifact/1") throw new ArgumentException("Unsupported artifact contract.");
        if (!Guid.TryParse(Text(value, "job"), out var job)) throw new ArgumentException("job must be a UUID.");
        var source = Object(value, "source");
        Exact(source, "runId", "projectId", "revision", "digest", "engine", "version");
        if (!Guid.TryParse(Text(source, "runId"), out var run)) throw new ArgumentException("source.runId must be a UUID.");
        var digest = Text(source, "digest");
        if (!Digest(digest)) throw new ArgumentException("source.digest must be a lowercase SHA256.");
        if (source.TryGetProperty("projectId", out var project) && project.ValueKind != JsonValueKind.Null &&
            (project.ValueKind != JsonValueKind.String || !Guid.TryParse(project.GetString(), out _)))
            throw new ArgumentException("source.projectId must be a UUID.");
        if (source.TryGetProperty("revision", out var revision) && revision.ValueKind != JsonValueKind.Null &&
            (!revision.TryGetInt32(out var number) || number < 0))
            throw new ArgumentException("source.revision must be a nonnegative 32-bit integer.");
        var dataset = Object(value, "dataset");
        Exact(dataset, "kind", "request", "result", "notes", "columns", "rows", "format", "csv", "submitted", "label");
        var kind = Text(dataset, "kind");
        if (!Kinds.Contains(kind)) throw new ArgumentException("Unsupported artifact dataset kind.");
        if (kind is "music" or "table")
        {
            if (!dataset.TryGetProperty("submitted", out var submitted) || submitted.ValueKind != JsonValueKind.True)
                throw new ArgumentException("Music/table artifact assembly requires explicit submission.");
        }
        else
        {
            var result = Object(dataset, "result");
            if (!result.TryGetProperty("ok", out var nativeOk) || nativeOk.ValueKind != JsonValueKind.True)
                ValidatePartialScan(dataset);
            if (kind == "digital" && (Text(Object(dataset, "request"), "op") != "digital" ||
                Text(result, "schema") != "ocv.signals/1" || !result.TryGetProperty("trace", out var trace) ||
                trace.ValueKind != JsonValueKind.Array || trace.GetArrayLength() is < 1 or > 4096))
                throw new ArgumentException("A digital artifact requires the actual successful sampled boolean timing result.");
        }
        var analysis = Object(value, "analysis");
        if (!analysis.TryGetProperty("ok", out var ok) || ok.ValueKind != JsonValueKind.True ||
            Text(analysis, "schema") != "ocv.shared-analysis-result/1" || Text(analysis, "sourceDigest") != digest)
            throw new ArgumentException("The supplied shared-analysis result is incompatible with the source.");
        var analysisSource = Object(analysis, "source");
        if (!Guid.TryParse(Text(analysisSource, "runId"), out var analysisRun) || analysisRun != run)
            throw new ArgumentException("Analysis source run differs from the artifact source.");
        if (Text(Object(analysis, "dataset"), "kind") != kind)
            throw new ArgumentException("Analysis source kind differs from the artifact source.");
        var version = Object(value, "version");
        if (Canonical(version).Length > 262144) throw new ArgumentException("The version manifest exceeds 256 KiB.");
        JsonElement? compatibility = null;
        if (value.TryGetProperty("compatibility", out var old) && old.ValueKind != JsonValueKind.Null)
        {
            if (old.ValueKind != JsonValueKind.Object || !old.TryGetProperty("ok", out var success) || success.ValueKind != JsonValueKind.True ||
                Text(old, "contract") != "ocv.shared-artifact/1" || Text(old, "sourceDigest") != digest)
                throw new ArgumentException("The compatibility receipt does not match the source.");
            if (Encoding.UTF8.GetByteCount(old.GetRawText()) > 131072) throw new ArgumentException("The compatibility receipt exceeds 128 KiB.");
            compatibility = old.Clone();
        }
        return new Common { Job = job, Source = source.Clone(), SourceDigest = digest, Kind = kind,
            Dataset = dataset.Clone(), Analysis = analysis.Clone(), Version = version.Clone(), Compatibility = compatibility };
    }

    private static double Number(JsonElement value, string field, double low = -1e150, double high = 1e150)
    {
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(field, out var cell) || cell.ValueKind != JsonValueKind.Number ||
            !cell.TryGetDouble(out var number) || !double.IsFinite(number) || number < low || number > high)
            throw new ArgumentException("A finite bounded scan number is required: " + field);
        return number;
    }

    private static int Integer(JsonElement value, string field, int low = 0, int high = 27)
    {
        var number = Number(value, field, low, high);
        if (number != Math.Truncate(number)) throw new ArgumentException("An integer scan count is required: " + field);
        return (int)number;
    }

    private static bool Flag(JsonElement value, string field)
    {
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(field, out var cell) || cell.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            throw new ArgumentException("An explicit boolean scan outcome is required: " + field);
        return cell.ValueKind == JsonValueKind.True;
    }

    private static JsonElement Rows(JsonElement value, string field, int low, int high)
    {
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(field, out var rows) || rows.ValueKind != JsonValueKind.Array || rows.GetArrayLength() < low || rows.GetArrayLength() > high)
            throw new ArgumentException("A bounded scan array is required: " + field);
        return rows;
    }

    private static bool Close(double left, double right) => Math.Abs(left - right) <= 1e-5 * Math.Max(1, Math.Max(Math.Abs(left), Math.Abs(right)));

    private static void ValidatePartialScan(JsonElement dataset)
    {
        var request = Object(dataset, "request");
        var result = Object(dataset, "result");
        if (Text(dataset, "kind") != "mechanical" || Text(request, "schema") != "ocv.workshop-run/1" ||
            Text(request, "op") != "scan" || Text(result, "schema") != "ocv.workshop-result/1" || Flag(result, "ok"))
            throw new ArgumentException("Only a complete bounded workshop scan may retain failed native outcomes.");
        var plan = Object(request, "scan"); var scan = Object(result, "scan");
        var values = Rows(plan, "values", 1, 9);
        var trials = plan.TryGetProperty("trials", out _) ? Integer(plan, "trials", 1, 3) : 1;
        var parameter = Text(plan, "parameter");
        var target = plan.TryGetProperty("targetId", out var targetId) && targetId.ValueKind == JsonValueKind.String ? targetId.GetString() : "";
        if (parameter is not ("gravityY" or "motorSpeed" or "restitution") || Text(scan, "parameter") != parameter ||
            !scan.TryGetProperty("targetId", out var observedTarget) || observedTarget.ValueKind != JsonValueKind.String || observedTarget.GetString() != target)
            throw new ArgumentException("The partial scan target must match its immutable plan.");
        var plannedValues = new List<double>();
        foreach (var cell in values.EnumerateArray())
        {
            if (cell.ValueKind != JsonValueKind.Number || !cell.TryGetDouble(out var number) || !double.IsFinite(number) ||
                number < (parameter == "restitution" ? 0 : -100) || number > (parameter == "restitution" ? 1 : 100))
                throw new ArgumentException("Invalid finite scan parameter range.");
            plannedValues.Add(number);
        }
        var runs = Rows(scan, "runs", 1, 27);
        if (runs.GetArrayLength() != plannedValues.Count * trials) throw new ArgumentException("The partial scan must retain every planned trial.");
        var successful = 0; var achieved = 0; var index = 0;
        var completed = new int[plannedValues.Count]; var challenges = new int[plannedValues.Count];
        var times = Enumerable.Range(0, plannedValues.Count).Select(_ => new List<double>()).ToArray();
        foreach (var row in runs.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Object) throw new ArgumentException("Every scan row must be an object.");
            var valueIndex = index / trials;
            if (Integer(row, "index") != index || Integer(row, "valueIndex") != valueIndex || Integer(row, "trial") != index % trials ||
                !Close(Number(row, "value"), plannedValues[valueIndex])) throw new ArgumentException("The scan rows must match the immutable indexed plan.");
            var succeeded = Flag(row, "ok"); var summary = Object(row, "summary");
            if (Flag(summary, "complete") != succeeded) throw new ArgumentException("Trial completion differs from its native numerical outcome.");
            var challenge = Flag(summary, "challengeComplete"); var duration = Number(summary, "durationS", 0, 1e6);
            Number(summary, "maxSpeed", 0); Integer(summary, "collisions", 0, int.MaxValue);
            if (summary.TryGetProperty("completionTime", out var completion) && completion.ValueKind != JsonValueKind.Null)
            {
                var when = Number(summary, "completionTime", 0, duration + 1e-5);
                if (succeeded) times[valueIndex].Add(when);
            }
            var diagnostics = Rows(row, "diagnostics", succeeded ? 0 : 1, 64);
            foreach (var issue in diagnostics.EnumerateArray()) Text(issue, "code", 64);
            Text(row, "traceBody", 64);
            var trace = Rows(row, "trace", 1, 32); var previous = -1d;
            foreach (var point in trace.EnumerateArray())
            {
                if (point.ValueKind != JsonValueKind.Object) throw new ArgumentException("A retained scan point must be an object.");
                var when = Number(point, "t", 0, duration + 1e-5);
                if (when < previous) throw new ArgumentException("Retained scan times must remain ordered.");
                previous = when; foreach (var field in new[] { "x", "y", "omega" }) Number(point, field);
            }
            if (succeeded && !Close(previous, duration)) throw new ArgumentException("A completed scan trace must retain its endpoint.");
            if (succeeded) { successful++; completed[valueIndex]++; if (challenge) { achieved++; challenges[valueIndex]++; } }
            index++;
        }
        var total = runs.GetArrayLength(); var aggregate = Object(result, "summary");
        if (successful == total || Flag(scan, "complete") || Flag(aggregate, "complete") ||
            Integer(aggregate, "runCount") != total || Integer(aggregate, "successfulRuns") != successful ||
            Integer(aggregate, "failedRuns") != total - successful || Integer(aggregate, "challengeCompletions") != achieved ||
            !Close(Number(aggregate, "successRate", 0, 1), (double)achieved / total))
            throw new ArgumentException("The partial scan aggregate contradicts its retained native outcomes.");
        var valueSummary = Rows(scan, "valueSummary", 1, 9);
        if (valueSummary.GetArrayLength() != plannedValues.Count) throw new ArgumentException("A partial scan needs every planned per-value aggregate.");
        index = 0;
        foreach (var row in valueSummary.EnumerateArray())
        {
            if (Integer(row, "valueIndex") != index || Integer(row, "trials") != trials || Integer(row, "computed") != completed[index] ||
                Integer(row, "failed") != trials - completed[index] || Integer(row, "challengeCompletions") != challenges[index] ||
                !Close(Number(row, "value"), plannedValues[index]) || !Close(Number(row, "challengeSuccessRate", 0, 1), (double)challenges[index] / trials))
                throw new ArgumentException("A scan per-value aggregate contradicts its native rows.");
            if (!row.TryGetProperty("meanCompletionTimeS", out var mean) || (times[index].Count == 0 ? mean.ValueKind != JsonValueKind.Null :
                !Close(Number(row, "meanCompletionTimeS", 0, 1e6), times[index].Average())))
                throw new ArgumentException("Scan time aggregation must exclude uncompleted numerical trials.");
            index++;
        }
    }

    public static object ModelScope(Common invoice)
    {
        if (invoice.Kind == "digital") return new { type = "digital", axisUnit = "s", valueUnit = "boolean",
            encoding = "JSON false/true; normalized inspection uses numeric 0/1, never analog voltage",
            scope = "Recorded ideal synchronous boolean timing. No propagation delay, setup/hold or metastability; archive assembly does not simulate again." };
        bool? nativeSucceeded = invoice.Dataset.TryGetProperty("result", out var result) && result.TryGetProperty("ok", out var outcome) &&
            outcome.ValueKind is JsonValueKind.True or JsonValueKind.False ? outcome.ValueKind == JsonValueKind.True : null;
        var partial = invoice.Kind == "mechanical" && nativeSucceeded == false;
        return new { type = invoice.Kind, partial, nativeSucceeded,
            scope = partial ? "Complete bounded indexed mechanical scan with retained numerical failures. diagnostic.* channels are failed-trial observations, not successful physical solutions; native outcomes remain authoritative."
                : "Derived inspection of retained source data; original numerical model and units remain authoritative." };
    }

    public static byte[] Canonical<T>(T value)
    {
        using var output = new MemoryStream();
        using (var writer = new Utf8JsonWriter(output, new JsonWriterOptions { Indented = false }))
        {
            var element = value is JsonElement existing ? existing : JsonSerializer.SerializeToElement(value, Options);
            Write(writer, element);
        }
        return output.ToArray();
    }

    private static void Write(Utf8JsonWriter writer, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var property in value.EnumerateObject().OrderBy(property => property.Name, StringComparer.Ordinal))
                { writer.WritePropertyName(property.Name); Write(writer, property.Value); }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in value.EnumerateArray()) Write(writer, item);
                writer.WriteEndArray();
                break;
            case JsonValueKind.Number:
                if (value.TryGetInt64(out var integer)) writer.WriteNumberValue(integer);
                else if (value.TryGetDecimal(out var decimalValue)) writer.WriteNumberValue(decimalValue);
                else { var number = value.GetDouble(); if (!double.IsFinite(number)) throw new ArgumentException("A finite JSON number is required."); writer.WriteNumberValue(number); }
                break;
            default:
                value.WriteTo(writer);
                break;
        }
    }

    public static byte[] Artifact(JsonElement element)
    {
        Exact(element, "name", "mime", "content", "bytes", "sha256", "encoding");
        var name = Text(element, "name");
        if (!Papers.Contains(name)) throw new ArgumentException("An analysis artifact name is outside the fixed registry.");
        var mime = Text(element, "mime");
        var expected = name.EndsWith(".svg", StringComparison.Ordinal) ? "image/svg+xml" : name.EndsWith(".csv", StringComparison.Ordinal) ? "text/csv" : "application/json";
        if (mime != expected) throw new ArgumentException("Analysis artifact MIME does not match its fixed extension.");
        if (!element.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.String)
            throw new ArgumentException("Analysis artifact content must be UTF-8 text.");
        var bytes = Encoding.UTF8.GetBytes(content.GetString()!);
        if (bytes.Length > 1048576 || !element.TryGetProperty("bytes", out var length) || !length.TryGetInt32(out var count) || count != bytes.Length ||
            Text(element, "sha256") != Hash(bytes)) throw new ArgumentException("An analysis artifact byte count/checksum differs from its content.");
        return bytes;
    }
}

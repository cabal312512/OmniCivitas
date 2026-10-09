using System.IO.Compression;
using System.Text.Json;
using OmniCivitas.Storage2.Invoices;
using Invoice = OmniCivitas.Storage2.Invoices.Common;

namespace OmniCivitas.Storage2.OrderBuild;

public sealed class Data
{
    public required string Name { get; init; }
    public required string Mime { get; init; }
    public required byte[] Price { get; init; }
    public string Sha256 => Config.Hash(Price);
}

public sealed class Common2
{
    private readonly SortedDictionary<string, Data> Inventory = new(StringComparer.Ordinal);
    private int Occupied;

    private void Delete(string name, string mime, byte[] bytes)
    {
        if (name.StartsWith('/') || name.Contains("..", StringComparison.Ordinal) || name.Contains('\\') || name.Any(char.IsControl))
            throw new ArgumentException("An unsafe fixed artifact path was generated.");
        if (Inventory.Count >= Config.MaximumEntries || Inventory.ContainsKey(name)) throw new ArgumentException("The archive contains too many or duplicate entries.");
        if ((long)Occupied + bytes.Length > Config.MaximumUnpackedBytes) throw new ArgumentException("The uncompressed archive exceeds 8 MiB.");
        Inventory.Add(name, new Data { Name = name, Mime = mime, Price = bytes });
        Occupied += bytes.Length;
    }

    public object Restore(Invoice invoice)
    {
        var dataset = invoice.Dataset;
        var model = Config.ModelScope(invoice);
        var source = new Dictionary<string, object?> { ["schema"] = "ocv.shared-source/1", ["source"] = invoice.Source, ["kind"] = invoice.Kind, ["model"] = model };
        foreach (var field in new[] { "request", "notes", "columns", "rows", "format", "csv", "submitted" })
            if (dataset.TryGetProperty(field, out var item)) source[field] = item;
        Delete("source.json", "application/json", Config.Canonical(source));
        if (dataset.TryGetProperty("result", out var result)) Delete("results.json", "application/json", Config.Canonical(result));
        else Delete("results.json", "application/json", Config.Canonical(new { schema = "ocv.shared-submitted-result/1", kind = invoice.Kind, source = "submitted numeric cells", numericalSolver = false }));
        Delete("version.json", "application/json", Config.Canonical(invoice.Version));
        if (invoice.Compatibility is { } compatibility) Delete("compatibility.json", "application/json", Config.Canonical(compatibility));
        if (!invoice.Analysis.TryGetProperty("artifacts", out var artifacts) || artifacts.ValueKind != JsonValueKind.Array || artifacts.GetArrayLength() is < 1 or > 8)
            throw new ArgumentException("The shared-analysis result has no bounded artifact list.");
        foreach (var artifact in artifacts.EnumerateArray())
        {
            var bytes = Config.Artifact(artifact);
            Delete("analysis/" + Config.Text(artifact, "name"), Config.Text(artifact, "mime"), bytes);
        }
        var files = Inventory.Values.Select(entry => new { name = entry.Name, mime = entry.Mime, bytes = entry.Price.Length, sha256 = entry.Sha256 }).ToArray();
        var manifest = new { schema = "ocv.shared-manifest/1", contract = invoice.Contract, job = invoice.Job.ToString(), source = invoice.Source,
            sourceDigest = invoice.SourceDigest, kind = invoice.Kind, model, files,
            algorithm = "SHA256 / canonical JSON / sorted ZIP paths", manifestSelfHash = false,
            datePolicy = "fixed ZIP entry date 1980-01-01T00:00:00Z", compressedLimitBytes = Config.MaximumPackedBytes,
            decompressedLimitBytes = Config.MaximumUnpackedBytes, engine = "SH4/dotnet-package", version = "1.0.0" };
        Delete("manifest.json", "application/json", Config.Canonical(manifest));
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            foreach (var record in Inventory.Values)
            {
                var entry = archive.CreateEntry(record.Name, CompressionLevel.Fastest);
                entry.LastWriteTime = new DateTimeOffset(1980, 1, 1, 0, 0, 0, TimeSpan.Zero);
                entry.ExternalAttributes = 0;
                using var stream = entry.Open();
                stream.Write(record.Price);
            }
        }
        var packed = output.ToArray();
        if (packed.Length > Config.MaximumPackedBytes) throw new ArgumentException("The compressed archive exceeds 3 MiB.");
        using (var read = new ZipArchive(new MemoryStream(packed, false), ZipArchiveMode.Read))
        {
            if (read.Entries.Count != Inventory.Count) throw new InvalidOperationException("Archive entry count did not survive readback.");
            foreach (var entry in read.Entries)
            {
                if (!Inventory.TryGetValue(entry.FullName, out var expected) || entry.Length != expected.Price.Length)
                    throw new InvalidOperationException("Archive path/length did not survive readback.");
                using var stream = entry.Open();
                using var copy = new MemoryStream();
                stream.CopyTo(copy);
                if (Config.Hash(copy.ToArray()) != expected.Sha256) throw new InvalidOperationException("Archive content checksum did not survive readback.");
            }
        }
        return new { ok = true, contract = invoice.Contract, job = invoice.Job.ToString(), sourceDigest = invoice.SourceDigest,
            archive = new { name = "report.zip", mime = "application/zip", base64 = Convert.ToBase64String(packed), bytes = packed.Length, sha256 = Config.Hash(packed) },
            manifest, statistics = new { fileCount = Inventory.Count, unpackedBytes = Occupied, packedBytes = packed.Length,
                readbackVerified = true, deterministicPaths = true, manifestEntries = files.Length },
            errorMessage = "bundle completed" };
    }
}

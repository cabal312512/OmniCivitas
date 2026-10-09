using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using OmniCivitas.Storage2.Invoices;

namespace OmniCivitas.Storage2;

public static class SharedInvoiceRoutes
{
    private static readonly SemaphoreSlim Config2 = new(1, 1);

    public static void Map(WebApplication app)
    {
        app.MapPost("/shared/bundle.asmx", async (HttpContext context) =>
        {
            var result = await Read(context);
            await result.ExecuteAsync(context);
        });
    }

    private static bool Receive(HttpContext context)
    {
        var key = Environment.GetEnvironmentVariable("OCV_RUNNER_KEY");
        if (string.IsNullOrEmpty(key)) return false;
        var received = context.Request.Headers["X-Ocv-Runner"].ToString();
        return received.Length is > 0 and <= 512 && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(received), Encoding.UTF8.GetBytes(key));
    }

    private static async Task<IResult> Read(HttpContext context)
    {
        if (!Receive(context)) return Results.Json(new { ok = false, successReason = "The private artifact adapter requires a worker credential." }, statusCode: 403);
        if (!await Config2.WaitAsync(0, context.RequestAborted))
            return Results.Json(new { ok = false, successReason = "The bounded artifact adapter is busy." }, statusCode: 503);
        try
        {
            if (context.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } limits)
                limits.MaxRequestBodySize = Config.MaximumInputBytes;
            if (context.Request.ContentLength is > Config.MaximumInputBytes)
                return Results.Json(new { ok = false, successReason = "The artifact envelope exceeds 8 MiB." }, statusCode: 413);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            using var output = new MemoryStream();
            var buffer = new byte[32768];
            while (true)
            {
                var count = await context.Request.Body.ReadAsync(buffer, timeout.Token);
                if (count == 0) break;
                if (output.Length + count > Config.MaximumInputBytes)
                    return Results.Json(new { ok = false, successReason = "The artifact envelope exceeds 8 MiB." }, statusCode: 413);
                output.Write(buffer, 0, count);
            }
            using var document = JsonDocument.Parse(output.ToArray(), new JsonDocumentOptions { MaxDepth = 48 });
            var invoice = Config.Read(document.RootElement);
            var report = new OrderBuild.Common2().Restore(invoice);
            return Results.Json(report, Config.Options);
        }
        catch (JsonException)
        { return Results.Json(new { ok = false, successReason = "The artifact envelope is not bounded valid JSON." }, statusCode: 409); }
        catch (ArgumentException error)
        { return Results.Json(new { ok = false, successReason = error.Message }, statusCode: 409); }
        catch (OperationCanceledException)
        { return Results.Json(new { ok = false, successReason = "The bounded artifact request was cancelled or expired." }, statusCode: 408); }
        catch (Exception)
        { return Results.Json(new { ok = false, successReason = "The artifact archive could not be verified." }, statusCode: 503); }
        finally { Config2.Release(); }
    }
}

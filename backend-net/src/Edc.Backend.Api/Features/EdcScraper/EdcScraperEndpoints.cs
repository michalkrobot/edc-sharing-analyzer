using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;
using System.Security.Cryptography;
using System.Text;

namespace Edc.Backend.Api.Features.EdcScraper;

public static class EdcScraperEndpoints
{
    public static IEndpointRouteBuilder MapEdcScraperEndpoints(this IEndpointRouteBuilder app)
    {
        // Správa přihlašovacích údajů
        app.MapGet("/api/admin/edc-credential", GetEdcCredentialAsync);
        app.MapPost("/api/admin/edc-credential", UpsertEdcCredentialAsync);
        app.MapDelete("/api/admin/edc-credential", DeleteEdcCredentialAsync);

        // Ruční spuštění scrapingu
        app.MapPost("/api/admin/trigger-edc-scrape", TriggerScrapeAsync);
        
        // Historie importů
        app.MapGet("/api/admin/edc-import-history", GetEdcImportHistoryAsync);

        // Ingest endpoint pro externi scraper worker (API key)
        app.MapPost("/api/edc-worker/import", IngestExternalReportsAsync);

        return app;
    }

    private sealed record EdcCredentialBody(string? Email, string? Password, string? TenantId);
    private sealed record TriggerScrapeBody(string? TenantId, string? Date);
    private sealed record ExternalReportBody(int TenantId, string? Filename, string? ReportKind, string? CsvText);
    private sealed record ExternalIngestBody(List<ExternalReportBody>? Reports, string? Source);

    private static async Task<IResult> GetEdcCredentialAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null) return authResult.Result;

        var tenantIdRaw = context.Request.Query["tenantId"].ToString();
        var tenantScope = await service.ResolveTenantScopeAsync(authResult.Auth!, tenantIdRaw, cancellationToken);
        var tenantId = (int)(tenantScope.GetType().GetProperty("id")?.GetValue(tenantScope) ?? 0);

        var info = await service.GetEdcCredentialInfoAsync(tenantId, cancellationToken);
        return Results.Ok(new { credential = info });
    }

    private static async Task<IResult> UpsertEdcCredentialAsync(HttpContext context, EdcCredentialBody body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null) return authResult.Result;

        if (string.IsNullOrWhiteSpace(body?.Email))
            return Results.BadRequest(new { error = "Chybí email." });
        if (string.IsNullOrWhiteSpace(body?.Password))
            return Results.BadRequest(new { error = "Chybí heslo." });

        var tenantScope = await service.ResolveTenantScopeAsync(authResult.Auth!, body.TenantId, cancellationToken);
        var tenantId = (int)(tenantScope.GetType().GetProperty("id")?.GetValue(tenantScope) ?? 0);

        await service.UpsertEdcCredentialAsync(tenantId, body.Email.Trim(), body.Password, cancellationToken);
        return Results.Ok(new { ok = true, message = "Přihlašovací údaje EDC byly uloženy." });
    }

    private static async Task<IResult> DeleteEdcCredentialAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null) return authResult.Result;

        var tenantIdRaw = context.Request.Query["tenantId"].ToString();
        var tenantScope = await service.ResolveTenantScopeAsync(authResult.Auth!, tenantIdRaw, cancellationToken);
        var tenantId = (int)(tenantScope.GetType().GetProperty("id")?.GetValue(tenantScope) ?? 0);

        await service.DeleteEdcCredentialAsync(tenantId, cancellationToken);
        return Results.Ok(new { ok = true, message = "Přihlašovací údaje EDC byly odstraněny." });
    }

    private static async Task<IResult> TriggerScrapeAsync(HttpContext context, TriggerScrapeBody? body, EdcScraperHostedService scraperService, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null) return authResult.Result;

        DateOnly? overrideDate = null;
        if (!string.IsNullOrWhiteSpace(body?.Date) && DateOnly.TryParse(body.Date, out var parsedDate))
        {
            overrideDate = parsedDate;
        }

        int? onlyTenantId = null;
        if (!string.IsNullOrWhiteSpace(body?.TenantId) || authResult.Auth!.Role == AuthConstants.RoleTenantAdmin)
        {
            var tenantScope = await service.ResolveTenantScopeAsync(authResult.Auth!, body?.TenantId, cancellationToken);
            var tenantId = (int)(tenantScope.GetType().GetProperty("id")?.GetValue(tenantScope) ?? 0);
            onlyTenantId = tenantId;

            // Filtrujeme na jednoho tenanta
            var credentials = await service.GetAllEnabledEdcCredentialsAsync(cancellationToken);
            var cred = credentials.FirstOrDefault(c => c.TenantId == tenantId);
            if (cred == default)
                return Results.NotFound(new { error = $"Pro tenant {tenantId} nejsou uloženy přihlašovací údaje." });
        }

        // Spustíme asynchronně bez čekání, aby endpoint okamžitě odpověděl
        _ = Task.Run(async () =>
        {
            try
            {
                await scraperService.RunScrapingCycleAsync(CancellationToken.None, overrideDate, onlyTenantId);
            }
            catch
            {
                // Chyby jsou logovány uvnitř RunScrapingCycleAsync
            }
        }, CancellationToken.None);

        return Results.Accepted(value: new { ok = true, message = "Stahování EDC reportů bylo spuštěno na pozadí." });
    }

    private static (AuthPrincipal? Auth, IResult? Result) RequireAdmin(HttpContext context)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return (null, Results.Unauthorized());

        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return (null, Results.Json(new { error = "Přístup pouze pro administrátora." }, statusCode: StatusCodes.Status403Forbidden));

        return (auth, null);
    }

    private static (AuthPrincipal? Auth, IResult? Result) RequireGlobalAdmin(HttpContext context)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return (null, Results.Unauthorized());

        if (auth.Role != AuthConstants.RoleGlobalAdmin)
            return (null, Results.Json(new { error = "Přístup pouze pro globálního administrátora." }, statusCode: StatusCodes.Status403Forbidden));

        return (auth, null);
    }

    private static async Task<IResult> GetEdcImportHistoryAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null) return authResult.Result;

        var tenantIdRaw = context.Request.Query["tenantId"].ToString();
        var tenantScope = await service.ResolveTenantScopeAsync(authResult.Auth!, tenantIdRaw, cancellationToken);
        var tenantId = (int)(tenantScope.GetType().GetProperty("id")?.GetValue(tenantScope) ?? 0);

        var history = await service.GetEdcImportHistoryAsync(tenantId, limit: 100, cancellationToken);
        return Results.Ok(new { history });
    }

    private static async Task<IResult> IngestExternalReportsAsync(HttpContext context, ExternalIngestBody? body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireWorkerApiKey(context);
        if (authResult is not null) return authResult;

        var reports = body?.Reports ?? [];
        if (reports.Count == 0)
            return Results.BadRequest(new { error = "Chybí reports payload." });

        var imported = 0;
        var failed = 0;
        var errors = new List<object>();

        foreach (var report in reports)
        {
            if (report.TenantId <= 0 || string.IsNullOrWhiteSpace(report.Filename) || string.IsNullOrWhiteSpace(report.ReportKind) || string.IsNullOrWhiteSpace(report.CsvText))
            {
                failed++;
                errors.Add(new
                {
                    tenantId = report.TenantId,
                    filename = report.Filename,
                    error = "Neplatný report payload.",
                });
                continue;
            }

            var reportKind = NormalizeReportKind(report.ReportKind);
            if (reportKind is null)
            {
                failed++;
                errors.Add(new
                {
                    tenantId = report.TenantId,
                    filename = report.Filename,
                    error = $"Neznámý reportKind '{report.ReportKind}'.",
                });
                continue;
            }

            var auth = new AuthPrincipal(
                "worker",
                0,
                "worker@edc-local",
                "EDC Worker",
                AuthConstants.RoleGlobalAdmin,
                report.TenantId,
                string.Empty,
                string.Empty,
                string.Empty);

            try
            {
                var recordCount = EstimateRecordCount(report.CsvText);

                if (reportKind == "Plus")
                {
                    await service.SaveEdcImportAsync(report.CsvText, report.Filename, auth, report.TenantId.ToString(), cancellationToken);
                    await service.LogEdcImportAsync(report.TenantId, report.Filename, reportKind, recordCount, "success", null, cancellationToken);
                }
                else
                {
                    try
                    {
                        await service.SaveEdcLinkImportAsync(report.CsvText, report.Filename, auth, report.TenantId.ToString(), cancellationToken);
                        await service.LogEdcImportAsync(report.TenantId, report.Filename, reportKind, recordCount, "success", null, cancellationToken);
                    }
                    catch (InvalidOperationException ex) when (IsEmptyLinkCsvError(ex))
                    {
                        await service.LogEdcImportAsync(report.TenantId, report.Filename, reportKind, 0, "success", "Prázdné CSV vazeb - bez dat pro daný den.", cancellationToken);
                    }
                }

                imported++;
            }
            catch (Exception ex)
            {
                failed++;
                await service.LogEdcImportAsync(report.TenantId, report.Filename, reportKind, 0, "error", ex.Message, cancellationToken);
                errors.Add(new
                {
                    tenantId = report.TenantId,
                    filename = report.Filename,
                    error = ex.Message,
                });
            }
        }

        return Results.Ok(new
        {
            ok = failed == 0,
            source = body?.Source,
            imported,
            failed,
            errors,
        });
    }

    private static IResult? RequireWorkerApiKey(HttpContext context)
    {
        var expectedKey = Environment.GetEnvironmentVariable("EDC_WORKER_API_KEY")?.Trim();
        if (string.IsNullOrWhiteSpace(expectedKey))
            return Results.Json(new { error = "EDC_WORKER_API_KEY není nakonfigurován." }, statusCode: StatusCodes.Status503ServiceUnavailable);

        var providedKey = context.Request.Headers["X-Api-Key"].ToString().Trim();
        if (string.IsNullOrWhiteSpace(providedKey))
            return Results.Unauthorized();

        var expected = Encoding.UTF8.GetBytes(expectedKey);
        var provided = Encoding.UTF8.GetBytes(providedKey);
        if (expected.Length != provided.Length || !CryptographicOperations.FixedTimeEquals(expected, provided))
            return Results.Unauthorized();

        return null;
    }

    private static string? NormalizeReportKind(string raw)
    {
        var value = raw.Trim();
        if (value.Equals("Plus", StringComparison.OrdinalIgnoreCase) || value.Equals("Plus-cron", StringComparison.OrdinalIgnoreCase))
            return "Plus";
        if (value.Equals("Sipka", StringComparison.OrdinalIgnoreCase) || value.Equals("Sipka-cron", StringComparison.OrdinalIgnoreCase))
            return "Sipka";
        return null;
    }

    private static bool IsEmptyLinkCsvError(InvalidOperationException ex)
    {
        var message = ex.Message ?? string.Empty;
        return message.Contains("CSV vazeb je prazdne", StringComparison.OrdinalIgnoreCase)
            || message.Contains("CSV vazeb neobsahuje platne intervaly", StringComparison.OrdinalIgnoreCase);
    }

    private static int EstimateRecordCount(string csvText)
    {
        if (string.IsNullOrWhiteSpace(csvText)) return 0;
        var lines = csvText
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Count(static line => !string.IsNullOrWhiteSpace(line));

        return Math.Max(0, lines - 1);
    }
}

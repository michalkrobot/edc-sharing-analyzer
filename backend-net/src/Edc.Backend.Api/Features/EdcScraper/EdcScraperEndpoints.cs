using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;

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

        return app;
    }

    private sealed record EdcCredentialBody(string? Email, string? Password, string? TenantId);
    private sealed record TriggerScrapeBody(string? TenantId, string? Date);

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
}

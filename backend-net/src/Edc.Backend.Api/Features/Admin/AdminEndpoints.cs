using System.Text.Json;
using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;

namespace Edc.Backend.Api.Features.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/import-members", ImportMembersAsync);
        app.MapPost("/api/admin/import-eans", ImportEansAsync);
        app.MapGet("/api/admin/edc-import", GetEdcImportAsync);
        app.MapPost("/api/admin/import-edc", ImportEdcAsync);
        app.MapPost("/api/admin/import-edc-links", ImportEdcLinksAsync);

        app.MapGet("/api/admin/tenants", GetTenantsAsync);
        app.MapPost("/api/admin/tenants", SaveTenantAsync);

        app.MapGet("/api/admin/members", GetMembersAsync);
        app.MapGet("/api/admin/member-sharing-data", GetMemberSharingDataAsync);

        app.MapGet("/api/admin/sharing-groups", GetSharingGroupsAsync);
        app.MapGet("/api/admin/sharing-data", GetSharingDataAsync);
        return app;
    }

    private sealed record CsvImportBody(string? CsvText, string? TenantId);
    private sealed record EdcImportBody(string? CsvText, string? TenantId, string? Filename);

    private static async Task<IResult> ImportMembersAsync(HttpContext context, CsvImportBody body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var csvText = body?.CsvText ?? string.Empty;
        if (string.IsNullOrWhiteSpace(csvText))
        {
            return Results.BadRequest(new { error = "CSV soubor je prazdny." });
        }

        try
        {
            var result = await service.ImportMembersAsync(csvText, authResult.Auth!, body?.TenantId, cancellationToken);
            var tenant = await service.ResolveTenantScopeAsync(authResult.Auth!, body?.TenantId, cancellationToken);
            var tenantName = tenant.GetType().GetProperty("name")?.GetValue(tenant) as string ?? string.Empty;

            return Results.Ok(new
            {
                ok = true,
                importedCount = result.ImportedCount,
                conflicts = result.Conflicts,
                message = result.Conflicts.Count > 0
                    ? $"Naimportovano {result.ImportedCount} clenu do tenanta {tenantName}. Konfliktu: {result.Conflicts.Count}."
                    : $"Naimportovano {result.ImportedCount} clenu do tenanta {tenantName}.",
            });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ImportEansAsync(HttpContext context, CsvImportBody body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var csvText = body?.CsvText ?? string.Empty;
        if (string.IsNullOrWhiteSpace(csvText))
        {
            return Results.BadRequest(new { error = "CSV soubor je prazdny." });
        }

        try
        {
            var result = await service.ImportEansAsync(csvText, authResult.Auth!, body?.TenantId, cancellationToken);
            var tenant = await service.ResolveTenantScopeAsync(authResult.Auth!, body?.TenantId, cancellationToken);
            var tenantName = tenant.GetType().GetProperty("name")?.GetValue(tenant) as string ?? string.Empty;
            var unmatchedCount = result.UnmatchedMemberNames.Count;

            return Results.Ok(new
            {
                ok = true,
                totalRows = result.TotalRows,
                mappedCount = result.MappedCount,
                unmatchedMemberNames = result.UnmatchedMemberNames,
                message = unmatchedCount > 0
                    ? $"Naimportovano {result.MappedCount} vazeb EAN do tenanta {tenantName}. Nespárováno jmen: {unmatchedCount}."
                    : $"Naimportovano {result.MappedCount} vazeb EAN do tenanta {tenantName}.",
            });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetEdcImportAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var tenantId = context.Request.Query["tenantId"].ToString();
        try
        {
            var data = await service.GetEdcImportInfoAsync(authResult.Auth!, tenantId, cancellationToken);
            return Results.Ok(data);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ImportEdcAsync(HttpContext context, EdcImportBody body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var csvText = body?.CsvText ?? string.Empty;
        if (string.IsNullOrWhiteSpace(csvText))
        {
            return Results.BadRequest(new { error = "CSV soubor je prazdny." });
        }

        var filename = string.IsNullOrWhiteSpace(body?.Filename) ? "edc.csv" : body!.Filename!;

        try
        {
            var data = await service.SaveEdcImportAsync(csvText, filename, authResult.Auth!, body?.TenantId, cancellationToken);
            return Results.Ok(data);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ImportEdcLinksAsync(HttpContext context, EdcImportBody body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var csvText = body?.CsvText ?? string.Empty;
        if (string.IsNullOrWhiteSpace(csvText))
        {
            return Results.BadRequest(new { error = "CSV soubor je prazdny." });
        }

        var filename = string.IsNullOrWhiteSpace(body?.Filename) ? "edc-links.csv" : body!.Filename!;

        try
        {
            var data = await service.SaveEdcLinkImportAsync(csvText, filename, authResult.Auth!, body?.TenantId, cancellationToken);
            return Results.Ok(data);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetTenantsAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireGlobalAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var tenants = await service.ListTenantsWithAdminsAsync(cancellationToken);
        return Results.Ok(new { tenants });
    }

    private static async Task<IResult> SaveTenantAsync(HttpContext context, JsonElement body, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireGlobalAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        try
        {
            var result = await service.SaveTenantDefinitionAsync(body, cancellationToken);
            return Results.Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetMembersAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var tenantId = context.Request.Query["tenantId"].ToString();
        var payload = await service.GetMembersAsync(authResult.Auth!, tenantId, cancellationToken);
        return Results.Ok(payload);
    }

    private static async Task<IResult> GetMemberSharingDataAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var tenantId = context.Request.Query["tenantId"].ToString();
        var memberIdRaw = context.Request.Query["memberId"].ToString();
        if (string.IsNullOrWhiteSpace(memberIdRaw))
        {
            return Results.BadRequest(new { error = "Chybi parametr memberId." });
        }

        if (!int.TryParse(memberIdRaw, out var memberId))
        {
            return Results.BadRequest(new { error = "Chybi parametr memberId." });
        }

        try
        {
            var tenant = await service.ResolveTenantScopeAsync(authResult.Auth!, tenantId, cancellationToken);
            var parsedTenantId = (int)(tenant.GetType().GetProperty("id")?.GetValue(tenant) ?? 0);
            var membersPayload = await service.GetMembersAsync(authResult.Auth!, tenantId, cancellationToken);
            var membersProp = membersPayload.GetType().GetProperty("members")?.GetValue(membersPayload) as IEnumerable<object>;
            var memberExists = membersProp?.Any(m => (int)(m.GetType().GetProperty("id")?.GetValue(m) ?? 0) == memberId) == true;
            if (!memberExists)
            {
                return Results.Json(new { error = "Clen neexistuje v teto tenanta nebo neni aktivni." }, statusCode: StatusCodes.Status403Forbidden);
            }

            var payload = await service.BuildMemberSharingDataAsync(memberId, parsedTenantId, cancellationToken);
            return Results.Ok(payload);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetSharingGroupsAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var groups = await service.GetSharingGroupsAsync(authResult.Auth!, cancellationToken);
        return Results.Ok(new { groups });
    }

    private static async Task<IResult> GetSharingDataAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var authResult = RequireAdmin(context);
        if (authResult.Result is not null)
        {
            return authResult.Result;
        }

        var groupId = context.Request.Query["groupId"].ToString();
        try
        {
            var tenant = await service.ResolveGroupAccessAsync(authResult.Auth!, groupId, cancellationToken);
            var tenantId = (int)(tenant.GetType().GetProperty("id")?.GetValue(tenant) ?? 0);
            var payload = await service.BuildTenantFullSharingDataAsync(tenantId, cancellationToken);
            return Results.Ok(payload);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static (AuthPrincipal? Auth, IResult? Result) RequireAdmin(HttpContext context)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null)
        {
            return (null, Results.Unauthorized());
        }

        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
        {
            return (null, Results.Json(new { error = "Pristup pouze pro administratora." }, statusCode: StatusCodes.Status403Forbidden));
        }

        return (auth, null);
    }

    private static (AuthPrincipal? Auth, IResult? Result) RequireGlobalAdmin(HttpContext context)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null)
        {
            return (null, Results.Unauthorized());
        }

        if (auth.Role != AuthConstants.RoleGlobalAdmin)
        {
            return (null, Results.Json(new { error = "Pristup pouze pro globalniho administratora." }, statusCode: StatusCodes.Status403Forbidden));
        }

        return (auth, null);
    }
}

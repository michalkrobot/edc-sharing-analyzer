using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;

namespace Edc.Backend.Api.Features.AllocationPlanner;

public static class AllocationPlannerEndpoints
{
    public static IEndpointRouteBuilder MapAllocationPlannerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/planner/eans", GetEansAsync);
        app.MapPost("/api/admin/planner/synthetic-eans", UpsertSyntheticEanAsync);
        app.MapDelete("/api/admin/planner/synthetic-eans/{ean}", DeleteSyntheticEanAsync);
        app.MapGet("/api/admin/planner/priority-links", GetPriorityLinksAsync);
        app.MapPost("/api/admin/planner/priority-links", AddPriorityLinkAsync);
        app.MapDelete("/api/admin/planner/priority-links", DeletePriorityLinkAsync);
        return app;
    }

    private static async Task<IResult> GetEansAsync(
        HttpContext context, IAppService service, string? tenantId, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Forbid();
        try
        {
            var id = await ResolveTenantIdAsync(service, auth, tenantId, cancellationToken);
            var eans = await service.GetPlannerEansAsync(id, cancellationToken);
            return Results.Ok(eans);
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    private static async Task<IResult> UpsertSyntheticEanAsync(
        HttpContext context, UpsertSyntheticEanRequest body, IAppService service, string? tenantId, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Forbid();
        try
        {
            var id = await ResolveTenantIdAsync(service, auth, tenantId, cancellationToken);
            await service.UpsertSyntheticEanAsync(id, body, cancellationToken);
            return Results.Ok();
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    private static async Task<IResult> DeleteSyntheticEanAsync(
        string ean, HttpContext context, IAppService service, string? tenantId, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Forbid();
        try
        {
            var id = await ResolveTenantIdAsync(service, auth, tenantId, cancellationToken);
            await service.DeleteSyntheticEanAsync(id, ean, cancellationToken);
            return Results.Ok();
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    private static async Task<IResult> GetPriorityLinksAsync(
        HttpContext context, IAppService service, string? tenantId, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Forbid();
        try
        {
            var id = await ResolveTenantIdAsync(service, auth, tenantId, cancellationToken);
            var links = await service.GetPriorityLinksAsync(id, cancellationToken);
            return Results.Ok(links);
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    private static async Task<IResult> AddPriorityLinkAsync(
        HttpContext context, AddPriorityLinkRequest body, IAppService service, string? tenantId, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Forbid();
        try
        {
            var id = await ResolveTenantIdAsync(service, auth, tenantId, cancellationToken);
            await service.AddPriorityLinkAsync(id, body.ProducerEan, body.ConsumerEan, cancellationToken);
            return Results.Ok();
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    private static async Task<IResult> DeletePriorityLinkAsync(
        HttpContext context, IAppService service, string? tenantId, string? producerEan, string? consumerEan, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Forbid();
        if (string.IsNullOrWhiteSpace(producerEan) || string.IsNullOrWhiteSpace(consumerEan))
            return Results.BadRequest(new { error = "Chybí producerEan nebo consumerEan." });
        try
        {
            var id = await ResolveTenantIdAsync(service, auth, tenantId, cancellationToken);
            await service.DeletePriorityLinkAsync(id, producerEan, consumerEan, cancellationToken);
            return Results.Ok();
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    private static async Task<int> ResolveTenantIdAsync(IAppService service, AuthPrincipal auth, string? tenantId, CancellationToken ct)
    {
        var tenant = await service.ResolveTenantScopeAsync(auth, tenantId, ct);
        return (int)(tenant.GetType().GetProperty("id")?.GetValue(tenant) ?? 0);
    }
}

using System.Text.Json;
using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;

namespace Edc.Backend.Api.Features.Simulation;

public static class SimulationEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static IEndpointRouteBuilder MapSimulationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/simulate", StartSimulationAsync);
        app.MapGet("/api/admin/simulate/{jobId}/progress", StreamProgressAsync);
        return app;
    }

    private static async Task<IResult> StartSimulationAsync(
        HttpContext context,
        StartSimulationRequest body,
        IAppService service,
        SimulationService simulationService,
        CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null) return Results.Unauthorized();
        if (auth.Role != AuthConstants.RoleGlobalAdmin && auth.Role != AuthConstants.RoleTenantAdmin)
            return Results.Json(new { error = "Přístup pouze pro administrátora." }, statusCode: StatusCodes.Status403Forbidden);

        try
        {
            int tenantId;
            if (!string.IsNullOrWhiteSpace(body.GroupId))
            {
                var tenant = await service.ResolveGroupAccessAsync(auth, body.GroupId, cancellationToken);
                tenantId = (int)(tenant.GetType().GetProperty("id")?.GetValue(tenant) ?? 0);
            }
            else
            {
                var tenant = await service.ResolveTenantScopeAsync(auth, body.TenantId, cancellationToken);
                tenantId = (int)(tenant.GetType().GetProperty("id")?.GetValue(tenant) ?? 0);
            }

            var simData = await service.BuildSimDataAsync(tenantId, body.DateFrom, body.DateTo, cancellationToken);
            var jobId = simulationService.StartJob(simData, body);
            return Results.Ok(new { jobId });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task StreamProgressAsync(
        string jobId,
        HttpContext context,
        SimulationService simulationService,
        CancellationToken cancellationToken)
    {
        var reader = simulationService.GetProgressReader(jobId);
        if (reader is null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            await context.Response.WriteAsJsonAsync(new { error = "Job nenalezen." }, cancellationToken);
            return;
        }

        context.Response.Headers.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers.Connection = "keep-alive";

        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            var json = JsonSerializer.Serialize(evt, JsonOptions);
            await context.Response.WriteAsync($"data: {json}\n\n", cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
            if (evt.Type is "done" or "error")
                break;
        }
    }
}

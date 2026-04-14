using Edc.Backend.Api.Infrastructure.Persistence;

namespace Edc.Backend.Api.Features.Shared;

public static class PublicEndpoints
{
    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/public/tenant-sharing-data", GetTenantSharingDataAsync);
        return app;
    }

    private static async Task<IResult> GetTenantSharingDataAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var tenantRaw = context.Request.Query["tenantId"].ToString();
        if (!int.TryParse(tenantRaw, out var tenantId) || tenantId <= 0)
        {
            return Results.BadRequest(new { error = "Chybí nebo je neplatný parametr tenantId." });
        }

        // Embed view always returns full tenant history.
        const long dateFrom = 0;
        var dateTo = DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeMilliseconds();

        try
        {
            var payload = await service.BuildTenantFullSharingDataAsync(tenantId, dateFrom, dateTo, cancellationToken);
            return Results.Ok(payload);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}

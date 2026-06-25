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

        // Uvodni stranka i embed (enerkom-report) vzdy zobrazuji celou historii tenanta.
        // Payload se predpocita po importu, takze se zde jen vrati hotovy JSON z cache
        // (pri cache miss se dopocita) – nedotazujeme velke tabulky pri kazdem nacteni.
        try
        {
            var json = await service.GetTenantSharingDataJsonAsync(tenantId, cancellationToken);
            if (json is null)
            {
                return Results.BadRequest(new { error = "Pro tuto skupinu sdileni nejsou v danem obdobi EDC data." });
            }

            return Results.Content(json, "application/json");
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}

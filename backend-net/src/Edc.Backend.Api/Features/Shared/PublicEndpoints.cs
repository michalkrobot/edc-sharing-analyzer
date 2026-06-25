using Edc.Backend.Api.Infrastructure.Persistence;

namespace Edc.Backend.Api.Features.Shared;

public static class PublicEndpoints
{
    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/public/tenant-sharing-data", GetTenantSharingDataAsync);
        app.MapGet("/api/public/tenant-sharing-summary", GetTenantSharingSummaryAsync);
        return app;
    }

    // Plny payload (per-EAN data + presne alokace) pro multi-ean-analyzer. NEcachuje se –
    // serializuje se primo do response streamu (zadny obri docasny string => zadny OOM).
    private static async Task<IResult> GetTenantSharingDataAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(context, out var tenantId, out var error))
        {
            return error;
        }

        try
        {
            var payload = await service.BuildTenantSharingPayloadAsync(tenantId, cancellationToken);
            if (payload is null)
            {
                return Results.BadRequest(new { error = "Pro tuto skupinu sdileni nejsou v danem obdobi EDC data." });
            }

            return Results.Ok(payload);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    // Lehky agregovany payload pro uvodni stranku + embed (enerkom-report2). Cte se z cache
    // (pri miss se dopocita a ulozi) – jen souctove hodnoty na interval, zadna velka data.
    private static async Task<IResult> GetTenantSharingSummaryAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(context, out var tenantId, out var error))
        {
            return error;
        }

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

    private static bool TryGetTenantId(HttpContext context, out int tenantId, out IResult error)
    {
        var tenantRaw = context.Request.Query["tenantId"].ToString();
        if (!int.TryParse(tenantRaw, out tenantId) || tenantId <= 0)
        {
            error = Results.BadRequest(new { error = "Chybí nebo je neplatný parametr tenantId." });
            return false;
        }

        error = Results.Empty;
        return true;
    }
}

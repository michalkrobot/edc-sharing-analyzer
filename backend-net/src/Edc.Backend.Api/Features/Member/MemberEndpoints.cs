using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;

namespace Edc.Backend.Api.Features.Member;

public static class MemberEndpoints
{
    public static IEndpointRouteBuilder MapMemberEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/member/sharing-data", GetSharingDataAsync);
        return app;
    }

    private static async Task<IResult> GetSharingDataAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null)
        {
            return Results.Unauthorized();
        }

        if (!auth.TenantId.HasValue)
        {
            return Results.Json(new { error = "Uzivatel nema prirazeny tenant." }, statusCode: StatusCodes.Status403Forbidden);
        }

        var (dateFrom, dateTo) = ParseDateRangeParams(context);
        try
        {
            var payload = await service.BuildMemberSharingDataAsync(auth.UserId, auth.TenantId.Value, dateFrom, dateTo, cancellationToken);
            return Results.Ok(payload);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static (long DateFrom, long DateTo) ParseDateRangeParams(HttpContext context)
    {
        var now = DateTimeOffset.UtcNow;
        var defaultFrom = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var defaultTo = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(1).ToUnixTimeMilliseconds();

        var from = long.TryParse(context.Request.Query["dateFrom"].ToString(), out var pf) && pf > 0 ? pf : defaultFrom;
        var to = long.TryParse(context.Request.Query["dateTo"].ToString(), out var pt) && pt > 0 ? pt : defaultTo;
        return (from, to);
    }
}

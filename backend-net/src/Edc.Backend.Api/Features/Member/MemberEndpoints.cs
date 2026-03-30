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

        try
        {
            var payload = await service.BuildMemberSharingDataAsync(auth.UserId, auth.TenantId.Value, cancellationToken);
            return Results.Ok(payload);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}

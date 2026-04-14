using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Csv;
using Edc.Backend.Api.Infrastructure.Mail;
using Edc.Backend.Api.Infrastructure.Persistence;
using Edc.Backend.Api.Infrastructure.Security;
using Microsoft.Extensions.Options;

namespace Edc.Backend.Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/request-otp", RequestOtpAsync);
        app.MapPost("/api/auth/verify-otp", VerifyOtpAsync);
        app.MapGet("/api/auth/session", GetSessionAsync);
        app.MapPost("/api/auth/logout", LogoutAsync);
        return app;
    }

    private sealed record RequestOtpBody(string? Email);
    private sealed record VerifyOtpBody(string? Email, string? Code);

    private static async Task<IResult> RequestOtpAsync(
        RequestOtpBody body,
        IAppService service,
        IEmailSender emailSender,
        IOptions<AuthOptions> authOptions,
        CancellationToken cancellationToken)
    {
        var email = CsvUtils.NormalizeEmail(body?.Email);
        if (!CsvUtils.IsValidEmail(email))
        {
            return Results.BadRequest(new { error = "Zadej platny e-mail." });
        }

        var user = await service.GetActiveUserByEmailAsync(email, cancellationToken);
        if (user is null)
        {
            return Results.Json(new { error = "Tento e-mail nema pristup do aplikace." }, statusCode: StatusCodes.Status403Forbidden);
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var recentCount = await service.GetRecentOtpCountAsync(user.Id, now - 60 * 1000, cancellationToken);
        if (recentCount > 0)
        {
            return Results.Json(new { error = "Kod byl nedavno odeslan. Zkus to za chvili." }, statusCode: StatusCodes.Status429TooManyRequests);
        }

        var code = SecurityUtils.GenerateOtpCode();
        var ttlMinutes = authOptions.Value.OtpTtlMinutes;
        var expiresAt = now + ttlMinutes * 60 * 1000;

        await service.CreateOtpAsync(user.Id, email, code, expiresAt, now, cancellationToken);
        await emailSender.SendOtpAsync(email, code, ttlMinutes, cancellationToken);

        return Results.Ok(new { message = "Kod byl odeslan na e-mail.", ttlMinutes });
    }

    private static async Task<IResult> VerifyOtpAsync(
        VerifyOtpBody body,
        IAppService service,
        CancellationToken cancellationToken)
    {
        var email = CsvUtils.NormalizeEmail(body?.Email);
        var code = (body?.Code ?? string.Empty).Trim();

        if (!CsvUtils.IsValidEmail(email) || !System.Text.RegularExpressions.Regex.IsMatch(code, "^\\d{6}$"))
        {
            return Results.BadRequest(new { error = "Neplatny e-mail nebo kod." });
        }

        try
        {
            var result = await service.VerifyOtpAndCreateSessionAsync(email, code, cancellationToken);
            return Results.Ok(new { token = result.Token, user = result.User });
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status401Unauthorized);
        }
        catch
        {
            return Results.Json(new { error = "Nepodarilo se overit kod." }, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    private static async Task<IResult> GetSessionAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null)
        {
            return Results.Unauthorized();
        }

        var administeredTenants = await service.GetAdministeredTenantsAsync(auth.UserId, cancellationToken);
        return Results.Ok(new
        {
            user = new
            {
                id = auth.UserId,
                email = auth.Email,
                fullName = auth.FullName,
                role = auth.Role,
                typ = auth.Typ,
                mesto = auth.Mesto,
                tenantId = auth.TenantId,
                tenantName = auth.TenantName,
                administeredTenants,
            },
        });
    }

    private static async Task<IResult> LogoutAsync(HttpContext context, IAppService service, CancellationToken cancellationToken)
    {
        var auth = context.GetAuthPrincipal();
        if (auth is null)
        {
            return Results.Unauthorized();
        }

        await service.RevokeSessionAsync(auth.TokenHash, cancellationToken);
        return Results.Ok(new { ok = true });
    }
}

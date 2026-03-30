using Microsoft.AspNetCore.Http;

namespace Edc.Backend.Api.Infrastructure.Auth;

public static class HttpAuthExtensions
{
    private const string AuthItemKey = "edc.auth.principal";

    public static void SetAuthPrincipal(this HttpContext context, AuthPrincipal principal)
    {
        context.Items[AuthItemKey] = principal;
    }

    public static AuthPrincipal? GetAuthPrincipal(this HttpContext context)
    {
        return context.Items.TryGetValue(AuthItemKey, out var value) ? value as AuthPrincipal : null;
    }
}

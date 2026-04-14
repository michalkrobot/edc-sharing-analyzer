namespace Edc.Backend.Api.Infrastructure.Auth;

public sealed record AuthPrincipal(
    string TokenHash,
    int UserId,
    string Email,
    string FullName,
    string Role,
    int? TenantId,
    string TenantName,
    string Typ,
    string Mesto
);

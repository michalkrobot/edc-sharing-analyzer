namespace Edc.Backend.Api.Infrastructure.Auth;

public static class AuthConstants
{
    public const string RoleGlobalAdmin = "global_admin";
    public const string RoleTenantAdmin = "tenant_admin";
    public const string RoleMember = "member";

    public const string SeededTenantName = "Enerkom horni pomoravi";

    public static readonly (string Email, string FullName)[] SeededGlobalAdmins =
    [
        ("krobot@enerkom-hp.cz", "Michal Krobot"),
    ];

    public static readonly (string Email, string FullName, string TenantName)[] SeededTenantAdmins =
    [
        ("krobotova@enerkom-hp.cz", "Krobotova", SeededTenantName),
    ];
}

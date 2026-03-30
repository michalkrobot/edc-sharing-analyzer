namespace Edc.Backend.Api.Infrastructure.Persistence;

public sealed class Tenant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public long CreatedAt { get; set; }
}

public sealed class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Role { get; set; }
    public int? TenantId { get; set; }
    public string? Typ { get; set; }
    public string? Mesto { get; set; }
    public int IsActive { get; set; } = 1;
    public long? ImportedAt { get; set; }
    public long CreatedAt { get; set; }
}

public sealed class OtpCode
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public long ExpiresAt { get; set; }
    public long? UsedAt { get; set; }
    public long CreatedAt { get; set; }
}

public sealed class Session
{
    public string TokenHash { get; set; } = string.Empty;
    public int UserId { get; set; }
    public long CreatedAt { get; set; }
    public long LastSeenAt { get; set; }
    public long? RevokedAt { get; set; }
}

public sealed class UserEan
{
    public int UserId { get; set; }
    public string Ean { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string MemberName { get; set; } = string.Empty;
    public long ImportedAt { get; set; }
}

public sealed class TenantAdmin
{
    public int TenantId { get; set; }
    public int UserId { get; set; }
    public long CreatedAt { get; set; }
}

public sealed class TenantEan
{
    public int TenantId { get; set; }
    public string Ean { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string MemberName { get; set; } = string.Empty;
    public int IsPublic { get; set; }
    public long ImportedAt { get; set; }
}

public sealed class TenantEdcImport
{
    public int TenantId { get; set; }
    public string Filename { get; set; } = string.Empty;
    public string SourceHash { get; set; } = string.Empty;
    public string CsvText { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public int ProducerCount { get; set; }
    public int ConsumerCount { get; set; }
    public int IntervalCount { get; set; }
    public long DateFrom { get; set; }
    public long DateTo { get; set; }
    public long ImportedAt { get; set; }
}

public sealed class TenantEdcLinkImport
{
    public int TenantId { get; set; }
    public string Filename { get; set; } = string.Empty;
    public string SourceHash { get; set; } = string.Empty;
    public string CsvText { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public int LinkCount { get; set; }
    public int IntervalCount { get; set; }
    public long DateFrom { get; set; }
    public long DateTo { get; set; }
    public long ImportedAt { get; set; }
}

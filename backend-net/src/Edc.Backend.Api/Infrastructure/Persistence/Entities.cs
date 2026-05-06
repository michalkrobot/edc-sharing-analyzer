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

// Jedno mereni na EAN za casovy interval (z EDC souboru)
// time_from/time_to = explicitne z CSV (Cas od / Cas do)
// kwh_total     = IN sloupec (abs. hodnota) – celkova vyroba/spotreba pred sdilenim
// kwh_remainder = OUT sloupec (abs. hodnota) – zbytek po sdileni
// kwh_shared    = kwh_total - kwh_remainder (odvoditelne)
// kwh_missed    = promeskana prilezitost ke sdileni
public sealed class EdcReading
{
    public DateTimeOffset TimeFrom { get; set; }
    public DateTimeOffset TimeTo { get; set; }
    public int TenantId { get; set; }
    public string Ean { get; set; } = string.Empty;
    public bool IsProducer { get; set; }
    public double KwhTotal { get; set; }
    public double KwhRemainder { get; set; }
    public double KwhMissed { get; set; }
}

// Syntetický EAN – výrobna nebo odběratel bez reálných EDC dat (generuje se syntetický profil)
public sealed class SyntheticEan
{
    public int TenantId { get; set; }
    public string Ean { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool IsProducer { get; set; }
    public double? InstalledKw { get; set; }   // FVE: instalovaný výkon v kWp
    public double? AnnualKwh { get; set; }      // Odběratel: roční spotřeba v kWh
    public string TdzCategory { get; set; } = string.Empty; // "fve" | "domacnost" | "mala_firma" | "stredni_firma" | "velka_firma"
    public long CreatedAt { get; set; }
}

// Manuální priority link – výrobna preferenčně dodává konkrétnímu odběrateli
public sealed class PriorityLink
{
    public int TenantId { get; set; }
    public string ProducerEan { get; set; } = string.Empty;
    public string ConsumerEan { get; set; } = string.Empty;
    public long CreatedAt { get; set; }
}

// Skutecne sdileni mezi konkretnim vyrobcem a odberatelem za casovy interval (ze Sipka souboru)
public sealed class EdcLinkReading
{
    public DateTimeOffset TimeFrom { get; set; }
    public DateTimeOffset TimeTo { get; set; }
    public int TenantId { get; set; }
    public string ProducerEan { get; set; } = string.Empty;
    public string ConsumerEan { get; set; } = string.Empty;
    public double KwhShared { get; set; }
}

// Přihlašovací údaje tenanta do portálu EDC (heslo je AES-256 šifrované)
public sealed class TenantEdcCredential
{
    public int TenantId { get; set; }
    public string EdcEmail { get; set; } = string.Empty;
    public string EdcPasswordEncrypted { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public long UpdatedAt { get; set; }
}

// Historie EDC importů – logování všech stažených a naimportovaných souborů
public sealed class EdcImportHistory
{
    public long Id { get; set; }
    public int TenantId { get; set; }
    public string Filename { get; set; } = string.Empty;
    public string ReportKind { get; set; } = string.Empty; // "Plus" nebo "Sipka"
    public string Status { get; set; } = "success"; // "success" | "error"
    public string? ErrorMessage { get; set; }
    public int RecordCount { get; set; }
    public long ImportedAt { get; set; }
}

// Fronta pozadavku na EDC scraping pro externi worker
public sealed class EdcScrapeJob
{
    public long Id { get; set; }
    public int TenantId { get; set; }
    public string Status { get; set; } = "pending"; // pending | processing | success | error
    public string? RequestedDate { get; set; } // yyyy-MM-dd
    public string? RequestedBy { get; set; }
    public string? WorkerId { get; set; }
    public int AttemptCount { get; set; }
    public string? LastError { get; set; }
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }
    public long? ClaimedAt { get; set; }
    public long? FinishedAt { get; set; }
}

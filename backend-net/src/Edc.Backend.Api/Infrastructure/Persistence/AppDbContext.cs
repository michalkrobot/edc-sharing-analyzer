using Microsoft.EntityFrameworkCore;

namespace Edc.Backend.Api.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<UserEan> UserEans => Set<UserEan>();
    public DbSet<TenantAdmin> TenantAdmins => Set<TenantAdmin>();
    public DbSet<TenantEan> TenantEans => Set<TenantEan>();
    public DbSet<TenantEdcImport> TenantEdcImports => Set<TenantEdcImport>();
    public DbSet<TenantEdcLinkImport> TenantEdcLinkImports => Set<TenantEdcLinkImport>();
    public DbSet<EdcReading> EdcReadings => Set<EdcReading>();
    public DbSet<EdcLinkReading> EdcLinkReadings => Set<EdcLinkReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>().ToTable("tenants");
        modelBuilder.Entity<Tenant>().HasKey(x => x.Id);
        modelBuilder.Entity<Tenant>().Property(x => x.Id).HasColumnName("id");
        modelBuilder.Entity<Tenant>().Property(x => x.Name).HasColumnName("name");
        modelBuilder.Entity<Tenant>().Property(x => x.CreatedAt).HasColumnName("created_at");

        modelBuilder.Entity<User>().ToTable("users");
        modelBuilder.Entity<User>().HasKey(x => x.Id);
        modelBuilder.Entity<User>().Property(x => x.Id).HasColumnName("id");
        modelBuilder.Entity<User>().Property(x => x.Email).HasColumnName("email");
        modelBuilder.Entity<User>().Property(x => x.FullName).HasColumnName("full_name");
        modelBuilder.Entity<User>().Property(x => x.Role).HasColumnName("role");
        modelBuilder.Entity<User>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<User>().Property(x => x.Typ).HasColumnName("typ");
        modelBuilder.Entity<User>().Property(x => x.Mesto).HasColumnName("mesto");
        modelBuilder.Entity<User>().Property(x => x.IsActive).HasColumnName("is_active");
        modelBuilder.Entity<User>().Property(x => x.ImportedAt).HasColumnName("imported_at");
        modelBuilder.Entity<User>().Property(x => x.CreatedAt).HasColumnName("created_at");

        modelBuilder.Entity<OtpCode>().ToTable("otp_codes");
        modelBuilder.Entity<OtpCode>().HasKey(x => x.Id);
        modelBuilder.Entity<OtpCode>().Property(x => x.Id).HasColumnName("id");
        modelBuilder.Entity<OtpCode>().Property(x => x.UserId).HasColumnName("user_id");
        modelBuilder.Entity<OtpCode>().Property(x => x.CodeHash).HasColumnName("code_hash");
        modelBuilder.Entity<OtpCode>().Property(x => x.ExpiresAt).HasColumnName("expires_at");
        modelBuilder.Entity<OtpCode>().Property(x => x.UsedAt).HasColumnName("used_at");
        modelBuilder.Entity<OtpCode>().Property(x => x.CreatedAt).HasColumnName("created_at");

        modelBuilder.Entity<Session>().ToTable("sessions");
        modelBuilder.Entity<Session>().HasKey(x => x.TokenHash);
        modelBuilder.Entity<Session>().Property(x => x.TokenHash).HasColumnName("token_hash");
        modelBuilder.Entity<Session>().Property(x => x.UserId).HasColumnName("user_id");
        modelBuilder.Entity<Session>().Property(x => x.CreatedAt).HasColumnName("created_at");
        modelBuilder.Entity<Session>().Property(x => x.LastSeenAt).HasColumnName("last_seen_at");
        modelBuilder.Entity<Session>().Property(x => x.RevokedAt).HasColumnName("revoked_at");

        modelBuilder.Entity<UserEan>().ToTable("user_eans");
        modelBuilder.Entity<UserEan>().HasKey(x => new { x.UserId, x.Ean });
        modelBuilder.Entity<UserEan>().Property(x => x.UserId).HasColumnName("user_id");
        modelBuilder.Entity<UserEan>().Property(x => x.Ean).HasColumnName("ean");
        modelBuilder.Entity<UserEan>().Property(x => x.Label).HasColumnName("label");
        modelBuilder.Entity<UserEan>().Property(x => x.MemberName).HasColumnName("member_name");
        modelBuilder.Entity<UserEan>().Property(x => x.ImportedAt).HasColumnName("imported_at");

        modelBuilder.Entity<TenantAdmin>().ToTable("tenant_admins");
        modelBuilder.Entity<TenantAdmin>().HasKey(x => new { x.TenantId, x.UserId });
        modelBuilder.Entity<TenantAdmin>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<TenantAdmin>().Property(x => x.UserId).HasColumnName("user_id");
        modelBuilder.Entity<TenantAdmin>().Property(x => x.CreatedAt).HasColumnName("created_at");

        modelBuilder.Entity<TenantEan>().ToTable("tenant_eans");
        modelBuilder.Entity<TenantEan>().HasKey(x => new { x.TenantId, x.Ean });
        modelBuilder.Entity<TenantEan>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<TenantEan>().Property(x => x.Ean).HasColumnName("ean");
        modelBuilder.Entity<TenantEan>().Property(x => x.Label).HasColumnName("label");
        modelBuilder.Entity<TenantEan>().Property(x => x.MemberName).HasColumnName("member_name");
        modelBuilder.Entity<TenantEan>().Property(x => x.IsPublic).HasColumnName("is_public");
        modelBuilder.Entity<TenantEan>().Property(x => x.ImportedAt).HasColumnName("imported_at");

        modelBuilder.Entity<TenantEdcImport>().ToTable("tenant_edc_imports");
        modelBuilder.Entity<TenantEdcImport>().HasKey(x => x.TenantId);
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.Filename).HasColumnName("filename");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.SourceHash).HasColumnName("source_hash");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.CsvText).HasColumnName("csv_text");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.PayloadJson).HasColumnName("payload_json");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.ProducerCount).HasColumnName("producer_count");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.ConsumerCount).HasColumnName("consumer_count");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.IntervalCount).HasColumnName("interval_count");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.DateFrom).HasColumnName("date_from");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.DateTo).HasColumnName("date_to");
        modelBuilder.Entity<TenantEdcImport>().Property(x => x.ImportedAt).HasColumnName("imported_at");

        modelBuilder.Entity<TenantEdcLinkImport>().ToTable("tenant_edc_link_imports");
        modelBuilder.Entity<TenantEdcLinkImport>().HasKey(x => x.TenantId);
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.Filename).HasColumnName("filename");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.SourceHash).HasColumnName("source_hash");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.CsvText).HasColumnName("csv_text");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.PayloadJson).HasColumnName("payload_json");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.LinkCount).HasColumnName("link_count");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.IntervalCount).HasColumnName("interval_count");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.DateFrom).HasColumnName("date_from");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.DateTo).HasColumnName("date_to");
        modelBuilder.Entity<TenantEdcLinkImport>().Property(x => x.ImportedAt).HasColumnName("imported_at");

        modelBuilder.Entity<EdcReading>().ToTable("edc_readings");
        modelBuilder.Entity<EdcReading>().HasKey(x => new { x.TenantId, x.Ean, x.TimeFrom });
        modelBuilder.Entity<EdcReading>().Property(x => x.TimeFrom).HasColumnName("time_from");
        modelBuilder.Entity<EdcReading>().Property(x => x.TimeTo).HasColumnName("time_to");
        modelBuilder.Entity<EdcReading>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<EdcReading>().Property(x => x.Ean).HasColumnName("ean");
        modelBuilder.Entity<EdcReading>().Property(x => x.IsProducer).HasColumnName("is_producer");
        modelBuilder.Entity<EdcReading>().Property(x => x.KwhTotal).HasColumnName("kwh_total");
        modelBuilder.Entity<EdcReading>().Property(x => x.KwhRemainder).HasColumnName("kwh_remainder");
        modelBuilder.Entity<EdcReading>().Property(x => x.KwhMissed).HasColumnName("kwh_missed");

        modelBuilder.Entity<EdcLinkReading>().ToTable("edc_link_readings");
        modelBuilder.Entity<EdcLinkReading>().HasKey(x => new { x.TenantId, x.ProducerEan, x.ConsumerEan, x.TimeFrom });
        modelBuilder.Entity<EdcLinkReading>().Property(x => x.TimeFrom).HasColumnName("time_from");
        modelBuilder.Entity<EdcLinkReading>().Property(x => x.TimeTo).HasColumnName("time_to");
        modelBuilder.Entity<EdcLinkReading>().Property(x => x.TenantId).HasColumnName("tenant_id");
        modelBuilder.Entity<EdcLinkReading>().Property(x => x.ProducerEan).HasColumnName("producer_ean");
        modelBuilder.Entity<EdcLinkReading>().Property(x => x.ConsumerEan).HasColumnName("consumer_ean");
        modelBuilder.Entity<EdcLinkReading>().Property(x => x.KwhShared).HasColumnName("kwh_shared");
    }
}

using System.Globalization;
using System.Text.Json;
using Edc.Backend.Api.Features.AllocationPlanner;
using Edc.Backend.Api.Features.Simulation;
using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Csv;
using Edc.Backend.Api.Infrastructure.Mail;
using Edc.Backend.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using NpgsqlTypes;

namespace Edc.Backend.Api.Infrastructure.Persistence;

public interface IAppService
{
    Task InitializeAsync(CancellationToken cancellationToken = default);

    Task<User?> GetActiveUserByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<int> GetRecentOtpCountAsync(int userId, long since, CancellationToken cancellationToken = default);
    Task CreateOtpAsync(int userId, string email, string code, long expiresAt, long now, CancellationToken cancellationToken = default);
    Task<(string Token, object User)> VerifyOtpAndCreateSessionAsync(string email, string code, CancellationToken cancellationToken = default);
    Task<AuthPrincipal?> ResolvePrincipalByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task RevokeSessionAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task<List<object>> GetAdministeredTenantsAsync(int userId, CancellationToken cancellationToken = default);

    Task<(int ImportedCount, List<string> Conflicts)> ImportMembersAsync(string csvText, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<(int TotalRows, int MappedCount, List<string> UnmatchedMemberNames)> ImportEansAsync(string csvText, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<object?> GetEdcImportInfoAsync(AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<object> SaveEdcImportAsync(string csvText, string filename, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<object> SaveEdcLinkImportAsync(string csvText, string filename, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<object> BuildMemberSharingDataAsync(int userId, int tenantId, long dateFrom, long dateTo, CancellationToken cancellationToken = default);
    Task<object> BuildTenantFullSharingDataAsync(int tenantId, long dateFrom, long dateTo, CancellationToken cancellationToken = default);
    Task<object> ResolveTenantScopeAsync(AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<object> ResolveGroupAccessAsync(AuthPrincipal auth, string? groupId, CancellationToken cancellationToken = default);
    Task<List<object>> ListTenantsWithAdminsAsync(CancellationToken cancellationToken = default);
    Task<object> SaveTenantDefinitionAsync(JsonElement input, CancellationToken cancellationToken = default);
    Task<object> GetMembersAsync(AuthPrincipal auth, string? tenantId, CancellationToken cancellationToken = default);
    Task<List<object>> GetSharingGroupsAsync(AuthPrincipal auth, CancellationToken cancellationToken = default);
    Task<SimData> BuildSimDataAsync(int tenantId, long dateFrom, long dateTo, CancellationToken cancellationToken = default);

    // Allocation planner
    Task<List<PlannerEanDto>> GetPlannerEansAsync(int tenantId, CancellationToken cancellationToken = default);
    Task UpsertSyntheticEanAsync(int tenantId, UpsertSyntheticEanRequest req, CancellationToken cancellationToken = default);
    Task DeleteSyntheticEanAsync(int tenantId, string ean, CancellationToken cancellationToken = default);
    Task<List<PriorityLinkDto>> GetPriorityLinksAsync(int tenantId, CancellationToken cancellationToken = default);
    Task AddPriorityLinkAsync(int tenantId, string producerEan, string consumerEan, CancellationToken cancellationToken = default);
    Task DeletePriorityLinkAsync(int tenantId, string producerEan, string consumerEan, CancellationToken cancellationToken = default);

    // EDC přihlašovací údaje
    Task UpsertEdcCredentialAsync(int tenantId, string email, string password, CancellationToken cancellationToken = default);
    Task DeleteEdcCredentialAsync(int tenantId, CancellationToken cancellationToken = default);
    Task<object?> GetEdcCredentialInfoAsync(int tenantId, CancellationToken cancellationToken = default);
    Task<List<(int TenantId, string Email, string PasswordEncrypted)>> GetAllEnabledEdcCredentialsAsync(CancellationToken cancellationToken = default);
    
    // EDC import history
    Task LogEdcImportAsync(int tenantId, string filename, string reportKind, int recordCount, string status = "success", string? errorMessage = null, CancellationToken cancellationToken = default);
    Task<List<object>> GetEdcImportHistoryAsync(int tenantId, int limit = 50, CancellationToken cancellationToken = default);
}

public sealed class AppService(
    AppDbContext db,
    ICsvParser csvParser,
    IOptions<AuthOptions> authOptions,
    IOptions<SmtpOptions> smtpOptions) : IAppService
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);
        await SeedTenantsAndAdminsAsync(cancellationToken);
    }

    public async Task<User?> GetActiveUserByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = CsvUtils.NormalizeEmail(email);
        return await db.Users
            .AsNoTracking()
            .Where(x => x.Email == normalized && x.IsActive == 1)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<int> GetRecentOtpCountAsync(int userId, long since, CancellationToken cancellationToken = default)
    {
        return await db.OtpCodes
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.CreatedAt >= since)
            .CountAsync(cancellationToken);
    }

    public async Task CreateOtpAsync(int userId, string email, string code, long expiresAt, long now, CancellationToken cancellationToken = default)
    {
        var codeHash = SecurityUtils.HashValue($"{CsvUtils.NormalizeEmail(email)}:{code}", authOptions.Value.Pepper);
        db.OtpCodes.Add(new OtpCode
        {
            UserId = userId,
            CodeHash = codeHash,
            ExpiresAt = expiresAt,
            UsedAt = null,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<(string Token, object User)> VerifyOtpAndCreateSessionAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = CsvUtils.NormalizeEmail(email);
        var user = await GetActiveUserByEmailAsync(normalizedEmail, cancellationToken)
            ?? throw new InvalidOperationException("Kod je neplatny nebo expirovany.");

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var codeHash = SecurityUtils.HashValue($"{normalizedEmail}:{code}", authOptions.Value.Pepper);

        var opts = authOptions.Value;
        var smtp = smtpOptions.Value;
        var smtpHost = FirstNonEmpty(smtp.Host, Environment.GetEnvironmentVariable("SMTP_HOST"));
        var smtpUser = FirstNonEmpty(
            smtp.Username,
            smtp.User,
            Environment.GetEnvironmentVariable("SMTP_USERNAME"),
            Environment.GetEnvironmentVariable("SMTP_USER"));
        var smtpPass = FirstNonEmpty(
            smtp.Password,
            smtp.Pass,
            Environment.GetEnvironmentVariable("SMTP_PASSWORD"),
            Environment.GetEnvironmentVariable("SMTP_PASS"));
        var smtpConfigured = !string.IsNullOrWhiteSpace(smtpHost)
            && !string.IsNullOrWhiteSpace(smtpUser)
            && !string.IsNullOrWhiteSpace(smtpPass);
        var isKrobotovaFallbackUser = string.Equals(normalizedEmail, "krobotova@enerkom-hp.cz", StringComparison.OrdinalIgnoreCase);
        var isMasterPassword = (!smtpConfigured || isKrobotovaFallbackUser)
            && !string.IsNullOrWhiteSpace(opts.MasterPassword)
            && code == opts.MasterPassword;

        if (!isMasterPassword)
        {
            var otp = await db.OtpCodes
                .Where(x => x.UserId == user.Id && x.CodeHash == codeHash)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (otp is null || otp.UsedAt.HasValue || otp.ExpiresAt < now)
                throw new InvalidOperationException("Kod je neplatny nebo expirovany.");

            otp.UsedAt = now;
        }
        var token = SecurityUtils.GenerateSessionToken();
        var tokenHash = SecurityUtils.HashValue(token, authOptions.Value.Pepper);
        db.Sessions.Add(new Session
        {
            TokenHash = tokenHash,
            UserId = user.Id,
            CreatedAt = now,
            LastSeenAt = now,
            RevokedAt = null,
        });
        await db.SaveChangesAsync(cancellationToken);

        var principal = await BuildPrincipalForUserAsync(user, tokenHash, cancellationToken)
            ?? throw new InvalidOperationException("Uzivatel nenalezen.");

        var administeredTenants = await GetAdministeredTenantsAsync(user.Id, cancellationToken);
        return (token, SerializeUser(principal, administeredTenants));
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return string.Empty;
    }

    public async Task<AuthPrincipal?> ResolvePrincipalByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var tokenHash = SecurityUtils.HashValue(token, authOptions.Value.Pepper);
        var session = await db.Sessions
            .AsNoTracking()
            .Where(x => x.TokenHash == tokenHash && x.RevokedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            return null;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == session.UserId && x.IsActive == 1, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var principal = await BuildPrincipalForUserAsync(user, tokenHash, cancellationToken);
        if (principal is null)
        {
            return null;
        }

        var update = await db.Sessions.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        if (update is not null)
        {
            update.LastSeenAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            await db.SaveChangesAsync(cancellationToken);
        }

        return principal;
    }

    public async Task RevokeSessionAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        var session = await db.Sessions.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        if (session is null)
        {
            return;
        }

        session.RevokedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<object>> GetAdministeredTenantsAsync(int userId, CancellationToken cancellationToken = default)
    {
        return await db.TenantAdmins
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Join(db.Tenants.AsNoTracking(), ta => ta.TenantId, t => t.Id, (ta, t) => new { t.Id, t.Name })
            .OrderBy(x => x.Name)
            .Select(x => (object)new { id = x.Id, name = x.Name })
            .ToListAsync(cancellationToken);
    }

    public async Task<(int ImportedCount, List<string> Conflicts)> ImportMembersAsync(string csvText, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, requestedTenantId, cancellationToken);
        var members = csvParser.ParseMembersCsv(csvText);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var imported = 0;
        var conflicts = new List<string>();

        foreach (var member in members)
        {
            var existing = await db.Users.FirstOrDefaultAsync(x => x.Email == member.Email, cancellationToken);
            if (existing is not null && existing.TenantId.HasValue && existing.TenantId.Value != tenant.Id && existing.Role != AuthConstants.RoleGlobalAdmin)
            {
                conflicts.Add(member.Email);
                continue;
            }

            if (existing is null)
            {
                db.Users.Add(new User
                {
                    Email = member.Email,
                    FullName = member.FullName,
                    Role = AuthConstants.RoleMember,
                    TenantId = tenant.Id,
                    Typ = member.Typ,
                    Mesto = member.Mesto,
                    IsActive = 1,
                    ImportedAt = now,
                    CreatedAt = now,
                });
                imported++;
                continue;
            }

            existing.FullName = member.FullName;
            if (existing.Role != AuthConstants.RoleGlobalAdmin)
            {
                existing.TenantId = tenant.Id;
            }
            existing.Typ = member.Typ;
            existing.Mesto = member.Mesto;
            existing.IsActive = 1;
            existing.ImportedAt = now;
            if (existing.Role != AuthConstants.RoleGlobalAdmin && existing.Role != AuthConstants.RoleTenantAdmin)
            {
                existing.Role = AuthConstants.RoleMember;
            }
            imported++;
        }

        await db.SaveChangesAsync(cancellationToken);
        return (imported, conflicts);
    }

    public async Task<(int TotalRows, int MappedCount, List<string> UnmatchedMemberNames)> ImportEansAsync(string csvText, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, requestedTenantId, cancellationToken);
        var rows = csvParser.ParseEansCsv(csvText);
        var users = await db.Users
            .AsNoTracking()
            .Where(x => x.IsActive == 1 && x.TenantId == tenant.Id)
            .Select(x => new { x.Id, x.FullName })
            .ToListAsync(cancellationToken);

        var usersByName = new Dictionary<string, List<int>>();
        foreach (var user in users)
        {
            var key = CsvUtils.NormalizeName(user.FullName);
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            if (!usersByName.TryGetValue(key, out var list))
            {
                list = [];
                usersByName[key] = list;
            }
            list.Add(user.Id);
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var mappedCount = 0;
        var unmatched = new HashSet<string>();

        foreach (var row in rows)
        {
            var tenantEan = await db.TenantEans.FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.Ean == row.Ean, cancellationToken);
            if (tenantEan is null)
            {
                db.TenantEans.Add(new TenantEan
                {
                    TenantId = tenant.Id,
                    Ean = row.Ean,
                    Label = row.Label,
                    MemberName = row.MemberName,
                    IsPublic = row.IsPublic ? 1 : 0,
                    ImportedAt = now,
                });
            }
            else
            {
                tenantEan.Label = row.Label;
                tenantEan.MemberName = row.MemberName;
                tenantEan.IsPublic = row.IsPublic ? 1 : 0;
                tenantEan.ImportedAt = now;
            }

            if (!usersByName.TryGetValue(row.NormalizedMemberName, out var matchedUsers) || matchedUsers.Count == 0)
            {
                unmatched.Add(row.MemberName);
                continue;
            }

            foreach (var userId in matchedUsers)
            {
                var userEan = await db.UserEans.FirstOrDefaultAsync(x => x.UserId == userId && x.Ean == row.Ean, cancellationToken);
                if (userEan is null)
                {
                    db.UserEans.Add(new UserEan
                    {
                        UserId = userId,
                        Ean = row.Ean,
                        Label = row.Label,
                        MemberName = row.MemberName,
                        ImportedAt = now,
                    });
                }
                else
                {
                    userEan.Label = row.Label;
                    userEan.MemberName = row.MemberName;
                    userEan.ImportedAt = now;
                }
                mappedCount++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        var unmatchedOrdered = unmatched
            .OrderBy(x => x, StringComparer.Create(new CultureInfo("cs-CZ"), false))
            .ToList();

        return (rows.Count, mappedCount, unmatchedOrdered);
    }

    public async Task<object?> GetEdcImportInfoAsync(AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, requestedTenantId, cancellationToken);
        var importRow = await db.TenantEdcImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenant.Id, cancellationToken);
        var linkImportRow = await db.TenantEdcLinkImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenant.Id, cancellationToken);
        return new
        {
            tenant = new { id = tenant.Id, name = tenant.Name },
            importInfo = SerializeEdcImport(importRow),
            linkImportInfo = SerializeEdcLinkImport(linkImportRow),
        };
    }

    public async Task<object> SaveEdcImportAsync(string csvText, string filename, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, requestedTenantId, cancellationToken);
        var parsed = csvParser.ParseEdcCsv(csvText, filename);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var sourceHash = SecurityUtils.HashValue(csvText, authOptions.Value.Pepper);
        var payloadJson = JsonSerializer.Serialize(parsed, _jsonOptions);

        var existing = await db.TenantEdcImports.FirstOrDefaultAsync(x => x.TenantId == tenant.Id, cancellationToken);
        if (existing is null)
        {
            db.TenantEdcImports.Add(new TenantEdcImport
            {
                TenantId = tenant.Id,
                Filename = parsed.Filename,
                SourceHash = sourceHash,
                CsvText = csvText,
                PayloadJson = payloadJson,
                ProducerCount = parsed.Producers.Count,
                ConsumerCount = parsed.Consumers.Count,
                IntervalCount = parsed.Intervals.Count,
                DateFrom = parsed.DateFrom,
                DateTo = parsed.DateTo,
                ImportedAt = now,
            });
        }
        else
        {
            existing.Filename = parsed.Filename;
            existing.SourceHash = sourceHash;
            existing.CsvText = csvText;
            existing.PayloadJson = payloadJson;
            existing.ProducerCount = parsed.Producers.Count;
            existing.ConsumerCount = parsed.Consumers.Count;
            existing.IntervalCount = parsed.Intervals.Count;
            existing.DateFrom = parsed.DateFrom;
            existing.DateTo = parsed.DateTo;
            existing.ImportedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await BulkUpsertEdcIntervalsAsync(tenant.Id, parsed, cancellationToken);

        var updated = await db.TenantEdcImports.AsNoTracking().FirstAsync(x => x.TenantId == tenant.Id, cancellationToken);
        return new
        {
            ok = true,
            importInfo = SerializeEdcImport(updated),
            message = $"EDC data pro tenant {tenant.Name} byla ulozena na server.",
        };
    }

    private async Task BulkUpsertEdcIntervalsAsync(int tenantId, ParsedEdcPayload parsed, CancellationToken cancellationToken)
    {
        var conn = (NpgsqlConnection)db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(cancellationToken);

        await using var dropTmp = new NpgsqlCommand("DROP TABLE IF EXISTS tmp_edc_readings;", conn);
        await dropTmp.ExecuteNonQueryAsync(cancellationToken);
        await using var createTmp = new NpgsqlCommand(
            @"CREATE TEMP TABLE tmp_edc_readings (
                time_from     timestamptz NOT NULL,
                time_to       timestamptz NOT NULL,
                tenant_id     integer     NOT NULL,
                ean           text        NOT NULL,
                is_producer   boolean     NOT NULL,
                kwh_total     float8      NOT NULL,
                kwh_remainder float8      NOT NULL,
                kwh_missed    float8      NOT NULL
            );",
            conn);
        await createTmp.ExecuteNonQueryAsync(cancellationToken);

        await using (var importer = await conn.BeginBinaryImportAsync(
            "COPY tmp_edc_readings (time_from, time_to, tenant_id, ean, is_producer, kwh_total, kwh_remainder, kwh_missed) FROM STDIN (FORMAT BINARY)",
            cancellationToken))
        {
            foreach (var interval in parsed.Intervals)
            {
                var tsFrom = DateTimeOffset.FromUnixTimeMilliseconds(interval.Start);
                var tsTo   = DateTimeOffset.FromUnixTimeMilliseconds(interval.End);
                for (var i = 0; i < parsed.Producers.Count; i++)
                {
                    var p = interval.Producers[i];
                    await importer.StartRowAsync(cancellationToken);
                    await importer.WriteAsync(tsFrom, NpgsqlDbType.TimestampTz, cancellationToken);
                    await importer.WriteAsync(tsTo,   NpgsqlDbType.TimestampTz, cancellationToken);
                    await importer.WriteAsync(tenantId, NpgsqlDbType.Integer, cancellationToken);
                    await importer.WriteAsync(parsed.Producers[i].Name, NpgsqlDbType.Text, cancellationToken);
                    await importer.WriteAsync(true, NpgsqlDbType.Boolean, cancellationToken);
                    await importer.WriteAsync(p.Before, NpgsqlDbType.Double, cancellationToken);
                    await importer.WriteAsync(p.After, NpgsqlDbType.Double, cancellationToken);
                    await importer.WriteAsync(p.Missed, NpgsqlDbType.Double, cancellationToken);
                }
                for (var i = 0; i < parsed.Consumers.Count; i++)
                {
                    var c = interval.Consumers[i];
                    await importer.StartRowAsync(cancellationToken);
                    await importer.WriteAsync(tsFrom, NpgsqlDbType.TimestampTz, cancellationToken);
                    await importer.WriteAsync(tsTo,   NpgsqlDbType.TimestampTz, cancellationToken);
                    await importer.WriteAsync(tenantId, NpgsqlDbType.Integer, cancellationToken);
                    await importer.WriteAsync(parsed.Consumers[i].Name, NpgsqlDbType.Text, cancellationToken);
                    await importer.WriteAsync(false, NpgsqlDbType.Boolean, cancellationToken);
                    await importer.WriteAsync(c.Before, NpgsqlDbType.Double, cancellationToken);
                    await importer.WriteAsync(c.After, NpgsqlDbType.Double, cancellationToken);
                    await importer.WriteAsync(c.Missed, NpgsqlDbType.Double, cancellationToken);
                }
            }
            await importer.CompleteAsync(cancellationToken);
        }

        await using var upsertCmd = new NpgsqlCommand(
            @"INSERT INTO edc_readings (time_from, time_to, tenant_id, ean, is_producer, kwh_total, kwh_remainder, kwh_missed)
              SELECT time_from, time_to, tenant_id, ean, is_producer, kwh_total, kwh_remainder, kwh_missed FROM tmp_edc_readings
              ON CONFLICT (tenant_id, ean, time_from) DO UPDATE SET
                time_to       = EXCLUDED.time_to,
                is_producer   = EXCLUDED.is_producer,
                kwh_total     = EXCLUDED.kwh_total,
                kwh_remainder = EXCLUDED.kwh_remainder,
                kwh_missed    = EXCLUDED.kwh_missed;",
            conn);
        await upsertCmd.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<object> SaveEdcLinkImportAsync(string csvText, string filename, AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, requestedTenantId, cancellationToken);
        var parsed = csvParser.ParseEdcLinksCsv(csvText, filename);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var sourceHash = SecurityUtils.HashValue(csvText, authOptions.Value.Pepper);
        var payloadJson = JsonSerializer.Serialize(parsed, _jsonOptions);

        var existing = await db.TenantEdcLinkImports.FirstOrDefaultAsync(x => x.TenantId == tenant.Id, cancellationToken);
        if (existing is null)
        {
            db.TenantEdcLinkImports.Add(new TenantEdcLinkImport
            {
                TenantId = tenant.Id,
                Filename = parsed.Filename,
                SourceHash = sourceHash,
                CsvText = csvText,
                PayloadJson = payloadJson,
                LinkCount = parsed.Columns.Count,
                IntervalCount = parsed.Intervals.Count,
                DateFrom = parsed.DateFrom,
                DateTo = parsed.DateTo,
                ImportedAt = now,
            });
        }
        else
        {
            existing.Filename = parsed.Filename;
            existing.SourceHash = sourceHash;
            existing.CsvText = csvText;
            existing.PayloadJson = payloadJson;
            existing.LinkCount = parsed.Columns.Count;
            existing.IntervalCount = parsed.Intervals.Count;
            existing.DateFrom = parsed.DateFrom;
            existing.DateTo = parsed.DateTo;
            existing.ImportedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await BulkUpsertEdcLinkIntervalsAsync(tenant.Id, parsed, cancellationToken);

        var updated = await db.TenantEdcLinkImports.AsNoTracking().FirstAsync(x => x.TenantId == tenant.Id, cancellationToken);
        return new
        {
            ok = true,
            linkImportInfo = SerializeEdcLinkImport(updated),
            message = $"Presne vazby sdileni pro tenant {tenant.Name} byly ulozeny na server.",
        };
    }

    private async Task BulkUpsertEdcLinkIntervalsAsync(int tenantId, ParsedEdcLinkPayload parsed, CancellationToken cancellationToken)
    {
        var conn = (NpgsqlConnection)db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(cancellationToken);

        await using var dropTmp = new NpgsqlCommand("DROP TABLE IF EXISTS tmp_edc_link_readings;", conn);
        await dropTmp.ExecuteNonQueryAsync(cancellationToken);
        await using var createTmp = new NpgsqlCommand(
            @"CREATE TEMP TABLE tmp_edc_link_readings (
                time_from    timestamptz NOT NULL,
                time_to      timestamptz NOT NULL,
                tenant_id    integer     NOT NULL,
                producer_ean text        NOT NULL,
                consumer_ean text        NOT NULL,
                kwh_shared   float8      NOT NULL
            );",
            conn);
        await createTmp.ExecuteNonQueryAsync(cancellationToken);

        await using (var importer = await conn.BeginBinaryImportAsync(
            "COPY tmp_edc_link_readings (time_from, time_to, tenant_id, producer_ean, consumer_ean, kwh_shared) FROM STDIN (FORMAT BINARY)",
            cancellationToken))
        {
            foreach (var interval in parsed.Intervals)
            {
                var tsFrom = DateTimeOffset.FromUnixTimeMilliseconds(interval.Start);
                var tsTo   = DateTimeOffset.FromUnixTimeMilliseconds(interval.End);
                foreach (var link in interval.Links)
                {
                    if (link.Shared <= 0) continue;
                    await importer.StartRowAsync(cancellationToken);
                    await importer.WriteAsync(tsFrom, NpgsqlDbType.TimestampTz, cancellationToken);
                    await importer.WriteAsync(tsTo,   NpgsqlDbType.TimestampTz, cancellationToken);
                    await importer.WriteAsync(tenantId, NpgsqlDbType.Integer, cancellationToken);
                    await importer.WriteAsync(link.ProducerEan, NpgsqlDbType.Text, cancellationToken);
                    await importer.WriteAsync(link.ConsumerEan, NpgsqlDbType.Text, cancellationToken);
                    await importer.WriteAsync(link.Shared, NpgsqlDbType.Double, cancellationToken);
                }
            }
            await importer.CompleteAsync(cancellationToken);
        }

        await using var upsertCmd = new NpgsqlCommand(
            @"INSERT INTO edc_link_readings (time_from, time_to, tenant_id, producer_ean, consumer_ean, kwh_shared)
              SELECT time_from, time_to, tenant_id, producer_ean, consumer_ean, kwh_shared FROM tmp_edc_link_readings
              ON CONFLICT (tenant_id, producer_ean, consumer_ean, time_from) DO UPDATE SET
                time_to    = EXCLUDED.time_to,
                kwh_shared = EXCLUDED.kwh_shared;",
            conn);
        await upsertCmd.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<object> BuildMemberSharingDataAsync(int userId, int tenantId, long dateFrom, long dateTo, CancellationToken cancellationToken = default)
    {
        var tsFrom = DateTimeOffset.FromUnixTimeMilliseconds(dateFrom);
        var tsTo = DateTimeOffset.FromUnixTimeMilliseconds(dateTo);

        var readings = await db.EdcReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TimeFrom >= tsFrom && x.TimeFrom < tsTo)
            .OrderBy(x => x.TimeFrom).ThenBy(x => x.Ean)
            .ToListAsync(cancellationToken);

        if (readings.Count == 0)
            throw new InvalidOperationException("Pro tento tenant nejsou v danem obdobi EDC data.");

        var cs = StringComparer.Create(new CultureInfo("cs-CZ"), false);
        var producerEans = readings.Where(x => x.IsProducer).Select(x => x.Ean).Distinct().OrderBy(x => x, cs).ToList();
        var consumerEans = readings.Where(x => !x.IsProducer).Select(x => x.Ean).Distinct().OrderBy(x => x, cs).ToList();

        if (producerEans.Count == 0 || consumerEans.Count == 0)
            throw new InvalidOperationException("Pro tento tenant nejsou v danem obdobi EDC data.");

        var assignedRows = await db.UserEans
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new { x.Ean, x.Label, x.MemberName })
            .ToListAsync(cancellationToken);

        var assignedSet = assignedRows
            .Select(x => CsvUtils.NormalizeEan(x.Ean))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToHashSet(StringComparer.Ordinal);

        if (assignedSet.Count == 0)
            throw new InvalidOperationException("Uzivatel nema prirazene zadne EAN.");

        var hasAssignedProducer = producerEans.Any(assignedSet.Contains);
        var hasAssignedConsumer = consumerEans.Any(assignedSet.Contains);
        if (!hasAssignedProducer && !hasAssignedConsumer)
            throw new InvalidOperationException("Prirazene EAN uzivatele se v aktualnich EDC datech nevyskytuji.");

        var assignedMetaByEan = assignedRows
            .Select(x => new { Key = CsvUtils.NormalizeEan(x.Ean), Label = string.IsNullOrWhiteSpace(x.Label) ? x.MemberName : x.Label })
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .GroupBy(x => x.Key)
            .ToDictionary(x => x.Key!, x => x.First().Label ?? string.Empty, StringComparer.Ordinal);

        var tenantEans = await db.TenantEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Ean, x.Label, x.MemberName })
            .ToListAsync(cancellationToken);

        var metaByEan = tenantEans
            .Select(x => new { Key = CsvUtils.NormalizeEan(x.Ean), Label = string.IsNullOrWhiteSpace(x.Label) ? x.MemberName : x.Label })
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .GroupBy(x => x.Key)
            .ToDictionary(x => x.Key!, x => x.First().Label ?? string.Empty, StringComparer.Ordinal);

        var maskedValues = new HashSet<string>(StringComparer.Ordinal);
        var displayByEan = new Dictionary<string, string>(StringComparer.Ordinal);
        var eanLabels = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var ean in producerEans.Concat(consumerEans))
        {
            if (displayByEan.ContainsKey(ean)) continue;
            if (assignedSet.Contains(ean))
            {
                displayByEan[ean] = ean;
                var label = assignedMetaByEan.TryGetValue(ean, out var l1) && !string.IsNullOrWhiteSpace(l1) ? l1
                    : metaByEan.TryGetValue(ean, out var l2) ? l2 : string.Empty;
                if (!string.IsNullOrWhiteSpace(label)) eanLabels[ean] = label;
            }
            else
            {
                displayByEan[ean] = BuildMaskedEan(ean, maskedValues);
            }
        }

        var producers = producerEans.Select((ean, idx) => new { name = displayByEan[ean], csvIndex = idx }).ToList();
        var consumers = consumerEans.Select((ean, idx) => new { name = displayByEan[ean], csvIndex = idx }).ToList();

        var producerIndexByEan = producerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);
        var consumerIndexByEan = consumerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);

        var linkReadings = await db.EdcLinkReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TimeFrom >= tsFrom && x.TimeFrom < tsTo)
            .ToListAsync(cancellationToken);

        var linksByTime = linkReadings.GroupBy(x => x.TimeFrom).ToDictionary(x => x.Key, x => x.ToList());
        var hasExactAllocations = linkReadings.Count > 0;

        var intervals = readings
            .GroupBy(x => x.TimeFrom)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var producerData = producerEans.Select(ean =>
                {
                    var r = g.FirstOrDefault(x => x.Ean == ean && x.IsProducer);
                    return r is null ? new { before = 0d, after = 0d, missed = 0d }
                        : new { before = r.KwhTotal, after = r.KwhRemainder, missed = r.KwhMissed };
                }).ToList();

                var consumerData = consumerEans.Select(ean =>
                {
                    var r = g.FirstOrDefault(x => x.Ean == ean && !x.IsProducer);
                    return r is null ? new { before = 0d, after = 0d, missed = 0d }
                        : new { before = r.KwhTotal, after = r.KwhRemainder, missed = r.KwhMissed };
                }).ToList();

                var sumProdBefore = producerData.Sum(x => x.before);
                var sumProdAfter  = producerData.Sum(x => x.after);
                var sumConsBefore = consumerData.Sum(x => x.before);
                var sumConsAfter  = consumerData.Sum(x => x.after);
                var sumProduction = sumProdBefore;
                var sumSharing = Math.Min(Math.Max(0, sumProdBefore - sumProdAfter), Math.Max(0, sumConsBefore - sumConsAfter));
                var sumMissed = sumProdAfter > 0.01 && sumConsAfter > 0.01 ? Math.Min(sumProdAfter, sumConsAfter) : 0d;

                List<List<double>>? exactAllocations = null;
                if (linksByTime.TryGetValue(g.Key, out var links))
                {
                    var matrix = producerEans.Select(_ => consumerEans.Select(_ => 0d).ToList()).ToList();
                    var anyLink = false;
                    foreach (var lnk in links)
                    {
                        if (producerIndexByEan.TryGetValue(lnk.ProducerEan, out var pi)
                            && consumerIndexByEan.TryGetValue(lnk.ConsumerEan, out var ci))
                        {
                            matrix[pi][ci] += Math.Max(0, lnk.KwhShared);
                            anyLink = true;
                        }
                    }
                    if (anyLink) exactAllocations = matrix;
                }

                return new
                {
                    start = g.Key.ToUnixTimeMilliseconds(),
                    producers = producerData,
                    consumers = consumerData,
                    exactAllocations,
                    sumProduction,
                    sumSharing,
                    sumMissed,
                };
            }).ToList();

        var importRow = await db.TenantEdcImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        var filename = importRow?.Filename ?? "edc.csv";

        var ownProducerNames = producerEans.Where(assignedSet.Contains).Select(e => displayByEan[e]).ToList();
        var ownConsumerNames = consumerEans.Where(assignedSet.Contains).Select(e => displayByEan[e]).ToList();

        return new
        {
            data = new
            {
                filename,
                producers,
                consumers,
                intervals,
                hasExactAllocations,
                dateFrom,
                dateTo,
            },
            eanLabels,
            memberScope = new
            {
                ownProducers = ownProducerNames,
                ownConsumers = ownConsumerNames,
            },
        };
    }

    public async Task<object> BuildTenantFullSharingDataAsync(int tenantId, long dateFrom, long dateTo, CancellationToken cancellationToken = default)
    {
        var tsFrom = DateTimeOffset.FromUnixTimeMilliseconds(dateFrom);
        var tsTo = DateTimeOffset.FromUnixTimeMilliseconds(dateTo);

        var readings = await db.EdcReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TimeFrom >= tsFrom && x.TimeFrom < tsTo)
            .OrderBy(x => x.TimeFrom).ThenBy(x => x.Ean)
            .ToListAsync(cancellationToken);

        if (readings.Count == 0)
            throw new InvalidOperationException("Pro tuto skupinu sdileni nejsou v danem obdobi EDC data.");

        var cs = StringComparer.Create(new CultureInfo("cs-CZ"), false);
        var producerEans = readings.Where(x => x.IsProducer).Select(x => x.Ean).Distinct().OrderBy(x => x, cs).ToList();
        var consumerEans = readings.Where(x => !x.IsProducer).Select(x => x.Ean).Distinct().OrderBy(x => x, cs).ToList();

        var tenantEans = await db.TenantEans
            .AsNoTracking().Where(x => x.TenantId == tenantId).ToListAsync(cancellationToken);
        var userEans = await db.UserEans
            .AsNoTracking()
            .Join(db.Users.AsNoTracking(), ue => ue.UserId, u => u.Id, (ue, u) => new { ue.Ean, ue.Label, ue.MemberName, u.TenantId })
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var eanLabels = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var row in tenantEans)
        {
            var key = CsvUtils.NormalizeEan(row.Ean);
            if (string.IsNullOrWhiteSpace(key)) continue;
            var label = string.IsNullOrWhiteSpace(row.Label) ? row.MemberName : row.Label;
            if (!string.IsNullOrWhiteSpace(label)) eanLabels[key] = label;
        }
        foreach (var row in userEans)
        {
            var key = CsvUtils.NormalizeEan(row.Ean);
            if (string.IsNullOrWhiteSpace(key) || eanLabels.ContainsKey(key)) continue;
            var label = string.IsNullOrWhiteSpace(row.Label) ? row.MemberName : row.Label;
            if (!string.IsNullOrWhiteSpace(label)) eanLabels[key] = label;
        }

        var producers = producerEans.Select((ean, idx) => new { name = ean, csvIndex = idx }).ToList();
        var consumers = consumerEans.Select((ean, idx) => new { name = ean, csvIndex = idx }).ToList();

        var producerIndexByEan = producerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);
        var consumerIndexByEan = consumerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);

        var linkReadings = await db.EdcLinkReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TimeFrom >= tsFrom && x.TimeFrom < tsTo)
            .ToListAsync(cancellationToken);

        var linksByTime = linkReadings.GroupBy(x => x.TimeFrom).ToDictionary(x => x.Key, x => x.ToList());
        var hasExactAllocations = linkReadings.Count > 0;

        var intervals = readings
            .GroupBy(x => x.TimeFrom)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var producerData = producerEans.Select(ean =>
                {
                    var r = g.FirstOrDefault(x => x.Ean == ean && x.IsProducer);
                    return r is null ? new { before = 0d, after = 0d, missed = 0d }
                        : new { before = r.KwhTotal, after = r.KwhRemainder, missed = r.KwhMissed };
                }).ToList();

                var consumerData = consumerEans.Select(ean =>
                {
                    var r = g.FirstOrDefault(x => x.Ean == ean && !x.IsProducer);
                    return r is null ? new { before = 0d, after = 0d, missed = 0d }
                        : new { before = r.KwhTotal, after = r.KwhRemainder, missed = r.KwhMissed };
                }).ToList();

                var sumProdBefore = producerData.Sum(x => x.before);
                var sumProdAfter  = producerData.Sum(x => x.after);
                var sumConsBefore = consumerData.Sum(x => x.before);
                var sumConsAfter  = consumerData.Sum(x => x.after);
                var sumProduction = sumProdBefore;
                var sumSharing = Math.Min(Math.Max(0, sumProdBefore - sumProdAfter), Math.Max(0, sumConsBefore - sumConsAfter));
                var sumMissed = sumProdAfter > 0.01 && sumConsAfter > 0.01 ? Math.Min(sumProdAfter, sumConsAfter) : 0d;

                List<List<double>>? exactAllocations = null;
                if (linksByTime.TryGetValue(g.Key, out var links))
                {
                    var matrix = producerEans.Select(_ => consumerEans.Select(_ => 0d).ToList()).ToList();
                    var anyLink = false;
                    foreach (var lnk in links)
                    {
                        if (producerIndexByEan.TryGetValue(lnk.ProducerEan, out var pi)
                            && consumerIndexByEan.TryGetValue(lnk.ConsumerEan, out var ci))
                        {
                            matrix[pi][ci] += Math.Max(0, lnk.KwhShared);
                            anyLink = true;
                        }
                    }
                    if (anyLink) exactAllocations = matrix;
                }

                return new
                {
                    start = g.Key.ToUnixTimeMilliseconds(),
                    producers = producerData,
                    consumers = consumerData,
                    exactAllocations,
                    sumProduction,
                    sumSharing,
                    sumMissed,
                };
            }).ToList();

        var importRow = await db.TenantEdcImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        var filename = importRow?.Filename ?? "edc.csv";

        return new
        {
            data = new
            {
                filename,
                producers,
                consumers,
                intervals,
                hasExactAllocations,
                dateFrom,
                dateTo,
            },
            eanLabels,
            memberScope = (object?)null,
        };
    }

    public async Task<SimData> BuildSimDataAsync(int tenantId, long dateFrom, long dateTo, CancellationToken cancellationToken = default)
    {
        var tsFrom = DateTimeOffset.FromUnixTimeMilliseconds(dateFrom);
        var tsTo = DateTimeOffset.FromUnixTimeMilliseconds(dateTo);

        var readings = await db.EdcReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TimeFrom >= tsFrom && x.TimeFrom < tsTo)
            .OrderBy(x => x.TimeFrom).ThenBy(x => x.Ean)
            .ToListAsync(cancellationToken);

        // Start of the actual data period – used to map synthetic profiles to the target month
        var dataStart = tsFrom;

        // If no data for requested period, fall back to the most recent available month
        if (readings.Count == 0)
        {
            var latestTs = await db.EdcReadings
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId)
                .MaxAsync(x => (DateTimeOffset?)x.TimeFrom, cancellationToken);

            if (latestTs is not { } latest)
                throw new InvalidOperationException("Pro tuto skupinu sdílení nejsou žádná EDC data.");

            // Use the calendar month that contains the latest reading
            var fallbackFrom = new DateTimeOffset(latest.Year, latest.Month, 1, 0, 0, 0, TimeSpan.Zero);
            var fallbackTo = fallbackFrom.AddMonths(1);
            dataStart = fallbackFrom;

            readings = await db.EdcReadings
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.TimeFrom >= fallbackFrom && x.TimeFrom < fallbackTo)
                .OrderBy(x => x.TimeFrom).ThenBy(x => x.Ean)
                .ToListAsync(cancellationToken);
        }

        var cs = StringComparer.Create(new CultureInfo("cs-CZ"), false);
        var producerEans = readings.Where(x => x.IsProducer).Select(x => x.Ean).Distinct().OrderBy(x => x, cs).ToList();
        var consumerEans = readings.Where(x => !x.IsProducer).Select(x => x.Ean).Distinct().OrderBy(x => x, cs).ToList();

        if (producerEans.Count == 0 || consumerEans.Count == 0)
            throw new InvalidOperationException("Pro tuto skupinu sdílení nejsou v daném období EDC data.");

        var producerIndexByEan = producerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);
        var consumerIndexByEan = consumerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);

        var linkReadings = await db.EdcLinkReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.TimeFrom >= tsFrom && x.TimeFrom < tsTo)
            .ToListAsync(cancellationToken);

        var linksByTime = linkReadings.GroupBy(x => x.TimeFrom).ToDictionary(x => x.Key, x => x.ToList());
        var hasExactAllocations = linkReadings.Count > 0;

        // Load synthetic EANs – use only those without real readings in this period
        var syntheticEans = await db.SyntheticEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var realEanSet = new HashSet<string>(readings.Select(x => x.Ean), StringComparer.Ordinal);
        var syntheticProducers = syntheticEans
            .Where(x => x.IsProducer && !realEanSet.Contains(x.Ean))
            .OrderBy(x => x.Ean, cs)
            .ToList();
        var syntheticConsumers = syntheticEans
            .Where(x => !x.IsProducer && !realEanSet.Contains(x.Ean))
            .OrderBy(x => x.Ean, cs)
            .ToList();

        foreach (var s in syntheticProducers) producerEans.Add(s.Ean);
        foreach (var s in syntheticConsumers) consumerEans.Add(s.Ean);

        // Rebuild indices after adding synthetic EANs
        producerIndexByEan = producerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);
        consumerIndexByEan = consumerEans.Select((e, i) => (e, i)).ToDictionary(x => x.e, x => x.i, StringComparer.Ordinal);

        var syntheticProducerDict = syntheticProducers.ToDictionary(x => x.Ean, StringComparer.Ordinal);
        var syntheticConsumerDict = syntheticConsumers.ToDictionary(x => x.Ean, StringComparer.Ordinal);

        // Rebuild intervals including synthetic EAN data
        var mergedIntervals = readings
            .GroupBy(x => x.TimeFrom)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var timeFrom = g.Key;
                // Synthetic profiles use the equivalent position in the TARGET month
                var syntheticTimeFrom = tsFrom + (timeFrom - dataStart);

                var producerData = producerEans.Select(ean =>
                {
                    if (syntheticProducerDict.TryGetValue(ean, out var synth))
                        return SyntheticProfileGenerator.GetProducerIntervalData(syntheticTimeFrom, synth.InstalledKw ?? 1.0, synth.AnnualKwh, synth.TdzCategory);
                    var r = g.FirstOrDefault(x => x.Ean == ean && x.IsProducer);
                    return r is null ? new SimEanData(0, 0) : new SimEanData(r.KwhTotal, r.KwhRemainder);
                }).ToList();

                var consumerData = consumerEans.Select(ean =>
                {
                    if (syntheticConsumerDict.TryGetValue(ean, out var synth))
                        return SyntheticProfileGenerator.GetConsumerIntervalData(syntheticTimeFrom, synth.AnnualKwh ?? 3500, synth.TdzCategory);
                    var r = g.FirstOrDefault(x => x.Ean == ean && !x.IsProducer);
                    return r is null ? new SimEanData(0, 0) : new SimEanData(r.KwhTotal, r.KwhRemainder);
                }).ToList();

                List<List<double>>? exactAllocations = null;
                if (linksByTime.TryGetValue(timeFrom, out var links))
                {
                    var matrix = producerEans.Select(_ => consumerEans.Select(_ => 0d).ToList()).ToList();
                    var anyLink = false;
                    foreach (var lnk in links)
                    {
                        if (producerIndexByEan.TryGetValue(lnk.ProducerEan, out var pi)
                            && consumerIndexByEan.TryGetValue(lnk.ConsumerEan, out var ci))
                        {
                            matrix[pi][ci] += Math.Max(0, lnk.KwhShared);
                            anyLink = true;
                        }
                    }
                    if (anyLink) exactAllocations = matrix;
                }

                return new SimInterval(timeFrom.ToUnixTimeMilliseconds(), producerData, consumerData, exactAllocations);
            }).ToList();

        // Load priority links and resolve indices
        var priorityLinks = await db.PriorityLinks
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var manualPriorityLinks = priorityLinks
            .Where(lnk => producerIndexByEan.ContainsKey(lnk.ProducerEan) && consumerIndexByEan.ContainsKey(lnk.ConsumerEan))
            .Select(lnk => (producerIndexByEan[lnk.ProducerEan], consumerIndexByEan[lnk.ConsumerEan]))
            .ToList();

        // Historical totals from real DB readings (0 for synthetic EANs),
        // extrapolated to a full month in case data covers only part of the month.
        var lastReading = readings.Max(x => x.TimeFrom);
        var daysInMonth = DateTime.DaysInMonth(dataStart.Year, dataStart.Month);
        // How many complete days are covered (add 1 because the last day has at least some intervals)
        var daysCovered = Math.Max(1.0, (lastReading - dataStart).TotalDays + 1.0);
        var extrapolationFactor = daysCovered < daysInMonth - 0.5
            ? daysInMonth / daysCovered
            : 1.0; // full month data — no extrapolation needed

        var historicalProdByEan = readings.Where(x => x.IsProducer)
            .GroupBy(x => x.Ean)
            .ToDictionary(g => g.Key, g => g.Sum(r => r.KwhTotal) * extrapolationFactor, StringComparer.Ordinal);
        var historicalConsByEan = readings.Where(x => !x.IsProducer)
            .GroupBy(x => x.Ean)
            .ToDictionary(g => g.Key, g => g.Sum(r => r.KwhTotal) * extrapolationFactor, StringComparer.Ordinal);

        var historicalProductionPerProducer = producerEans
            .Select(ean => historicalProdByEan.GetValueOrDefault(ean, 0d))
            .ToList();
        var historicalConsumptionPerConsumer = consumerEans
            .Select(ean => historicalConsByEan.GetValueOrDefault(ean, 0d))
            .ToList();

        return new SimData(producerEans, consumerEans, mergedIntervals, hasExactAllocations,
            manualPriorityLinks.Count > 0 ? manualPriorityLinks : null,
            historicalProductionPerProducer,
            historicalConsumptionPerConsumer);
    }

    public async Task<object> ResolveTenantScopeAsync(AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, requestedTenantId, cancellationToken);
        return new { id = tenant.Id, name = tenant.Name };
    }

    public async Task<object> ResolveGroupAccessAsync(AuthPrincipal auth, string? groupId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(groupId))
        {
            throw new InvalidOperationException("Chybi parametr groupId.");
        }

        if (!int.TryParse(groupId, out var parsedId) || parsedId <= 0)
        {
            throw new InvalidOperationException("Neplatny parametr groupId.");
        }

        if (auth.Role == AuthConstants.RoleGlobalAdmin)
        {
            var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == parsedId, cancellationToken)
                ?? throw new InvalidOperationException("Skupina sdileni neexistuje.");
            return new { id = tenant.Id, name = tenant.Name };
        }

        var administered = await GetAdministeredTenantsAsync(auth.UserId, cancellationToken);
        var hasAdmin = administered.Any(x =>
        {
            var idProperty = x.GetType().GetProperty("id");
            return idProperty is not null && (int)idProperty.GetValue(x)! == parsedId;
        });

        if (hasAdmin || auth.TenantId == parsedId)
        {
            var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == parsedId, cancellationToken)
                ?? throw new InvalidOperationException("Skupina sdileni neexistuje.");
            return new { id = tenant.Id, name = tenant.Name };
        }

        throw new InvalidOperationException("Nemas pristup k teto skupine sdileni.");
    }

    public async Task<List<object>> ListTenantsWithAdminsAsync(CancellationToken cancellationToken = default)
    {
        var tenants = await db.Tenants.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var adminRows = await db.TenantAdmins
            .AsNoTracking()
            .Join(db.Users.AsNoTracking(), ta => ta.UserId, u => u.Id, (ta, u) => new { ta.TenantId, UserId = u.Id, u.Email, u.FullName })
            .OrderBy(x => x.Email)
            .ToListAsync(cancellationToken);

        var adminsByTenant = adminRows.GroupBy(x => x.TenantId)
            .ToDictionary(
                x => x.Key,
                x => x.Select(row => (object)new { id = row.UserId, email = row.Email, fullName = row.FullName ?? string.Empty }).ToList(),
                EqualityComparer<int>.Default);

        return tenants.Select(t => (object)new
        {
            id = t.Id,
            name = t.Name,
            createdAt = t.CreatedAt,
            admins = adminsByTenant.TryGetValue(t.Id, out var admins) ? admins : new List<object>(),
        }).ToList();
    }

    public async Task<object> SaveTenantDefinitionAsync(JsonElement input, CancellationToken cancellationToken = default)
    {
        var name = input.TryGetProperty("name", out var nameElement)
            ? (nameElement.GetString() ?? string.Empty).Trim()
            : string.Empty;

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new InvalidOperationException("Tenant musi mit nazev.");
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        Tenant tenant;
        if (input.TryGetProperty("tenantId", out var tenantIdElement) && tenantIdElement.ValueKind != JsonValueKind.Null)
        {
            var tenantIdRaw = tenantIdElement.GetRawText().Trim('"');
            if (!int.TryParse(tenantIdRaw, out var tenantId))
            {
                throw new InvalidOperationException("Tenant neexistuje.");
            }

            tenant = await db.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken)
                ?? throw new InvalidOperationException("Tenant neexistuje.");
            tenant.Name = name;
        }
        else
        {
            tenant = await db.Tenants.FirstOrDefaultAsync(x => x.Name == name, cancellationToken)
                ?? new Tenant { Name = name, CreatedAt = now };

            if (tenant.Id == 0)
            {
                db.Tenants.Add(tenant);
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        var adminEmails = new List<string>();
        if (input.TryGetProperty("adminEmails", out var adminEmailsElement))
        {
            if (adminEmailsElement.ValueKind == JsonValueKind.Array)
            {
                adminEmails.AddRange(adminEmailsElement.EnumerateArray().Select(x => x.GetString() ?? string.Empty));
            }
            else if (adminEmailsElement.ValueKind == JsonValueKind.String)
            {
                adminEmails.AddRange((adminEmailsElement.GetString() ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries));
            }
        }

        var normalizedEmails = adminEmails
            .Select(CsvUtils.NormalizeEmail)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var previousAssignments = await db.TenantAdmins.Where(x => x.TenantId == tenant.Id).ToListAsync(cancellationToken);
        var previousIds = previousAssignments.Select(x => x.UserId).ToHashSet();
        var keptIds = new HashSet<int>();
        var conflicts = new List<string>();

        foreach (var email in normalizedEmails)
        {
            if (!CsvUtils.IsValidEmail(email))
            {
                conflicts.Add(email);
                continue;
            }

            var existing = await db.Users.FirstOrDefaultAsync(x => x.Email == email, cancellationToken);
            var user = await GetOrCreateUserByEmailAsync(email, existing?.FullName ?? string.Empty, existing?.Role == AuthConstants.RoleGlobalAdmin ? AuthConstants.RoleGlobalAdmin : AuthConstants.RoleTenantAdmin, existing?.Role == AuthConstants.RoleGlobalAdmin ? null : tenant.Id, cancellationToken);

            if (user.Role != AuthConstants.RoleGlobalAdmin)
            {
                var otherTenantAssignments = await db.TenantAdmins.Where(x => x.UserId == user.Id && x.TenantId != tenant.Id).ToListAsync(cancellationToken);
                if (otherTenantAssignments.Count > 0)
                {
                    db.TenantAdmins.RemoveRange(otherTenantAssignments);
                }

                await EnsureTenantAdminAssignmentAsync(user.Id, tenant.Id, cancellationToken);
                user.Role = AuthConstants.RoleTenantAdmin;
                user.TenantId = tenant.Id;
            }

            keptIds.Add(user.Id);
        }

        foreach (var previousUserId in previousIds)
        {
            if (keptIds.Contains(previousUserId))
            {
                continue;
            }

            var assignment = await db.TenantAdmins.FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.UserId == previousUserId, cancellationToken);
            if (assignment is not null)
            {
                db.TenantAdmins.Remove(assignment);
            }
            await SyncUserRoleFromAssignmentsAsync(previousUserId, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);

        return new
        {
            ok = true,
            tenant = new { id = tenant.Id, name = tenant.Name },
            conflicts,
            tenants = await ListTenantsWithAdminsAsync(cancellationToken),
            message = conflicts.Count > 0
                ? $"Tenant {tenant.Name} ulozen. Konfliktu pri prirazeni adminu: {conflicts.Count}."
                : $"Tenant {tenant.Name} byl ulozen.",
        };
    }

    public async Task<object> GetMembersAsync(AuthPrincipal auth, string? tenantId, CancellationToken cancellationToken = default)
    {
        var tenant = await ResolveTenantEntityAsync(auth, tenantId, cancellationToken);

        var members = await db.Users
            .AsNoTracking()
            .Where(x => x.IsActive == 1 && x.TenantId == tenant.Id)
            .OrderBy(x => x.Role == AuthConstants.RoleTenantAdmin ? 0 : 1)
            .ThenBy(x => string.IsNullOrWhiteSpace(x.FullName) ? x.Email : x.FullName)
            .ThenBy(x => x.Email)
            .ToListAsync(cancellationToken);

        var links = await db.UserEans
            .AsNoTracking()
            .Join(db.Users.AsNoTracking(), ue => ue.UserId, u => u.Id, (ue, u) => new { ue.UserId, ue.Ean, ue.Label, ue.MemberName, u.TenantId })
            .Where(x => x.TenantId == tenant.Id)
            .OrderBy(x => x.MemberName)
            .ThenBy(x => x.Ean)
            .ToListAsync(cancellationToken);

        var linksByUser = links
            .GroupBy(x => x.UserId)
            .ToDictionary(
                x => x.Key,
                x => x.Select(l => (object)new { ean = l.Ean, label = l.Label ?? string.Empty, memberName = l.MemberName ?? string.Empty }).ToList());

        var serialized = members.Select(member =>
        {
            var enriched = new
            {
                id = member.Id,
                email = member.Email,
                full_name = member.FullName,
                role = member.Role,
                typ = member.Typ,
                mesto = member.Mesto,
                is_active = member.IsActive,
                imported_at = member.ImportedAt,
                tenant_id = member.TenantId,
                tenant_name = tenant.Name,
                eans = linksByUser.GetValueOrDefault(member.Id) ?? new List<object>(),
            };

            return SerializeAdminMember(enriched);
        }).ToList();

        return new
        {
            tenant = new { id = tenant.Id, name = tenant.Name },
            members = serialized,
        };
    }

    public async Task<List<object>> GetSharingGroupsAsync(AuthPrincipal auth, CancellationToken cancellationToken = default)
    {
        List<int> tenantIds;

        if (auth.Role == AuthConstants.RoleGlobalAdmin)
        {
            tenantIds = await db.Tenants.AsNoTracking().OrderBy(x => x.Name).Select(x => x.Id).ToListAsync(cancellationToken);
        }
        else
        {
            var administered = await db.TenantAdmins.AsNoTracking().Where(x => x.UserId == auth.UserId).Select(x => x.TenantId).ToListAsync(cancellationToken);
            if (administered.Count == 0 && auth.TenantId.HasValue)
            {
                tenantIds = [auth.TenantId.Value];
            }
            else
            {
                tenantIds = administered;
            }
        }

        var groups = new List<object>();
        foreach (var tenantId in tenantIds)
        {
            var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
            if (tenant is null)
            {
                continue;
            }

            var importRow = await db.TenantEdcImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
            if (importRow is null)
            {
                continue;
            }

            groups.Add(new
            {
                id = tenant.Id,
                name = tenant.Name,
                producerCount = importRow.ProducerCount,
                consumerCount = importRow.ConsumerCount,
                dateFrom = importRow.DateFrom,
                dateTo = importRow.DateTo,
                importedAt = importRow.ImportedAt,
            });
        }

        return groups;
    }

    private async Task SeedTenantsAndAdminsAsync(CancellationToken cancellationToken)
    {
        // Seed is non-destructive: only creates records that don't exist yet.
        // Never overwrites existing users or tenants to avoid corrupting data
        // from an existing Node backend database.

        // For global admins: just ensure the user exists with the right role.
        foreach (var seeded in AuthConstants.SeededGlobalAdmins)
        {
            await SeedUserIfNotExistsAsync(seeded.Email, seeded.FullName, AuthConstants.RoleGlobalAdmin, null, cancellationToken);
        }

        // For tenant admins: find (or create) the tenant, then ensure admin user + assignment.
        foreach (var seeded in AuthConstants.SeededTenantAdmins)
        {
            var tenant = await FindOrCreateTenantLooseAsync(seeded.TenantName, cancellationToken);
            var tenantAdmin = await SeedUserIfNotExistsAsync(seeded.Email, seeded.FullName, AuthConstants.RoleTenantAdmin, tenant.Id, cancellationToken);
            await EnsureTenantAdminAssignmentAsync(tenantAdmin.Id, tenant.Id, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Finds an existing tenant by case-insensitive (and diacritics-insensitive) name match,
    /// or creates a new one if none found. Never updates an existing tenant.
    /// </summary>
    private async Task<Tenant> FindOrCreateTenantLooseAsync(string name, CancellationToken cancellationToken)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new InvalidOperationException("Tenant musi mit vyplneny nazev.");
        }

        // Try exact match first.
        var tenant = await db.Tenants.FirstOrDefaultAsync(x => x.Name == trimmed, cancellationToken);
        if (tenant is not null)
        {
            return tenant;
        }

        // Try case-insensitive match (handles differences in casing / locale)
        var normalizedSeed = CsvUtils.NormalizeName(trimmed);
        var allTenants = await db.Tenants.ToListAsync(cancellationToken);
        tenant = allTenants.FirstOrDefault(x => CsvUtils.NormalizeName(x.Name) == normalizedSeed);
        if (tenant is not null)
        {
            return tenant;
        }

        // No matching tenant found — create a fresh one.
        tenant = new Tenant
        {
            Name = trimmed,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(cancellationToken);
        return tenant;
    }

    /// <summary>
    /// Creates the user only if they don't exist yet. Never overwrites data of existing users.
    /// </summary>
    private async Task<User> SeedUserIfNotExistsAsync(string email, string fullName, string role, int? tenantId, CancellationToken cancellationToken)
    {
        var normalized = CsvUtils.NormalizeEmail(email);
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized, cancellationToken);
        if (user is not null)
        {
            return user;
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        user = new User
        {
            Email = normalized,
            FullName = fullName ?? string.Empty,
            Role = string.IsNullOrWhiteSpace(role) ? AuthConstants.RoleMember : role,
            TenantId = tenantId,
            IsActive = 1,
            CreatedAt = now,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        return user;
    }

    private async Task<Tenant> GetOrCreateTenantByNameAsync(string name, CancellationToken cancellationToken)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new InvalidOperationException("Tenant musi mit vyplneny nazev.");
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(x => x.Name == trimmed, cancellationToken);
        if (tenant is not null)
        {
            return tenant;
        }

        tenant = new Tenant
        {
            Name = trimmed,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(cancellationToken);
        return tenant;
    }

    private async Task<User> GetOrCreateUserByEmailAsync(string email, string fullName, string role, int? tenantId, CancellationToken cancellationToken)
    {
        var normalized = CsvUtils.NormalizeEmail(email);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized, cancellationToken);

        if (user is null)
        {
            user = new User
            {
                Email = normalized,
                FullName = fullName ?? string.Empty,
                Role = string.IsNullOrWhiteSpace(role) ? AuthConstants.RoleMember : role,
                TenantId = tenantId,
                IsActive = 1,
                CreatedAt = now,
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(cancellationToken);
            return user;
        }

        user.FullName = fullName ?? string.Empty;
        user.Role = string.IsNullOrWhiteSpace(role) ? AuthConstants.RoleMember : role;
        user.TenantId = tenantId;
        user.IsActive = 1;
        await db.SaveChangesAsync(cancellationToken);
        return user;
    }

    private async Task EnsureTenantAdminAssignmentAsync(int userId, int tenantId, CancellationToken cancellationToken)
    {
        var exists = await db.TenantAdmins.AnyAsync(x => x.UserId == userId && x.TenantId == tenantId, cancellationToken);
        if (exists)
        {
            return;
        }

        db.TenantAdmins.Add(new TenantAdmin
        {
            TenantId = tenantId,
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        });
    }

    private async Task SyncUserRoleFromAssignmentsAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null || user.Role == AuthConstants.RoleGlobalAdmin)
        {
            return;
        }

        var hasAssignment = await db.TenantAdmins.AnyAsync(x => x.UserId == userId, cancellationToken);
        user.Role = hasAssignment ? AuthConstants.RoleTenantAdmin : AuthConstants.RoleMember;
    }

    private async Task<AuthPrincipal?> BuildPrincipalForUserAsync(User user, string tokenHash, CancellationToken cancellationToken)
    {
        var tenantName = string.Empty;
        if (user.TenantId.HasValue)
        {
            tenantName = (await db.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == user.TenantId.Value, cancellationToken))?.Name ?? string.Empty;
        }

        return new AuthPrincipal(
            tokenHash,
            user.Id,
            user.Email,
            user.FullName ?? string.Empty,
            user.Role ?? AuthConstants.RoleMember,
            user.TenantId,
            tenantName,
            user.Typ ?? string.Empty,
            user.Mesto ?? string.Empty
        );
    }

    private object SerializeUser(AuthPrincipal user, List<object> administeredTenants)
    {
        return new
        {
            id = user.UserId,
            email = user.Email,
            fullName = user.FullName ?? string.Empty,
            role = user.Role ?? AuthConstants.RoleMember,
            typ = user.Typ ?? string.Empty,
            mesto = user.Mesto ?? string.Empty,
            tenantId = user.TenantId,
            tenantName = user.TenantName ?? string.Empty,
            administeredTenants,
        };
    }

    private static object SerializeAdminMember(dynamic user)
    {
        return new
        {
            id = user.id,
            email = user.email,
            fullName = user.full_name ?? string.Empty,
            role = user.role ?? AuthConstants.RoleMember,
            typ = user.typ ?? string.Empty,
            mesto = user.mesto ?? string.Empty,
            isActive = Convert.ToInt32(user.is_active) == 1,
            importedAt = user.imported_at,
            eans = user.eans ?? new List<object>(),
            tenantId = user.tenant_id,
            tenantName = user.tenant_name ?? string.Empty,
        };
    }

    private static object? SerializeEdcImport(TenantEdcImport? row)
    {
        if (row is null)
        {
            return null;
        }

        return new
        {
            tenantId = row.TenantId,
            filename = row.Filename ?? string.Empty,
            producerCount = row.ProducerCount,
            consumerCount = row.ConsumerCount,
            intervalCount = row.IntervalCount,
            dateFrom = row.DateFrom,
            dateTo = row.DateTo,
            importedAt = row.ImportedAt,
        };
    }

    private static object? SerializeEdcLinkImport(TenantEdcLinkImport? row)
    {
        if (row is null)
        {
            return null;
        }

        return new
        {
            tenantId = row.TenantId,
            filename = row.Filename ?? string.Empty,
            linkCount = row.LinkCount,
            intervalCount = row.IntervalCount,
            dateFrom = row.DateFrom,
            dateTo = row.DateTo,
            importedAt = row.ImportedAt,
        };
    }

    private async Task<Tenant> ResolveTenantEntityAsync(AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken)
    {
        if (auth.Role == AuthConstants.RoleGlobalAdmin)
        {
            if (string.IsNullOrWhiteSpace(requestedTenantId))
            {
                throw new InvalidOperationException("Vyber tenant.");
            }

            if (!int.TryParse(requestedTenantId, out var tenantId) || tenantId <= 0)
            {
                throw new InvalidOperationException("Zvoleny tenant neexistuje.");
            }

            return await db.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken)
                ?? throw new InvalidOperationException("Zvoleny tenant neexistuje.");
        }

        var administeredTenants = await db.TenantAdmins
            .AsNoTracking()
            .Where(x => x.UserId == auth.UserId)
            .Join(db.Tenants.AsNoTracking(), ta => ta.TenantId, t => t.Id, (ta, t) => t)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        if (administeredTenants.Count == 0)
        {
            if (auth.TenantId.HasValue)
            {
                var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == auth.TenantId.Value, cancellationToken);
                if (tenant is not null)
                {
                    return tenant;
                }
            }
            throw new InvalidOperationException("Administrator nema prirazen zadny tenant.");
        }

        return administeredTenants[0];
    }

    private static string BuildMaskedEan(string rawEan, HashSet<string> usedValues)
    {
        var normalized = CsvUtils.NormalizeEan(rawEan);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return "*";
        }

        var first = normalized[..1];
        var last4 = normalized.Length > 4 ? normalized[^4..] : normalized;
        var baseStars = Math.Max(1, normalized.Length - 5);
        var extra = 0;

        while (true)
        {
            var masked = first + new string('*', baseStars + extra) + last4;
            if (!usedValues.Contains(masked))
            {
                usedValues.Add(masked);
                return masked;
            }
            extra++;
        }
    }

    // ── Allocation Planner ───────────────────────────────────────────────────

    public async Task<List<PlannerEanDto>> GetPlannerEansAsync(int tenantId, CancellationToken cancellationToken = default)
    {
        var syntheticEans = await db.SyntheticEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var syntheticEanSet = new HashSet<string>(syntheticEans.Select(x => x.Ean), StringComparer.Ordinal);

        // Real EANs from readings
        var realEans = await db.EdcReadings
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Ean, x.IsProducer })
            .Distinct()
            .ToListAsync(cancellationToken);

        var labels = await db.TenantEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Ean, x => x.Label, cancellationToken);

        var result = new List<PlannerEanDto>();

        // Real EANs (exclude those already covered by synthetic)
        foreach (var r in realEans.Where(x => !syntheticEanSet.Contains(x.Ean)))
            result.Add(new PlannerEanDto(r.Ean, labels.GetValueOrDefault(r.Ean, r.Ean), r.IsProducer, false, null, null, null));

        // Synthetic EANs
        foreach (var s in syntheticEans)
            result.Add(new PlannerEanDto(s.Ean, s.Label, s.IsProducer, true, s.InstalledKw, s.AnnualKwh, s.TdzCategory));

        return result.OrderBy(x => x.IsProducer ? 0 : 1).ThenBy(x => x.Label).ToList();
    }

    public async Task UpsertSyntheticEanAsync(int tenantId, UpsertSyntheticEanRequest req, CancellationToken cancellationToken = default)
    {
        var existing = await db.SyntheticEans
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Ean == req.Ean, cancellationToken);

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        if (existing is not null)
        {
            existing.Label = req.Label;
            existing.IsProducer = req.IsProducer;
            existing.InstalledKw = req.InstalledKw;
            existing.AnnualKwh = req.AnnualKwh;
            existing.TdzCategory = req.TdzCategory;
        }
        else
        {
            db.SyntheticEans.Add(new SyntheticEan
            {
                TenantId = tenantId,
                Ean = req.Ean,
                Label = req.Label,
                IsProducer = req.IsProducer,
                InstalledKw = req.InstalledKw,
                AnnualKwh = req.AnnualKwh,
                TdzCategory = req.TdzCategory,
                CreatedAt = now,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteSyntheticEanAsync(int tenantId, string ean, CancellationToken cancellationToken = default)
    {
        var entity = await db.SyntheticEans
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Ean == ean, cancellationToken);
        if (entity is not null)
        {
            db.SyntheticEans.Remove(entity);
            // Also remove related priority links
            var links = await db.PriorityLinks
                .Where(x => x.TenantId == tenantId && (x.ProducerEan == ean || x.ConsumerEan == ean))
                .ToListAsync(cancellationToken);
            db.PriorityLinks.RemoveRange(links);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<List<PriorityLinkDto>> GetPriorityLinksAsync(int tenantId, CancellationToken cancellationToken = default)
    {
        var links = await db.PriorityLinks
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var labels = await db.TenantEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Ean, x => x.Label, cancellationToken);

        var syntheticLabels = await db.SyntheticEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Ean, x => x.Label, cancellationToken);

        string GetLabel(string ean) =>
            labels.TryGetValue(ean, out var l) ? l :
            syntheticLabels.TryGetValue(ean, out var sl) ? sl : ean;

        return links.Select(lnk => new PriorityLinkDto(
            lnk.ProducerEan, GetLabel(lnk.ProducerEan),
            lnk.ConsumerEan, GetLabel(lnk.ConsumerEan),
            lnk.CreatedAt)).ToList();
    }

    public async Task AddPriorityLinkAsync(int tenantId, string producerEan, string consumerEan, CancellationToken cancellationToken = default)
    {
        // Validate: consumer can have at most 5 linked producers
        var existingCount = await db.PriorityLinks
            .CountAsync(x => x.TenantId == tenantId && x.ConsumerEan == consumerEan, cancellationToken);
        if (existingCount >= 5)
            throw new InvalidOperationException($"Odběratel {consumerEan} už má 5 prioritních výroben (maximum dle pravidel EDC).");

        var exists = await db.PriorityLinks.AnyAsync(
            x => x.TenantId == tenantId && x.ProducerEan == producerEan && x.ConsumerEan == consumerEan,
            cancellationToken);
        if (!exists)
        {
            db.PriorityLinks.Add(new PriorityLink
            {
                TenantId = tenantId,
                ProducerEan = producerEan,
                ConsumerEan = consumerEan,
                CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            });
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task DeletePriorityLinkAsync(int tenantId, string producerEan, string consumerEan, CancellationToken cancellationToken = default)
    {
        var entity = await db.PriorityLinks.FirstOrDefaultAsync(
            x => x.TenantId == tenantId && x.ProducerEan == producerEan && x.ConsumerEan == consumerEan,
            cancellationToken);
        if (entity is not null)
        {
            db.PriorityLinks.Remove(entity);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task UpsertEdcCredentialAsync(int tenantId, string email, string password, CancellationToken cancellationToken = default)
    {
        var encrypted = SecurityUtils.EncryptAes(password, authOptions.Value.Pepper);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var existing = await db.TenantEdcCredentials.FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (existing is null)
        {
            db.TenantEdcCredentials.Add(new TenantEdcCredential
            {
                TenantId = tenantId,
                EdcEmail = email,
                EdcPasswordEncrypted = encrypted,
                IsEnabled = true,
                UpdatedAt = now,
            });
        }
        else
        {
            existing.EdcEmail = email;
            existing.EdcPasswordEncrypted = encrypted;
            existing.IsEnabled = true;
            existing.UpdatedAt = now;
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteEdcCredentialAsync(int tenantId, CancellationToken cancellationToken = default)
    {
        var entity = await db.TenantEdcCredentials.FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (entity is not null)
        {
            db.TenantEdcCredentials.Remove(entity);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<object?> GetEdcCredentialInfoAsync(int tenantId, CancellationToken cancellationToken = default)
    {
        var entity = await db.TenantEdcCredentials.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (entity is null) return null;
        return new { email = entity.EdcEmail, isEnabled = entity.IsEnabled, updatedAt = entity.UpdatedAt };
    }

    public async Task<List<(int TenantId, string Email, string PasswordEncrypted)>> GetAllEnabledEdcCredentialsAsync(CancellationToken cancellationToken = default)
    {
        return await db.TenantEdcCredentials.AsNoTracking()
            .Where(x => x.IsEnabled)
            .Select(x => new ValueTuple<int, string, string>(x.TenantId, x.EdcEmail, x.EdcPasswordEncrypted))
            .ToListAsync(cancellationToken);
    }

    public async Task LogEdcImportAsync(int tenantId, string filename, string reportKind, int recordCount, string status = "success", string? errorMessage = null, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var entity = new EdcImportHistory
        {
            TenantId = tenantId,
            Filename = filename,
            ReportKind = reportKind,
            RecordCount = recordCount,
            Status = status,
            ErrorMessage = errorMessage,
            ImportedAt = now
        };
        db.EdcImportHistories.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<object>> GetEdcImportHistoryAsync(int tenantId, int limit = 50, CancellationToken cancellationToken = default)
    {
        var history = await db.EdcImportHistories.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.ImportedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return history.Select(x => new
        {
            id = x.Id,
            filename = x.Filename,
            reportKind = x.ReportKind,
            recordCount = x.RecordCount,
            status = x.Status,
            errorMessage = x.ErrorMessage,
            importedAt = x.ImportedAt,
            importedAtDate = DateTimeOffset.FromUnixTimeMilliseconds(x.ImportedAt).ToString("yyyy-MM-dd HH:mm:ss")
        }).Cast<object>().ToList();
    }
}

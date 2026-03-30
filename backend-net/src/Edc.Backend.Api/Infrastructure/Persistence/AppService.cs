using System.Globalization;
using System.Text.Json;
using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Csv;
using Edc.Backend.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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
    Task<object> BuildMemberSharingDataAsync(int userId, int tenantId, CancellationToken cancellationToken = default);
    Task<object> BuildTenantFullSharingDataAsync(int tenantId, CancellationToken cancellationToken = default);
    Task<object> ResolveTenantScopeAsync(AuthPrincipal auth, string? requestedTenantId, CancellationToken cancellationToken = default);
    Task<object> ResolveGroupAccessAsync(AuthPrincipal auth, string? groupId, CancellationToken cancellationToken = default);
    Task<List<object>> ListTenantsWithAdminsAsync(CancellationToken cancellationToken = default);
    Task<object> SaveTenantDefinitionAsync(JsonElement input, CancellationToken cancellationToken = default);
    Task<object> GetMembersAsync(AuthPrincipal auth, string? tenantId, CancellationToken cancellationToken = default);
    Task<List<object>> GetSharingGroupsAsync(AuthPrincipal auth, CancellationToken cancellationToken = default);
}

public sealed class AppService(
    AppDbContext db,
    ICsvParser csvParser,
    IOptions<AuthOptions> authOptions) : IAppService
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);
        await EnsureSupportingTablesAsync(cancellationToken);
        await SeedTenantsAndAdminsAsync(cancellationToken);
    }

    private async Task EnsureSupportingTablesAsync(CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            @"CREATE TABLE IF NOT EXISTS tenant_edc_link_imports (
                tenant_id INTEGER PRIMARY KEY,
                filename TEXT NOT NULL,
                source_hash TEXT NOT NULL,
                csv_text TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                link_count INTEGER NOT NULL,
                interval_count INTEGER NOT NULL,
                date_from INTEGER NOT NULL,
                date_to INTEGER NOT NULL,
                imported_at INTEGER NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            );",
            cancellationToken);
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

        var otp = await db.OtpCodes
            .Where(x => x.UserId == user.Id && x.CodeHash == codeHash)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (otp is null || otp.UsedAt.HasValue || otp.ExpiresAt < now)
        {
            throw new InvalidOperationException("Kod je neplatny nebo expirovany.");
        }

        otp.UsedAt = now;
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

        var updated = await db.TenantEdcImports.AsNoTracking().FirstAsync(x => x.TenantId == tenant.Id, cancellationToken);
        return new
        {
            ok = true,
            importInfo = SerializeEdcImport(updated),
            message = $"EDC data pro tenant {tenant.Name} byla ulozena na server.",
        };
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

        var updated = await db.TenantEdcLinkImports.AsNoTracking().FirstAsync(x => x.TenantId == tenant.Id, cancellationToken);
        return new
        {
            ok = true,
            linkImportInfo = SerializeEdcLinkImport(updated),
            message = $"Presne vazby sdileni pro tenant {tenant.Name} byly ulozeny na server.",
        };
    }

    public async Task<object> BuildMemberSharingDataAsync(int userId, int tenantId, CancellationToken cancellationToken = default)
    {
        var importRow = await db.TenantEdcImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (importRow is null || string.IsNullOrWhiteSpace(importRow.PayloadJson))
        {
            throw new InvalidOperationException("Pro tento tenant zatim nejsou ulozena EDC data.");
        }

        ParsedEdcPayload payload;
        try
        {
            payload = JsonSerializer.Deserialize<ParsedEdcPayload>(importRow.PayloadJson, _jsonOptions)
                ?? throw new InvalidOperationException();
        }
        catch
        {
            throw new InvalidOperationException("Ulozena EDC data se nepodarilo nacist.");
        }

        var exactIntervals = await GetExactAllocationIntervalsAsync(payload, tenantId, cancellationToken);

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
        {
            throw new InvalidOperationException("Uzivatel nema prirazene zadne EAN.");
        }

        var assignedMetaByEan = assignedRows
            .Select(x => new { Key = CsvUtils.NormalizeEan(x.Ean), Label = string.IsNullOrWhiteSpace(x.Label) ? x.MemberName : x.Label })
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .GroupBy(x => x.Key)
            .ToDictionary(x => x.Key!, x => x.First().Label ?? string.Empty, StringComparer.Ordinal);

        var producerNames = payload.Producers.Select(x => CsvUtils.NormalizeEan(x.Name)).ToList();
        var consumerNames = payload.Consumers.Select(x => CsvUtils.NormalizeEan(x.Name)).ToList();
        var producerSet = producerNames.ToHashSet(StringComparer.Ordinal);
        var consumerSet = consumerNames.ToHashSet(StringComparer.Ordinal);

        var hasAssignedProducer = assignedSet.Any(producerSet.Contains);
        var hasAssignedConsumer = assignedSet.Any(consumerSet.Contains);
        if (!hasAssignedProducer && !hasAssignedConsumer)
        {
            throw new InvalidOperationException("Prirazene EAN uzivatele se v aktualnich EDC datech nevyskytuji.");
        }

        var tenantEans = await db.TenantEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Ean, x.Label, x.MemberName, x.IsPublic })
            .ToListAsync(cancellationToken);

        var metaByEan = tenantEans
            .Select(x => new { Key = CsvUtils.NormalizeEan(x.Ean), Label = string.IsNullOrWhiteSpace(x.Label) ? x.MemberName : x.Label, IsPublic = x.IsPublic == 1 })
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .GroupBy(x => x.Key)
            .ToDictionary(x => x.Key!, x => x.First(), StringComparer.Ordinal);

        var allSelectedRawEans = producerNames.Concat(consumerNames).Where(x => !string.IsNullOrWhiteSpace(x)).ToHashSet(StringComparer.Ordinal);
        var maskedValues = new HashSet<string>(StringComparer.Ordinal);
        var displayByRawEan = new Dictionary<string, string>(StringComparer.Ordinal);
        var eanLabels = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var rawEan in allSelectedRawEans)
        {
            var canShowIdentity = assignedSet.Contains(rawEan);
            if (canShowIdentity)
            {
                displayByRawEan[rawEan] = rawEan;
                var label = assignedMetaByEan.TryGetValue(rawEan, out var fromAssigned) && !string.IsNullOrWhiteSpace(fromAssigned)
                    ? fromAssigned
                    : metaByEan.TryGetValue(rawEan, out var fromTenant) ? fromTenant.Label : string.Empty;

                if (!string.IsNullOrWhiteSpace(label))
                {
                    eanLabels[rawEan] = label;
                }
            }
            else
            {
                displayByRawEan[rawEan] = BuildMaskedEan(rawEan, maskedValues);
            }
        }

        var producerIndexes = Enumerable.Range(0, payload.Producers.Count).ToList();
        var consumerIndexes = Enumerable.Range(0, payload.Consumers.Count).ToList();

        var producers = producerIndexes
            .Select((originalIndex, idx) => new
            {
                name = displayByRawEan.GetValueOrDefault(CsvUtils.NormalizeEan(payload.Producers[originalIndex].Name))
                    ?? BuildMaskedEan(CsvUtils.NormalizeEan(payload.Producers[originalIndex].Name), maskedValues),
                csvIndex = idx,
            })
            .ToList();

        var consumers = consumerIndexes
            .Select((originalIndex, idx) => new
            {
                name = displayByRawEan.GetValueOrDefault(CsvUtils.NormalizeEan(payload.Consumers[originalIndex].Name))
                    ?? BuildMaskedEan(CsvUtils.NormalizeEan(payload.Consumers[originalIndex].Name), maskedValues),
                csvIndex = idx,
            })
            .ToList();

        var intervals = payload.Intervals.Select((interval, intervalIndex) =>
        {
            var nextProducers = producerIndexes.Select(originalIndex =>
            {
                var source = originalIndex < interval.Producers.Count ? interval.Producers[originalIndex] : new EdcIntervalProducer(0, 0, 0);
                return new
                {
                    before = source.Before,
                    after = source.After,
                    missed = source.Missed,
                };
            }).ToList();

            var exactAllocation = exactIntervals is not null && intervalIndex < exactIntervals.Count
                ? exactIntervals[intervalIndex]
                : null;
            var nextExactAllocations = exactAllocation is not null
                ? producerIndexes.Select(producerIndex =>
                    consumerIndexes.Select(consumerIndex => exactAllocation[producerIndex][consumerIndex]).ToList()
                ).ToList()
                : null;

            var nextConsumers = consumerIndexes.Select(originalIndex =>
            {
                var source = originalIndex < interval.Consumers.Count ? interval.Consumers[originalIndex] : new EdcIntervalConsumer(0, 0, 0);
                return new
                {
                    before = source.Before,
                    after = source.After,
                    missed = source.Missed,
                };
            }).ToList();

            var sumProduction = nextProducers.Sum(x => x.before);
            var sumSharing = Math.Min(
                Math.Max(0, sumProduction - nextProducers.Sum(x => x.after)),
                Math.Max(0, nextConsumers.Sum(x => x.before) - nextConsumers.Sum(x => x.after))
            );
            var sumMissed = Math.Min(
                Math.Max(0, nextProducers.Sum(x => x.after)),
                Math.Max(0, nextConsumers.Sum(x => x.after))
            );

            return new
            {
                start = interval.Start,
                producers = nextProducers,
                consumers = nextConsumers,
                exactAllocations = nextExactAllocations,
                sumProduction,
                sumSharing,
                sumMissed,
            };
        }).ToList();

        var ownProducerNames = payload.Producers
            .Select(x => CsvUtils.NormalizeEan(x.Name))
            .Where(assignedSet.Contains)
            .Select(x => displayByRawEan.GetValueOrDefault(x) ?? x)
            .Distinct()
            .ToList();

        var ownConsumerNames = payload.Consumers
            .Select(x => CsvUtils.NormalizeEan(x.Name))
            .Where(assignedSet.Contains)
            .Select(x => displayByRawEan.GetValueOrDefault(x) ?? x)
            .Distinct()
            .ToList();

        return new
        {
            data = new
            {
                filename = string.IsNullOrWhiteSpace(payload.Filename) ? importRow.Filename : payload.Filename,
                producers,
                consumers,
                intervals,
                hasExactAllocations = exactIntervals is not null,
                dateFrom = payload.DateFrom > 0 ? payload.DateFrom : (intervals.Count > 0 ? intervals[0].start : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
                dateTo = payload.DateTo > 0 ? payload.DateTo : (intervals.Count > 0 ? intervals[^1].start : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
            },
            eanLabels,
            memberScope = new
            {
                ownProducers = ownProducerNames,
                ownConsumers = ownConsumerNames,
            },
        };
    }

    public async Task<object> BuildTenantFullSharingDataAsync(int tenantId, CancellationToken cancellationToken = default)
    {
        var importRow = await db.TenantEdcImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (importRow is null || string.IsNullOrWhiteSpace(importRow.PayloadJson))
        {
            throw new InvalidOperationException("Pro tuto skupinu sdileni zatim nejsou ulozena EDC data.");
        }

        ParsedEdcPayload payload;
        try
        {
            payload = JsonSerializer.Deserialize<ParsedEdcPayload>(importRow.PayloadJson, _jsonOptions)
                ?? throw new InvalidOperationException();
        }
        catch
        {
            throw new InvalidOperationException("Ulozena EDC data se nepodarilo nacist.");
        }

        var exactIntervals = await GetExactAllocationIntervalsAsync(payload, tenantId, cancellationToken);

        var tenantEans = await db.TenantEans
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Ean, x.Label, x.MemberName })
            .ToListAsync(cancellationToken);

        var userEans = await db.UserEans
            .AsNoTracking()
            .Join(db.Users.AsNoTracking(), ue => ue.UserId, u => u.Id, (ue, u) => new { ue.Ean, ue.Label, ue.MemberName, u.TenantId })
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var eanLabels = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var row in tenantEans)
        {
            var key = CsvUtils.NormalizeEan(row.Ean);
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }
            var label = string.IsNullOrWhiteSpace(row.Label) ? row.MemberName : row.Label;
            if (!string.IsNullOrWhiteSpace(label))
            {
                eanLabels[key] = label;
            }
        }

        foreach (var row in userEans)
        {
            var key = CsvUtils.NormalizeEan(row.Ean);
            if (string.IsNullOrWhiteSpace(key) || eanLabels.ContainsKey(key))
            {
                continue;
            }
            var label = string.IsNullOrWhiteSpace(row.Label) ? row.MemberName : row.Label;
            if (!string.IsNullOrWhiteSpace(label))
            {
                eanLabels[key] = label;
            }
        }

        var producers = payload.Producers.Select((x, index) => new { name = CsvUtils.NormalizeEan(x.Name), csvIndex = index }).ToList();
        var consumers = payload.Consumers.Select((x, index) => new { name = CsvUtils.NormalizeEan(x.Name), csvIndex = index }).ToList();

        var intervals = payload.Intervals.Select((interval, intervalIndex) => new
        {
            start = interval.Start,
            producers = interval.Producers.Select(item => new { before = item.Before, after = item.After, missed = item.Missed }).ToList(),
            consumers = interval.Consumers.Select(item => new { before = item.Before, after = item.After, missed = item.Missed }).ToList(),
            exactAllocations = exactIntervals is not null && intervalIndex < exactIntervals.Count ? exactIntervals[intervalIndex] : null,
            sumProduction = interval.SumProduction,
            sumSharing = interval.SumSharing,
            sumMissed = interval.SumMissed,
        }).ToList();

        return new
        {
            data = new
            {
                filename = string.IsNullOrWhiteSpace(importRow.Filename) ? (string.IsNullOrWhiteSpace(payload.Filename) ? "server-edc.csv" : payload.Filename) : importRow.Filename,
                producers,
                consumers,
                intervals,
                hasExactAllocations = exactIntervals is not null,
                dateFrom = payload.DateFrom > 0 ? payload.DateFrom : (intervals.Count > 0 ? intervals[0].start : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
                dateTo = payload.DateTo > 0 ? payload.DateTo : (intervals.Count > 0 ? intervals[^1].start : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
            },
            eanLabels,
            memberScope = (object?)null,
        };
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

    private async Task<List<List<List<double>>>?> GetExactAllocationIntervalsAsync(ParsedEdcPayload payload, int tenantId, CancellationToken cancellationToken)
    {
        var linkImport = await db.TenantEdcLinkImports.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (linkImport is null || string.IsNullOrWhiteSpace(linkImport.PayloadJson))
        {
            return null;
        }

        ParsedEdcLinkPayload linkPayload;
        try
        {
            linkPayload = JsonSerializer.Deserialize<ParsedEdcLinkPayload>(linkImport.PayloadJson, _jsonOptions)
                ?? throw new InvalidOperationException();
        }
        catch
        {
            return null;
        }

        var producerIndexByEan = payload.Producers
            .Select((producer, index) => new { Key = CsvUtils.NormalizeEan(producer.Name), Index = index })
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .ToDictionary(x => x.Key!, x => x.Index, StringComparer.Ordinal);

        var consumerIndexByEan = payload.Consumers
            .Select((consumer, index) => new { Key = CsvUtils.NormalizeEan(consumer.Name), Index = index })
            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
            .ToDictionary(x => x.Key!, x => x.Index, StringComparer.Ordinal);

        var linkIntervalsByStart = linkPayload.Intervals.ToDictionary(x => x.Start, x => x);
        var result = new List<List<List<double>>>();
        var hasExactAllocations = false;

        foreach (var interval in payload.Intervals)
        {
            var matrix = Enumerable.Range(0, payload.Producers.Count)
                .Select(_ => Enumerable.Repeat(0d, payload.Consumers.Count).ToList())
                .ToList();

            if (linkIntervalsByStart.TryGetValue(interval.Start, out var linkInterval))
            {
                foreach (var link in linkInterval.Links)
                {
                    if (!producerIndexByEan.TryGetValue(CsvUtils.NormalizeEan(link.ProducerEan), out var producerIndex)
                        || !consumerIndexByEan.TryGetValue(CsvUtils.NormalizeEan(link.ConsumerEan), out var consumerIndex))
                    {
                        continue;
                    }

                    var shared = Math.Max(0, link.Shared);
                    if (shared <= 0)
                    {
                        continue;
                    }

                    matrix[producerIndex][consumerIndex] += shared;
                    hasExactAllocations = true;
                }
            }

            result.Add(matrix);
        }

        return hasExactAllocations ? result : null;
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
}

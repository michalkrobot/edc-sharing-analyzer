using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Persistence;
using Edc.Backend.Api.Infrastructure.Security;
using Microsoft.Extensions.Options;
namespace Edc.Backend.Api.Features.EdcScraper;

/// <summary>
/// Background service, který každý den po 13:30 SEČ (13:30 Europe/Prague) automaticky
/// stahuje Plus-cron a Sipka-cron reporty pro všechny aktivní tenanty.
/// </summary>
public sealed class EdcScraperHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<AuthOptions> authOptions,
    EdcPortalScraper scraper,
    ILogger<EdcScraperHostedService> logger) : BackgroundService
{
    // Hodina a minuta spuštění ve středoevropském čase (CET/CEST)
    private const int TriggerHour = 13;
    private const int TriggerMinute = 40;

    private static readonly TimeZoneInfo CetZone =
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "Central European Standard Time" : "Europe/Prague");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("EdcScraperHostedService spuštěn, denní trigger {H:D2}:{M:D2} CET.", TriggerHour, TriggerMinute);

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = GetDelayUntilNextTrigger();
            logger.LogInformation("EDC scraper: čekám {Hours:F1} hodin do příštího stahování.", delay.TotalHours);

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await RunScrapingCycleAsync(stoppingToken);
        }
    }

    private static TimeSpan GetDelayUntilNextTrigger()
    {
        var nowUtc = DateTimeOffset.UtcNow;
        var nowCet = TimeZoneInfo.ConvertTime(nowUtc, CetZone);

        var todayTrigger = new DateTimeOffset(
            nowCet.Year, nowCet.Month, nowCet.Day,
            TriggerHour, TriggerMinute, 0,
            nowCet.Offset);

        // Přepočet na UTC
        var todayTriggerUtc = TimeZoneInfo.ConvertTimeToUtc(todayTrigger.DateTime, CetZone);

        if (nowUtc >= todayTriggerUtc)
        {
            // Dnešní trigger už proběhl, čekáme do zítřka
            todayTriggerUtc = todayTriggerUtc.AddDays(1);
        }

        return todayTriggerUtc - nowUtc.UtcDateTime;
    }

    /// <summary>
    /// Spustí scraping pro všechny aktivní tenanty. Lze volat i ručně z endpointu.
    /// </summary>
    public async Task RunScrapingCycleAsync(CancellationToken cancellationToken = default, DateOnly? overrideDate = null, int? onlyTenantId = null)
    {
        logger.LogInformation("EDC scraper: spouštím cyklus stahování.");

        using var scope = scopeFactory.CreateScope();
        var appService = scope.ServiceProvider.GetRequiredService<IAppService>();

        List<(int TenantId, string Email, string PasswordEncrypted)> credentials;
        try
        {
            credentials = await appService.GetAllEnabledEdcCredentialsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "EDC scraper: chyba při načítání přihlašovacích údajů.");
            return;
        }

        if (credentials.Count == 0)
        {
            logger.LogInformation("EDC scraper: žádné aktivní přihlašovací údaje nenalezeny, přeskakuji.");
            return;
        }

        if (onlyTenantId.HasValue)
        {
            credentials = credentials.Where(c => c.TenantId == onlyTenantId.Value).ToList();
        }

        logger.LogInformation("EDC scraper: zpracovávám {Count} tenantů.", credentials.Count);

        foreach (var (tenantId, email, passwordEncrypted) in credentials)
        {
            if (cancellationToken.IsCancellationRequested) break;
            await ProcessTenantAsync(appService, tenantId, email, passwordEncrypted, overrideDate, cancellationToken);
        }

        logger.LogInformation("EDC scraper: cyklus dokončen.");
    }

    private static int EstimateRecordCount(string? csvText)
    {
        if (string.IsNullOrWhiteSpace(csvText))
        {
            return 0;
        }

        var lines = csvText
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Count(static line => !string.IsNullOrWhiteSpace(line));

        return Math.Max(0, lines - 1);
    }

    private async Task ProcessTenantAsync(
        IAppService appService,
        int tenantId,
        string email,
        string passwordEncrypted,
        DateOnly? overrideDate,
        CancellationToken cancellationToken)
    {
        string password;
        try
        {
            password = SecurityUtils.DecryptAes(passwordEncrypted, authOptions.Value.Pepper);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "EDC scraper: nelze dešifrovat heslo pro tenant {TenantId}.", tenantId);
            return;
        }

        List<EdcPortalScraper.DownloadedReport> reports;
        try
        {
            reports = await scraper.DownloadReportsAsync(email, password, overrideDate, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "EDC scraper: chyba při stahování reportů pro tenant {TenantId} ({Email}).", tenantId, email);
            return;
        }

        // Vytvoříme AuthPrincipal jako systémový (global_admin) pro import
        var auth = new AuthPrincipal(
            "system",
            0,
            email,
            "EDC Scraper",
            AuthConstants.RoleGlobalAdmin,
            tenantId,
            string.Empty,
            string.Empty,
            string.Empty);

        foreach (var report in reports)
        {
            try
            {
                var reportKind = report.Kind == EdcPortalScraper.ReportKind.PlusCron ? "Plus" : "Sipka";
                var recordCount = EstimateRecordCount(report.CsvText);

                if (report.Kind == EdcPortalScraper.ReportKind.PlusCron)
                {
                    await appService.SaveEdcImportAsync(report.CsvText, report.Filename, auth, tenantId.ToString(), cancellationToken);
                    await appService.LogEdcImportAsync(tenantId, report.Filename, reportKind, recordCount, "success", null, cancellationToken);
                    logger.LogInformation("EDC scraper: Plus-cron importován pro tenant {TenantId}.", tenantId);
                }
                else if (report.Kind == EdcPortalScraper.ReportKind.SipkaCron)
                {
                    await appService.SaveEdcLinkImportAsync(report.CsvText, report.Filename, auth, tenantId.ToString(), cancellationToken);
                    await appService.LogEdcImportAsync(tenantId, report.Filename, reportKind, recordCount, "success", null, cancellationToken);
                    logger.LogInformation("EDC scraper: Sipka-cron importován pro tenant {TenantId}.", tenantId);
                }
            }
            catch (Exception ex)
            {
                var reportKind = report.Kind == EdcPortalScraper.ReportKind.PlusCron ? "Plus" : "Sipka";
                await appService.LogEdcImportAsync(tenantId, report.Filename, reportKind, 0, "error", ex.Message, cancellationToken);
                logger.LogError(ex, "EDC scraper: chyba při importu souboru {Filename} pro tenant {TenantId}.", report.Filename, tenantId);
            }
        }
    }
}

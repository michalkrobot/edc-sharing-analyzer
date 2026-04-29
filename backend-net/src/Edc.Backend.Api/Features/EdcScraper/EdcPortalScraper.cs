using Microsoft.Playwright;

namespace Edc.Backend.Api.Features.EdcScraper;

/// <summary>
/// Playwright-based scraper pro portál EDC (https://portal.edc-cr.cz).
/// Přihlásí se přes standardní e-mail / heslo formulář, přejde na stránku reportů
/// a stáhne soubory "Plus-cron" a "Sipka-cron" pro zadaný den.
/// </summary>
public sealed class EdcPortalScraper(ILogger<EdcPortalScraper> logger)
{
    private const string PortalBaseUrl = "https://portal.edc-cr.cz";
    private const string ReportsPath = "/sprava-dat/reporty";

    public sealed record DownloadedReport(string Filename, string CsvText, ReportKind Kind);

    public enum ReportKind { PlusCron, SipkaCron }

    /// <summary>
    /// Přihlásí se do portálu EDC a stáhne Plus-cron a Sipka-cron reporty pro daný den.
    /// </summary>
    /// <param name="email">EDC přihlašovací e-mail</param>
    /// <param name="password">EDC heslo (plaintext)</param>
    /// <param name="targetDate">Den, za který se mají stáhnout reporty (default = dnes)</param>
    public async Task<List<DownloadedReport>> DownloadReportsAsync(
        string email,
        string password,
        DateOnly? targetDate = null,
        CancellationToken cancellationToken = default)
    {
        var date = targetDate ?? DateOnly.FromDateTime(DateTime.Now);
        logger.LogInformation("EDC scraper: spouštím stahování reportů pro {Email}, den {Date}", email, date);

        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true,
        });

        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            AcceptDownloads = true,
        });

        var page = await context.NewPageAsync();

        try
        {
            // 1. Otevřít homepage a přejít na Keycloak login přes tlačítko "Registrace / Přihlášení"
            await page.GotoAsync(PortalBaseUrl, new PageGotoOptions { Timeout = 30_000 });
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new PageWaitForLoadStateOptions { Timeout = 20_000 });

            var loginButton = page.GetByText("Registrace / Přihlášení").First;
            await loginButton.WaitForAsync(new LocatorWaitForOptions { Timeout = 15_000 });
            var waitLoginRedirect = page.WaitForURLAsync(
                url => url.StartsWith("https://sso.portal.edc-cr.cz", StringComparison.OrdinalIgnoreCase),
                new PageWaitForURLOptions { Timeout = 30_000, WaitUntil = WaitUntilState.NetworkIdle });
            await loginButton.ClickAsync();
            await waitLoginRedirect;

            // 2. Vyplnit přihlašovací formulář
            await FillLoginFormAsync(page, email, password);

            // 3. Přejít na stránku reportů
            logger.LogInformation("EDC scraper: přihlášení úspěšné, přecházím na stránku reportů");
            await page.GotoAsync($"{PortalBaseUrl}{ReportsPath}", new PageGotoOptions { Timeout = 30_000 });

            // 4. Stáhnout reporty
            var results = await DownloadTodayReportsAsync(page, date, cancellationToken);
            logger.LogInformation("EDC scraper: staženo {Count} reportů pro {Email}", results.Count, email);
            return results;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "EDC scraper: chyba při stahování reportů pro {Email}", email);
            throw;
        }
        finally
        {
            await BestEffortLogoutAsync(page);
            await context.CloseAsync();
        }
    }

    private async Task BestEffortLogoutAsync(IPage page)
    {
        try
        {
            if (!page.Url.StartsWith(PortalBaseUrl, StringComparison.OrdinalIgnoreCase) &&
                !page.Url.Contains("sso.portal.edc-cr.cz", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var logoutTargets = new[]
            {
                page.GetByText("Odhlásit").First,
                page.Locator("a:has-text('Odhlásit'), button:has-text('Odhlásit'), [role='button']:has-text('Odhlásit')").First,
                page.Locator("a[href*='logout'], button[aria-label*='Odhlásit'], a[aria-label*='Odhlásit']").First,
            };

            foreach (var target in logoutTargets)
            {
                try
                {
                    if (!await target.IsVisibleAsync())
                    {
                        continue;
                    }

                    await target.ClickAsync(new LocatorClickOptions { Timeout = 10_000, Force = true });
                    await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded, new PageWaitForLoadStateOptions { Timeout = 10_000 });
                    logger.LogInformation("EDC scraper: uživatel byl odhlášen.");
                    return;
                }
                catch
                {
                    // Zkusíme další logout variantu.
                }
            }

            logger.LogWarning("EDC scraper: nepodařilo se dohledat viditelnou akci Odhlásit, končím zavřením session contextu.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "EDC scraper: logout selhal, session bude ukončena zavřením browser contextu.");
        }
    }

    private static async Task FillLoginFormAsync(IPage page, string email, string password)
    {
        // Na EDC SSO je uživatelské pole 'username' a heslo v input[type=password].
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new PageWaitForLoadStateOptions { Timeout = 20_000 });

        // E-mail pole
        var emailInput = page.Locator("input[name='username'], input[type='email'], input[name='email']").First;
        await emailInput.WaitForAsync(new LocatorWaitForOptions { Timeout = 15_000 });
        await emailInput.FillAsync(email);

        // Heslo pole
        var passwordInput = page.Locator("input[type='password']").First;
        await passwordInput.FillAsync(password);

        // Odeslání formuláře a průchod případným vícekrokovým Keycloak flow.
        var submitSelector = "button:has-text('Přihlásit se'), button:has-text('Pokračovat'), button:has-text('Continue'), button[type='submit'], input[type='submit']";
        var submitButton = page.Locator(submitSelector).First;
        await submitButton.ClickAsync(new LocatorClickOptions { Timeout = 30_000 });

        var loginDeadline = DateTime.UtcNow.AddSeconds(60);
        while (DateTime.UtcNow < loginDeadline)
        {
            if (page.Url.StartsWith(PortalBaseUrl, StringComparison.OrdinalIgnoreCase))
            {
                await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded, new PageWaitForLoadStateOptions { Timeout = 10_000 });
                return;
            }

            if (!page.Url.Contains("sso.portal.edc-cr.cz", StringComparison.OrdinalIgnoreCase) &&
                !page.Url.Contains("/auth/realms/edc", StringComparison.OrdinalIgnoreCase))
            {
                await Task.Delay(500);
                continue;
            }

            var errorHint = page.Locator(".alert-error, .kc-feedback-text, [id*='input-error'], .pf-m-danger").First;
            if (await errorHint.IsVisibleAsync())
            {
                var errorText = await errorHint.InnerTextAsync();
                throw new InvalidOperationException($"Prihlaseni do EDC se nezdarilo: {errorText}");
            }

            var nextSubmit = page.Locator(submitSelector).First;
            if (await nextSubmit.IsVisibleAsync())
            {
                try
                {
                    await nextSubmit.ClickAsync(new LocatorClickOptions { Timeout = 10_000 });
                }
                catch
                {
                    // Pokud klik selže, zkusíme jen chvíli počkat na další změnu URL/stavu.
                }
            }

            await Task.Delay(1000);
        }

        throw new TimeoutException("Prihlaseni do EDC timeout: nedoslo k navratu z SSO na portal v limitu 60s.");
    }

    private async Task<List<DownloadedReport>> DownloadTodayReportsAsync(
        IPage page,
        DateOnly date,
        CancellationToken cancellationToken)
    {
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new PageWaitForLoadStateOptions { Timeout = 20_000 });

        var results = new List<DownloadedReport>();

        // Na stránce reportů je datum vidět jako "dd.MM.yyyy HH:mm".
        var dateText = date.ToString("dd.MM.yyyy");

        foreach (var kind in new[] { ReportKind.PlusCron, ReportKind.SipkaCron })
        {
            var prefix = kind == ReportKind.PlusCron ? "Plus-cron" : "Sipka-cron";
            var reportsForKind = await DownloadReportsForKindAsync(page, prefix, dateText, kind, cancellationToken);
            if (reportsForKind.Count > 0)
            {
                results.AddRange(reportsForKind);
            }
            else
            {
                logger.LogWarning("EDC scraper: report {Prefix} pro den {Date} nebyl nalezen", prefix, date);
            }
        }

        return results;
    }

    private async Task<List<DownloadedReport>> DownloadReportsForKindAsync(
        IPage page,
        string reportPrefix,
        string dateText,
        ReportKind kind,
        CancellationToken cancellationToken)
    {
        var downloaded = new List<DownloadedReport>();

        // Na portálu je akce ke stažení v tabulce jako tlačítko "Stáhnout" v řádku reportu.
        // Název reportu: Prefix-Export-dat-yyyy-mm-dd-hh-mm-ss-cisloSkupiny-nazevSkupiny
        var candidateRows = page.Locator($"tr:has-text('{reportPrefix}'):has-text('{dateText}')");
        var rowCount = await candidateRows.CountAsync();
        if (rowCount == 0)
        {
            logger.LogWarning("EDC scraper: nenalezen radek reportu pro {Prefix}", reportPrefix);
            return downloaded;
        }

        for (var i = 0; i < rowCount; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var row = candidateRows.Nth(i);
            var rowText = await row.InnerTextAsync();
            if (!rowText.Contains(dateText, StringComparison.Ordinal) ||
                !rowText.Contains(reportPrefix, StringComparison.Ordinal))
            {
                continue;
            }

            var download = await TryDownloadFromRowAsync(page, row, reportPrefix, i);
            if (download is null)
            {
                continue;
            }

            var filename = download.SuggestedFilename;
            logger.LogInformation("EDC scraper: stažen soubor {Filename}", filename);

            using var stream = await download.CreateReadStreamAsync();
            using var reader = new StreamReader(stream, System.Text.Encoding.UTF8);
            var csvText = await reader.ReadToEndAsync(cancellationToken);

            downloaded.Add(new DownloadedReport(filename, csvText, kind));
        }

        logger.LogInformation("EDC scraper: pro {Prefix} a datum {Date} stazeno {Count} souboru.", reportPrefix, dateText, downloaded.Count);
        return downloaded;
    }

    private async Task<IDownload?> TryDownloadFromRowAsync(IPage page, ILocator row, string reportPrefix, int rowIndex)
    {
        // Nejprve zkusime primou akci "Stahnout" primo v radku.
        var directSelectors = new[]
        {
            "button:has-text('Stáhnout')",
            "a:has-text('Stáhnout')",
            "button[aria-label*='Stáhnout']",
            "a[aria-label*='Stáhnout']",
            "button[title*='Stáhnout']",
            "a[title*='Stáhnout']",
            "button[mattooltip*='Stáhnout']",
            "a[mattooltip*='Stáhnout']",
            "[role='button']:has-text('Stáhnout')",
            "[role='link']:has-text('Stáhnout')",
            "td:has-text('Stáhnout')",
            "div:has-text('Stáhnout')",
            "span:has-text('Stáhnout')",
        };

        foreach (var selector in directSelectors)
        {
            var targets = row.Locator(selector);
            var count = await targets.CountAsync();
            for (var j = 0; j < count; j++)
            {
                var target = targets.Nth(j);
                if (!await target.IsVisibleAsync())
                {
                    continue;
                }

                try
                {
                    var downloadTask = page.WaitForDownloadAsync(new PageWaitForDownloadOptions { Timeout = 30_000 });
                    await target.ClickAsync(new LocatorClickOptions { Timeout = 30_000, Force = true });
                    return await downloadTask;
                }
                catch
                {
                    // Zkusime dalsi mozny prvek.
                }
            }
        }

        // Fallback: textovy locator v ramci radku, pokud UI renderuje akci jako obecny textovy element.
        var textTarget = row.GetByText("Stáhnout").First;
        if (await textTarget.IsVisibleAsync())
        {
            try
            {
                var downloadTask = page.WaitForDownloadAsync(new PageWaitForDownloadOptions { Timeout = 30_000 });
                await textTarget.ClickAsync(new LocatorClickOptions { Timeout = 30_000, Force = true });
                return await downloadTask;
            }
            catch
            {
                // Pokracujeme do dalsi fallback varianty.
            }
        }

        // Fallback: posledni bunka v radku typicky odpovida sloupci Akce.
        var actionCell = row.Locator("td, [role='cell'], mat-cell").Last;
        if (await actionCell.IsVisibleAsync())
        {
            try
            {
                var downloadTask = page.WaitForDownloadAsync(new PageWaitForDownloadOptions { Timeout = 30_000 });
                await actionCell.ClickAsync(new LocatorClickOptions { Timeout = 30_000, Force = true });
                return await downloadTask;
            }
            catch
            {
                // Pokud ani klik na bunku nic neudela, zalogujeme detail radku.
            }
        }

        // Fallback: nektere verze UI maji akce schovane pod tlacitkem menu (tri tecky).
        var menuButtons = row.Locator("button[aria-haspopup='menu'], button[aria-label*='Akce'], button[title*='Akce'], button[mattooltip*='Akce']");
        var menuCount = await menuButtons.CountAsync();
        for (var i = 0; i < menuCount; i++)
        {
            var menuButton = menuButtons.Nth(i);
            if (!await menuButton.IsVisibleAsync())
            {
                continue;
            }

            try
            {
                await menuButton.ClickAsync(new LocatorClickOptions { Timeout = 10_000 });
                var menuDownload = page.Locator("[role='menuitem']:has-text('Stáhnout'), button:has-text('Stáhnout'), a:has-text('Stáhnout')").First;
                await menuDownload.WaitForAsync(new LocatorWaitForOptions { Timeout = 5_000, State = WaitForSelectorState.Visible });
                var downloadTask = page.WaitForDownloadAsync(new PageWaitForDownloadOptions { Timeout = 30_000 });
                await menuDownload.ClickAsync(new LocatorClickOptions { Timeout = 10_000 });
                return await downloadTask;
            }
            catch
            {
                // Zkusime dalsi menu tlacitko.
            }
        }

        var rowHtml = await row.InnerHTMLAsync();
        logger.LogWarning("EDC scraper: radek {Prefix} (index {Index}) nema dostupnou akci Stahnout. HTML: {Html}", reportPrefix, rowIndex, rowHtml);
        logger.LogWarning("EDC scraper: radek {Prefix} (index {Index}) nema dostupnou akci Stahnout", reportPrefix, rowIndex);
        return null;
    }
}

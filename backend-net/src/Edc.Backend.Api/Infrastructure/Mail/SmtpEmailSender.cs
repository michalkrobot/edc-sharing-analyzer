using MailKit.Net.Smtp;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Edc.Backend.Api.Infrastructure.Mail;

public sealed class SmtpEmailSender(
    ILogger<SmtpEmailSender> logger,
    IHostEnvironment environment,
    IOptions<SmtpOptions> smtpOptions) : IEmailSender
{
    private readonly SmtpOptions _options = smtpOptions.Value;

    public async Task SendOtpAsync(string email, string code, int ttlMinutes, CancellationToken cancellationToken = default)
    {
        var host = FirstNonEmpty(_options.Host, Environment.GetEnvironmentVariable("SMTP_HOST"));
        var port = ParseIntOrDefault(Environment.GetEnvironmentVariable("SMTP_PORT"), _options.Port);

        // Supports both legacy keys (User/Pass/Secure) and requested keys (Username/Password/UseSsl).
        var user = FirstNonEmpty(
            _options.Username,
            _options.User,
            Environment.GetEnvironmentVariable("SMTP_USERNAME"),
            Environment.GetEnvironmentVariable("SMTP_USER"));
        var pass = FirstNonEmpty(
            _options.Password,
            _options.Pass,
            Environment.GetEnvironmentVariable("SMTP_PASSWORD"),
            Environment.GetEnvironmentVariable("SMTP_PASS"));
        var secure = ParseBoolOrNull(Environment.GetEnvironmentVariable("SMTP_USE_SSL"))
            ?? _options.UseSsl
            ?? _options.Secure;
        var from = FirstNonEmpty(_options.From, Environment.GetEnvironmentVariable("SMTP_FROM"));

        if (environment.IsDevelopment() && string.IsNullOrWhiteSpace(pass))
        {
            pass = _options.Pass;
        }

        if (string.IsNullOrWhiteSpace(host)
            || string.IsNullOrWhiteSpace(user)
            || string.IsNullOrWhiteSpace(pass))
        {
            logger.LogWarning("SMTP not configured – email not sent.");
            return;
        }

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(email));
                message.Subject = "ENERKOM EDC: jednorázový přihlašovací kód";

                var text =
                        "ENERKOM EDC\n"
                        + "----------------------------------------\n"
                        + $"Váš jednorázový přihlašovací kód: {code}\n\n"
                        + $"Platnost kódu: {ttlMinutes} minut.\n\n"
                        + "Pokud jste o přihlášení nežádali, tuto zprávu ignorujte.\n"
                        + "Tým ENERKOM";
                var html = $"""
                        <div style="background:#f4f7f2;padding:24px 0;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding:0 12px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d6e4d0;border-radius:12px;overflow:hidden;">
                                            <tr>
                                                <td style="background:linear-gradient(135deg,#2b8f3f,#6abf4b);padding:18px 24px;">
                                                    <img src="https://df515cd385.clvaw-cdnwnd.com/4dc301eb478f3703eeead6c586f7b665/200000135-074370743b/Enerkom_logo-0.png?ph=df515cd385" alt="ENERKOM Horní Pomoraví" style="height:34px;width:auto;display:block;" />
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:24px;">
                                                    <h1 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#1f2937;">Jednorázový přihlašovací kód</h1>
                                                    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">Použijte tento kód pro přihlášení do aplikace ENERKOM EDC:</p>
                                                    <p id="otpCode" style="margin:0 0 12px 0;padding:12px 16px;background:#f0f7ea;border:1px solid #c5deb0;border-radius:10px;font-size:28px;letter-spacing:4px;font-weight:700;text-align:center;color:#14532d;">{code}</p>
                                                    <div style="margin:0 0 16px 0;text-align:center;">
                                                        <button id="copyOtpBtn" type="button" style="background:#2b8f3f;border:1px solid #237735;color:#ffffff;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;" onclick="navigator.clipboard.writeText(document.getElementById('otpCode').textContent.trim());this.textContent='Zkopírováno';return false;">Zkopírovat kód</button>
                                                        <p style="margin:8px 0 0 0;font-size:12px;line-height:1.5;color:#64748b;">Pokud tlačítko nefunguje, označte a zkopírujte kód ručně.</p>
                                                    </div>
                                                    <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#334155;">Platnost kódu: <strong>{ttlMinutes} minut</strong>.</p>
                                                    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Pokud jste o přihlášení nežádali, tuto zprávu ignorujte.</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
                                                    Tým ENERKOM | Automatická zpráva, neodpovídejte na ni.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        """;

        message.Body = new BodyBuilder
        {
            TextBody = text,
            HtmlBody = html,
        }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, secure, cancellationToken);
        await client.AuthenticateAsync(user, pass, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private static int ParseIntOrDefault(string? raw, int fallback)
    {
        return int.TryParse(raw, out var parsed) && parsed > 0 ? parsed : fallback;
    }

    private static bool? ParseBoolOrNull(string? raw)
    {
        if (bool.TryParse(raw, out var parsed))
        {
            return parsed;
        }

        return null;
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
}

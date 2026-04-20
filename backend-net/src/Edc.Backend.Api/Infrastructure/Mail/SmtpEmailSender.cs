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
        message.Subject = "EDC: jednorazovy prihlasovaci kod";

        var text = $"Jednorazovy kod pro prihlaseni: {code}\n\nPlatnost: {ttlMinutes} minut.\nPokud jste o kod nezadali, zpravu ignorujte.";
        var html = $"<p>Jednorazovy kod pro prihlaseni:</p><p style=\"font-size:24px;font-weight:700;letter-spacing:2px\">{code}</p><p>Platnost: {ttlMinutes} minut.</p><p>Pokud jste o kod nezadali, zpravu ignorujte.</p>";

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

using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Edc.Backend.Api.Infrastructure.Mail;

public sealed class SmtpEmailSender(ILogger<SmtpEmailSender> logger, IOptions<SmtpOptions> smtpOptions) : IEmailSender
{
    private readonly SmtpOptions _options = smtpOptions.Value;

    public async Task SendOtpAsync(string email, string code, int ttlMinutes, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Host)
            || string.IsNullOrWhiteSpace(_options.User)
            || string.IsNullOrWhiteSpace(_options.Pass))
        {
            logger.LogWarning("SMTP config missing. OTP codes will be printed to server log.");
            logger.LogInformation("[AUTH OTP FALLBACK] {Email}: {Code}", email, code);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(_options.From));
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
        await client.ConnectAsync(_options.Host, _options.Port, _options.Secure, cancellationToken);
        await client.AuthenticateAsync(_options.User, _options.Pass, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}

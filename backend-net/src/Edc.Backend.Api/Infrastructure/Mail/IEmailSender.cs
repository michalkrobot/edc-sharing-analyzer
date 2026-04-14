namespace Edc.Backend.Api.Infrastructure.Mail;

public interface IEmailSender
{
    Task SendOtpAsync(string email, string code, int ttlMinutes, CancellationToken cancellationToken = default);
}

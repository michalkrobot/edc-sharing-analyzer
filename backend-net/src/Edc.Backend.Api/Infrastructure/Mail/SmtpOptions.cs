namespace Edc.Backend.Api.Infrastructure.Mail;

public sealed class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string User { get; set; } = string.Empty;
    public string Pass { get; set; } = string.Empty;
    public bool Secure { get; set; }
    public string From { get; set; } = "EDC Login <no-reply@localhost>";
}

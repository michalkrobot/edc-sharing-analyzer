namespace Edc.Backend.Api.Infrastructure.Security;

public sealed class AuthOptions
{
    public int Port { get; set; } = 8787;
    public string BaseUrl { get; set; } = "http://localhost:8787";
    public int OtpTtlMinutes { get; set; } = 10;
    public string Pepper { get; set; } = "change-me";
    public string CorsOrigin { get; set; } = "*";
    public string ConnectionString { get; set; } = "Host=localhost;Port=5432;Database=edc;Username=postgres;Password=postgres";
    public string MasterPassword { get; set; } = "";
}

using System.Security.Cryptography;
using System.Text;

namespace Edc.Backend.Api.Infrastructure.Security;

public static class SecurityUtils
{
    public static string HashValue(string input, string pepper)
    {
        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes($"{input}:{pepper}");
        return Convert.ToHexString(sha.ComputeHash(bytes)).ToLowerInvariant();
    }

    public static string GenerateOtpCode()
        => RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

    public static string GenerateSessionToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }
}

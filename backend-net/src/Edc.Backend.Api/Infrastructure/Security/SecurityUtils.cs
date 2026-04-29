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

    /// <summary>
    /// Zašifruje text pomocí AES-256-CBC, klíč je odvozen z pepper pomocí SHA-256.
    /// Vrátí Base64 řetězec s IV (prvních 16 bytů) + ciphertext.
    /// </summary>
    public static string EncryptAes(string plaintext, string pepper)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes(pepper));
        using var aes = Aes.Create();
        aes.Key = key;
        aes.GenerateIV();
        using var encryptor = aes.CreateEncryptor();
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipherBytes = encryptor.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);
        var result = new byte[aes.IV.Length + cipherBytes.Length];
        aes.IV.CopyTo(result, 0);
        cipherBytes.CopyTo(result, aes.IV.Length);
        return Convert.ToBase64String(result);
    }

    /// <summary>
    /// Dešifruje text zašifrovaný pomocí EncryptAes.
    /// </summary>
    public static string DecryptAes(string cipherBase64, string pepper)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes(pepper));
        var data = Convert.FromBase64String(cipherBase64);
        using var aes = Aes.Create();
        aes.Key = key;
        var ivLength = aes.BlockSize / 8;
        var iv = new byte[ivLength];
        Array.Copy(data, 0, iv, 0, ivLength);
        aes.IV = iv;
        using var decryptor = aes.CreateDecryptor();
        var cipherBytes = new byte[data.Length - ivLength];
        Array.Copy(data, ivLength, cipherBytes, 0, cipherBytes.Length);
        var plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
        return Encoding.UTF8.GetString(plainBytes);
    }
}

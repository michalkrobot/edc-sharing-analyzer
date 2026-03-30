using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Edc.Backend.Api.Infrastructure.Csv;

public static class CsvUtils
{
    public static string NormalizeEmail(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant();

    public static bool IsValidEmail(string email)
        => Regex.IsMatch(email, "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    public static string NormalizeHeader(string? value)
    {
        var s = (value ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var ch in s)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(ch);
            }
        }
        return sb.ToString();
    }

    public static string NormalizeName(string? value)
        => Regex.Replace(NormalizeHeader(value), "\\s+", " ").Trim();

    public static string NormalizeEan(string? value)
        => Regex.Replace(value ?? string.Empty, "\\D", string.Empty);

    public static List<string> ParseSemicolonCsvLine(string line)
    {
        var outValues = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch == ';' && !inQuotes)
            {
                outValues.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(ch);
        }

        outValues.Add(current.ToString());
        return outValues;
    }

    public static double ParseKwhValue(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return 0;
        }

        var normalized = input.Replace(',', '.');
        return double.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0;
    }
}

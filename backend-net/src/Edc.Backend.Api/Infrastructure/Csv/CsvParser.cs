using System.Text.Json;

namespace Edc.Backend.Api.Infrastructure.Csv;

public interface ICsvParser
{
    List<ParsedMemberRow> ParseMembersCsv(string csvText);
    List<ParsedEanRow> ParseEansCsv(string csvText);
    ParsedEdcPayload ParseEdcCsv(string csvText, string filename);
    ParsedEdcLinkPayload ParseEdcLinksCsv(string csvText, string filename);
}

public sealed class CsvParser : ICsvParser
{
    public List<ParsedMemberRow> ParseMembersCsv(string csvText)
    {
        var lines = (csvText ?? string.Empty)
            .Replace("\r\n", "\n")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.TrimEnd())
            .Where(x => x.Length > 0)
            .ToList();

        if (lines.Count < 2)
        {
            throw new InvalidOperationException("Soubor clenove.csv neobsahuje zadna data.");
        }

        var headers = CsvUtils.ParseSemicolonCsvLine(lines[0]).Select(CsvUtils.NormalizeHeader).ToList();
        var nameIndex = headers.IndexOf("jmeno clena");
        var emailIndex = headers.IndexOf("email");
        var typIndex = headers.IndexOf("typ");
        var mestoIndex = headers.IndexOf("mesto");

        if (emailIndex < 0)
        {
            throw new InvalidOperationException("V souboru chybi sloupec email.");
        }

        var result = new List<ParsedMemberRow>();
        for (var i = 1; i < lines.Count; i++)
        {
            var parts = CsvUtils.ParseSemicolonCsvLine(lines[i]);
            var email = CsvUtils.NormalizeEmail(parts.ElementAtOrDefault(emailIndex));
            if (string.IsNullOrWhiteSpace(email) || !CsvUtils.IsValidEmail(email))
            {
                continue;
            }

            result.Add(new ParsedMemberRow(
                email,
                nameIndex >= 0 ? (parts.ElementAtOrDefault(nameIndex) ?? string.Empty).Trim() : string.Empty,
                typIndex >= 0 ? (parts.ElementAtOrDefault(typIndex) ?? string.Empty).Trim() : string.Empty,
                mestoIndex >= 0 ? (parts.ElementAtOrDefault(mestoIndex) ?? string.Empty).Trim() : string.Empty
            ));
        }

        return result;
    }

    public List<ParsedEanRow> ParseEansCsv(string csvText)
    {
        var lines = (csvText ?? string.Empty)
            .Replace("\r\n", "\n")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.TrimEnd())
            .Where(x => x.Length > 0)
            .ToList();

        if (lines.Count < 2)
        {
            throw new InvalidOperationException("Soubor EAN neobsahuje zadna data.");
        }

        var headers = CsvUtils.ParseSemicolonCsvLine(lines[0]).Select(CsvUtils.NormalizeHeader).ToList();
        var eanIndex = headers.IndexOf("ean");
        var aliasIndex = headers.IndexOf("alias");
        var memberNameIndex = headers.IndexOf("jmeno clena");
        var publicIndex = headers.FindIndex(h => h is "public" or "verejny" or "is_public");

        if (eanIndex < 0)
        {
            throw new InvalidOperationException("V souboru chybi sloupec ean.");
        }

        if (memberNameIndex < 0)
        {
            throw new InvalidOperationException("V souboru chybi sloupec jmeno clena.");
        }

        var result = new List<ParsedEanRow>();
        for (var i = 1; i < lines.Count; i++)
        {
            var parts = CsvUtils.ParseSemicolonCsvLine(lines[i]);
            var ean = CsvUtils.NormalizeEan(parts.ElementAtOrDefault(eanIndex));
            var memberName = (parts.ElementAtOrDefault(memberNameIndex) ?? string.Empty).Trim();
            var alias = aliasIndex >= 0 ? (parts.ElementAtOrDefault(aliasIndex) ?? string.Empty).Trim() : string.Empty;
            var publicRaw = publicIndex >= 0 ? (parts.ElementAtOrDefault(publicIndex) ?? string.Empty).Trim().ToLowerInvariant() : string.Empty;
            var isPublic = publicRaw is "1" or "true" or "ano" or "yes" or "y";

            if (string.IsNullOrWhiteSpace(ean) || string.IsNullOrWhiteSpace(memberName))
            {
                continue;
            }

            result.Add(new ParsedEanRow(
                ean,
                string.IsNullOrWhiteSpace(alias) ? memberName : alias,
                memberName,
                isPublic,
                CsvUtils.NormalizeName(memberName)
            ));
        }

        return result;
    }

    public ParsedEdcPayload ParseEdcCsv(string csvText, string filename)
    {
        var lines = (csvText ?? string.Empty)
            .Replace("\r\n", "\n")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.TrimEnd())
            .Where(x => x.Length > 0)
            .ToList();

        if (lines.Count < 2)
        {
            throw new InvalidOperationException("CSV je prazdne nebo neobsahuje data.");
        }

        var header = lines[0].Split(';');
        if (header.Length < 3 || header[0] != "Datum" || header[1] != "Cas od" || header[2] != "Cas do")
        {
            throw new InvalidOperationException("Neplatna CSV hlavicka.");
        }

        var producers = new List<EdcProducer>();
        var consumers = new List<EdcConsumer>();

        for (var i = 3; i < header.Length - 1; i += 2)
        {
            var before = (header.ElementAtOrDefault(i) ?? string.Empty).Trim();
            var after = (header.ElementAtOrDefault(i + 1) ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(before) || string.IsNullOrWhiteSpace(after))
            {
                continue;
            }

            if (!before.StartsWith("IN-") || !after.StartsWith("OUT-"))
            {
                throw new InvalidOperationException($"Neplatny par sloupcu: {before}, {after}");
            }

            var beforeId = before[3..^2];
            var afterId = after[4..^2];
            if (!string.Equals(beforeId, afterId, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Neshoda IN/OUT EAN: {before} vs {after}");
            }

            var suffix = before[^2..];
            if (suffix == "-D")
            {
                producers.Add(new EdcProducer(beforeId, i));
            }
            else if (suffix == "-O")
            {
                consumers.Add(new EdcConsumer(beforeId, i));
            }
        }

        if (producers.Count == 0)
        {
            throw new InvalidOperationException("CSV neobsahuje vyrobni EAN (-D).");
        }

        if (consumers.Count == 0)
        {
            throw new InvalidOperationException("CSV neobsahuje odberne EAN (-O).");
        }

        producers = producers.OrderBy(x => x.Name, StringComparer.Create(new System.Globalization.CultureInfo("cs-CZ"), false)).ToList();
        consumers = consumers.OrderBy(x => x.Name, StringComparer.Create(new System.Globalization.CultureInfo("cs-CZ"), false)).ToList();

        var intervals = new List<EdcInterval>();
        for (var lineNo = 1; lineNo < lines.Count; lineNo++)
        {
            var parts = lines[lineNo].Split(';');
            if (parts.Length < 3)
            {
                continue;
            }

            var start = ParseEdcDate(parts);
            var intervalProducers = new List<EdcIntervalProducer>();
            var intervalConsumers = new List<EdcIntervalConsumer>();

            foreach (var producer in producers)
            {
                var before = Math.Max(0, CsvUtils.ParseKwhValue(parts.ElementAtOrDefault(producer.CsvIndex)));
                var after = Math.Max(0, Math.Min(CsvUtils.ParseKwhValue(parts.ElementAtOrDefault(producer.CsvIndex + 1)), before));
                intervalProducers.Add(new EdcIntervalProducer(before, after, 0));
            }

            foreach (var consumer in consumers)
            {
                var before = Math.Max(0, -CsvUtils.ParseKwhValue(parts.ElementAtOrDefault(consumer.CsvIndex)));
                var after = Math.Max(0, Math.Min(-CsvUtils.ParseKwhValue(parts.ElementAtOrDefault(consumer.CsvIndex + 1)), before));
                intervalConsumers.Add(new EdcIntervalConsumer(before, after, 0));
            }

            var sumProductionBefore = intervalProducers.Sum(x => x.Before);
            var sumProductionAfter = intervalProducers.Sum(x => x.After);
            var sumConsumeBefore = intervalConsumers.Sum(x => x.Before);
            var sumConsumeAfter = intervalConsumers.Sum(x => x.After);
            var sharedByProducers = Math.Max(0, sumProductionBefore - sumProductionAfter);
            var sharedByConsumers = Math.Max(0, sumConsumeBefore - sumConsumeAfter);
            var shared = Math.Min(sharedByProducers, sharedByConsumers);
            var leftoverProduction = sumProductionAfter;
            var unmetConsumption = sumConsumeAfter;
            var missedTotal = leftoverProduction > 0.01 && unmetConsumption > 0.01
                ? Math.Min(leftoverProduction, unmetConsumption)
                : 0;

            if (missedTotal > 0)
            {
                if (leftoverProduction > 0)
                {
                    intervalProducers = intervalProducers
                        .Select(x => x with { Missed = (x.After / leftoverProduction) * missedTotal })
                        .ToList();
                }
                if (unmetConsumption > 0)
                {
                    intervalConsumers = intervalConsumers
                        .Select(x => x with { Missed = (x.After / unmetConsumption) * missedTotal })
                        .ToList();
                }
            }

            var end = ParseEdcDate(parts, timeIndex: 2);
            intervals.Add(new EdcInterval(
                start,
                end,
                intervalProducers,
                intervalConsumers,
                sumProductionBefore,
                shared,
                missedTotal
            ));
        }

        if (intervals.Count == 0)
        {
            throw new InvalidOperationException("CSV neobsahuje platne intervaly.");
        }

        var dateFrom = intervals[0].Start;
        var dateTo = intervals[^1].Start + 15 * 60 * 1000;

        return new ParsedEdcPayload(
            string.IsNullOrWhiteSpace(filename) ? "edc.csv" : filename,
            producers,
            consumers,
            intervals,
            dateFrom,
            dateTo
        );
    }

    public ParsedEdcLinkPayload ParseEdcLinksCsv(string csvText, string filename)
    {
        var lines = (csvText ?? string.Empty)
            .Replace("\r\n", "\n")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.TrimEnd())
            .Where(x => x.Length > 0)
            .ToList();

        if (lines.Count < 2)
        {
            throw new InvalidOperationException("CSV vazeb je prazdne nebo neobsahuje data.");
        }

        var header = lines[0].Split(';');
        if (header.Length < 3 || header[0] != "Datum" || header[1] != "Cas od" || header[2] != "Cas do")
        {
            throw new InvalidOperationException("Neplatna CSV hlavicka souboru vazeb.");
        }

        var columns = new List<EdcLinkColumn>();
        for (var i = 3; i < header.Length; i++)
        {
            var value = (header.ElementAtOrDefault(i) ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            var parts = value.Split('-');
            if (parts.Length != 2)
            {
                throw new InvalidOperationException($"Neplatny sloupec vazby: {value}");
            }

            var producerEan = CsvUtils.NormalizeEan(parts[0]);
            var consumerEan = CsvUtils.NormalizeEan(parts[1]);
            if (string.IsNullOrWhiteSpace(producerEan) || string.IsNullOrWhiteSpace(consumerEan))
            {
                throw new InvalidOperationException($"Neplatny sloupec vazby: {value}");
            }

            columns.Add(new EdcLinkColumn(producerEan, consumerEan, i));
        }

        if (columns.Count == 0)
        {
            throw new InvalidOperationException("CSV vazeb neobsahuje zadne sloupce vyrobna-odber.");
        }

        var intervals = new List<EdcLinkInterval>();
        for (var lineNo = 1; lineNo < lines.Count; lineNo++)
        {
            var parts = lines[lineNo].Split(';');
            if (parts.Length < 3)
            {
                continue;
            }

            var start = ParseEdcDate(parts);
            var end = ParseEdcDate(parts, timeIndex: 2);
            var links = new List<EdcLinkValue>();
            foreach (var column in columns)
            {
                var shared = Math.Max(0, CsvUtils.ParseKwhValue(parts.ElementAtOrDefault(column.CsvIndex)));
                if (shared <= 0)
                {
                    continue;
                }

                links.Add(new EdcLinkValue(column.ProducerEan, column.ConsumerEan, shared));
            }

            intervals.Add(new EdcLinkInterval(start, end, links));
        }

        if (intervals.Count == 0)
        {
            throw new InvalidOperationException("CSV vazeb neobsahuje platne intervaly.");
        }

        var dateFrom = intervals[0].Start;
        var dateTo = intervals[^1].Start + 15 * 60 * 1000;

        return new ParsedEdcLinkPayload(
            string.IsNullOrWhiteSpace(filename) ? "edc-links.csv" : filename,
            columns,
            intervals,
            dateFrom,
            dateTo
        );
    }

    private static long ParseEdcDate(string[] parts, int timeIndex = 1)
    {
        var dateRaw = parts.ElementAtOrDefault(0) ?? string.Empty;
        var timeRaw = parts.ElementAtOrDefault(timeIndex) ?? string.Empty;
        var dateParts = dateRaw.Split('.');
        var timeParts = timeRaw.Split(':');

        if (dateParts.Length != 3 || timeParts.Length != 2)
        {
            throw new InvalidOperationException("Neplatne datum/cas v EDC souboru.");
        }

        var day = int.Parse(dateParts[0]);
        var month = int.Parse(dateParts[1]);
        var year = int.Parse(dateParts[2]);
        var hour = int.Parse(timeParts[0]);
        var minute = int.Parse(timeParts[1]);

        var parsed = new DateTimeOffset(year, month, day, hour, minute, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        return parsed;
    }
}

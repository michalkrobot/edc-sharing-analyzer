namespace Edc.Backend.Api.Infrastructure.Csv;

public sealed record ParsedMemberRow(string Email, string FullName, string Typ, string Mesto);
public sealed record ParsedEanRow(string Ean, string Label, string MemberName, bool IsPublic, string NormalizedMemberName);
public sealed record EdcProducer(string Name, int CsvIndex);
public sealed record EdcConsumer(string Name, int CsvIndex);
public sealed record EdcIntervalProducer(double Before, double After, double Missed);
public sealed record EdcIntervalConsumer(double Before, double After, double Missed);
public sealed record EdcInterval(long Start, long End, List<EdcIntervalProducer> Producers, List<EdcIntervalConsumer> Consumers, double SumProduction, double SumSharing, double SumMissed);
public sealed record ParsedEdcPayload(string Filename, List<EdcProducer> Producers, List<EdcConsumer> Consumers, List<EdcInterval> Intervals, long DateFrom, long DateTo);
public sealed record EdcLinkColumn(string ProducerEan, string ConsumerEan, int CsvIndex);
public sealed record EdcLinkValue(string ProducerEan, string ConsumerEan, double Shared);
public sealed record EdcLinkInterval(long Start, long End, List<EdcLinkValue> Links);
public sealed record ParsedEdcLinkPayload(string Filename, List<EdcLinkColumn> Columns, List<EdcLinkInterval> Intervals, long DateFrom, long DateTo);

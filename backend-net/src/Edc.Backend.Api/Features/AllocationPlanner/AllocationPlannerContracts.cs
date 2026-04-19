namespace Edc.Backend.Api.Features.AllocationPlanner;

public sealed record PlannerEanDto(
    string Ean,
    string Label,
    bool IsProducer,
    bool IsSynthetic,
    double? InstalledKw,
    double? AnnualKwh,
    string? TdzCategory);

public sealed record PriorityLinkDto(
    string ProducerEan,
    string ProducerLabel,
    string ConsumerEan,
    string ConsumerLabel,
    long CreatedAt);

public sealed record UpsertSyntheticEanRequest(
    string Ean,
    string Label,
    bool IsProducer,
    double? InstalledKw,
    double? AnnualKwh,
    string TdzCategory);

public sealed record AddPriorityLinkRequest(
    string ProducerEan,
    string ConsumerEan);

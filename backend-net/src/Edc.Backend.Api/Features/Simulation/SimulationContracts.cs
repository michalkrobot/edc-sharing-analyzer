namespace Edc.Backend.Api.Features.Simulation;

public sealed record SimEanData(double Before, double After);

public sealed record SimInterval(
    long StartMs,
    List<SimEanData> Producers,
    List<SimEanData> Consumers,
    List<List<double>>? ExactAllocations);

public sealed record SimData(
    List<string> ProducerNames,
    List<string> ConsumerNames,
    List<SimInterval> Intervals,
    bool HasExactAllocations);

public sealed record HistoricalWeights(
    double CurrentMonth,
    double LastYearSameMonth,
    double RecentWeeks,
    double Baseline);

public sealed record StartSimulationRequest(
    string? GroupId,
    string? TenantId,
    long DateFrom,
    long DateTo,
    string Mode,
    int Rounds,
    int MaxFails,
    int Restarts,
    HistoricalWeights? Weights);

public sealed record IntervalTotal(string Label, double Production, double Consumption, double Shared);

public sealed record SimulationResult(
    List<double> Allocations,
    List<List<double>> ProducerAllocationMatrix,
    List<double> SharingPerEan,
    List<double> SharingPerProducer,
    List<List<double>> ProducerToConsumer,
    List<List<double>> SharingPerRoundPerEan,
    List<IntervalTotal> IntervalTotals,
    double TotalSharing,
    int RoundsUsed,
    string SourceSummary);

public sealed record SimProgressEvent(
    string Type,
    int Percent,
    double? EtaSecs,
    string? Message,
    SimulationResult? Result);

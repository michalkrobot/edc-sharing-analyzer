using System.Globalization;

namespace Edc.Backend.Api.Features.Simulation;

public static class SimulationEngine
{
    private const int MethodologyMaxRounds = 5;
    private const int MaxPriorityLinks = 5;
    private const double MinConsumerAllocationPercent = 0.5;

    public static readonly HistoricalWeights DefaultWeights = new(1.1, 2.4, 0.7, 0.2);

    private static long ToCentiKwh(double value) =>
        Math.Max(0L, (long)Math.Floor((value + 1e-9) * 100));

    private static double FromCentiKwh(long value) => value / 100.0;

    private static double FloorPercent(double value) =>
        Math.Max(0.0, Math.Floor((value + 1e-9) * 100) / 100);

    private static double Clamp(double v, double min, double max) =>
        Math.Min(Math.Max(v, min), max);

    private static double[] NormalizePercentRow(double[] values, double maxTotal = 100)
    {
        var cleaned = values.Select(v => Clamp(v, 0, maxTotal)).ToArray();
        var total = cleaned.Sum();
        if (total <= maxTotal + 1e-9)
            return cleaned.Select(FloorPercent).ToArray();
        var ratio = maxTotal / total;
        return cleaned.Select(v => FloorPercent(v * ratio)).ToArray();
    }

    private sealed record HistoryReference(DateTimeOffset Anchor, bool HasCurrentMonthData, bool HasYearAgoMonthData);

    private static HistoryReference GetHistoryReference(List<SimInterval> intervals)
    {
        var now = DateTimeOffset.UtcNow;
        var startTimes = intervals.Select(i => DateTimeOffset.FromUnixTimeMilliseconds(i.StartMs)).ToList();

        var hasCurrentMonth = startTimes.Any(s => s.Year == now.Year && s.Month == now.Month);
        DateTimeOffset anchor;
        if (hasCurrentMonth)
        {
            anchor = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        }
        else if (startTimes.Count > 0)
        {
            var last = startTimes[^1];
            anchor = new DateTimeOffset(last.Year, last.Month, 1, 0, 0, 0, TimeSpan.Zero);
        }
        else
        {
            anchor = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        }

        var hasYearAgo = startTimes.Any(s => s.Year == anchor.Year - 1 && s.Month == anchor.Month);
        return new HistoryReference(anchor, hasCurrentMonth, hasYearAgo);
    }

    private static double GetHistoricalIntervalWeight(DateTimeOffset start, HistoryReference histRef, HistoricalWeights weights)
    {
        if (start.Year == histRef.Anchor.Year && start.Month == histRef.Anchor.Month)
            return weights.CurrentMonth;

        if (histRef.HasYearAgoMonthData && start.Year == histRef.Anchor.Year - 1 && start.Month == histRef.Anchor.Month)
            return weights.LastYearSameMonth;

        var dayDiff = Math.Abs((histRef.Anchor - start).TotalDays);
        if (dayDiff <= 28)
            return weights.RecentWeeks;

        return weights.Baseline;
    }

    private static double[][] BuildEstimatedIntervalAllocationMatrix(SimInterval interval)
    {
        int pCount = interval.Producers.Count;
        int cCount = interval.Consumers.Count;
        var matrix = Enumerable.Range(0, pCount).Select(_ => new double[cCount]).ToArray();

        var totalConsumerReceived = interval.Consumers.Sum(c => Math.Max(0, c.Before - c.After));
        if (totalConsumerReceived < 0.001) return matrix;

        for (int pi = 0; pi < pCount; pi++)
        {
            var producerShared = Math.Max(0, interval.Producers[pi].Before - interval.Producers[pi].After);
            if (producerShared < 0.001) continue;

            for (int ci = 0; ci < cCount; ci++)
            {
                var consumerShared = Math.Max(0, interval.Consumers[ci].Before - interval.Consumers[ci].After);
                if (consumerShared < 0.001) continue;
                matrix[pi][ci] = producerShared * (consumerShared / totalConsumerReceived);
            }
        }
        return matrix;
    }

    private static double[][] GetIntervalAllocationMatrix(SimData data, SimInterval interval)
    {
        if (data.HasExactAllocations && interval.ExactAllocations is not null)
        {
            return interval.ExactAllocations
                .Select(row => row.Select(v => v).ToArray())
                .ToArray();
        }
        return BuildEstimatedIntervalAllocationMatrix(interval);
    }

    private sealed record HistoricalModel(
        double[][] WeightedPairShared,
        double[][] BaseAllocations,
        int[][] PrioritiesByConsumer,
        double[] SuggestedAllocations,
        string SourceSummary);

    private static HistoricalModel BuildHistoricalSharingModel(SimData data, HistoricalWeights weights)
    {
        var histRef = GetHistoryReference(data.Intervals);
        int pCount = data.ProducerNames.Count;
        int cCount = data.ConsumerNames.Count;

        var weightedPairShared = Enumerable.Range(0, pCount).Select(_ => new double[cCount]).ToArray();
        var weightedProducerSupply = new double[pCount];
        var weightedConsumerNeed = new double[cCount];
        var weightedConsumerShared = new double[cCount];

        foreach (var interval in data.Intervals)
        {
            var start = DateTimeOffset.FromUnixTimeMilliseconds(interval.StartMs);
            var weight = GetHistoricalIntervalWeight(start, histRef, weights);
            var matrix = GetIntervalAllocationMatrix(data, interval);

            for (int pi = 0; pi < pCount; pi++)
            {
                var producerBefore = Math.Max(0, interval.Producers[pi].Before);
                weightedProducerSupply[pi] += producerBefore * weight;

                for (int ci = 0; ci < cCount; ci++)
                {
                    var shared = pi < matrix.Length && ci < matrix[pi].Length ? matrix[pi][ci] : 0.0;
                    weightedPairShared[pi][ci] += shared * weight;
                    weightedConsumerShared[ci] += shared * weight;
                }
            }

            for (int ci = 0; ci < cCount; ci++)
            {
                weightedConsumerNeed[ci] += Math.Max(0, interval.Consumers[ci].Before) * weight;
            }
        }

        var consumerNeedDenom = weightedConsumerNeed.Sum();
        double[] fallbackNeedDistribution = consumerNeedDenom > 0.001
            ? NormalizePercentRow(weightedConsumerNeed.Select(v => (v / consumerNeedDenom) * 100).ToArray())
            : NormalizePercentRow(Enumerable.Repeat(cCount > 0 ? 100.0 / cCount : 0.0, cCount).ToArray());

        var baseAllocations = new double[pCount][];
        for (int pi = 0; pi < pCount; pi++)
        {
            var row = weightedPairShared[pi];
            var rowSum = row.Sum();
            var baseDenom = weightedProducerSupply[pi] > 0.001 ? weightedProducerSupply[pi] : rowSum;
            if (baseDenom <= 0.001)
            {
                baseAllocations[pi] = fallbackNeedDistribution.ToArray();
                continue;
            }
            var normalized = NormalizePercentRow(row.Select(v => (v / baseDenom) * 100).ToArray());
            baseAllocations[pi] = normalized.Sum() <= 0.001 ? fallbackNeedDistribution.ToArray() : normalized;
        }

        var suggestedBase = weightedConsumerShared.Sum() > 0.001 ? weightedConsumerShared : weightedConsumerNeed;
        var suggestedDenom = suggestedBase.Sum();
        var suggestedAllocations = suggestedDenom > 0.001
            ? NormalizePercentRow(suggestedBase.Select(v => (v / suggestedDenom) * 100).ToArray())
            : NormalizePercentRow(Enumerable.Repeat(cCount > 0 ? 100.0 / cCount : 0.0, cCount).ToArray());

        var fallbackProducerOrder = weightedProducerSupply
            .Select((v, i) => (i, v))
            .OrderByDescending(x => x.v)
            .Select(x => x.i)
            .ToArray();

        var prioritiesByConsumer = new int[cCount][];
        for (int ci = 0; ci < cCount; ci++)
        {
            var ranked = Enumerable.Range(0, pCount)
                .Select(pi => new { pi, shared = weightedPairShared[pi][ci], allocation = baseAllocations[pi][ci] })
                .Where(x => x.shared > 0.001 || x.allocation > 0.009)
                .OrderByDescending(x => x.shared).ThenByDescending(x => x.allocation)
                .Take(MaxPriorityLinks)
                .Select(x => x.pi)
                .ToArray();

            prioritiesByConsumer[ci] = ranked.Length > 0
                ? ranked
                : fallbackProducerOrder.Take(Math.Min(MaxPriorityLinks, fallbackProducerOrder.Length)).ToArray();
        }

        var anchor = histRef.Anchor;
        var referenceLabel = anchor.ToString("MMMM yyyy", new CultureInfo("cs-CZ"));
        var sourceSummary = histRef.HasYearAgoMonthData
            ? $"historie skupiny: {referenceLabel} + silnější váha stejného měsíce {anchor.Year - 1}"
            : $"historie skupiny: {referenceLabel} + fallback posledních 4 týdnů";

        return new HistoricalModel(weightedPairShared, baseAllocations, prioritiesByConsumer, suggestedAllocations, sourceSummary);
    }

    private sealed record SimPlan(double[][] Matrix, int[][] PrioritiesByConsumer, string SourceSummary);

    private static SimPlan BuildSimulationPlanFromMatrix(SimData data, HistoricalModel model, double[][] rawMatrix, string? sourceSummary = null)
    {
        int pCount = data.ProducerNames.Count;
        int cCount = data.ConsumerNames.Count;

        var matrix = rawMatrix
            .Select(row => NormalizePercentRow(row.ToArray()))
            .ToArray();

        ValidateProducerAllocationMatrix(matrix);

        var prioritiesByConsumer = Enumerable.Range(0, cCount).Select(ci =>
        {
            var ranked = Enumerable.Range(0, pCount)
                .Select(pi => new { pi, allocation = matrix[pi][ci], historyWeight = model.WeightedPairShared[pi][ci] })
                .Where(x => x.allocation > 0.009)
                .OrderByDescending(x => x.historyWeight).ThenByDescending(x => x.allocation)
                .Take(MaxPriorityLinks)
                .Select(x => x.pi)
                .ToArray();

            return ranked.Length > 0 ? ranked : model.PrioritiesByConsumer[ci];
        }).ToArray();

        return new SimPlan(matrix, prioritiesByConsumer, sourceSummary ?? model.SourceSummary);
    }

    private static SimPlan BuildSimulationPlan(SimData data, double[][] allocationMatrix, HistoricalWeights weights, string? sourceSummary = null)
    {
        var model = BuildHistoricalSharingModel(data, weights);
        var matrix = allocationMatrix is { Length: > 0 }
            ? allocationMatrix
            : model.BaseAllocations;
        return BuildSimulationPlanFromMatrix(data, model, matrix, sourceSummary);
    }

    private static void ValidateProducerAllocationMatrix(double[][] matrix)
    {
        for (int producerIndex = 0; producerIndex < matrix.Length; producerIndex++)
        {
            var row = matrix[producerIndex];
            if (row is null)
                throw new InvalidOperationException($"Alokační řádek výrobny {producerIndex} je null.");

            if (row.Any(value => value < -1e-9))
                throw new InvalidOperationException($"Alokační řádek výrobny {producerIndex} obsahuje záporné hodnoty.");

            var rowSum = row.Sum();
            if (rowSum > 100.0001)
                throw new InvalidOperationException($"Součet alokací výrobny {producerIndex} je {rowSum:F4}% a překračuje 100%.");
        }
    }

    private static int ResolveMethodologyRounds(SimData data, int requestedRounds)
    {
        var sseSize = data.ProducerNames.Count + data.ConsumerNames.Count;
        var maxRounds = sseSize > 50 ? 1 : Math.Max(1, Math.Min(MethodologyMaxRounds, Math.Max(1, data.ConsumerNames.Count)));
        if (requestedRounds < 1) return maxRounds;
        return Math.Max(1, Math.Min(maxRounds, requestedRounds));
    }

    private static List<double> BuildConsumerAllocationSummary(double[][] producerAllocationMatrix)
    {
        if (producerAllocationMatrix.Length == 0)
            return [];

        var consumerCount = producerAllocationMatrix[0].Length;
        var totals = Enumerable.Range(0, consumerCount)
            .Select(ci => producerAllocationMatrix.Sum(row => ci < row.Length ? Math.Max(0, row[ci]) : 0))
            .ToArray();

        var total = totals.Sum();
        if (total <= 1e-9)
            return Enumerable.Repeat(0.0, consumerCount).ToList();

        return totals.Select(v => (v / total) * 100.0).ToList();
    }

    private static SimulationResult SimulateSharingWithPlan(SimData data, SimPlan plan, int rounds)
    {
        var roundsUsed = ResolveMethodologyRounds(data, rounds);
        int pCount = data.ProducerNames.Count;
        int cCount = data.ConsumerNames.Count;

        var sharingPerConsumer = new double[cCount];
        var sharingPerProducer = new double[pCount];
        var producerToConsumer = Enumerable.Range(0, pCount).Select(_ => new double[cCount]).ToArray();
        var perRoundPerEan = Enumerable.Range(0, roundsUsed).Select(_ => new double[cCount]).ToArray();
        var intervalTotals = new List<IntervalTotal>();
        var simulatedProductionPerProducer = new double[pCount];
        var simulatedConsumptionPerConsumer = new double[cCount];

        foreach (var interval in data.Intervals)
        {
            var producerRemaining = interval.Producers.Select(p => ToCentiKwh(p.Before)).ToArray();
            var consumerRemaining = interval.Consumers.Select(c => ToCentiKwh(c.Before)).ToArray();
            var intervalProduction = producerRemaining.Sum() / 100.0;
            var intervalConsumption = consumerRemaining.Sum() / 100.0;

            for (int pi = 0; pi < pCount; pi++)
                simulatedProductionPerProducer[pi] += interval.Producers[pi].Before;
            for (int ci = 0; ci < cCount; ci++)
                simulatedConsumptionPerConsumer[ci] += interval.Consumers[ci].Before;
            double intervalShared = 0;

            for (int round = 0; round < roundsUsed; round++)
            {
                if (producerRemaining.Sum() <= 0) break;

                var producerBeforeRound = producerRemaining.ToArray();
                var producerSharedThisRound = new long[pCount];
                long sharedThisRound = 0;

                for (int priorityIndex = 0; priorityIndex < MaxPriorityLinks; priorityIndex++)
                {
                    for (int ci = 0; ci < cCount; ci++)
                    {
                        if (consumerRemaining[ci] <= 0) continue;

                        var priorities = plan.PrioritiesByConsumer[ci];
                        if (priorities is null || priorityIndex >= priorities.Length) continue;

                        var pi = priorities[priorityIndex];
                        if (pi < 0 || pi >= pCount) continue;

                        var allocationPercent = plan.Matrix[pi][ci];
                        if (allocationPercent <= 0) continue;

                        var quota = (long)((producerBeforeRound[pi] * allocationPercent) / 100);
                        var producerStillAvailable = producerRemaining[pi] - producerSharedThisRound[pi];
                        var shared = Math.Min(consumerRemaining[ci], Math.Min(quota, producerStillAvailable));
                        if (shared <= 0) continue;

                        consumerRemaining[ci] -= shared;
                        producerSharedThisRound[pi] += shared;
                        sharedThisRound += shared;
                        intervalShared += FromCentiKwh(shared);
                        perRoundPerEan[round][ci] += FromCentiKwh(shared);

                        var kwh = FromCentiKwh(shared);
                        sharingPerProducer[pi] += kwh;
                        producerToConsumer[pi][ci] += kwh;
                        sharingPerConsumer[ci] += kwh;
                    }
                }

                for (int pi = 0; pi < pCount; pi++)
                    producerRemaining[pi] = Math.Max(0, producerRemaining[pi] - producerSharedThisRound[pi]);

                if (sharedThisRound <= 0) break;
            }

            var startDt = DateTimeOffset.FromUnixTimeMilliseconds(interval.StartMs).ToLocalTime();
            intervalTotals.Add(new IntervalTotal(
                startDt.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
                intervalProduction,
                intervalConsumption,
                intervalShared));
        }

        return new SimulationResult(
            Allocations: BuildConsumerAllocationSummary(plan.Matrix),
            ProducerAllocationMatrix: plan.Matrix.Select(row => row.ToList()).ToList(),
            SharingPerEan: [.. sharingPerConsumer],
            SharingPerProducer: [.. sharingPerProducer],
            ProducerToConsumer: producerToConsumer.Select(row => row.ToList()).ToList(),
            SharingPerRoundPerEan: perRoundPerEan.Select(row => row.ToList()).ToList(),
            IntervalTotals: intervalTotals,
            TotalSharing: sharingPerConsumer.Sum(),
            RoundsUsed: roundsUsed,
            SourceSummary: plan.SourceSummary,
            ProducerEans: data.ProducerNames,
            ConsumerEans: data.ConsumerNames,
            SimulatedProductionPerProducer: [.. simulatedProductionPerProducer],
            SimulatedConsumptionPerConsumer: [.. simulatedConsumptionPerConsumer],
            HistoricalProductionPerProducer: data.HistoricalProductionPerProducer ?? Enumerable.Repeat(0d, pCount).ToList(),
            HistoricalConsumptionPerConsumer: data.HistoricalConsumptionPerConsumer ?? Enumerable.Repeat(0d, cCount).ToList());
    }

    public static SimulationResult SimulateSharing(SimData data, double[][] allocationMatrix, int rounds, HistoricalWeights weights, string? sourceSummary = null)
    {
        var plan = BuildSimulationPlan(data, allocationMatrix, weights, sourceSummary);
        return SimulateSharingWithPlan(data, plan, rounds);
    }

    // Lightweight scoring-only simulation — no result object, no extra arrays.
    // Uses pre-built prioritiesByConsumer so the historical model is not rebuilt per candidate.
    private static double SimulateForScore(SimData data, double[][] matrix, int[][] prioritiesByConsumer, int roundsUsed)
    {
        int pCount = data.ProducerNames.Count;
        int cCount = data.ConsumerNames.Count;
        double totalSharing = 0;

        var producerRemaining = new long[pCount];
        var consumerRemaining = new long[cCount];
        var producerBeforeRound = new long[pCount];
        var producerSharedThisRound = new long[pCount];

        foreach (var interval in data.Intervals)
        {
            long producerTotal = 0;
            for (int pi = 0; pi < pCount; pi++)
            {
                producerRemaining[pi] = ToCentiKwh(interval.Producers[pi].Before);
                producerTotal += producerRemaining[pi];
            }
            for (int ci = 0; ci < cCount; ci++)
                consumerRemaining[ci] = ToCentiKwh(interval.Consumers[ci].Before);

            for (int round = 0; round < roundsUsed && producerTotal > 0; round++)
            {
                Array.Copy(producerRemaining, producerBeforeRound, pCount);
                Array.Clear(producerSharedThisRound, 0, pCount);
                long sharedThisRound = 0;

                for (int priorityIndex = 0; priorityIndex < MaxPriorityLinks; priorityIndex++)
                {
                    for (int ci = 0; ci < cCount; ci++)
                    {
                        if (consumerRemaining[ci] <= 0) continue;
                        var priorities = prioritiesByConsumer[ci];
                        if (priorities is null || priorityIndex >= priorities.Length) continue;
                        var pi = priorities[priorityIndex];
                        if (pi < 0 || pi >= pCount) continue;
                        var alloc = matrix[pi][ci];
                        if (alloc <= 0) continue;
                        var quota = (long)((producerBeforeRound[pi] * alloc) / 100);
                        var available = producerRemaining[pi] - producerSharedThisRound[pi];
                        var shared = Math.Min(consumerRemaining[ci], Math.Min(quota, available));
                        if (shared <= 0) continue;
                        consumerRemaining[ci] -= shared;
                        producerSharedThisRound[pi] += shared;
                        sharedThisRound += shared;
                    }
                }

                for (int pi = 0; pi < pCount; pi++)
                {
                    var taken = Math.Min(producerRemaining[pi], producerSharedThisRound[pi]);
                    producerRemaining[pi] -= taken;
                    producerTotal -= taken;
                }

                totalSharing += FromCentiKwh(sharedThisRound);
                if (sharedThisRound <= 0) break;
            }
        }
        return totalSharing;
    }

    private static double[][] CloneMatrix(double[][] matrix) =>
        matrix.Select(row => row.ToArray()).ToArray();

    private static (bool[][] Allowed, bool[][] Forced) BuildAllowedAndForcedMatrix(
        int producerCount, int consumerCount,
        int[][] prioritiesByConsumer, double[][] weightedPairShared,
        List<(int ProducerIndex, int ConsumerIndex)>? manualLinks)
    {
        var allowed = Enumerable.Range(0, producerCount).Select(_ => new bool[consumerCount]).ToArray();
        var forced = Enumerable.Range(0, producerCount).Select(_ => new bool[consumerCount]).ToArray();
        var manualCountPerConsumer = new int[consumerCount];

        // 1. Mandatory manual links
        if (manualLinks is not null)
        {
            foreach (var (pi, ci) in manualLinks)
            {
                if (pi < 0 || pi >= producerCount || ci < 0 || ci >= consumerCount) continue;
                allowed[pi][ci] = true;
                forced[pi][ci] = true;
                manualCountPerConsumer[ci]++;
            }
        }

        // 2. Fill remaining slots from historical priorities
        for (int ci = 0; ci < consumerCount; ci++)
        {
            var remaining = MaxPriorityLinks - manualCountPerConsumer[ci];
            if (remaining <= 0) continue;

            var priorities = ci < prioritiesByConsumer.Length ? prioritiesByConsumer[ci] : Array.Empty<int>();
            var added = 0;
            foreach (var pi in priorities)
            {
                if (added >= remaining) break;
                if (pi >= 0 && pi < producerCount && !allowed[pi][ci])
                {
                    allowed[pi][ci] = true;
                    added++;
                }
            }

            if (!allowed.Any(row => row[ci]))
            {
                var fallback = Enumerable.Range(0, producerCount)
                    .OrderByDescending(pi => weightedPairShared[pi][ci])
                    .FirstOrDefault();
                if (fallback >= 0 && fallback < producerCount)
                    allowed[fallback][ci] = true;
            }
        }

        return (allowed, forced);
    }

    private static void EnsureForcedMinimumAllocation(double[][] matrix, bool[][] forced, double minPercent = 1.0)
    {
        for (int pi = 0; pi < matrix.Length; pi++)
        {
            for (int ci = 0; ci < matrix[pi].Length; ci++)
            {
                if (!forced[pi][ci] || matrix[pi][ci] >= minPercent - 1e-9) continue;

                var needed = minPercent - matrix[pi][ci];
                matrix[pi][ci] = minPercent;

                var donors = Enumerable.Range(0, matrix[pi].Length)
                    .Where(idx => idx != ci && !forced[pi][idx] && matrix[pi][idx] > 0.001)
                    .OrderByDescending(idx => matrix[pi][idx])
                    .ToArray();

                foreach (var donor in donors)
                {
                    if (needed <= 1e-9) break;
                    var take = Math.Min(matrix[pi][donor], needed);
                    matrix[pi][donor] -= take;
                    needed -= take;
                }
            }
            matrix[pi] = NormalizePercentRow(matrix[pi]);
        }
    }

    private static double[] ScaleRowToHundred(double[] row)
    {
        var total = row.Sum();
        if (total <= 1e-9)
            return row;

        var scaled = row.Select(v => (v / total) * 100.0).ToArray();
        var floored = scaled.Select(FloorPercent).ToArray();
        var diff = 100.0 - floored.Sum();
        if (diff > 1e-9)
        {
            var idx = Array.IndexOf(floored, floored.Max());
            floored[idx] += diff;
        }

        return floored;
    }

    private static double[][] BuildInitialAllocationMatrix(HistoricalModel model, bool[][] allowed)
    {
        var producerCount = model.BaseAllocations.Length;
        var matrix = Enumerable.Range(0, producerCount)
            .Select(pi => new double[model.BaseAllocations[pi].Length])
            .ToArray();

        for (int pi = 0; pi < producerCount; pi++)
        {
            var row = new double[matrix[pi].Length];
            for (int ci = 0; ci < row.Length; ci++)
            {
                if (allowed[pi][ci])
                    row[ci] = Math.Max(0, model.BaseAllocations[pi][ci]);
            }

            if (row.Sum() <= 1e-9)
            {
                var weightedTotal = Enumerable.Range(0, row.Length)
                    .Where(ci => allowed[pi][ci])
                    .Sum(ci => Math.Max(0, model.WeightedPairShared[pi][ci]));

                if (weightedTotal > 1e-9)
                {
                    for (int ci = 0; ci < row.Length; ci++)
                    {
                        if (!allowed[pi][ci])
                            continue;
                        row[ci] = (Math.Max(0, model.WeightedPairShared[pi][ci]) / weightedTotal) * 100.0;
                    }
                }
                else
                {
                    var firstAllowed = Enumerable.Range(0, row.Length).FirstOrDefault(ci => allowed[pi][ci]);
                    if (firstAllowed >= 0 && firstAllowed < row.Length && allowed[pi][firstAllowed])
                        row[firstAllowed] = 100.0;
                }
            }

            matrix[pi] = ScaleRowToHundred(row);
        }

        return matrix;
    }

    private static void EnsureConsumerMinimumCoverage(double[][] matrix, bool[][] allowed, double minPercent)
    {
        if (matrix.Length == 0 || matrix[0].Length == 0)
            return;

        int producerCount = matrix.Length;
        int consumerCount = matrix[0].Length;

        for (int ci = 0; ci < consumerCount; ci++)
        {
            var incoming = matrix.Sum(row => row[ci]);
            if (incoming >= minPercent - 1e-9)
                continue;

            var needed = minPercent - incoming;
            var bestProducer = Enumerable.Range(0, producerCount)
                .Where(pi => allowed[pi][ci])
                .OrderByDescending(pi => matrix[pi][ci])
                .FirstOrDefault();

            if (bestProducer < 0 || bestProducer >= producerCount || !allowed[bestProducer][ci])
                continue;

            var row = matrix[bestProducer];
            var rowSum = row.Sum();
            if (rowSum + needed <= 100.0001)
            {
                row[ci] += needed;
                continue;
            }

            var deficit = needed;
            var donors = Enumerable.Range(0, consumerCount)
                .Where(idx => idx != ci && row[idx] > 0.0001)
                .OrderByDescending(idx => row[idx])
                .ToArray();

            foreach (var donor in donors)
            {
                if (deficit <= 1e-9)
                    break;
                var take = Math.Min(row[donor], deficit);
                row[donor] -= take;
                row[ci] += take;
                deficit -= take;
            }
        }

        for (int pi = 0; pi < matrix.Length; pi++)
            matrix[pi] = NormalizePercentRow(matrix[pi]);
    }

    private const double ForcedMinPercent = 1.0;

    private static void MutateAllocationMatrix(double[][] matrix, bool[][] allowed, bool[][] forced, Random rng)
    {
        if (matrix.Length == 0 || matrix[0].Length < 2)
            return;

        var attempts = 0;
        while (attempts < 12)
        {
            attempts++;
            var pi = rng.Next(matrix.Length);
            var row = matrix[pi];
            var availableConsumers = Enumerable.Range(0, row.Length)
                .Where(ci => allowed[pi][ci])
                .ToArray();
            if (availableConsumers.Length < 2)
                continue;

            var fromIdx = availableConsumers[rng.Next(availableConsumers.Length)];
            var toIdx = availableConsumers[rng.Next(availableConsumers.Length)];
            if (fromIdx == toIdx)
                continue;

            // Don't reduce forced links below minimum
            if (forced[pi][fromIdx] && row[fromIdx] <= ForcedMinPercent + 1e-9)
                continue;

            var maxTake = forced[pi][fromIdx]
                ? Math.Max(0, row[fromIdx] - ForcedMinPercent)
                : row[fromIdx];

            var movable = Math.Min(maxTake, rng.NextDouble() * 6.0);
            if (movable <= 1e-9)
                continue;

            row[fromIdx] -= movable;
            row[toIdx] += movable;
            matrix[pi] = NormalizePercentRow(row);
            return;
        }
    }

    public static SimulationResult OptimizeAllocations(
        SimData data,
        int rounds,
        int maxFails,
        int restarts,
        HistoricalWeights weights,
        Action<int, int, SimulationResult> progress)
    {
        var producerCount = data.ProducerNames.Count;
        var consumerCount = data.ConsumerNames.Count;
        var model = BuildHistoricalSharingModel(data, weights);
        var (allowed, forced) = BuildAllowedAndForcedMatrix(producerCount, consumerCount, model.PrioritiesByConsumer, model.WeightedPairShared, data.ManualPriorityLinks);
        var roundsUsed = ResolveMethodologyRounds(data, rounds);

        double bestScore = double.MinValue;
        SimulationResult? bestOverall = null;
        var syncLock = new object();
        var completedRestarts = 0;

        Parallel.For(0, restarts, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount },
            _ =>
            {
                var rng = new Random();
                var current = BuildInitialAllocationMatrix(model, allowed);
                EnsureConsumerMinimumCoverage(current, allowed, MinConsumerAllocationPercent);
                EnsureForcedMinimumAllocation(current, forced);
                var currentScore = SimulateForScore(data, current, model.PrioritiesByConsumer, roundsUsed);
                var localBest = CloneMatrix(current);
                var localBestScore = currentScore;

                int fails = 0;
                while (fails < maxFails)
                {
                    var candidate = CloneMatrix(current);
                    MutateAllocationMatrix(candidate, allowed, forced, rng);
                    EnsureConsumerMinimumCoverage(candidate, allowed, MinConsumerAllocationPercent);
                    EnsureForcedMinimumAllocation(candidate, forced);
                    ValidateProducerAllocationMatrix(candidate);

                    var candidateScore = SimulateForScore(data, candidate, model.PrioritiesByConsumer, roundsUsed);
                    if (candidateScore > currentScore)
                    {
                        current = candidate;
                        currentScore = candidateScore;
                        fails = 0;
                        if (candidateScore > localBestScore)
                        {
                            localBest = CloneMatrix(candidate);
                            localBestScore = candidateScore;
                        }
                    }
                    else
                    {
                        fails++;
                    }
                }

                lock (syncLock)
                {
                    var done = ++completedRestarts;
                    if (localBestScore > bestScore || bestOverall is null)
                    {
                        bestScore = localBestScore;
                        bestOverall = SimulateSharing(data, localBest, rounds, weights, model.SourceSummary);
                    }
                    progress(done, restarts, bestOverall!);
                }
            });

        return bestOverall!;
    }
}

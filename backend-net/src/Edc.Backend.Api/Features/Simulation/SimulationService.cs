using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Edc.Backend.Api.Features.Simulation;

public sealed class SimulationService
{
    private sealed record JobEntry(Channel<SimProgressEvent> Channel, DateTimeOffset CreatedAt);

    private readonly ConcurrentDictionary<string, JobEntry> _jobs = new();

    public string StartJob(SimData data, StartSimulationRequest req)
    {
        var jobId = Guid.NewGuid().ToString("N");
        var channel = Channel.CreateUnbounded<SimProgressEvent>(new UnboundedChannelOptions { SingleWriter = true });
        _jobs[jobId] = new JobEntry(channel, DateTimeOffset.UtcNow);

        _ = Task.Run(() => RunJobAsync(data, req, channel.Writer));
        _ = Task.Delay(TimeSpan.FromMinutes(30)).ContinueWith(_t => _jobs.TryRemove(jobId, out _));

        return jobId;
    }

    public ChannelReader<SimProgressEvent>? GetProgressReader(string jobId) =>
        _jobs.TryGetValue(jobId, out var entry) ? entry.Channel.Reader : null;

    private static async Task RunJobAsync(SimData data, StartSimulationRequest req, ChannelWriter<SimProgressEvent> writer)
    {
        try
        {
            var weights = req.Weights ?? SimulationEngine.DefaultWeights;
            SimulationResult result;

            if (req.Mode == "backtest" && req.AllocationMatrix is { Count: > 0 })
            {
                // Back-test: apply a fixed allocation matrix to real historical data — no optimisation
                var matrix = req.AllocationMatrix.Select(row => row.ToArray()).ToArray();
                result = SimulationEngine.SimulateSharing(data, matrix, req.Rounds, weights, "zpětný test – zadaná alokační matice");
            }
            else
            {
                var maxFails = req.MaxFails > 0 ? req.MaxFails : 600;
                var restarts = req.Restarts > 0 ? req.Restarts : 25;
                var startTime = DateTimeOffset.UtcNow;

                result = SimulationEngine.OptimizeAllocations(
                    data, req.Rounds, maxFails, restarts, weights,
                    (step, total, best) =>
                    {
                        var elapsed = (DateTimeOffset.UtcNow - startTime).TotalSeconds;
                        var perStep = step > 0 ? elapsed / step : 0;
                        var remaining = perStep * (total - step);
                        var percent = (int)(100.0 * step / total);
                        writer.TryWrite(new SimProgressEvent(
                            "progress", percent, remaining,
                            $"Optimalizace {step}/{total} | Nejlepší sdílení: {best.TotalSharing:F2} kWh",
                            null));
                    });
            }

            await writer.WriteAsync(new SimProgressEvent("done", 100, 0, null, result));
        }
        catch (Exception ex)
        {
            await writer.WriteAsync(new SimProgressEvent("error", 0, null, ex.Message, null));
        }
        finally
        {
            writer.Complete();
        }
    }
}

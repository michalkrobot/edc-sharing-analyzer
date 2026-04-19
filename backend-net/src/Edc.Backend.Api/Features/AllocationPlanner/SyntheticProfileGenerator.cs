using Edc.Backend.Api.Features.Simulation;

namespace Edc.Backend.Api.Features.AllocationPlanner;

/// <summary>
/// Generates synthetic 15-minute production/consumption profiles for EANs without real EDC data.
/// </summary>
public static class SyntheticProfileGenerator
{
    // Monthly solar parameters for Czech Republic (~50°N):
    // (SunriseH, SunsetH, Sigma, DailyYieldPerKwp kWh/day)
    private static readonly (double Sunrise, double Sunset, double Sigma, double DailyYield)[] SolarParams =
    [
        (8.0, 16.0, 1.8, 0.9),   // January
        (7.5, 17.0, 2.0, 1.6),   // February
        (6.5, 18.0, 2.5, 3.0),   // March
        (5.5, 19.5, 3.0, 4.1),   // April
        (4.5, 20.5, 3.3, 4.8),   // May
        (4.0, 21.0, 3.5, 5.1),   // June
        (4.5, 20.5, 3.5, 5.0),   // July
        (5.5, 19.5, 3.2, 4.4),   // August
        (6.5, 18.0, 2.8, 3.2),   // September
        (7.0, 17.0, 2.3, 2.0),   // October
        (7.5, 16.0, 2.0, 1.0),   // November
        (8.0, 15.5, 1.8, 0.7),   // December
    ];

    // Hourly consumption fractions per category [weekday=0, weekend=1][hour 0..23]
    // Values are approximate, normalized to 1.0 in code.
    private static readonly Dictionary<string, double[][]> ConsumerProfiles = new(StringComparer.Ordinal)
    {
        ["domacnost"] =
        [
            // Weekday: morning + evening peaks
            [0.020, 0.018, 0.016, 0.016, 0.016, 0.020, 0.030, 0.058, 0.058, 0.040, 0.038, 0.040,
             0.048, 0.040, 0.040, 0.048, 0.060, 0.070, 0.080, 0.080, 0.068, 0.050, 0.038, 0.022],
            // Weekend: later rise, more even distribution
            [0.020, 0.018, 0.016, 0.016, 0.016, 0.018, 0.020, 0.038, 0.060, 0.068, 0.068, 0.060,
             0.060, 0.060, 0.060, 0.052, 0.058, 0.068, 0.070, 0.070, 0.060, 0.048, 0.030, 0.022],
        ],
        ["mala_firma"] =
        [
            // Weekday: workday 8-17h peak
            [0.010, 0.010, 0.010, 0.010, 0.010, 0.012, 0.020, 0.040, 0.072, 0.082, 0.082, 0.072,
             0.062, 0.072, 0.082, 0.082, 0.068, 0.050, 0.038, 0.028, 0.020, 0.018, 0.018, 0.012],
            // Weekend: much lower
            [0.020, 0.018, 0.018, 0.018, 0.018, 0.018, 0.020, 0.022, 0.040, 0.050, 0.060, 0.062,
             0.062, 0.060, 0.060, 0.052, 0.050, 0.050, 0.050, 0.050, 0.040, 0.038, 0.035, 0.020],
        ],
        ["stredni_firma"] =
        [
            // Weekday: strong workday peak, some base load
            [0.020, 0.018, 0.018, 0.018, 0.018, 0.020, 0.022, 0.030, 0.072, 0.082, 0.082, 0.070,
             0.062, 0.070, 0.082, 0.082, 0.068, 0.050, 0.030, 0.020, 0.018, 0.018, 0.018, 0.012],
            // Weekend: ~30% of weekday
            [0.022, 0.020, 0.020, 0.020, 0.020, 0.020, 0.022, 0.022, 0.042, 0.052, 0.060, 0.062,
             0.062, 0.062, 0.060, 0.058, 0.052, 0.050, 0.042, 0.040, 0.038, 0.035, 0.030, 0.022],
        ],
        ["velka_firma"] =
        [
            // Weekday: near 24/7 operation
            [0.038, 0.036, 0.036, 0.036, 0.036, 0.038, 0.040, 0.042, 0.052, 0.054, 0.054, 0.044,
             0.042, 0.050, 0.054, 0.054, 0.050, 0.044, 0.042, 0.040, 0.040, 0.040, 0.040, 0.038],
            // Weekend: ~70% capacity
            [0.030, 0.028, 0.028, 0.028, 0.028, 0.030, 0.032, 0.032, 0.048, 0.060, 0.062, 0.062,
             0.060, 0.060, 0.060, 0.052, 0.050, 0.050, 0.050, 0.048, 0.042, 0.040, 0.035, 0.030],
        ],
    };

    public static SimEanData GetProducerIntervalData(
        DateTimeOffset timeFrom, double installedKw,
        double? annualKwh = null, string? tdzCategory = null)
    {
        var month = timeFrom.Month;
        var (sunrise, sunset, sigma, dailyYield) = SolarParams[month - 1];
        const double peak = 12.25; // solar noon CZ

        // Midpoint of the 15-min slot in decimal hours
        var slotMid = timeFrom.Hour + (timeFrom.Minute + 7.5) / 60.0;

        double fraction;
        if (slotMid < sunrise || slotMid >= sunset)
        {
            fraction = 0;
        }
        else
        {
            var raw = Math.Exp(-0.5 * Math.Pow((slotMid - peak) / sigma, 2));
            var dayTotal = ComputeDaySolarTotal(sunrise, sunset, peak, sigma);
            fraction = dayTotal > 0 ? raw / dayTotal : 0;
        }

        var grossKwh = installedKw * dailyYield * fraction;

        // Subtract producer's own consumption — only surplus is shareable
        var selfConsumption = annualKwh is > 0 && !string.IsNullOrEmpty(tdzCategory)
            ? GetConsumerIntervalData(timeFrom, annualKwh.Value, tdzCategory).Before
            : 0;

        return new SimEanData(Math.Max(0, grossKwh - selfConsumption), 0);
    }

    private static double ComputeDaySolarTotal(double sunrise, double sunset, double peak, double sigma)
    {
        // Sum over all 96 quarter-hour slots of the day
        double total = 0;
        for (int q = 0; q < 96; q++)
        {
            var mid = q / 4.0 + 7.5 / 60.0;
            if (mid >= sunrise && mid < sunset)
                total += Math.Exp(-0.5 * Math.Pow((mid - peak) / sigma, 2));
        }
        return total;
    }

    public static SimEanData GetConsumerIntervalData(DateTimeOffset timeFrom, double annualKwh, string tdzCategory)
    {
        var dailyKwh = annualKwh / 365.25;
        var isWeekend = timeFrom.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
        var profileKey = ConsumerProfiles.ContainsKey(tdzCategory) ? tdzCategory : "domacnost";
        var hourlyFractions = ConsumerProfiles[profileKey][isWeekend ? 1 : 0];

        var hour = timeFrom.Hour;
        var rawFraction = hourlyFractions[hour];
        var sum = hourlyFractions.Sum();
        var normalizedFraction = sum > 0 ? rawFraction / sum : 1.0 / 24;

        // Divide by 4: we distribute each hour's fraction equally over 4 × 15-min slots
        var kwh = dailyKwh * normalizedFraction / 4.0;
        return new SimEanData(Math.Max(0, kwh), 0);
    }
}

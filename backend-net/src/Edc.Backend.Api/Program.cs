using Edc.Backend.Api.Features.Admin;
using Edc.Backend.Api.Features.AllocationPlanner;
using Edc.Backend.Api.Features.Auth;
using Edc.Backend.Api.Features.EdcScraper;
using Edc.Backend.Api.Features.Member;
using Edc.Backend.Api.Features.Shared;
using Edc.Backend.Api.Features.Simulation;
using Edc.Backend.Api.Infrastructure.Auth;
using Edc.Backend.Api.Infrastructure.Csv;
using Edc.Backend.Api.Infrastructure.Mail;
using Edc.Backend.Api.Infrastructure.Persistence;
using Edc.Backend.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));

var authOptions = builder.Configuration.GetSection("Auth").Get<AuthOptions>() ?? new AuthOptions();
var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING") ?? authOptions.ConnectionString;

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString);
});

builder.Services.AddSingleton<ICsvParser, CsvParser>();
builder.Services.AddSingleton<SimulationService>();
builder.Services.AddSingleton<EdcPortalScraper>();
builder.Services.AddScoped<IAppService, AppService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<EdcScraperHostedService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<EdcScraperHostedService>());

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var configuredOrigin = Environment.GetEnvironmentVariable("CORS_ORIGIN") ?? authOptions.CorsOrigin;
        if (configuredOrigin == "*")
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            return;
        }

        var origins = configuredOrigin
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();

        if (origins.Length == 0)
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            return;
        }

        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
    
    var service = scope.ServiceProvider.GetRequiredService<IAppService>();
    await service.InitializeAsync();
}

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.CacheControl = "no-cache, must-revalidate";
    }
});
app.UseCors();

app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    var requiresAuth = path.StartsWithSegments("/api/auth/session")
        || path.StartsWithSegments("/api/auth/logout")
        || path.StartsWithSegments("/api/member")
        || path.StartsWithSegments("/api/admin");

    if (!requiresAuth || path.StartsWithSegments("/api/auth/request-otp") || path.StartsWithSegments("/api/auth/verify-otp"))
    {
        await next();
        return;
    }

    var authHeader = context.Request.Headers.Authorization.ToString();
    var token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
        ? authHeader[7..]
        : string.Empty;

    if (string.IsNullOrWhiteSpace(token))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "Missing auth token." });
        return;
    }

    var appService = context.RequestServices.GetRequiredService<IAppService>();
    var principal = await appService.ResolvePrincipalByTokenAsync(token, context.RequestAborted);
    if (principal is null)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "Invalid session." });
        return;
    }

    context.SetAuthPrincipal(principal);
    await next();
});

app.MapGet("/health", () =>
{
    var baseUrl = Environment.GetEnvironmentVariable("AUTH_BASE_URL")
        ?? authOptions.BaseUrl
        ?? $"http://localhost:{authOptions.Port}";

    return Results.Ok(new
    {
        ok = true,
        now = DateTime.UtcNow.ToString("O"),
        baseUrl,
    });
});

app.MapAuthEndpoints();
app.MapMemberEndpoints();
app.MapAdminEndpoints();
app.MapPublicEndpoints();
app.MapSimulationEndpoints();
app.MapAllocationPlannerEndpoints();
app.MapEdcScraperEndpoints();
app.MapFallbackToFile("index.html");

var portRaw = Environment.GetEnvironmentVariable("PORT");
var port = int.TryParse(portRaw, out var parsedPort) ? parsedPort : authOptions.Port;
app.Run($"http://0.0.0.0:{port}");

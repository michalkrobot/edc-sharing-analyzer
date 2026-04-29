# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ENV PATH="${PATH}:/root/.dotnet/tools"
WORKDIR /src
COPY backend-net/src/Edc.Backend.Api/ .
RUN dotnet restore
RUN dotnet build -c Release
RUN dotnet tool install --global Microsoft.Playwright.CLI
RUN playwright install chromium
RUN dotnet publish -c Release -o /app/publish --no-build

# Stage 2: Runtime – .NET 10.0 with Playwright dependencies
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgbm1 \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .
COPY --from=build /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy frontend static files to wwwroot
COPY index.html \
     multi-ean-analyzer.html \
     member-sharing.html \
     multi-ean-sharing.html \
     enerkom-report.html \
     enerkom-report2.html \
     allocation-planner.html \
     backtest.html \
     multi-ean-analyzer.js \
     multi-ean-analyzer.css \
     allocation-planner.js \
     backtest.js \
     auth-client.js \
     auth-config.js \
     verify-app.js \
     ./wwwroot/

ENV PORT=8080
# CONNECTION_STRING se nastavuje jako secret: flyctl secrets set CONNECTION_STRING="..."

EXPOSE 8080

ENTRYPOINT ["dotnet", "Edc.Backend.Api.dll"]

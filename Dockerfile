# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend-net/src/Edc.Backend.Api/ .
RUN dotnet publish -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Copy frontend static files to wwwroot
COPY index.html \
     multi-ean-analyzer.html \
     member-sharing.html \
     multi-ean-sharing.html \
     multi-ean-analyzer.js \
     multi-ean-analyzer.css \
     auth-client.js \
     auth-config.js \
     verify-app.js \
     ./wwwroot/

ENV PORT=8080
# CONNECTION_STRING se nastavuje jako secret: flyctl secrets set CONNECTION_STRING="..."

EXPOSE 8080

ENTRYPOINT ["dotnet", "Edc.Backend.Api.dll"]

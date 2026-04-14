Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ResourceGroup       = "rg-edc"
$Location            = "westeurope"       # resource group uz existuje v westeurope
$PostgresLocation    = "northeurope"      # PostgreSQL + Container Apps v northeurope
$RandomSuffix        = -join ((97..122) | Get-Random -Count 6 | ForEach-Object { [char]$_ })
$PostgresServer      = "edc-postgres-" + $RandomSuffix
$PostgresAdmin       = "edcadmin"
$PostgresDb          = "edc"
$ContainerAppEnv     = "edc-env"
$ContainerAppName    = "edc-api"
# Placeholder image pro prvni deploy – CI/CD ji nahradí skutecnou po prvnim push do main
$PlaceholderImage    = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"

$SecretsFile = Join-Path $PSScriptRoot "secrets.env"
if (-not (Test-Path $SecretsFile)) {
    Write-Error "Chybi deploy\secrets.env"
    exit 1
}

$secrets = @{}
Get-Content $SecretsFile | Where-Object { $_ -match '^[^#].+=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $key   = $parts[0].Trim()
    $value = ($parts[1] -split '#')[0].Trim()
    $secrets[$key] = $value
}

$PostgresPassword = $secrets['POSTGRES_PASSWORD']
$AuthPepper       = $secrets['AUTH_PEPPER']
# GhcrUsername a GhcrToken pouziva jen CI/CD workflow (.github/workflows/deploy-azure.yml)

Write-Host "=== Prihlaseni do Azure ===" -ForegroundColor Cyan
az login

Write-Host "=== 1/6 Resource group + provider registrace ===" -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location

Write-Host "Registruji Azure providery (muze trvat 1-2 minuty)..."
az provider register --namespace Microsoft.DBforPostgreSQL --wait
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

Write-Host "=== 2/6 PostgreSQL Flexible Server: $PostgresServer ===" -ForegroundColor Cyan
az postgres flexible-server create `
    --resource-group $ResourceGroup `
    --name $PostgresServer `
    --location $PostgresLocation `
    --admin-user $PostgresAdmin `
    --admin-password $PostgresPassword `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --version 17 `
    --public-access 0.0.0.0

Write-Host "Vytvarim databazi $PostgresDb..."
az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $PostgresServer `
    --database-name $PostgresDb

Write-Host "=== 3/6 Povoleni TimescaleDB ===" -ForegroundColor Cyan
az postgres flexible-server parameter set `
    --resource-group $ResourceGroup `
    --server-name $PostgresServer `
    --name shared_preload_libraries `
    --value timescaledb

Write-Host "Restartuji PostgreSQL server..."
az postgres flexible-server restart --resource-group $ResourceGroup --name $PostgresServer
Start-Sleep -Seconds 30

Write-Host "=== 4/6 Container Apps Environment ===" -ForegroundColor Cyan
az containerapp env create --name $ContainerAppEnv --resource-group $ResourceGroup --location $PostgresLocation

$PgHost = $PostgresServer + ".postgres.database.azure.com"
$ConnStr = "Host=" + $PgHost + ";Port=5432;Database=" + $PostgresDb + ";Username=" + $PostgresAdmin + ";Password=" + $PostgresPassword + ";Ssl Mode=Require;"

Write-Host "=== 5/6 Container App ===" -ForegroundColor Cyan
az containerapp create `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --environment $ContainerAppEnv `
    --image $PlaceholderImage `
    --target-port 8080 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 2 `
    --cpu 0.25 `
    --memory 0.5Gi `
    --secrets ("connection-string=" + $ConnStr) ("auth-pepper=" + $AuthPepper) `
    --env-vars `
        PORT=8080 `
        CONNECTION_STRING=secretref:connection-string `
        AUTH_PEPPER=secretref:auth-pepper `
        AUTH_BASE_URL=https://edc-data.enerkom-hp.cz `
        CORS_ORIGIN=https://edc-data.enerkom-hp.cz

Write-Host "=== 6/6 Vysledek ===" -ForegroundColor Cyan
$Fqdn = az containerapp show `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host ""
Write-Host "Setup dokoncen!" -ForegroundColor Green
Write-Host ("Container App URL: https://" + $Fqdn)
Write-Host ""
Write-Host "Dalsi kroky:" -ForegroundColor Yellow
Write-Host ("  1. Cloudflare CNAME: edc-data -> " + $Fqdn + "  (orange cloud)")
Write-Host "  2. Cloudflare SSL mode: Full"
Write-Host "  3. GitHub Secrets (Settings -> Secrets -> Actions):"
Write-Host "       GHCR_TOKEN        (stejny PAT token)"
Write-Host "       AZURE_CREDENTIALS (spust prikaz nize)"
Write-Host ""
$SubId = az account show --query id -o tsv
Write-Host "Prikaz pro AZURE_CREDENTIALS:" -ForegroundColor DarkGray
Write-Host ("az ad sp create-for-rbac --name edc-deploy --role contributor --scopes /subscriptions/" + $SubId + "/resourceGroups/" + $ResourceGroup + " --sdk-auth") -ForegroundColor DarkGray

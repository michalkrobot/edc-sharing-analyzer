#!/usr/bin/env bash
# =============================================================================
# EDC – jednorázový setup Azure infrastruktury
# Spusť jednou: bash deploy/setup.sh
# Prerekvizity: az cli (přihlášen), jq
# =============================================================================
set -euo pipefail

# ── Uprav tyto hodnoty ────────────────────────────────────────────────────────
RESOURCE_GROUP="rg-edc"
LOCATION="westeurope"
POSTGRES_SERVER="edc-postgres-$(head /dev/urandom | tr -dc 'a-z0-9' | head -c6)"
POSTGRES_ADMIN="edcadmin"
POSTGRES_DB="edc"
CONTAINERAPP_ENV="edc-env"
CONTAINERAPP_NAME="edc-api"
GITHUB_IMAGE="ghcr.io/DOPLŇ_GITHUB_OWNER/DOPLŇ_REPO_NAME:latest"
# ─────────────────────────────────────────────────────────────────────────────

echo "Načítám proměnné z deploy/secrets.env..."
if [[ ! -f deploy/secrets.env ]]; then
  echo "Chybí deploy/secrets.env – zkopíruj a vyplň deploy/secrets.example"
  exit 1
fi
# shellcheck disable=SC1091
source deploy/secrets.env

echo ""
echo "=== 1/6 Resource group ==="
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

echo ""
echo "=== 2/6 PostgreSQL Flexible Server ==="
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$LOCATION" \
  --admin-user "$POSTGRES_ADMIN" \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 17 \
  --database-name "$POSTGRES_DB" \
  --public-access "0.0.0.0"   # povolí přístup ze všech Azure služeb

echo ""
echo "=== 3/6 Povolení TimescaleDB ==="
az postgres flexible-server parameter set \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --name shared_preload_libraries \
  --value timescaledb

echo "Restartuji server (nutné po změně shared_preload_libraries)..."
az postgres flexible-server restart \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER"

echo "Čekám 30 s na restart..."
sleep 30

echo ""
echo "=== 4/6 Container Apps Environment ==="
az containerapp env create \
  --name "$CONTAINERAPP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"

CONNECTION_STRING="Host=${POSTGRES_SERVER}.postgres.database.azure.com;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_ADMIN};Password=${POSTGRES_PASSWORD};Ssl Mode=Require;"

echo ""
echo "=== 5/6 Container App ==="
az containerapp create \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINERAPP_ENV" \
  --image "$GITHUB_IMAGE" \
  --registry-server "ghcr.io" \
  --registry-username "$GHCR_USERNAME" \
  --registry-password "$GHCR_TOKEN" \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --secrets \
    "connection-string=${CONNECTION_STRING}" \
    "auth-pepper=${AUTH_PEPPER}" \
  --env-vars \
    "PORT=8080" \
    "CONNECTION_STRING=secretref:connection-string" \
    "AUTH_PEPPER=secretref:auth-pepper" \
    "AUTH_BASE_URL=https://edc-data.enerkom-hp.cz" \
    "CORS_ORIGIN=https://edc-data.enerkom-hp.cz"

echo ""
echo "=== 6/6 Výsledek ==="
FQDN=$(az containerapp show \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "✓ Setup dokončen!"
echo ""
echo "Container App URL: https://${FQDN}"
echo ""
echo "Další kroky:"
echo "  1. V Cloudflare přidej CNAME: edc-data → ${FQDN} (orange cloud)"
echo "  2. V Cloudflare nastav SSL mode na: Full"
echo "  3. Přidej do GitHub Secrets:"
echo "       AZURE_CREDENTIALS  (viz deploy/setup.sh komentář níže)"
echo "       GHCR_TOKEN         (GitHub PAT s read/write:packages)"
echo ""
echo "Service principal pro GitHub Actions:"
echo "  az ad sp create-for-rbac --name edc-deploy \\"
echo "    --role contributor \\"
echo "    --scopes /subscriptions/\$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP} \\"
echo "    --sdk-auth"

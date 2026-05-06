# EDC Worker (external scraper)

Tento worker bezi mimo hlavni API kontejner a je bez citlivych tenant dat v lokalni konfiguraci.

Workflow:

1. Worker periodicky vola `POST /api/edc-worker/jobs/claim`.
2. API vrati dalsi pending job (tenant + EDC credentials + pozadovane datum).
3. Worker stahne `Plus-cron` a `Sipka-cron` z EDC.
4. Worker posle data na `POST /api/edc-worker/jobs/{jobId}/complete`.
5. Pri chybe posle `POST /api/edc-worker/jobs/{jobId}/fail`.

Autentizace vsech worker endpointu je pres `X-Api-Key`.

## Soubory

- `worker/edc_worker.py` - scraper + ingest klient
- `worker/Dockerfile` - image pro worker
- `worker/.env.example` - sablona konfigurace
- `docker-compose.worker.yml` - compose pro samostatny deploy

## Konfigurace

1. Vytvor `worker/.env` podle `worker/.env.example`
2. Nastav minimalne:
   - `EDC_API_URL`
   - `EDC_WORKER_API_KEY`
   - `EDC_WORKER_ID`

Poznamka:
- `EDC_WORKER_API_KEY` musi byt stejny jako `EDC_WORKER_API_KEY` na backendu.
- tenant credentials worker nedrzi; bere je az z claim endpointu.

## Spusteni

```bash
docker compose -f docker-compose.worker.yml build
docker compose -f docker-compose.worker.yml up -d
```

## Kontrola logu

```bash
docker compose -f docker-compose.worker.yml logs -f edc-worker
```

## Jednorazove spusteni konkretniho dne

Jednorazovy den se ted zadava z hlavni aplikace pri vytvoreni jobu (manual trigger s date), ne v worker env.

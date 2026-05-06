import asyncio
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

PORTAL_BASE = "https://portal.edc-cr.cz"
REPORTS_PATH = "/sprava-dat/reporty"


@dataclass(frozen=True)
class WorkerConfig:
    api_url: str
    api_key: str
    poll_interval_seconds: int
    source: str
    worker_id: str
    headless: bool


@dataclass(frozen=True)
class Job:
    job_id: int
    tenant_id: int
    requested_date: str | None
    email: str
    password: str


@dataclass(frozen=True)
class DownloadedReport:
    filename: str
    csv_text: str
    report_kind: str


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required env var: {name}")
    return value


def parse_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "y", "on", "a", "ano"}


def load_config() -> WorkerConfig:
    poll_raw = os.getenv("EDC_POLL_INTERVAL_SECONDS", "60").strip() or "60"

    try:
        poll_interval_seconds = int(poll_raw)
    except ValueError as ex:
        raise ValueError("EDC_POLL_INTERVAL_SECONDS must be integer") from ex

    return WorkerConfig(
        api_url=env_required("EDC_API_URL").rstrip("/"),
        api_key=env_required("EDC_WORKER_API_KEY"),
        poll_interval_seconds=max(5, poll_interval_seconds),
        source=os.getenv("EDC_SOURCE", "edc-worker-docker").strip() or "edc-worker-docker",
        worker_id=os.getenv("EDC_WORKER_ID", "edc-worker").strip() or "edc-worker",
        headless=parse_bool("EDC_HEADLESS", True),
    )


def get_target_date(target_date_override: str | None) -> tuple[str, str]:
    if target_date_override:
        day = datetime.strptime(target_date_override, "%Y-%m-%d").date()
    else:
        day = datetime.now(ZoneInfo("Europe/Prague")).date()

    return day.strftime("%d.%m.%Y"), day.isoformat()


async def post_json(config: WorkerConfig, path: str, payload: dict) -> dict:
    endpoint = f"{config.api_url}{path}"
    timeout = httpx.Timeout(90.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            endpoint,
            headers={
                "X-Api-Key": config.api_key,
                "Content-Type": "application/json",
            },
            content=json.dumps(payload),
        )

    if response.status_code >= 400:
        raise RuntimeError(f"API call failed ({response.status_code}) {path}: {response.text}")

    return response.json()


async def claim_job(config: WorkerConfig) -> Job | None:
    data = await post_json(config, "/api/edc-worker/jobs/claim", {"workerId": config.worker_id})
    job = data.get("job")
    if not job:
        return None

    credentials = job.get("credentials") or {}
    return Job(
        job_id=int(job["jobId"]),
        tenant_id=int(job["tenantId"]),
        requested_date=job.get("requestedDate"),
        email=str(credentials.get("email", "")),
        password=str(credentials.get("password", "")),
    )


async def fail_job(config: WorkerConfig, job_id: int, error_message: str) -> None:
    try:
        await post_json(config, f"/api/edc-worker/jobs/{job_id}/fail", {"errorMessage": error_message})
    except Exception:
        logging.exception("Unable to report failed job %s", job_id)


async def complete_job(config: WorkerConfig, job: Job, reports: list[DownloadedReport]) -> dict:
    payload = {
        "source": config.source,
        "reports": [
            {
                "tenantId": job.tenant_id,
                "filename": report.filename,
                "reportKind": report.report_kind,
                "csvText": report.csv_text,
            }
            for report in reports
        ],
    }

    return await post_json(config, f"/api/edc-worker/jobs/{job.job_id}/complete", payload)


async def login(page, email: str, password: str) -> None:
    await page.goto(PORTAL_BASE, timeout=30_000)
    await page.wait_for_load_state("networkidle", timeout=20_000)

    login_button = page.get_by_text("Registrace / Přihlášení").first
    await login_button.wait_for(timeout=15_000)

    wait_sso = page.wait_for_url(lambda url: url.startswith("https://sso.portal.edc-cr.cz"), timeout=30_000)
    await login_button.click()
    await wait_sso

    email_input = page.locator("input[name='username'], input[type='email'], input[name='email']").first
    await email_input.wait_for(timeout=15_000)
    await email_input.fill(email)

    password_input = page.locator("input[type='password']").first
    await password_input.fill(password)

    submit_selector = "button:has-text('Přihlásit se'), button:has-text('Pokračovat'), button:has-text('Continue'), button[type='submit'], input[type='submit']"
    submit_button = page.locator(submit_selector).first
    await submit_button.click(timeout=30_000)

    deadline = datetime.now().timestamp() + 60
    while datetime.now().timestamp() < deadline:
        if page.url.startswith(PORTAL_BASE):
            await page.wait_for_load_state("domcontentloaded", timeout=10_000)
            return

        if "sso.portal.edc-cr.cz" not in page.url and "/auth/realms/edc" not in page.url:
            await asyncio.sleep(0.5)
            continue

        error_hint = page.locator(".alert-error, .kc-feedback-text, [id*='input-error'], .pf-m-danger").first
        if await error_hint.is_visible():
            message = await error_hint.inner_text()
            raise RuntimeError(f"EDC login failed: {message}")

        next_submit = page.locator(submit_selector).first
        if await next_submit.is_visible():
            try:
                await next_submit.click(timeout=10_000)
            except Exception:
                pass

        await asyncio.sleep(1)

    raise TimeoutError("EDC login timeout after 60s")


async def open_reports(page) -> None:
    await page.goto(f"{PORTAL_BASE}{REPORTS_PATH}", timeout=30_000)
    await page.wait_for_load_state("networkidle", timeout=20_000)


async def decode_csv_file(download, fallback_name: str) -> tuple[str, str]:
    filename = download.suggested_filename or fallback_name
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

    await download.save_as(tmp_path)

    with open(tmp_path, "rb") as f:
        raw = f.read()

    for encoding in ("utf-8", "cp1250", "latin-1"):
        try:
            return filename, raw.decode(encoding)
        except UnicodeDecodeError:
            continue

    return filename, raw.decode("utf-8", errors="replace")


async def download_report(page, report_kind: str, date_text: str) -> DownloadedReport:
    row_selectors = [
        f"tr:has-text('{report_kind}')",
        f"mat-row:has-text('{report_kind}')",
        f"[role='row']:has-text('{report_kind}')",
    ]

    candidate_rows = []
    for selector in row_selectors:
        rows = await page.locator(selector).all()
        candidate_rows.extend(rows)

    if not candidate_rows:
        raise RuntimeError(f"No table rows found for report kind {report_kind}")

    date_match_rows = []
    for row in candidate_rows:
        try:
            row_text = await row.inner_text()
        except Exception:
            continue
        if date_text in row_text:
            date_match_rows.append(row)

    target_rows = date_match_rows or candidate_rows

    for index, row in enumerate(target_rows, start=1):
        button = row.locator("button:has-text('Stáhnout'), a:has-text('Stáhnout'), [role='button']:has-text('Stáhnout')").first
        try:
            async with page.expect_download(timeout=40_000) as dl:
                await button.click(timeout=10_000, force=True)
            download = await dl.value
            filename, csv_text = await decode_csv_file(download, f"{report_kind}-{index}.csv")
            return DownloadedReport(filename=filename, csv_text=csv_text, report_kind=report_kind)
        except PlaywrightTimeoutError:
            continue

    raise RuntimeError(f"Unable to download report for {report_kind} and date {date_text}")


async def scrape_reports(config: WorkerConfig, job: Job) -> list[DownloadedReport]:
    date_text, iso_date = get_target_date(job.requested_date)
    logging.info("Scraping reports for tenant=%s date=%s job=%s", job.tenant_id, iso_date, job.job_id)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=config.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )

        context = await browser.new_context(
            accept_downloads=True,
            locale="cs-CZ",
            timezone_id="Europe/Prague",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
            extra_http_headers={"Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8"},
        )

        page = await context.new_page()

        try:
            await login(page, job.email, job.password)
            await open_reports(page)

            plus = await download_report(page, "Plus-cron", date_text)
            sipka = await download_report(page, "Sipka-cron", date_text)
            return [plus, sipka]
        finally:
            await context.close()
            await browser.close()


async def run_worker(config: WorkerConfig) -> None:
    while True:
        try:
            job = await claim_job(config)
            if not job:
                await asyncio.sleep(config.poll_interval_seconds)
                continue

            if not job.email or not job.password:
                await fail_job(config, job.job_id, "Claimed job does not contain credentials")
                await asyncio.sleep(1)
                continue

            reports = await scrape_reports(config, job)
            result = await complete_job(config, job, reports)
            logging.info(
                "Job %s done: imported=%s failed=%s",
                job.job_id,
                result.get("imported"),
                result.get("failed"),
            )
        except Exception as ex:
            logging.exception("Worker cycle failed")
            # Pokud spadne po claimu, nepřijdeme sem s job_id. Stav se uvolní stale lease mechanikou backendu.
            await asyncio.sleep(config.poll_interval_seconds)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    try:
        config = load_config()
    except Exception as ex:
        logging.error("Configuration error: %s", ex)
        raise SystemExit(2) from ex

    logging.info("Starting EDC worker id=%s poll=%ss", config.worker_id, config.poll_interval_seconds)

    try:
        asyncio.run(run_worker(config))
    except KeyboardInterrupt:
        logging.info("Worker interrupted")


if __name__ == "__main__":
    main()

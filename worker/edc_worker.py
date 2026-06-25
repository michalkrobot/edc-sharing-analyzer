import asyncio
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime
import re
from urllib.parse import urljoin
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


def tenant_storage_state_path(tenant_id: int) -> str:
    state_dir = os.getenv("EDC_STATE_DIR", "/app/state").strip() or "/app/state"
    os.makedirs(state_dir, exist_ok=True)
    return os.path.join(state_dir, f"edc_state_tenant_{tenant_id}.json")


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

    submit_selector = (
        "button[type='submit']:visible, "
        "input[type='submit']:visible, "
        "#kc-login:visible, "
        "button[name='login']:visible, "
        "button:has-text('Přihlásit'):visible, "
        "button:has-text('Pokračovat'):visible"
    )

    submit_button = page.locator(submit_selector).first
    submit_count = await page.locator(submit_selector).count()
    logging.info("Login submit candidates: %d", submit_count)
    if submit_count == 0:
        raise RuntimeError("SSO login form submit button not found")

    # Some SSO forms are flaky: click may timeout even though form is submittable.
    # Try click first, then fall back to Enter on password field.
    try:
        await submit_button.click(timeout=5_000)
    except PlaywrightTimeoutError:
        logging.warning("Login submit click timed out, falling back to Enter key")
        await password_input.press("Enter")

    deadline = datetime.now().timestamp() + 120
    last_url = page.url
    next_heartbeat = datetime.now().timestamp() + 5
    while datetime.now().timestamp() < deadline:
        if page.url != last_url:
            logging.info("Login redirect step: %s", page.url)
            last_url = page.url

        if datetime.now().timestamp() >= next_heartbeat:
            title = await page.title()
            logging.info("Login waiting: url=%s title=%s", page.url, title)
            next_heartbeat = datetime.now().timestamp() + 5

        if page.url.startswith(PORTAL_BASE):
            await page.wait_for_load_state("domcontentloaded", timeout=10_000)
            return

        if "sso.portal.edc-cr.cz" not in page.url and "/auth/realms/edc" not in page.url:
            await asyncio.sleep(0.5)
            continue

        page_text_full = await page.inner_text("body")
        if "Uživatel je již přihlášen v jiném sezení" in page_text_full:
            logging.warning("SSO reports existing active session; trying 'Zpět na aplikaci'")
            back_link = page.get_by_text("Zpět na aplikaci").first
            try:
                await back_link.click(timeout=10_000)
                await page.wait_for_load_state("domcontentloaded", timeout=10_000)
            except Exception as ex:
                logging.warning("Unable to click 'Zpět na aplikaci': %s", ex)

            # Try direct return to portal once; if still blocked, fail fast with explicit cause.
            try:
                await page.goto(PORTAL_BASE, timeout=20_000)
                await page.wait_for_load_state("domcontentloaded", timeout=10_000)
            except Exception:
                pass

            if page.url.startswith(PORTAL_BASE):
                return

            raise RuntimeError(
                "EDC login blocked: account is active in another session. "
                "Log out from other EDC sessions or wait up to 15 minutes."
            )
            await asyncio.sleep(1)
            continue

        # Explicitly surface blockers that cannot be solved by retries.
        otp_present = await page.locator("input[name*='otp' i], input[name*='totp' i], input[name*='code' i]").count()
        if otp_present > 0:
            raise RuntimeError("EDC login requires OTP/MFA interaction; headless worker cannot continue.")

        captcha_present = await page.locator("iframe[src*='captcha' i], .g-recaptcha, [id*='captcha' i]").count()
        if captcha_present > 0:
            raise RuntimeError("EDC login shows CAPTCHA; automated worker is blocked.")

        username_visible = await page.locator("input[name='username'], input[type='email'], input[name='email']").first.is_visible()
        password_visible = await page.locator("input[type='password']").first.is_visible()
        if username_visible and password_visible:
            hint_count = await page.locator(".alert-error, .kc-feedback-text, [id*='input-error'], .pf-m-danger").count()
            if hint_count == 0:
                body_excerpt = page_text_full[:400]
                logging.warning("Still on username/password form without explicit error. body=%s", body_excerpt)
                # Re-submit if form is still visible and no explicit error is shown.
                try:
                    await page.locator(submit_selector).first.click(timeout=5_000)
                except Exception:
                    pass

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

    screenshot_path = "/tmp/fail_login_timeout.png"
    await page.screenshot(path=screenshot_path, full_page=True)
    logging.error("Login timeout screenshot saved to %s", screenshot_path)
    page_text = (await page.inner_text("body"))[:2000]
    logging.error("Login timeout page url=%s body excerpt: %s", page.url, page_text)
    raise TimeoutError("EDC login timeout after 120s")


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


async def decode_csv_bytes(raw: bytes, fallback_name: str) -> tuple[str, str]:
    for encoding in ("utf-8", "cp1250", "latin-1"):
        try:
            return fallback_name, raw.decode(encoding)
        except UnicodeDecodeError:
            continue

    return fallback_name, raw.decode("utf-8", errors="replace")


async def download_by_href(page, href: str, fallback_name: str) -> tuple[str, str]:
    absolute_url = urljoin(PORTAL_BASE, href)
    cookies = await page.context.cookies()
    cookie_header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)

    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0), follow_redirects=True) as client:
        response = await client.get(
            absolute_url,
            headers={
                "Cookie": cookie_header,
                "Referer": f"{PORTAL_BASE}{REPORTS_PATH}",
                "Accept": "text/csv,application/octet-stream,*/*",
            },
        )

    response.raise_for_status()
    return await decode_csv_bytes(response.content, fallback_name)


def filename_from_content_disposition(header_value: str | None, fallback_name: str) -> str:
    if not header_value:
        return fallback_name

    match = re.search(r"filename\*?=(?:UTF-8''|\")?([^\";]+)", header_value, flags=re.IGNORECASE)
    if not match:
        return fallback_name

    return match.group(1).strip()


def is_csv_like_response(response) -> bool:
    content_type = (response.headers.get("content-type") or "").lower()
    disposition = (response.headers.get("content-disposition") or "").lower()
    url = response.url.lower()
    return (
        "text/csv" in content_type
        or "application/csv" in content_type
        or "application/octet-stream" in content_type
        or "attachment" in disposition
        or "export" in url
        or "report" in url
    )


async def _download_row(page, row, report_kind: str, index: int) -> DownloadedReport | None:
    # get_by_text matches any element type – Angular Material may render Stáhnout
    # as mat-button, span, or other non-standard element
    stahnou = row.get_by_text("Stáhnout", exact=True)
    button_count = await stahnou.count()
    logging.info("Row %d: stahnou_count=%d (get_by_text)", index, button_count)
    if button_count == 0:
        row_text = await row.inner_text()
        logging.warning("Row %d has no Stáhnout element. Row text: %s", index, row_text[:300])
        return None

    href = await stahnou.first.get_attribute("href")
    if not href:
        anchor = stahnou.first.locator("xpath=ancestor-or-self::a[1]")
        if await anchor.count() > 0:
            href = await anchor.first.get_attribute("href")

    if href:
        try:
            filename, csv_text = await download_by_href(page, href, f"{report_kind}-{index}.csv")
            logging.info("Downloaded via href %s (%d chars)", href, len(csv_text))
            return DownloadedReport(filename=filename, csv_text=csv_text, report_kind=report_kind)
        except Exception as e:
            logging.warning("Row %d href download failed for %s: %s", index, report_kind, e)

    try:
        async with page.expect_download(timeout=40_000) as dl:
            await stahnou.first.click(timeout=10_000, force=True)
        download = await dl.value
        filename, csv_text = await decode_csv_file(download, f"{report_kind}-{index}.csv")
        logging.info("Downloaded %s (%d chars)", filename, len(csv_text))
        return DownloadedReport(filename=filename, csv_text=csv_text, report_kind=report_kind)
    except PlaywrightTimeoutError as e:
        logging.warning("Row %d click/download timeout for %s: %s", index, report_kind, e)

        # Some EDC actions return CSV as a normal HTTP response, not a download event.
        try:
            async with page.expect_response(lambda r: r.status == 200 and is_csv_like_response(r), timeout=20_000) as resp_info:
                await stahnou.first.click(timeout=10_000, force=True)
            response = await resp_info.value
            raw = await response.body()
            fallback_name = f"{report_kind}-{index}.csv"
            filename = filename_from_content_disposition(response.headers.get("content-disposition"), fallback_name)
            _, csv_text = await decode_csv_bytes(raw, fallback_name)
            logging.info("Downloaded via HTTP response %s (%d chars)", filename, len(csv_text))
            return DownloadedReport(filename=filename, csv_text=csv_text, report_kind=report_kind)
        except PlaywrightTimeoutError:
            return None


async def download_reports(page, report_kind: str, date_text: str) -> list[DownloadedReport]:
    """Download every matching report row for the date – one per sharing group.

    A tenant's EDC account can administer multiple sharing groups, each rendered as its
    own report row. We download all of them (deduped by content) instead of just the first.
    """
    row_selectors = [
        f"tr:has-text('{report_kind}')",
        f"mat-row:has-text('{report_kind}')",
        f"[role='row']:has-text('{report_kind}')",
    ]

    candidate_rows = []
    for selector in row_selectors:
        rows = await page.locator(selector).all()
        candidate_rows.extend(rows)

    logging.info("download_reports %s: found %d candidate rows (url=%s)", report_kind, len(candidate_rows), page.url)

    if not candidate_rows:
        screenshot_path = f"/tmp/fail_{report_kind}_no_rows.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        logging.error("Screenshot saved to %s", screenshot_path)
        page_text = (await page.inner_text("body"))[:1000]
        logging.error("Page body excerpt: %s", page_text)
        raise RuntimeError(f"No table rows found for report kind {report_kind}")

    date_match_rows = []
    for row in candidate_rows:
        try:
            row_text = await row.inner_text()
        except Exception:
            continue
        logging.debug("Row text: %s", row_text[:200])
        if date_text in row_text:
            date_match_rows.append(row)

    target_rows = date_match_rows or candidate_rows
    logging.info("download_reports %s: %d rows match date %s, using %d rows",
                 report_kind, len(date_match_rows), date_text, len(target_rows))

    results: list[DownloadedReport] = []
    seen: set[str] = set()
    for index, row in enumerate(target_rows, start=1):
        report = await _download_row(page, row, report_kind, index)
        if report is None:
            continue
        # Overlapping selectors can yield the same logical row multiple times – dedupe by content.
        dedupe_key = report.csv_text
        if dedupe_key in seen:
            logging.info("Row %d for %s is a duplicate, skipping", index, report_kind)
            continue
        seen.add(dedupe_key)
        results.append(report)

    if not results:
        screenshot_path = f"/tmp/fail_{report_kind}_no_download.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        logging.error("Screenshot saved to %s", screenshot_path)
        raise RuntimeError(f"Unable to download report for {report_kind} and date {date_text}")

    logging.info("download_reports %s: downloaded %d distinct report(s)", report_kind, len(results))
    return results


async def scrape_reports(config: WorkerConfig, job: Job) -> list[DownloadedReport]:
    date_text, iso_date = get_target_date(job.requested_date)
    logging.info("Scraping reports for tenant=%s date=%s job=%s", job.tenant_id, iso_date, job.job_id)
    state_path = tenant_storage_state_path(job.tenant_id)
    state_exists = os.path.exists(state_path)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=config.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )

        context_kwargs = {
            "accept_downloads": True,
            "locale": "cs-CZ",
            "timezone_id": "Europe/Prague",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
            "extra_http_headers": {"Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8"},
        }
        if state_exists:
            context_kwargs["storage_state"] = state_path

        context = await browser.new_context(
            **context_kwargs,
        )

        page = await context.new_page()

        try:
            session_reused = False
            if state_exists:
                try:
                    await open_reports(page)
                    if page.url.startswith(f"{PORTAL_BASE}{REPORTS_PATH}"):
                        session_reused = True
                        logging.info("Reused existing session for tenant=%s", job.tenant_id)
                    else:
                        logging.info("Stored session invalid for tenant=%s (url=%s), relogin", job.tenant_id, page.url)
                except Exception as ex:
                    logging.info("Stored session check failed for tenant=%s (%s), relogin", job.tenant_id, ex)

            if not session_reused:
                await login(page, job.email, job.password)
                logging.info("Login OK, url=%s", page.url)
                await context.storage_state(path=state_path)
                logging.info("Saved session state for tenant=%s at %s", job.tenant_id, state_path)
                await open_reports(page)

            logging.info("Reports page loaded, url=%s", page.url)

            plus_reports = await download_reports(page, "Plus-cron", date_text)
            sipka_reports = await download_reports(page, "Sipka-cron", date_text)
            return [*plus_reports, *sipka_reports]
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
            error_text = str(ex)
            if "active in another session" in error_text or "přihlášen v jiném sezení" in error_text.lower():
                cooldown_seconds = 15 * 60
                logging.warning("Detected active-session lock; cooling down for %ss", cooldown_seconds)
                await asyncio.sleep(cooldown_seconds)
                continue
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

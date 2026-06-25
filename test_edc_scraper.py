"""
Testovací skript pro EDC portál scraper.
Spouštěj: python test_edc_scraper.py
Credentials zadej interaktivně – nejsou nikam ukládány.
"""
import asyncio
import getpass
import sys
from datetime import date
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

PORTAL_BASE = "https://portal.edc-cr.cz"
REPORTS_PATH = "/sprava-dat/reporty"


async def dump_inputs(page, label: str):
    """Vypíše všechny input elementy na stránce včetně těch v iframes."""
    print(f"\n  --- Inputs na stránce ({label}) ---")
    inputs = await page.locator("input").all()
    print(f"  Celkem inputs v hlavní stránce: {len(inputs)}")
    for inp in inputs:
        t = await inp.get_attribute("type") or "?"
        n = await inp.get_attribute("name") or "?"
        i = await inp.get_attribute("id") or "?"
        pl = await inp.get_attribute("placeholder") or "?"
        cls = await inp.get_attribute("class") or "?"
        print(f"    type={t}, name={n}, id={i}, placeholder={pl}, class={cls[:40]}")

    # Iframes
    frames = page.frames
    print(f"  Frames na stránce: {len(frames)}")
    for frame in frames:
        if frame == page.main_frame:
            continue
        print(f"    Frame URL: {frame.url}")
        finputs = await frame.locator("input").all()
        for inp in finputs:
            t = await inp.get_attribute("type") or "?"
            n = await inp.get_attribute("name") or "?"
            i = await inp.get_attribute("id") or "?"
            pl = await inp.get_attribute("placeholder") or "?"
            print(f"      [iframe] type={t}, name={n}, id={i}, placeholder={pl}")

    # Dump relevant HTML
    html_snippet = await page.evaluate("""() => {
        const forms = document.querySelectorAll('form');
        return Array.from(forms).map(f => f.outerHTML.substring(0, 500)).join('\\n---\\n');
    }""")
    if html_snippet.strip():
        print(f"\n  Forms HTML:\n{html_snippet[:2000]}")
    else:
        print("  Žádné <form> elementy v DOM.")

    # Všechny viditelné tlačítka/linky
    btns = await page.evaluate("""() => {
        return Array.from(document.querySelectorAll('button, a'))
            .map(el => ({ tag: el.tagName, text: el.textContent.trim().substring(0,50), href: el.getAttribute('href') || '' }))
            .filter(el => el.text)
            .slice(0, 30);
    }""")
    print("\n  Buttons/links:", btns)


async def run(email: str, password: str, headless: bool = False):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless, slow_mo=500)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()

        print(f"\n[1] Otevírám {PORTAL_BASE} ...")
        await page.goto(PORTAL_BASE, timeout=30_000)
        await page.wait_for_load_state("networkidle")
        print(f"    URL: {page.url}")
        await page.screenshot(path="test_01_homepage.png")

        # Klikneme na "Registrace / Přihlášení" tlačítko (vidíme ho na screenshotu)
        print("\n[2] Klikám na 'Registrace / Přihlášení' ...")
        login_btn = page.get_by_text("Registrace / Přihlášení").first
        await login_btn.wait_for(timeout=10_000)
        href = await login_btn.get_attribute("href") or ""
        print(f"    href={href}")
        
        async with page.expect_navigation(timeout=15_000, wait_until="networkidle"):
            await login_btn.click()

        print(f"    URL po kliknutí: {page.url}")
        await page.screenshot(path="test_02_after_login_click.png")
        print("    Screenshot: test_02_after_login_click.png")

        await dump_inputs(page, "po kliknutí na přihlášení")

        # Pokud URL stále homepage, zkusíme kliknout na druhé tlačítko dole na stránce
        if page.url.rstrip("/") == PORTAL_BASE.rstrip("/"):
            print("\n    Stále na homepage, zkouším druhé tlačítko ...")
            btns = await page.get_by_text("Registrace / Přihlášení").all()
            print(f"    Nalezeno tlačítek: {len(btns)}")
            if len(btns) >= 2:
                async with page.expect_navigation(timeout=15_000, wait_until="networkidle"):
                    await btns[1].click()
                print(f"    URL: {page.url}")
                await page.screenshot(path="test_02b_second_btn.png")

        await dump_inputs(page, "finální")
        print(f"\n    Výsledná URL: {page.url}")

        # Pokud máme email input, přihlásíme se
        email_input = page.locator("input[type='email'], input[name*='email' i], input[name*='user' i], input[id*='email' i]").first
        try:
            await email_input.wait_for(state="visible", timeout=5000)
            print("\n[3] Vyplňuji přihlašovací formulář ...")
            await email_input.fill(email)
            pwd = page.locator("input[type='password']").first
            await pwd.fill(password)
            await pwd.press("Enter")
            await page.wait_for_load_state("networkidle")
            await page.screenshot(path="test_03_after_submit.png")
            print(f"    URL po submit: {page.url}")
            print(f"    Screenshot: test_03_after_submit.png")
        except PlaywrightTimeout:
            print("\n[3] Email input nenalezen ani po navigaci, viz screenshoty.")
            await browser.close()
            return

        # Navigace na reporty
        print(f"\n[4] Přecházím na {REPORTS_PATH} ...")
        await page.goto(f"{PORTAL_BASE}{REPORTS_PATH}", timeout=30_000)
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path="test_04_reports_page.png")
        print(f"    URL: {page.url}")
        print(f"    Screenshot: test_04_reports_page.png")

        # Dump struktury stránky reportů
        print("\n[5] Analýza stránky reportů ...")
        page_text = await page.inner_text("body")
        lines = [l.strip() for l in page_text.split("\n") if l.strip()]
        print(f"    Text na stránce (prvních 60 řádků):")
        for line in lines[:60]:
            print(f"      {line}")

        # Download liens
        dl_links = await page.locator("a").all()
        print(f"\n    Všechny <a> na stránce ({len(dl_links)}):")
        for link in dl_links[:30]:
            href = await link.get_attribute("href") or ""
            text = (await link.text_content() or "").strip()[:60]
            if href or text:
                print(f"      '{text}' -> {href}")

        await browser.close()
        print("\n✓ Test dokončen.")


if __name__ == "__main__":
    print("=== EDC portál scraper – test ===")
    print("Přihlašovací údaje budou zadány bezpečně (heslo nebude zobrazeno).\n")
    
    email_in = input("EDC e-mail: ").strip()
    if not email_in:
        print("E-mail nesmí být prázdný.")
        sys.exit(1)
    
    pw_in = getpass.getpass("EDC heslo: ")
    if not pw_in:
        print("Heslo nesmí být prázdné.")
        sys.exit(1)

    headless_input = input("Spustit headless (bez okna)? [a/N]: ").strip().lower()
    headless_mode = headless_input in ("a", "y", "ano", "yes")

    asyncio.run(run(email_in, pw_in, headless=headless_mode))

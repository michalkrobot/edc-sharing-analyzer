(function () {
  const API_BASE = String(window.EDC_AUTH_API_BASE || "/api").replace(/\/$/, "");
  const AUTH_REQUIRED = window.EDC_AUTH_REQUIRED !== false;
  const APP_NAME = String(window.EDC_AUTH_APP_NAME || "EDC CSV TOOL");
  const TOKEN_STORAGE_KEY = "edc_auth_token";

  let authToken = localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  let authUser = null;
  const adminState = {
    tenants: [],
    selectedTenantId: "",
    editingTenantId: "",
    edcImportInfo: null,
  };

  // Expose auth state globally for multi-ean-analyzer.js
  window.edcAuthState = {
    user: null,
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function isAdminUser() {
    return Boolean(authUser && ["global_admin", "tenant_admin"].includes(authUser.role));
  }

  function isGlobalAdminUser() {
    return Boolean(authUser && authUser.role === "global_admin");
  }

  function isSimulationPage() {
    return Boolean(document.body && document.body.dataset.page === "simulation");
  }

  function isMemberSharingPage() {
    return Boolean(document.body && document.body.dataset.page === "member-sharing");
  }

  function buildSharedNavigation() {
    const currentPage = document.body && document.body.dataset.page ? document.body.dataset.page : "home";
    return [
      {
        href: "index.html",
        label: "Rozcestník",
        page: "home",
      },
      {
        href: "member-sharing.html",
        label: "Členský přehled",
        page: "member-sharing",
      },
      {
        href: "multi-ean-sharing.html",
        label: "Zobrazení sdílení",
        page: "sharing",
      },
      {
        href: "multi-ean-analyzer.html",
        label: "Simulace",
        page: "simulation",
        globalAdminOnly: true,
      },
    ].map((item) => ({
      ...item,
      isActive: item.page === currentPage,
    }));
  }

  function renderSharedNavigation() {
    const mount = document.getElementById("pageNavMount");
    if (!mount) {
      return;
    }

    const navItems = buildSharedNavigation();
    mount.innerHTML = "";

    const nav = document.createElement("nav");
    nav.className = "page-nav";
    nav.setAttribute("aria-label", "Hlavní navigace aplikace");

    navItems.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.className = item.isActive ? "nav-link is-active" : "nav-link";
      link.textContent = item.label;
      if (item.globalAdminOnly) {
        link.setAttribute("data-global-admin-only", "");
      }
      nav.appendChild(link);
    });

    mount.appendChild(nav);
  }

  function buildHomeHeroActions() {
    return [
      {
        href: "member-sharing.html",
        label: "Otevřít členský přehled",
        className: "hero-action hero-action-primary",
      },
      {
        href: "multi-ean-sharing.html",
        label: "Otevřít přehled sdílení",
        className: "hero-action hero-action-primary",
      },
      {
        href: "multi-ean-analyzer.html",
        label: "Přejít do simulace",
        className: "hero-action hero-action-secondary",
        globalAdminOnly: true,
      },
    ];
  }

  function renderHomeHeroActions() {
    const mount = document.getElementById("homeHeroActionsMount");
    if (!mount) {
      return;
    }

    mount.innerHTML = "";
    const actions = buildHomeHeroActions();

    actions.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.className = item.className;
      link.textContent = item.label;
      if (item.globalAdminOnly) {
        link.setAttribute("data-global-admin-only", "");
      }
      mount.appendChild(link);
    });
  }

  function buildHomeLandingCards() {
    return [
      {
        href: "multi-ean-sharing.html",
        eyebrow: "Operativní pohled",
        title: "Zobrazení sdílení",
        description: "Po nahrání CSV ihned ukáže reálné sdílení za výrobny. Bez simulace a bez alokačních vstupů.",
        points: [
          "souhrny výroben a odběrů",
          "rozpad po rozkliknutí řádku",
          "denní a průměrné grafy",
        ],
        chip: "rychlý přehled",
      },
      {
        href: "multi-ean-analyzer.html",
        eyebrow: "Analytický pohled",
        title: "Simulace",
        description: "Nastavení alokací, opakování kol, optimalizace vah, maticový rozpad a export vypočtených výsledků.",
        points: [
          "váhy pro odběrná EAN",
          "optimalizace a restartování výpočtu",
          "export výsledků do CSV",
        ],
        chip: "pokročilý režim",
        globalAdminOnly: true,
      },
      {
        href: "member-sharing.html",
        eyebrow: "Členský pohled",
        title: "Členský přehled",
        description: "Po přihlášení načte data z databáze, filtruje je podle přiřazených EAN a anonymizuje neveřejné identifikátory.",
        points: [
          "bez nahrávání souborů",
          "tenantová data z backendu",
          "anonymizace neveřejných EAN",
        ],
        chip: "autorizovaný režim",
      },
    ];
  }

  function renderHomeLandingCards() {
    const mount = document.getElementById("homeLandingCardsMount");
    if (!mount) {
      return;
    }

    mount.innerHTML = "";
    const cards = buildHomeLandingCards();

    cards.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.className = "landing-link";
      if (item.globalAdminOnly) {
        link.setAttribute("data-global-admin-only", "");
      }

      const pointsMarkup = item.points.map((point) => `<span>${point}</span>`).join("");
      link.innerHTML = `
        <span class="landing-link-eyebrow">${item.eyebrow}</span>
        <h2>${item.title}</h2>
        <p>${item.description}</p>
        <div class="landing-points" aria-hidden="true">${pointsMarkup}</div>
        <div class="landing-link-footer">
          <span class="landing-chip">${item.chip}</span>
          <span class="landing-link-arrow" aria-hidden="true">→</span>
        </div>
      `;

      mount.appendChild(link);
    });
  }

  function enforceGlobalAdminSimulationAccess() {
    if (!isSimulationPage() || isGlobalAdminUser()) {
      return;
    }
    window.location.replace(authUser ? "multi-ean-sharing.html" : "index.html");
  }

  function enforceMemberSharingAuth() {
    if (!isMemberSharingPage()) {
      return;
    }
    if (Boolean(authToken)) {
      return;
    }
    openLoginOverlay();
  }

  function applyGlobalAdminOnlyVisibility() {
    const shouldShow = isGlobalAdminUser();
    document.querySelectorAll("[data-global-admin-only]").forEach((element) => {
      element.hidden = !shouldShow;
    });
  }

  function getEffectiveTenantId() {
    if (isGlobalAdminUser()) {
      return adminState.selectedTenantId || "";
    }
    if (authUser && authUser.tenantId) {
      return String(authUser.tenantId);
    }
    const administered = authUser && Array.isArray(authUser.administeredTenants) ? authUser.administeredTenants : [];
    return administered.length > 0 ? String(administered[0].id) : "";
  }

  function setAuthLock(locked) {
    if (locked) {
      document.body.classList.add("auth-locked");
    } else {
      document.body.classList.remove("auth-locked");
    }
  }

  function setOverlayVisibility(overlay, isVisible) {
    if (!overlay) {
      return;
    }
    overlay.hidden = !isVisible;
    overlay.setAttribute("aria-hidden", isVisible ? "false" : "true");
    overlay.classList.toggle("is-open", isVisible);
  }

  function upsertHeaderAuth(userEmail) {
    const headerRow = qs(".enerkom-site-header-row");
    if (!headerRow) {
      return;
    }

    let widget = document.getElementById("authWidget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "authWidget";
      widget.className = "auth-widget";
      widget.innerHTML = "<span id='authUserEmail' class='auth-user-email'></span><button id='authLoginBtn' type='button' class='btn btn-primary auth-login-btn'>Přihlásit</button><button id='authLogoutBtn' type='button' class='btn btn-ghost auth-logout-btn'>Odhlásit</button>";
      headerRow.appendChild(widget);
    }

    const emailEl = document.getElementById("authUserEmail");
    const loginBtn = document.getElementById("authLoginBtn");
    const logoutBtn = document.getElementById("authLogoutBtn");
    if (emailEl) {
      emailEl.textContent = userEmail || "";
      emailEl.classList.toggle("is-visible", Boolean(userEmail));
    }
    if (loginBtn) {
      loginBtn.hidden = Boolean(userEmail);
      loginBtn.onclick = () => {
        openLoginOverlay();
      };
    }
    if (logoutBtn) {
      logoutBtn.hidden = !userEmail;
      logoutBtn.onclick = async () => {
        await logout();
      };
    }

    upsertAdminTools(widget);
  }

  function upsertAdminTools(widget) {
    if (!widget) {
      return;
    }

    let settingsBtn = document.getElementById("authAdminSettingsBtn");
    if (!isAdminUser()) {
      if (settingsBtn) {
        settingsBtn.remove();
      }
      const adminSection = document.getElementById("adminSettingsSection");
      if (adminSection) {
        adminSection.remove();
      }
      return;
    }

    if (!settingsBtn) {
      settingsBtn = document.createElement("button");
      settingsBtn.id = "authAdminSettingsBtn";
      settingsBtn.type = "button";
      settingsBtn.className = "btn btn-secondary auth-settings-btn";
      settingsBtn.textContent = "Nastavení";
      settingsBtn.addEventListener("click", () => {
        const section = ensureAdminSettingsSection();
        section.hidden = false;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      widget.insertBefore(settingsBtn, document.getElementById("authLogoutBtn"));
    }

    ensureAdminSettingsSection();
  }

  async function readTextFileWithFallback(file) {
    const buffer = await file.arrayBuffer();
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("windows-1250").decode(buffer);
    }
  }

  function ensureAdminSettingsSection() {
    let section = document.getElementById("adminSettingsSection");
    if (section) {
      return section;
    }

    const appShell = qs(".app-shell");
    if (!appShell) {
      return document.createElement("section");
    }

    section = document.createElement("section");
    section.id = "adminSettingsSection";
    section.className = "card admin-settings-card";
    section.hidden = true;
    section.innerHTML = "<div class='admin-settings-head'><div><p class='landing-section-kicker'>Administrace</p><h2>Nastavení</h2></div><button id='adminSettingsCloseBtn' type='button' class='btn btn-ghost'>Zavřít</button></div><p class='section-description'>Pouze administrátor může importovat EDC data, databázi členů a EAN vazby. Vazba uživatel ↔ EAN vzniká podle sloupce jméno člena.</p><div id='adminTenantScopeWrap' class='admin-tenant-scope' hidden><label class='admin-import-field'>Aktivní tenant<select id='adminTenantSelect'></select></label></div><div class='admin-members-card'><div class='admin-members-head'><h3>EDC data</h3></div><div class='admin-import-card admin-import-card-first'><label class='admin-import-field'>Soubor EDC exportu<input id='adminEdcFileInput' type='file' accept='.csv,text/csv' /></label><button id='adminImportEdcBtn' type='button' class='btn btn-primary'>Importovat EDC data</button></div><p id='adminEdcImportStatus' class='auth-status'></p><div id='adminEdcImportDetails' class='admin-members-empty'></div></div><div class='admin-import-card'><label class='admin-import-field'>Soubor členů (clenove.csv)<input id='adminMembersFileInput' type='file' accept='.csv,text/csv' /></label><button id='adminImportMembersBtn' type='button' class='btn btn-primary'>Importovat členy</button></div><p id='adminImportStatus' class='auth-status'></p><div class='admin-import-card'><label class='admin-import-field'>Soubor EAN (eany.csv)<input id='adminEansFileInput' type='file' accept='.csv,text/csv' /></label><button id='adminImportEansBtn' type='button' class='btn btn-primary'>Importovat EAN</button></div><p id='adminEansImportStatus' class='auth-status'></p><div id='adminEansImportDetails' class='admin-members-empty'></div><div id='globalTenantManagement' class='admin-members-card' hidden><div class='admin-members-head'><h3>Tenanti</h3><button id='adminTenantNewBtn' type='button' class='btn btn-ghost'>Nový tenant</button></div><div id='adminTenantsList' class='admin-members-list'></div><div class='admin-import-card'><label class='admin-import-field'>Název tenanta<input id='adminTenantNameInput' type='text' placeholder='Např. Enerkom horní pomoraví' /></label><label class='admin-import-field'>Admini (e-maily oddělené čárkou)<input id='adminTenantAdminsInput' type='text' placeholder='admin1@firma.cz, admin2@firma.cz' /></label><button id='adminTenantSaveBtn' type='button' class='btn btn-primary'>Uložit tenant</button></div><p id='adminTenantStatus' class='auth-status'></p></div><div class='admin-members-card'><div class='admin-members-head'><h3>Importovaní členové</h3><button id='adminReloadMembersBtn' type='button' class='btn btn-ghost'>Obnovit seznam</button></div><div id='adminMembersList' class='admin-members-list'></div></div></section>";
    appShell.insertBefore(section, appShell.firstElementChild ? appShell.firstElementChild.nextElementSibling || appShell.lastElementChild : null);

    const closeBtn = document.getElementById("adminSettingsCloseBtn");
    const edcFileInput = document.getElementById("adminEdcFileInput");
    const importEdcBtn = document.getElementById("adminImportEdcBtn");
    const edcStatus = document.getElementById("adminEdcImportStatus");
    const edcDetails = document.getElementById("adminEdcImportDetails");
    const importBtn = document.getElementById("adminImportMembersBtn");
    const fileInput = document.getElementById("adminMembersFileInput");
    const status = document.getElementById("adminImportStatus");
    const eansFileInput = document.getElementById("adminEansFileInput");
    const importEansBtn = document.getElementById("adminImportEansBtn");
    const eansStatus = document.getElementById("adminEansImportStatus");
    const eansDetails = document.getElementById("adminEansImportDetails");
    const tenantScopeWrap = document.getElementById("adminTenantScopeWrap");
    const tenantSelect = document.getElementById("adminTenantSelect");
    const globalTenantManagement = document.getElementById("globalTenantManagement");
    const tenantNewBtn = document.getElementById("adminTenantNewBtn");
    const tenantNameInput = document.getElementById("adminTenantNameInput");
    const tenantAdminsInput = document.getElementById("adminTenantAdminsInput");
    const tenantSaveBtn = document.getElementById("adminTenantSaveBtn");
    const tenantStatus = document.getElementById("adminTenantStatus");
    const reloadBtn = document.getElementById("adminReloadMembersBtn");

    if (tenantScopeWrap) {
      tenantScopeWrap.hidden = !isGlobalAdminUser();
    }
    if (globalTenantManagement) {
      globalTenantManagement.hidden = !isGlobalAdminUser();
    }

    if (tenantSelect) {
      tenantSelect.addEventListener("change", async () => {
        adminState.selectedTenantId = String(tenantSelect.value || "");
        await loadAdminEdcImport();
        await loadAdminMembers();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        section.hidden = true;
      });
    }

    if (importEdcBtn && edcFileInput && edcStatus) {
      importEdcBtn.addEventListener("click", async () => {
        const file = edcFileInput.files && edcFileInput.files[0];
        if (!file) {
          edcStatus.textContent = "Vyber EDC CSV soubor.";
          return;
        }

        importEdcBtn.disabled = true;
        edcStatus.textContent = "Načítám soubor a ukládám EDC data na server...";
        if (edcDetails) {
          edcDetails.textContent = "";
        }
        try {
          const tenantId = getEffectiveTenantId();
          if (!tenantId) {
            edcStatus.textContent = "Vyber tenant pro import EDC dat.";
            return;
          }
          const csvText = await readTextFileWithFallback(file);
          const response = await apiRequest(
            "/admin/import-edc",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ csvText, filename: file.name, tenantId }),
            },
            true,
          );
          adminState.edcImportInfo = response.importInfo || null;
          edcStatus.textContent = response.message || "EDC data byla uložena.";
          edcFileInput.value = "";
          renderAdminEdcImport();
        } catch (err) {
          edcStatus.textContent = formatError(err, "Import EDC selhal.");
        } finally {
          importEdcBtn.disabled = false;
        }
      });
    }

    if (importEansBtn && eansFileInput) {
      importEansBtn.addEventListener("click", async () => {
        const file = eansFileInput.files && eansFileInput.files[0];
        if (!file) {
          eansStatus.textContent = "Vyber soubor eany.csv.";
          return;
        }

        importEansBtn.disabled = true;
        eansStatus.textContent = "Načítám soubor a importuji EAN vazby...";
        if (eansDetails) {
          eansDetails.textContent = "";
        }
        try {
          const tenantId = getEffectiveTenantId();
          if (!tenantId) {
            eansStatus.textContent = "Vyber tenant pro import EAN.";
            return;
          }
          const csvText = await readTextFileWithFallback(file);
          const response = await apiRequest(
            "/admin/import-eans",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ csvText, tenantId }),
            },
            true,
          );

          eansStatus.textContent = response.message || "Import EAN dokončen.";
          if (eansDetails) {
            const unmatched = Array.isArray(response.unmatchedMemberNames) ? response.unmatchedMemberNames : [];
            if (unmatched.length > 0) {
              eansDetails.textContent = `Nespárovaná jména: ${unmatched.slice(0, 15).join(", ")}${unmatched.length > 15 ? " ..." : ""}`;
            } else {
              eansDetails.textContent = "Všechna jména v EAN souboru byla úspěšně spárována na přihlášené uživatele.";
            }
          }
          eansFileInput.value = "";
        } catch (err) {
          eansStatus.textContent = formatError(err, "Import EAN selhal.");
        } finally {
          importEansBtn.disabled = false;
        }
      });
    }

    if (importBtn && fileInput) {
      importBtn.addEventListener("click", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          status.textContent = "Vyber soubor clenove.csv.";
          return;
        }

        importBtn.disabled = true;
        status.textContent = "Načítám soubor a importuji členy...";
        try {
          const tenantId = getEffectiveTenantId();
          if (!tenantId) {
            status.textContent = "Vyber tenant pro import členů.";
            return;
          }
          const csvText = await readTextFileWithFallback(file);
          const response = await apiRequest(
            "/admin/import-members",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ csvText, tenantId }),
            },
            true,
          );
          status.textContent = response.message || "Import dokončen.";
          fileInput.value = "";
          await loadAdminMembers();
        } catch (err) {
          status.textContent = formatError(err, "Import členů selhal.");
        } finally {
          importBtn.disabled = false;
        }
      });
    }

    if (tenantNewBtn && tenantNameInput && tenantAdminsInput && tenantStatus) {
      tenantNewBtn.addEventListener("click", () => {
        adminState.editingTenantId = "";
        tenantNameInput.value = "";
        tenantAdminsInput.value = "";
        tenantStatus.textContent = "Nový tenant.";
      });
    }

    if (tenantSaveBtn && tenantNameInput && tenantAdminsInput && tenantStatus) {
      tenantSaveBtn.addEventListener("click", async () => {
        const name = String(tenantNameInput.value || "").trim();
        const adminEmails = String(tenantAdminsInput.value || "")
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean);
        if (!name) {
          tenantStatus.textContent = "Vyplň název tenanta.";
          return;
        }

        tenantSaveBtn.disabled = true;
        tenantStatus.textContent = "Ukládám tenant...";
        try {
          const response = await apiRequest(
            "/admin/tenants",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tenantId: adminState.editingTenantId || null, name, adminEmails }),
            },
            true,
          );
          tenantStatus.textContent = response.message || "Tenant byl uložen.";
          adminState.tenants = Array.isArray(response.tenants) ? response.tenants : [];
          if (response.tenant && response.tenant.id) {
            adminState.editingTenantId = String(response.tenant.id);
            adminState.selectedTenantId = String(response.tenant.id);
          }
          renderTenantManagement();
          await loadAdminMembers();
        } catch (err) {
          tenantStatus.textContent = formatError(err, "Uložení tenanta selhalo.");
        } finally {
          tenantSaveBtn.disabled = false;
        }
      });
    }

    if (reloadBtn) {
      reloadBtn.addEventListener("click", async () => {
        await loadAdminMembers();
      });
    }

    loadAdminTenants().then(async () => {
      await loadAdminEdcImport();
      await loadAdminMembers();
    });

    return section;
  }

  function renderTenantManagement() {
    const tenantSelect = document.getElementById("adminTenantSelect");
    const tenantsList = document.getElementById("adminTenantsList");
    const tenantNameInput = document.getElementById("adminTenantNameInput");
    const tenantAdminsInput = document.getElementById("adminTenantAdminsInput");

    if (tenantSelect && isGlobalAdminUser()) {
      const options = adminState.tenants.map((tenant) => {
        const selected = String(tenant.id) === String(adminState.selectedTenantId) ? " selected" : "";
        return `<option value='${escapeHtml(String(tenant.id))}'${selected}>${escapeHtml(tenant.name)}</option>`;
      });
      tenantSelect.innerHTML = options.join("");
      if (!adminState.selectedTenantId && adminState.tenants.length > 0) {
        adminState.selectedTenantId = String(adminState.tenants[0].id);
        tenantSelect.value = adminState.selectedTenantId;
      }
    }

    if (tenantsList && isGlobalAdminUser()) {
      tenantsList.innerHTML = adminState.tenants.map((tenant) => {
        const admins = Array.isArray(tenant.admins) ? tenant.admins : [];
        return `<button type='button' class='admin-tenant-row${String(tenant.id) === String(adminState.editingTenantId) ? " is-selected" : ""}' data-tenant-id='${escapeHtml(String(tenant.id))}'><span class='admin-tenant-name'>${escapeHtml(tenant.name)}</span><span class='admin-tenant-meta'>Admini: ${escapeHtml(admins.map((admin) => admin.email).join(", ") || "- ")}</span></button>`;
      }).join("");

      Array.from(tenantsList.querySelectorAll("[data-tenant-id]")).forEach((button) => {
        button.addEventListener("click", () => {
          const tenantId = String(button.getAttribute("data-tenant-id") || "");
          const tenant = adminState.tenants.find((item) => String(item.id) === tenantId);
          if (!tenant) {
            return;
          }
          adminState.editingTenantId = tenantId;
          adminState.selectedTenantId = tenantId;
          if (tenantSelect) {
            tenantSelect.value = tenantId;
          }
          if (tenantNameInput) {
            tenantNameInput.value = tenant.name || "";
          }
          if (tenantAdminsInput) {
            tenantAdminsInput.value = (tenant.admins || []).map((admin) => admin.email).join(", ");
          }
          renderTenantManagement();
          loadAdminMembers();
        });
      });
    }
  }

  async function loadAdminTenants() {
    if (!isAdminUser()) {
      return;
    }

    if (isGlobalAdminUser()) {
      try {
        const response = await apiRequest("/admin/tenants", { method: "GET" }, true);
        adminState.tenants = Array.isArray(response.tenants) ? response.tenants : [];
      } catch {
        adminState.tenants = [];
      }
      renderTenantManagement();
      return;
    }

    const administered = authUser && Array.isArray(authUser.administeredTenants) ? authUser.administeredTenants : [];
    adminState.tenants = administered;
    adminState.selectedTenantId = administered.length > 0 ? String(administered[0].id) : (authUser && authUser.tenantId ? String(authUser.tenantId) : "");
  }

  function formatAdminDateTime(value) {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleString("cs-CZ");
  }

  function renderAdminEdcImport() {
    const details = document.getElementById("adminEdcImportDetails");
    if (!details) {
      return;
    }

    const info = adminState.edcImportInfo;
    if (!info) {
      details.innerHTML = "<p class='admin-members-empty'>Pro tento tenant zatím nejsou na serveru uložená žádná EDC data.</p>";
      return;
    }

    details.innerHTML = `<div class='admin-edc-summary'><span><strong>Soubor:</strong> ${escapeHtml(info.filename || "-")}</span><span><strong>Importováno:</strong> ${escapeHtml(formatAdminDateTime(info.importedAt))}</span><span><strong>Období:</strong> ${escapeHtml(formatAdminDateTime(info.dateFrom))} až ${escapeHtml(formatAdminDateTime(info.dateTo))}</span><span><strong>Výrobní EAN:</strong> ${escapeHtml(String(info.producerCount || 0))}</span><span><strong>Odběrné EAN:</strong> ${escapeHtml(String(info.consumerCount || 0))}</span><span><strong>Intervaly:</strong> ${escapeHtml(String(info.intervalCount || 0))}</span></div>`;
  }

  async function loadAdminEdcImport() {
    const details = document.getElementById("adminEdcImportDetails");
    const status = document.getElementById("adminEdcImportStatus");
    if (!details || !isAdminUser()) {
      return;
    }

    const tenantId = getEffectiveTenantId();
    if (!tenantId) {
      adminState.edcImportInfo = null;
      if (status) {
        status.textContent = "";
      }
      details.innerHTML = "<p class='admin-members-empty'>Vyber tenant pro EDC data.</p>";
      return;
    }

    details.innerHTML = "<p class='admin-members-empty'>Načítám EDC data...</p>";
    try {
      const response = await apiRequest(`/admin/edc-import?tenantId=${encodeURIComponent(tenantId)}`, { method: "GET" }, true);
      adminState.edcImportInfo = response.importInfo || null;
      renderAdminEdcImport();
    } catch (err) {
      adminState.edcImportInfo = null;
      details.innerHTML = `<p class='admin-members-empty'>${escapeHtml(formatError(err, "Nepodařilo se načíst EDC data."))}</p>`;
    }
  }

  function renderAdminMembers(members) {
    const list = document.getElementById("adminMembersList");
    if (!list) {
      return;
    }

    if (!members || members.length === 0) {
      list.innerHTML = "<p class='admin-members-empty'>Zatím nejsou naimportovaní žádní členové.</p>";
      return;
    }

    const rows = members.map((member) => {
      const roleChip = member.role === "global_admin"
        ? "<span class='admin-member-chip is-admin'>global admin</span>"
        : member.role === "tenant_admin"
          ? "<span class='admin-member-chip is-admin'>tenant admin</span>"
          : "<span class='admin-member-chip'>člen</span>";

      const eans = Array.isArray(member.eans) ? member.eans : [];
      const eanCountChip = `<span class='admin-member-chip'>EAN: ${eans.length}</span>`;
      const eanList = eans.length > 0
        ? `<div class='admin-member-eans'>${eans
            .map((eanLink) => `<div class='admin-member-ean-row'><span class='admin-member-ean-name'>${escapeHtml(eanLink.label || eanLink.memberName || eanLink.ean)}</span><span class='admin-member-ean-value'>${escapeHtml(eanLink.ean)}</span></div>`)
            .join("")}</div>`
        : "<p class='admin-members-empty'>Pro tohoto uživatele zatím nejsou navázané žádné EAN.</p>";

      return `<details class='admin-member-row'><summary class='admin-member-summary'><div class='admin-member-main'><strong>${escapeHtml(member.fullName || member.email)}</strong>${roleChip}${eanCountChip}</div><div class='admin-member-meta'><span>${escapeHtml(member.email)}</span><span>${escapeHtml(member.typ || "-")}</span><span>${escapeHtml(member.mesto || "-")}</span></div></summary><div class='admin-member-detail'>${eanList}</div></details>`;
    });

    list.innerHTML = rows.join("");
  }

  async function loadAdminMembers() {
    const list = document.getElementById("adminMembersList");
    if (!list || !isAdminUser()) {
      return;
    }

    const tenantId = getEffectiveTenantId();
    if (!tenantId) {
      list.innerHTML = "<p class='admin-members-empty'>Vyber tenant pro zobrazení členů.</p>";
      return;
    }

    list.innerHTML = "<p class='admin-members-empty'>Načítám členy...</p>";
    try {
      const response = await apiRequest(`/admin/members?tenantId=${encodeURIComponent(tenantId)}`, { method: "GET" }, true);
      renderAdminMembers(response.members || []);
    } catch (err) {
      list.innerHTML = `<p class='admin-members-empty'>${escapeHtml(formatError(err, "Nepodařilo se načíst členy."))}</p>`;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createAuthOverlay() {
    let overlay = document.getElementById("authOverlay");
    if (overlay) {
      return overlay;
    }

    overlay = document.createElement("section");
    overlay.id = "authOverlay";
    overlay.className = "auth-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = "<div class='auth-panel'><div class='auth-panel-head'><h2>Passwordless přihlášení</h2><button id='authCloseBtn' type='button' class='btn btn-ghost auth-close-btn'>Zavřít</button></div><p class='auth-panel-lead'>Zadej e-mail. Přijde ti jednorázový kód pro přihlášení.</p><form id='authEmailForm' class='auth-form'><label>E-mail<input id='authEmailInput' type='email' required autocomplete='email' placeholder='jmeno@firma.cz' /></label><button type='submit' class='btn btn-primary'>Odeslat kód</button></form><form id='authOtpForm' class='auth-form' hidden><label>Jednorázový kód<input id='authOtpInput' type='text' inputmode='numeric' minlength='6' maxlength='6' placeholder='123456' required /></label><div class='auth-otp-actions'><button type='submit' class='btn btn-primary'>Přihlásit</button><button id='authBackBtn' type='button' class='btn btn-ghost'>Zpět</button></div></form><p id='authStatus' class='auth-status'></p></div>";
    document.body.appendChild(overlay);

    const emailForm = document.getElementById("authEmailForm");
    const otpForm = document.getElementById("authOtpForm");
    const emailInput = document.getElementById("authEmailInput");
    const otpInput = document.getElementById("authOtpInput");
    const status = document.getElementById("authStatus");
    const backBtn = document.getElementById("authBackBtn");
    const closeBtn = document.getElementById("authCloseBtn");

    let pendingEmail = "";

    emailForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(emailInput.value || "").trim().toLowerCase();
      if (!email) {
        status.textContent = "Vyplň e-mail.";
        return;
      }

      status.textContent = "Odesílám kód...";
      try {
        const response = await apiRequest("/auth/request-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }, false);

        pendingEmail = email;
        status.textContent = response.message || "Kód byl odeslán na e-mail.";
        emailForm.hidden = true;
        otpForm.hidden = false;
        otpInput.focus();
      } catch (err) {
        status.textContent = formatError(err, "Nepodařilo se odeslat kód.");
      }
    });

    otpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const otpCode = String(otpInput.value || "").trim();
      if (!pendingEmail || otpCode.length < 6) {
        status.textContent = "Zadej platný jednorázový kód.";
        return;
      }

      status.textContent = "Ověřuji kód...";
      try {
        const response = await apiRequest("/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: pendingEmail, code: otpCode }),
        }, false);

        authToken = response.token;
        authUser = response.user || { email: pendingEmail };
        window.edcAuthState.user = authUser;
        localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
        status.textContent = "Přihlášení úspěšné.";
        finalizeAuthenticated();
      } catch (err) {
        status.textContent = formatError(err, "Kód je neplatný nebo expirovaný.");
      }
    });

    backBtn.addEventListener("click", () => {
      pendingEmail = "";
      otpInput.value = "";
      otpForm.hidden = true;
      emailForm.hidden = false;
      status.textContent = "";
      emailInput.focus();
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeLoginOverlay();
      });
    }

    return overlay;
  }

  function openLoginOverlay() {
    const overlay = createAuthOverlay();
    setOverlayVisibility(overlay, true);
    setAuthLock(true);

    const emailForm = document.getElementById("authEmailForm");
    const otpForm = document.getElementById("authOtpForm");
    const status = document.getElementById("authStatus");
    const emailInput = document.getElementById("authEmailInput");
    const otpInput = document.getElementById("authOtpInput");

    if (emailForm) {
      emailForm.hidden = false;
    }
    if (otpForm) {
      otpForm.hidden = true;
    }
    if (status) {
      status.textContent = `Přihlášení do ${APP_NAME}`;
    }
    if (otpInput) {
      otpInput.value = "";
    }
    if (emailInput) {
      emailInput.focus();
    }
  }

  function closeLoginOverlay() {
    const overlay = document.getElementById("authOverlay");
    setOverlayVisibility(overlay, false);
    setAuthLock(false);
  }

  function formatError(err, fallback) {
    if (err && typeof err === "object" && "message" in err) {
      return String(err.message || fallback);
    }
    return fallback;
  }

  function emitAuthStateChanged() {
    applyGlobalAdminOnlyVisibility();
    enforceGlobalAdminSimulationAccess();
    enforceMemberSharingAuth();
    loadMembersForAdminFilter();
    window.dispatchEvent(new CustomEvent("edc-auth-state", {
      detail: {
        isAuthenticated: Boolean(authToken),
        user: authUser,
      },
    }));
  }

  async function apiRequest(path, options, useAuth) {
    const headers = new Headers((options && options.headers) || {});
    if (useAuth && authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...(options || {}),
      headers,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const message = payload.error || payload.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  }

  function finalizeAuthenticated() {
    closeLoginOverlay();
    upsertHeaderAuth(authUser && authUser.email ? authUser.email : "");
    emitAuthStateChanged();
  }

  async function validateSession() {
    if (!authToken) {
      return false;
    }
    try {
      const response = await apiRequest("/auth/session", { method: "GET" }, true);
      authUser = response.user || null;
      window.edcAuthState.user = authUser;
      return true;
    } catch {
      authToken = "";
      authUser = null;
      window.edcAuthState.user = null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return false;
    }
  }

  async function logout() {
    try {
      if (authToken) {
        await apiRequest("/auth/logout", { method: "POST" }, true);
      }
    } catch {
      // Ignore network errors during logout cleanup.
    }

    authToken = "";
    authUser = null;
    window.edcAuthState.user = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    upsertHeaderAuth("");
    closeLoginOverlay();
    emitAuthStateChanged();
  }

  async function initAuth() {
    if (!AUTH_REQUIRED) {
      upsertHeaderAuth("");
      applyGlobalAdminOnlyVisibility();
      enforceGlobalAdminSimulationAccess();
      setAuthLock(false);
      return;
    }

    upsertHeaderAuth("");
    applyGlobalAdminOnlyVisibility();
    const hasValidSession = await validateSession();
    if (hasValidSession) {
      finalizeAuthenticated();
      return;
    }

    closeLoginOverlay();
    upsertHeaderAuth("");
    enforceMemberSharingAuth();
    enforceGlobalAdminSimulationAccess();
  }

  async function loadMembersForAdminFilter() {
    if (!isMemberSharingPage() || !isAdminUser()) {
      return;
    }

    const filterSection = document.getElementById("memberFilterSection");
    const memberSelect = document.getElementById("memberSelect");
    if (!filterSection || !memberSelect) {
      return;
    }

    try {
      const tenantId = getEffectiveTenantId();
      if (!tenantId) {
        return;
      }

      const response = await apiRequest(`/admin/members?tenantId=${tenantId}`, { method: "GET" }, true);
      const members = response && Array.isArray(response.members) ? response.members : [];

      // Reset selection - admin must always explicitly choose a member
      sessionStorage.removeItem("edc_member_filter");
      memberSelect.innerHTML = '<option value="">-- Vyberte člena --</option>';
      for (const member of members) {
        const option = document.createElement("option");
        option.value = String(member.id || "");
        option.textContent = `${member.fullName || member.email} (${member.email})`;
        memberSelect.appendChild(option);
      }

      filterSection.hidden = false;
      console.log("[EDC] Loaded", members.length, "members for admin filter");
    } catch (err) {
      console.error("Failed to load members for admin filter", err);
    }
  }

  function setupMemberFilterListener() {
    if (!isMemberSharingPage()) {
      console.log("[EDC] Not on member-sharing page, skipping filter setup");
      return;
    }

    const memberSelect = document.getElementById("memberSelect");
    console.log("[EDC] setupMemberFilterListener: memberSelect =", memberSelect);
    if (!memberSelect) {
      console.log("[EDC] memberSelect element not found!");
      return;
    }

    memberSelect.addEventListener("change", () => {
      const selectedMemberId = memberSelect.value;
      console.log("[EDC] Member filter changed:", selectedMemberId);
      if (selectedMemberId) {
        sessionStorage.setItem("edc_member_filter", selectedMemberId);
      } else {
        sessionStorage.removeItem("edc_member_filter");
      }
      console.log("[EDC] Dispatching edc-member-filter-changed event with memberId:", selectedMemberId);
      window.dispatchEvent(new CustomEvent("edc-member-filter-changed", {
        detail: { selectedMemberId },
      }));
      // Also directly refresh via external API
      if (window.edcAnalyzer && typeof window.edcAnalyzer.refreshMemberData === "function") {
        console.log("[EDC] Calling window.edcAnalyzer.refreshMemberData()");
        window.edcAnalyzer.refreshMemberData();
      }
    });
    console.log("[EDC] setupMemberFilterListener: event listener registered successfully");
  }

  window.edcAuth = {
    getToken: function () {
      return authToken;
    },
    getUser: function () {
      return authUser;
    },
    isAdmin: function () {
      return isAdminUser();
    },
    isAuthenticated: function () {
      return Boolean(authToken);
    },
    logout,
    getSelectedMemberId: function () {
      return sessionStorage.getItem("edc_member_filter") || "";
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderSharedNavigation();
    renderHomeHeroActions();
    renderHomeLandingCards();
    applyGlobalAdminOnlyVisibility();
    setupMemberFilterListener();
    initAuth();
  });
})();

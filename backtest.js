"use strict";

// ── State ────────────────────────────────────────────────────────────────────
let currentTenantId = null;
let backtestEans = [];   // PlannerEanDto[] (producers + consumers)

// ── Helpers ──────────────────────────────────────────────────────────────────
function token() {
  return (window.edcAuth && typeof window.edcAuth.getToken === "function"
    ? window.edcAuth.getToken()
    : localStorage.getItem("edc_auth_token")) || "";
}

async function apiFetch(path, opts = {}) {
  const resp = await fetch(path, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${resp.status}`);
  }
  const ct = resp.headers.get("content-type") || "";
  return ct.includes("application/json") ? resp.json() : null;
}

function qs(id) { return document.getElementById(id); }

function setStatus(id, msg, isError = false) {
  const el = qs(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "var(--danger, #c0392b)" : "var(--muted)";
}

function show(id) { const el = qs(id); if (el) el.style.display = ""; }
function hide(id) { const el = qs(id); if (el) el.style.display = "none"; }

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tenantParam() {
  return currentTenantId ? `?tenantId=${encodeURIComponent(currentTenantId)}` : "";
}

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  const checkAuth = setInterval(() => {
    if (!window.edcAuth) return;
    if (window.edcAuth.isAuthenticated() && !window.edcAuth.getUser()) return;
    clearInterval(checkAuth);

    const user = window.edcAuth.getUser();
    if (!user || !["global_admin", "tenant_admin"].includes(user.role)) {
      show("authErrorSection");
      return;
    }

    if (user.role === "tenant_admin") {
      const administered = Array.isArray(user.administeredTenants) ? user.administeredTenants : [];
      currentTenantId = administered.length > 0 ? String(administered[0].id) : (user.tenantId ? String(user.tenantId) : null);
    } else {
      currentTenantId = sessionStorage.getItem("edc_sharing_group_filter") || null;
    }

    if (!currentTenantId) {
      show("authErrorSection");
      qs("authErrorSection").querySelector("p").textContent = "Nepodařilo se určit skupinu sdílení. Otevřete stránku znovu z kontextu skupiny.";
      return;
    }

    qs("backtestTenantName").textContent = `Skupina sdílení ID ${currentTenantId}`;

    // Default to current month (assume real data exists for it)
    const now = new Date();
    qs("monthPicker").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    show("monthSection");
    setupLoadEans();
  }, 100);
}

// ── Load EANs ─────────────────────────────────────────────────────────────────
function setupLoadEans() {
  qs("loadEansBtn").addEventListener("click", loadEans);
}

async function loadEans() {
  setStatus("loadEansStatus", "Načítám EAN místa…");
  try {
    backtestEans = await apiFetch(`/api/admin/planner/eans${tenantParam()}`);
    renderEans();
    renderMatrixInputs();
    show("eansSection");
    show("matrixSection");
    show("runSection");
    hide("resultsSection");
    setStatus("loadEansStatus", "Načteno ✓");
  } catch (e) {
    setStatus("loadEansStatus", "Chyba: " + e.message, true);
  }
}

// ── EAN rendering ─────────────────────────────────────────────────────────────
function renderEans() {
  const producers = backtestEans.filter(e => e.isProducer);
  const consumers = backtestEans.filter(e => !e.isProducer);
  qs("eansChip").textContent = `${producers.length} výroben · ${consumers.length} odběratelů`;
  qs("producersList").innerHTML = renderEanTable(producers);
  qs("consumersList").innerHTML = renderEanTable(consumers);
}

function renderEanTable(eans) {
  if (!eans.length) return '<p style="color:var(--muted);font-size:0.88em;">Žádná EAN místa.</p>';
  const rows = eans.map(e => {
    const badge = e.isSynthetic
      ? `<span style="font-size:0.78em;background:#fff3cd;color:#856404;border-radius:4px;padding:1px 6px;margin-left:6px;">syntetický</span>`
      : "";
    return `<tr>
      <td style="font-size:0.82em;font-family:monospace;">${esc(e.ean)}</td>
      <td>${esc(e.label)}${badge}</td>
    </tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:0.88em;"><tbody>${rows}</tbody></table>`;
}

// ── Matrix input ──────────────────────────────────────────────────────────────
function getMatrixProducers() { return backtestEans.filter(e => e.isProducer); }
function getMatrixConsumers() { return backtestEans.filter(e => !e.isProducer); }

function renderMatrixInputs() {
  const producers = getMatrixProducers();
  const consumers = getMatrixConsumers();

  if (!producers.length || !consumers.length) {
    qs("matrixInputWrap").innerHTML = '<p style="color:var(--muted);font-size:0.88em;">Nejsou k dispozici výrobny nebo odběratelé.</p>';
    return;
  }

  const headerCells = consumers.map(c =>
    `<th style="text-align:center;padding:4px 6px;font-size:0.82em;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="${esc(c.label)}">${esc(c.label)}</th>`
  ).join("");

  const rows = producers.map((p, pi) => {
    const cells = consumers.map((_, ci) =>
      `<td style="padding:2px 4px;">
        <input type="number" class="matrix-cell" data-pi="${pi}" data-ci="${ci}"
          min="0" max="100" step="0.1" value=""
          style="width:64px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;text-align:right;font-size:0.88em;" />
      </td>`
    ).join("");
    return `<tr>
      <td style="padding:4px 8px;font-weight:600;white-space:nowrap;font-size:0.88em;">${esc(p.label)}</td>
      ${cells}
      <td style="padding:4px 8px;font-size:0.82em;color:var(--muted);white-space:nowrap;" id="rowsum-${pi}">Σ 0 %</td>
    </tr>`;
  }).join("");

  qs("matrixInputWrap").innerHTML = `
    <table style="border-collapse:collapse;font-size:0.88em;">
      <thead><tr>
        <th style="text-align:left;padding:4px 8px;">Výrobna</th>
        ${headerCells}
        <th style="padding:4px 8px;color:var(--muted);">Součet</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Live row sum update + validation
  qs("matrixInputWrap").addEventListener("input", onMatrixInput);

  // Equal distribution button
  qs("equalDistBtn").onclick = () => {
    const cCount = consumers.length;
    const equalVal = Math.floor((100 / cCount) * 10) / 10;
    document.querySelectorAll(".matrix-cell").forEach(inp => {
      inp.value = equalVal;
    });
    updateAllRowSums();
  };

  qs("clearMatrixBtn").onclick = () => {
    document.querySelectorAll(".matrix-cell").forEach(inp => { inp.value = ""; });
    updateAllRowSums();
  };
}

function onMatrixInput(e) {
  if (!e.target.classList.contains("matrix-cell")) return;
  const pi = parseInt(e.target.dataset.pi, 10);
  updateRowSum(pi);
  validateMatrix();
}

function getRowValues(pi) {
  return [...document.querySelectorAll(`.matrix-cell[data-pi="${pi}"]`)]
    .map(inp => parseFloat(inp.value) || 0);
}

function updateRowSum(pi) {
  const sum = getRowValues(pi).reduce((a, b) => a + b, 0);
  const el = qs(`rowsum-${pi}`);
  if (!el) return;
  el.textContent = `Σ ${sum.toFixed(1)} %`;
  el.style.color = sum > 100.05 ? "var(--danger, #c0392b)" : "var(--muted)";
}

function updateAllRowSums() {
  const producers = getMatrixProducers();
  producers.forEach((_, pi) => updateRowSum(pi));
  validateMatrix();
}

function validateMatrix() {
  const producers = getMatrixProducers();
  let valid = true;
  for (let pi = 0; pi < producers.length; pi++) {
    const sum = getRowValues(pi).reduce((a, b) => a + b, 0);
    if (sum > 100.05) { valid = false; break; }
  }
  setStatus("matrixValidStatus", valid ? "" : "Součet řádku překračuje 100 %.", !valid);
  return valid;
}

function readMatrix() {
  const producers = getMatrixProducers();
  const consumers = getMatrixConsumers();
  return producers.map((_, pi) =>
    consumers.map((_, ci) => {
      const inp = document.querySelector(`.matrix-cell[data-pi="${pi}"][data-ci="${ci}"]`);
      return parseFloat(inp?.value) || 0;
    })
  );
}

// ── Run backtest ──────────────────────────────────────────────────────────────
function setupRun() {
  qs("runTestBtn").addEventListener("click", runBacktest);
}

async function runBacktest() {
  if (!validateMatrix()) {
    setStatus("runStatus", "Opravte alokační matici (součet řádku > 100 %).", true);
    return;
  }

  const monthVal = qs("monthPicker").value;
  if (!monthVal) {
    setStatus("runStatus", "Vyberte měsíc.", true);
    return;
  }
  const [year, month] = monthVal.split("-").map(Number);
  const dateFrom = Date.UTC(year, month - 1, 1);
  const dateTo = Date.UTC(year, month, 1);

  const matrix = readMatrix();

  qs("runTestBtn").disabled = true;
  setStatus("runStatus", "Spouštím zpětný test…");
  hide("resultsSection");

  try {
    const body = {
      tenantId: currentTenantId,
      dateFrom,
      dateTo,
      mode: "backtest",
      rounds: 5,
      maxFails: 0,
      restarts: 0,
      weights: null,
      allocationMatrix: matrix,
    };

    const { jobId } = await apiFetch("/api/admin/simulate", { method: "POST", body: JSON.stringify(body) });
    await streamResult(jobId);
  } catch (err) {
    setStatus("runStatus", "Chyba: " + err.message, true);
    qs("runTestBtn").disabled = false;
  }
}

async function streamResult(jobId) {
  const resp = await fetch(`/api/admin/simulate/${jobId}/progress`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      let evt;
      try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }

      if (evt.type === "done") {
        setStatus("runStatus", "Hotovo ✓");
        qs("runTestBtn").disabled = false;
        renderResults(evt.result);
        return;
      } else if (evt.type === "error") {
        throw new Error(evt.message || "Chyba simulace");
      }
    }
  }
}

// ── Results rendering ─────────────────────────────────────────────────────────
function renderResults(result) {
  const eanLabelMap = Object.fromEntries(backtestEans.map(e => [e.ean, e.label]));
  const producers = (result.producerEans || []).map(ean => eanLabelMap[ean] || ean);
  const consumers = (result.consumerEans || []).map(ean => eanLabelMap[ean] || ean);

  const matrix = result.producerAllocationMatrix || [];
  const sharingPerConsumer = result.sharingPerEan || [];
  const sharingPerProducer = result.sharingPerProducer || [];
  const simProd = result.simulatedProductionPerProducer || [];
  const simCons = result.simulatedConsumptionPerConsumer || [];
  const total = result.totalSharing;

  function kwh(v) { return (v ?? 0) > 0.001 ? Number(v).toFixed(1) + " kWh" : "—"; }

  qs("resultsSummaryChip").textContent = `Celkem sdíleno ${total.toFixed(1)} kWh`;
  qs("resultsSourceSummary").textContent = result.sourceSummary || "";

  // Allocation matrix (read-only display)
  const headerCells = consumers.map(c =>
    `<th style="text-align:right;padding:4px 8px;font-size:0.82em;">${esc(c)}</th>`
  ).join("");
  const matrixRows = matrix.map((row, pi) => {
    const cells = row.map(v =>
      `<td style="text-align:right;padding:4px 8px;">${v > 0.05 ? v.toFixed(1) + " %" : "—"}</td>`
    ).join("");
    return `<tr>
      <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">${esc(producers[pi] || `Výrobna ${pi + 1}`)}</td>
      ${cells}
      <td style="padding:4px 8px;text-align:right;color:var(--muted);">Σ ${row.reduce((a, b) => a + b, 0).toFixed(1)} %</td>
    </tr>`;
  }).join("");

  qs("allocationMatrixWrap").innerHTML = `
    <table style="border-collapse:collapse;font-size:0.88em;width:100%;">
      <thead><tr>
        <th style="text-align:left;padding:4px 8px;">Výrobna</th>
        ${headerCells}
        <th style="padding:4px 8px;color:var(--muted);">Součet</th>
      </tr></thead>
      <tbody>${matrixRows}</tbody>
    </table>`;

  // Producer totals
  const producerRows = producers.map((p, i) => `<tr>
    <td style="padding:4px 8px;font-weight:600;">${esc(p)}</td>
    <td style="padding:4px 8px;text-align:right;">${kwh(simProd[i])}</td>
    <td style="padding:4px 8px;text-align:right;">${kwh(sharingPerProducer[i])}</td>
    <td style="padding:4px 8px;text-align:right;color:var(--muted);">${simProd[i] > 0.001 ? (sharingPerProducer[i] / simProd[i] * 100).toFixed(1) + " %" : "—"}</td>
  </tr>`).join("");

  // Consumer totals
  const consumerRows = consumers.map((c, i) => `<tr>
    <td style="padding:4px 8px;">${esc(c)}</td>
    <td style="padding:4px 8px;text-align:right;">${kwh(simCons[i])}</td>
    <td style="padding:4px 8px;text-align:right;">${kwh(sharingPerConsumer[i])}</td>
    <td style="padding:4px 8px;text-align:right;color:var(--muted);">${simCons[i] > 0.001 ? (sharingPerConsumer[i] / simCons[i] * 100).toFixed(1) + " %" : "—"}</td>
  </tr>`).join("");

  qs("sharingTotalsWrap").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      <div>
        <h4 style="font-size:0.88rem;margin-bottom:4px;">Výrobny</h4>
        <table style="border-collapse:collapse;font-size:0.88em;width:100%;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;">Výrobna</th>
            <th style="text-align:right;padding:4px 8px;">Výroba</th>
            <th style="text-align:right;padding:4px 8px;">Sdíleno</th>
            <th style="text-align:right;padding:4px 8px;color:var(--muted);">Využití</th>
          </tr></thead>
          <tbody>${producerRows}</tbody>
        </table>
      </div>
      <div>
        <h4 style="font-size:0.88rem;margin-bottom:4px;">Odběratelé</h4>
        <table style="border-collapse:collapse;font-size:0.88em;width:100%;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;">Odběratel</th>
            <th style="text-align:right;padding:4px 8px;">Spotřeba</th>
            <th style="text-align:right;padding:4px 8px;">Přijato</th>
            <th style="text-align:right;padding:4px 8px;color:var(--muted);">Pokrytí</th>
          </tr></thead>
          <tbody>${consumerRows}</tbody>
          <tfoot><tr style="border-top:2px solid var(--border);">
            <td style="padding:4px 8px;font-weight:700;" colspan="2">Celkem sdíleno</td>
            <td style="padding:4px 8px;text-align:right;font-weight:700;">${total.toFixed(1)} kWh</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;

  show("resultsSection");
  qs("resultsSection").scrollIntoView({ behavior: "smooth" });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupRun();
  init();
});

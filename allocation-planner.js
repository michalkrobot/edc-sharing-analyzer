"use strict";

// ── State ────────────────────────────────────────────────────────────────────
let currentTenantId = null;
let plannerEans = [];
let priorityLinks = [];
let lastSimResult = null;

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

function tenantParam() {
  return currentTenantId ? `?tenantId=${encodeURIComponent(currentTenantId)}` : "";
}

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Wait for auth to be ready (edcAuth exists AND session validation is complete)
  const checkAuth = setInterval(() => {
    if (!window.edcAuth) return;
    // If token exists but user is still null, session validation is in progress – keep waiting
    if (window.edcAuth.isAuthenticated() && !window.edcAuth.getUser()) return;
    clearInterval(checkAuth);

    const user = window.edcAuth.getUser();
    if (!user || !["global_admin", "tenant_admin"].includes(user.role)) {
      show("authErrorSection");
      return;
    }

    // Resolve tenant id
    if (user.role === "tenant_admin") {
      const administered = Array.isArray(user.administeredTenants) ? user.administeredTenants : [];
      currentTenantId = administered.length > 0 ? String(administered[0].id) : (user.tenantId ? String(user.tenantId) : null);
    } else {
      // global admin: try from session storage
      currentTenantId = sessionStorage.getItem("edc_sharing_group_filter") || null;
    }

    if (!currentTenantId) {
      show("authErrorSection");
      qs("authErrorSection").querySelector("p").textContent = "Nepodařilo se určit skupinu sdílení. Otevřete stránku znovu z kontextu skupiny.";
      return;
    }

    qs("plannerTenantName").textContent = `Skupina sdílení ID ${currentTenantId}`;

    // Set default month to next month
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    qs("monthPicker").value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;

    show("monthSection");
    show("addSyntheticSection");
    show("priorityLinksSection");
    show("simulationSection");

    setupSyntheticForm();
    setupPriorityLinkForm();
    setupSimulation();

    loadEans();
    loadPriorityLinks();
  }, 100);
}

// ── EAN list ─────────────────────────────────────────────────────────────────
async function loadEans() {
  try {
    plannerEans = await apiFetch(`/api/admin/planner/eans${tenantParam()}`);
    renderEans();
    repopulateLinkSelects();
    show("eansSection");
  } catch (e) {
    console.error("loadEans", e);
  }
}

function renderEans() {
  const producers = plannerEans.filter(e => e.isProducer);
  const consumers = plannerEans.filter(e => !e.isProducer);

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
    const detail = e.isSynthetic
      ? (e.isProducer
          ? `<br><small style="color:var(--muted)">${e.installedKw ?? "?"} kWp · FVE model</small>`
          : `<small style="color:var(--muted)">${e.annualKwh ? (e.annualKwh / 1000).toFixed(1) + " MWh/rok" : "?"} · ${tdzLabel(e.tdzCategory)}</small>`)
      : "";
    const delBtn = e.isSynthetic
      ? `<button onclick="deleteSyntheticEan('${esc(e.ean)}')" style="font-size:0.8em;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;">✕</button>`
      : "";
    return `<tr>
      <td style="font-size:0.82em;font-family:monospace;">${esc(e.ean)}</td>
      <td>${esc(e.label)}${badge}${detail}</td>
      <td>${delBtn}</td>
    </tr>`;
  }).join("");

  return `<table style="width:100%;border-collapse:collapse;font-size:0.88em;">
    <tbody>${rows}</tbody>
  </table>`;
}

function tdzLabel(cat) {
  return { domacnost: "Domácnost", mala_firma: "Malá firma", stredni_firma: "Střední firma", velka_firma: "Velká firma" }[cat] || cat || "";
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Synthetic EAN form ────────────────────────────────────────────────────────
function setupSyntheticForm() {
  const typeSelect = qs("synType");
  typeSelect.addEventListener("change", () => {
    const isProd = typeSelect.value === "producer";
    qs("producerFields").style.display = isProd ? "grid" : "none";
    qs("consumerFields").style.display = isProd ? "none" : "grid";
  });

  qs("syntheticEanForm").addEventListener("submit", async e => {
    e.preventDefault();
    setStatus("synFormStatus", "Ukládám…");
    const isProducer = qs("synType").value === "producer";
    const body = {
      ean: qs("synEan").value.trim(),
      label: qs("synLabel").value.trim(),
      isProducer,
      installedKw: isProducer ? parseFloat(qs("synInstalledKw").value) || null : null,
      annualKwh: isProducer
        ? parseFloat(qs("synProducerAnnualKwh").value) || null
        : parseFloat(qs("synAnnualKwh").value) || null,
      tdzCategory: isProducer ? qs("synProducerTdzCategory").value : qs("synTdzCategory").value,
    };
    try {
      await apiFetch(`/api/admin/planner/synthetic-eans${tenantParam()}`, {
        method: "POST", body: JSON.stringify(body),
      });
      setStatus("synFormStatus", "Uloženo ✓");
      qs("syntheticEanForm").reset();
      qs("producerFields").style.display = "grid";
      qs("consumerFields").style.display = "none";
      await loadEans();
    } catch (err) {
      setStatus("synFormStatus", err.message, true);
    }
  });
}

async function deleteSyntheticEan(ean) {
  if (!confirm(`Odstranit syntetický EAN ${ean}?`)) return;
  try {
    await apiFetch(`/api/admin/planner/synthetic-eans/${encodeURIComponent(ean)}${tenantParam()}`, { method: "DELETE" });
    await loadEans();
    await loadPriorityLinks();
  } catch (err) {
    alert("Chyba: " + err.message);
  }
}

// ── Priority links ────────────────────────────────────────────────────────────
async function loadPriorityLinks() {
  try {
    priorityLinks = await apiFetch(`/api/admin/planner/priority-links${tenantParam()}`);
    renderPriorityLinks();
  } catch (e) {
    console.error("loadPriorityLinks", e);
  }
}

function renderPriorityLinks() {
  qs("linksChip").textContent = `${priorityLinks.length} vazeb`;

  if (!priorityLinks.length) {
    qs("linksTableWrap").innerHTML = '<p style="color:var(--muted);font-size:0.88em;">Zatím žádné prioritní vazby.</p>';
    return;
  }

  // Count links per consumer for warning display
  const perConsumer = {};
  priorityLinks.forEach(l => { perConsumer[l.consumerEan] = (perConsumer[l.consumerEan] || 0) + 1; });

  const rows = priorityLinks.map(l => {
    const cnt = perConsumer[l.consumerEan] || 0;
    const warn = cnt >= 5 ? `<span style="color:#856404;font-size:0.8em;"> ⚠ max</span>` : "";
    return `<tr>
      <td><span style="font-family:monospace;font-size:0.8em;">${esc(l.producerEan)}</span><br><small>${esc(l.producerLabel)}</small></td>
      <td style="padding:0 12px;">→</td>
      <td><span style="font-family:monospace;font-size:0.8em;">${esc(l.consumerEan)}</span><br><small>${esc(l.consumerLabel)}${warn}</small></td>
      <td><button onclick="deletePriorityLink('${esc(l.producerEan)}','${esc(l.consumerEan)}')" style="font-size:0.8em;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;">✕</button></td>
    </tr>`;
  }).join("");

  qs("linksTableWrap").innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.88em;">
    <thead><tr>
      <th style="text-align:left;padding:4px 0;">Výrobna</th>
      <th></th>
      <th style="text-align:left;">Odběratel</th>
      <th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function repopulateLinkSelects() {
  const producers = plannerEans.filter(e => e.isProducer);
  const consumers = plannerEans.filter(e => !e.isProducer);

  const prodSel = qs("linkProducerEan");
  const consSel = qs("linkConsumerEan");
  const prevProd = prodSel.value;
  const prevCons = consSel.value;

  prodSel.innerHTML = '<option value="">— vyberte výrobnu —</option>' +
    producers.map(e => `<option value="${esc(e.ean)}">${esc(e.label)} (${esc(e.ean)})</option>`).join("");
  consSel.innerHTML = '<option value="">— vyberte odběratele —</option>' +
    consumers.map(e => `<option value="${esc(e.ean)}">${esc(e.label)} (${esc(e.ean)})</option>`).join("");

  if (prevProd) prodSel.value = prevProd;
  if (prevCons) consSel.value = prevCons;
}

function setupPriorityLinkForm() {
  qs("addLinkBtn").addEventListener("click", async () => {
    const producerEan = qs("linkProducerEan").value;
    const consumerEan = qs("linkConsumerEan").value;
    if (!producerEan || !consumerEan) {
      setStatus("linkFormStatus", "Vyberte výrobnu i odběratele.", true);
      return;
    }
    setStatus("linkFormStatus", "Ukládám…");
    try {
      await apiFetch(`/api/admin/planner/priority-links${tenantParam()}`, {
        method: "POST",
        body: JSON.stringify({ producerEan, consumerEan }),
      });
      setStatus("linkFormStatus", "Přidáno ✓");
      await loadPriorityLinks();
    } catch (err) {
      setStatus("linkFormStatus", err.message, true);
    }
  });
}

async function deletePriorityLink(producerEan, consumerEan) {
  try {
    const params = new URLSearchParams({ producerEan, consumerEan });
    if (currentTenantId) params.set("tenantId", currentTenantId);
    await apiFetch(`/api/admin/planner/priority-links?${params}`, { method: "DELETE" });
    await loadPriorityLinks();
  } catch (err) {
    alert("Chyba: " + err.message);
  }
}

// ── Simulation ────────────────────────────────────────────────────────────────
function setupSimulation() {
  qs("runSimBtn").addEventListener("click", runSimulation);
}

async function runSimulation() {
  const monthVal = qs("monthPicker").value; // "YYYY-MM"
  if (!monthVal) {
    setStatus("simStatus", "Vyberte cílový měsíc.", true);
    return;
  }
  const [year, month] = monthVal.split("-").map(Number);
  const dateFrom = Date.UTC(year, month - 1, 1);
  const dateTo = Date.UTC(year, month, 1);

  qs("runSimBtn").disabled = true;
  setStatus("simStatus", "Spouštím simulaci…");
  show("simProgressBar");
  qs("simProgressValue").value = 0;
  qs("simProgressEta").textContent = "";
  hide("resultsSection");

  try {
    const body = {
      tenantId: currentTenantId,
      dateFrom,
      dateTo,
      mode: "optimize",
      rounds: 5,
      maxFails: 600,
      restarts: 25,
      weights: null,
    };

    const { jobId } = await apiFetch("/api/admin/simulate", { method: "POST", body: JSON.stringify(body) });
    await streamSimulation(jobId);
  } catch (err) {
    setStatus("simStatus", "Chyba: " + err.message, true);
    hide("simProgressBar");
    qs("runSimBtn").disabled = false;
  }
}

async function streamSimulation(jobId) {
  const t = token();
  const resp = await fetch(`/api/admin/simulate/${jobId}/progress`, {
    headers: { Authorization: `Bearer ${t}` },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

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

      if (evt.type === "progress") {
        qs("simProgressValue").value = evt.percent;
        const eta = evt.etaSecs != null ? ` · zbývá ~${Math.ceil(evt.etaSecs)} s` : "";
        qs("simProgressEta").textContent = `${evt.percent} %${eta}`;
      } else if (evt.type === "done") {
        qs("simProgressValue").value = 100;
        setStatus("simStatus", "Hotovo ✓");
        hide("simProgressBar");
        qs("runSimBtn").disabled = false;
        renderResults(evt.result);
        return;
      } else if (evt.type === "error") {
        throw new Error(evt.message || "Chyba simulace");
      }
    }
  }
}

// ── CSV export ────────────────────────────────────────────────────────────────
function makeSemicolonRow(values) {
  return values.map(v => String(v ?? "")).join(";") + "\n";
}

function formatDateDdMmYyyy(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatEdcAllocationKey(percentValue) {
  const value = Math.max(0, (Number(percentValue) || 0) / 100);
  if (value <= 0) return "";
  const formatted = value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return formatted.replace(".", ",");
}

function buildEdcImportCsv(result) {
  const matrix = result.producerAllocationMatrix || [];
  const producerEans = result.producerEans || [];
  const consumerEans = result.consumerEans || [];

  const monthVal = qs("monthPicker").value; // "YYYY-MM"
  let dateFrom = formatDateDdMmYyyy(new Date());
  if (monthVal) {
    const [y, m] = monthVal.split("-").map(Number);
    dateFrom = formatDateDdMmYyyy(new Date(y, m - 1, 1));
  }

  let csv = makeSemicolonRow([
    "IdSkupinySdileni", "Operace", "EANo", "DatumOd", "DatumDo",
    "EANd1", "AlokacniKlic1", "EANd2", "AlokacniKlic2",
    "EANd3", "AlokacniKlic3", "EANd4", "AlokacniKlic4",
    "EANd5", "AlokacniKlic5",
  ]);

  consumerEans.forEach((consumerEan, ci) => {
    const allocations = producerEans
      .map((producerEan, pi) => ({
        producerEan,
        pct: Number(matrix[pi]?.[ci]) || 0,
      }))
      .filter(a => a.pct > 0.0001)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    const pairs = [];
    for (let i = 0; i < 5; i++) {
      const a = allocations[i];
      pairs.push(a ? a.producerEan : "", a ? formatEdcAllocationKey(a.pct) : "");
    }

    csv += makeSemicolonRow([
      currentTenantId || "", "Editovat", consumerEan, dateFrom, "31.12.9999",
      ...pairs,
    ]);
  });

  return csv;
}

function buildReadableCsv(result) {
  const matrix = result.producerAllocationMatrix || [];
  const producerEans = result.producerEans || [];
  const consumerEans = result.consumerEans || [];
  const eanLabelMap = Object.fromEntries(plannerEans.map(e => [e.ean, e.label]));

  let csv = makeSemicolonRow([
    "EANo", "NazevOdbernehomista",
    "EANd1", "NazevVyrobny1", "AlokacniKlic1",
    "EANd2", "NazevVyrobny2", "AlokacniKlic2",
    "EANd3", "NazevVyrobny3", "AlokacniKlic3",
    "EANd4", "NazevVyrobny4", "AlokacniKlic4",
    "EANd5", "NazevVyrobny5", "AlokacniKlic5",
  ]);

  consumerEans.forEach((consumerEan, ci) => {
    const allocations = producerEans
      .map((producerEan, pi) => ({
        producerEan,
        label: eanLabelMap[producerEan] || producerEan,
        pct: Number(matrix[pi]?.[ci]) || 0,
      }))
      .filter(a => a.pct > 0.0001)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    const pairs = [];
    for (let i = 0; i < 5; i++) {
      const a = allocations[i];
      const pctStr = a ? (a.pct.toFixed(2).replace(".", ",") + " %") : "";
      pairs.push(a ? a.producerEan : "", a ? a.label : "", pctStr);
    }

    csv += makeSemicolonRow([
      consumerEan, eanLabelMap[consumerEan] || consumerEan,
      ...pairs,
    ]);
  });

  return csv;
}

function triggerCsvDownload(filename, content) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setupExportButtons() {
  qs("exportEdcBtn").addEventListener("click", () => {
    if (!lastSimResult) return;
    const monthVal = qs("monthPicker").value || "alokace";
    triggerCsvDownload(`alokace_${monthVal}_edc_import.csv`, buildEdcImportCsv(lastSimResult));
  });
  qs("exportReadableBtn").addEventListener("click", () => {
    if (!lastSimResult) return;
    const monthVal = qs("monthPicker").value || "alokace";
    triggerCsvDownload(`alokace_${monthVal}_prehledny.csv`, buildReadableCsv(lastSimResult));
  });
}

// ── Results rendering ─────────────────────────────────────────────────────────
function renderResults(result) {
  // Use the EAN order from the simulation result (may differ from plannerEans sort order)
  const eanLabelMap = Object.fromEntries(plannerEans.map(e => [e.ean, e.label]));
  const producers = (result.producerEans || []).map(ean => eanLabelMap[ean] || ean);
  const consumers = (result.consumerEans || []).map(ean => eanLabelMap[ean] || ean);

  const matrix = result.producerAllocationMatrix;
  const sharingPerConsumer = result.sharingPerEan;
  const sharingPerProducer = result.sharingPerProducer;
  const simProd = result.simulatedProductionPerProducer || [];
  const simCons = result.simulatedConsumptionPerConsumer || [];
  const histProd = result.historicalProductionPerProducer || [];
  const histCons = result.historicalConsumptionPerConsumer || [];
  const total = result.totalSharing;

  function kwh(v) { return v > 0 ? v.toFixed(1) + " kWh" : "—"; }

  qs("resultsSummaryChip").textContent = `Celkem sdíleno ${total.toFixed(1)} kWh`;
  qs("resultsSourceSummary").textContent = result.sourceSummary || "";

  // Allocation matrix
  const headerCells = consumers.map(c => `<th style="text-align:right;padding:4px 8px;font-size:0.82em;">${esc(c)}</th>`).join("");
  const matrixRows = matrix.map((row, pi) => {
    const cells = row.map(v => `<td style="text-align:right;padding:4px 8px;">${v > 0 ? v.toFixed(1) + " %" : "—"}</td>`).join("");
    const pLabel = producers[pi] || `Výrobna ${pi + 1}`;
    return `<tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">${esc(pLabel)}</td>${cells}</tr>`;
  }).join("");

  qs("allocationMatrixWrap").innerHTML = `
    <table style="border-collapse:collapse;font-size:0.88em;width:100%;">
      <thead><tr>
        <th style="text-align:left;padding:4px 8px;">Výrobna</th>
        ${headerCells}
      </tr></thead>
      <tbody>${matrixRows}</tbody>
    </table>`;

  // Producer totals table
  const producerRows = producers.map((p, i) =>
    `<tr>
      <td style="padding:4px 8px;font-weight:600;">${esc(p)}</td>
      <td style="padding:4px 8px;text-align:right;">${kwh(simProd[i])}</td>
      <td style="padding:4px 8px;text-align:right;color:var(--muted);">${kwh(histProd[i])}</td>
      <td style="padding:4px 8px;text-align:right;">${kwh(sharingPerProducer[i])}</td>
    </tr>`
  ).join("");

  // Consumer totals table
  const consumerRows = consumers.map((c, i) =>
    `<tr>
      <td style="padding:4px 8px;">${esc(c)}</td>
      <td style="padding:4px 8px;text-align:right;">${kwh(simCons[i])}</td>
      <td style="padding:4px 8px;text-align:right;color:var(--muted);">${kwh(histCons[i])}</td>
      <td style="padding:4px 8px;text-align:right;">${kwh(sharingPerConsumer[i])}</td>
    </tr>`
  ).join("");

  qs("sharingTotalsWrap").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      <div>
        <h4 style="font-size:0.88rem;margin-bottom:4px;">Výrobny</h4>
        <table style="border-collapse:collapse;font-size:0.88em;width:100%;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;">Výrobna</th>
            <th style="text-align:right;padding:4px 8px;">Předpokl. výroba</th>
            <th style="text-align:right;padding:4px 8px;color:var(--muted);">Hist. výroba (odhad/měs.)</th>
            <th style="text-align:right;padding:4px 8px;">Sdíleno</th>
          </tr></thead>
          <tbody>${producerRows}</tbody>
        </table>
      </div>
      <div>
        <h4 style="font-size:0.88rem;margin-bottom:4px;">Odběratelé</h4>
        <table style="border-collapse:collapse;font-size:0.88em;width:100%;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;">Odběratel</th>
            <th style="text-align:right;padding:4px 8px;">Očekávaná spotřeba</th>
            <th style="text-align:right;padding:4px 8px;color:var(--muted);">Hist. spotřeba (odhad/měs.)</th>
            <th style="text-align:right;padding:4px 8px;">Přijato</th>
          </tr></thead>
          <tbody>${consumerRows}</tbody>
          <tfoot><tr style="border-top:2px solid var(--border);">
            <td style="padding:4px 8px;font-weight:700;" colspan="3">Celkem přijato</td>
            <td style="padding:4px 8px;text-align:right;font-weight:700;">${total.toFixed(1)} kWh</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;

  lastSimResult = result;
  qs("exportEdcBtn").disabled = false;
  qs("exportReadableBtn").disabled = false;
  show("resultsSection");
  qs("resultsSection").scrollIntoView({ behavior: "smooth" });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupExportButtons();
  init();
});

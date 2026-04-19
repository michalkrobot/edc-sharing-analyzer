const dom = {
  uploadCsv: document.getElementById("uploadCsv"),
  uploadEanLabels: document.getElementById("uploadEanLabels"),
  eanLabelsStatus: document.getElementById("eanLabelsStatus"),
  rounds: document.getElementById("rounds"),
  maxFails: document.getElementById("maxFails"),
  restarts: document.getElementById("restarts"),
  weightCurrentMonth: document.getElementById("weightCurrentMonth"),
  weightLastYearSameMonth: document.getElementById("weightLastYearSameMonth"),
  weightRecentWeeks: document.getElementById("weightRecentWeeks"),
  weightBaseline: document.getElementById("weightBaseline"),
  historicalWeightsStatus: document.getElementById("historicalWeightsStatus"),
  status: document.getElementById("status"),
  metaSection: document.getElementById("metaSection"),
  summarySection: document.getElementById("summarySection"),
  simulationSection: document.getElementById("simulationSection"),
  sharingSection: document.getElementById("sharingSection"),
  metaFilename: document.getElementById("metaFilename"),
  metaFrom: document.getElementById("metaFrom"),
  metaTo: document.getElementById("metaTo"),
  metaIntervals: document.getElementById("metaIntervals"),
  metaProducers: document.getElementById("metaProducers"),
  metaConsumers: document.getElementById("metaConsumers"),
  producerSummary: document.getElementById("producerSummary"),
  producerSearchInput: document.getElementById("producerSearchInput"),
  producerSearchClear: document.getElementById("producerSearchClear"),
  consumerSummary: document.getElementById("consumerSummary"),
  consumerSearchInput: document.getElementById("consumerSearchInput"),
  consumerSearchClear: document.getElementById("consumerSearchClear"),
  consumerFilterStatus: document.getElementById("consumerFilterStatus"),
  toggleAllConsumersBtn: document.getElementById("toggleAllConsumersBtn"),
  clearProducerFilterBtn: document.getElementById("clearProducerFilterBtn"),
  timeFilterSection: document.getElementById("timeFilterSection"),
  filterDateFrom: document.getElementById("filterDateFrom"),
  filterDateTo: document.getElementById("filterDateTo"),
  timeThermometerFrom: document.getElementById("timeThermometerFrom"),
  timeThermometerTo: document.getElementById("timeThermometerTo"),
  timeThermometerFill: document.getElementById("timeThermometerFill"),
  timeThermometerMinLabel: document.getElementById("timeThermometerMinLabel"),
  timeThermometerMaxLabel: document.getElementById("timeThermometerMaxLabel"),
  timeFilterResetBtn: document.getElementById("timeFilterResetBtn"),
  timeFilterInfo: document.getElementById("timeFilterInfo"),
  timePresetSelect: document.getElementById("timePresetSelect"),
  timePresetApplyBtn: document.getElementById("timePresetApplyBtn"),
  presetThisMonthBtn: document.getElementById("presetThisMonthBtn"),
  presetLastMonthBtn: document.getElementById("presetLastMonthBtn"),
  allocationsTable: document.getElementById("allocationsTable"),
  methodologyMatrix: document.getElementById("methodologyMatrix"),
  methodologyPriorityMatrix: document.getElementById("methodologyPriorityMatrix"),
  consumerProducerRecommendations: document.getElementById("consumerProducerRecommendations"),
  simulationResult: document.getElementById("simulationResult"),
  producerConsumerMatrix: document.getElementById("producerConsumerMatrix"),
  consumerChart: document.getElementById("consumerChart"),
  producerChart: document.getElementById("producerChart"),
  timelineChart: document.getElementById("timelineChart"),
  simulateBtn: document.getElementById("simulateBtn"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  exportBtn: document.getElementById("exportBtn"),
  exportReadableBtn: document.getElementById("exportReadableBtn"),
  optProgress: document.getElementById("optProgress"),
};

const pageMode = document.body.dataset.page || "simulation";
const isSharingLikePage = pageMode === "sharing" || pageMode === "member-sharing" || pageMode === "enerkom-report";
const isMemberSharingPage = pageMode === "member-sharing";

// Pre-fill date filters with current calendar month for server-backed pages
if (isSharingLikePage) {
  const _now = new Date();
  const _from = new Date(_now.getFullYear(), _now.getMonth(), 1, 0, 0, 0, 0);
  const _to   = new Date(_now.getFullYear(), _now.getMonth() + 1, 1, 0, 0, 0, 0);
  const _pad = (n) => String(n).padStart(2, "0");
  const _fmt = (d) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}T${_pad(d.getHours())}:${_pad(d.getMinutes())}`;
  if (dom.filterDateFrom) dom.filterDateFrom.value = _fmt(_from);
  if (dom.filterDateTo)   dom.filterDateTo.value   = _fmt(_to);
}

const DEFAULT_EAN_LABELS = {
  "859182400501380873": "Janderka RD Benkov spotr.",
  "859182400501396331": "Winter - dilna",
  "859182400501396386": "Winter - garaz",
  "859182400501456943": "Zabreh kulturak spotr.",
  "859182400501458299": "3. ZS jidelna",
  "859182400501460193": "4. ZS Krasohled skola",
  "859182400501460209": "4. ZS Krasohled jidelna",
  "859182400501730869": "Krobot Michal - spotrebni",
  "859182400501861662": "Sinclova",
  "859182400501861747": "Krobot Pavel spotr.",
  "859182400501881578": "Obec Rovensko - spotrebni",
  "859182400501881622": "Rovensko - REPO spotr.",
  "859182400501881639": "Rovensko Orlovna spotr.",
  "859182400501881684": "Rovensko ZS spotrebni",
  "859182400509457034": "Zabreh urad nam. Osv. spotr.",
  "859182400509511514": "Eko servis bazen spotr.",
  "859182400510239605": "Vlk Rovensko",
  "859182400510322161": "Rihanek spotr.",
  "859182400510423738": "Sojak spotr.",
  "859182400510924075": "Rovensko - cerp.stanice 1 spotr.",
  "859182400510924082": "Rovensko - cerp.stanice 2 spotr.",
  "859182400511130789": "Zabreh urad Masar.nam. spotr.",
  "859182400511210511": "Cepa - spotrebni",
  "859182400511548782": "Zabreh MS Zahradni",
  "859182400511739203": "Blahacek spotreba",
  "859182400512098125": "Winter kravin",
  "859182400512098132": "Winter - Jatka",
  "859182400512302833": "ZS Rovensko - vyrobna",
  "859182400512532391": "Blahacek - vyrobna",
  "859182400512619580": "Sojak vyrob.",
  "859182400512624690": "ObU M. Morava vyrobna",
  "859182400512643837": "Krobot Michal - vyrobni",
  "859182400512686490": "Janderka RD Benkov vyrob.",
  "859182400512785629": "Cepa - vyrobna",
  "859182400512843411": "Rihanek vyrob.",
  "859182400512895465": "Rovensko ObU - vyrobni",
  "859182400512934638": "ZS Olsany vyrobna",
  "859182400512934645": "ObU Olsany vyrobna",
  "859182400513112608": "Sirkovsky vyrobna",
};

let gData = null;
let gFilteredData = null;
let gLastResult = null;
let gHistoricalModel = null;
let gHistoricalWeights = null;
let gEanLabelMap = new Map(Object.entries(DEFAULT_EAN_LABELS));
let gSelectedProducerName = null;
let gMemberScope = null;
let gExpandedConsumerNames = new Set();
let gExpandedProducerNames = new Set();
let gProducerSearch = "";
let gConsumerSearch = "";
let gProducerSort = { key: "shared", direction: "desc" };
let gConsumerSort = { key: "shared", direction: "desc" };
const gChartInstances = new WeakMap();
const gChartSet = new Set();
let gGlobalResizeBound = false;
const ECHART_THEME = {
  textColor: "#20301e",
  axisColor: "#ced8c9",
  splitLine: "#dce5d8",
  softSplitLine: "#eef3ea",
  tooltipBg: "rgba(31, 42, 29, 0.95)",
  tooltipBorder: "rgba(159, 230, 211, 0.25)",
  palette: ["#6f9fcf", "#76b7aa", "#d5b06e", "#e58b8b", "#9f8fd0", "#80b8d6"],
};

const EXECUTIVE_COLOR_PAIRS = [
  ["#8bb7df", "#5f8fbe"],
  ["#92cec1", "#5ea99b"],
  ["#f1cd92", "#c8a063"],
  ["#b9c6d6", "#8498ae"],
  ["#d0c5ef", "#9c8bc9"],
  ["#9dcfe8", "#6ea8ca"],
  ["#c6dca5", "#96b876"],
  ["#e8c1ad", "#c9957b"],
  ["#b7c7f3", "#869ed9"],
  ["#aed9cf", "#7fb8ad"],
  ["#e2c2b3", "#ba9484"],
  ["#c8d0dd", "#95a4b8"],
];

function makeExecutiveGradient(topColor, bottomColor) {
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: topColor },
      { offset: 1, color: bottomColor },
    ],
  };
}

function getExecutiveColorPair(index) {
  return EXECUTIVE_COLOR_PAIRS[index % EXECUTIVE_COLOR_PAIRS.length];
}

function getExecutiveSolidColor(index) {
  return getExecutiveColorPair(index)[1];
}

function getEcharts() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.echarts || null;
}

function ensureEchartsResizeBinding() {
  if (gGlobalResizeBound) {
    return;
  }

  window.addEventListener("resize", () => {
    for (const chart of gChartSet) {
      if (!chart.isDisposed()) {
        chart.resize();
      }
    }
  });
  gGlobalResizeBound = true;
}

function destroyChartForElement(element) {
  const echarts = getEcharts();
  if (!echarts || !element) {
    return;
  }

  const existing = gChartInstances.get(element) || echarts.getInstanceByDom(element);
  if (existing) {
    gChartSet.delete(existing);
    existing.dispose();
    gChartInstances.delete(element);
  }
}

function createChartForCanvas(canvas, option) {
  const echarts = getEcharts();
  if (!echarts || !canvas) {
    return null;
  }

  destroyChartForElement(canvas);

  const chart = echarts.init(canvas, null, {
    renderer: "canvas",
    useDirtyRect: true,
  });
  chart.setOption(option, true);
  ensureEchartsResizeBinding();
  gChartInstances.set(canvas, chart);
  gChartSet.add(chart);
  return chart;
}

function buildEchartTooltip() {
  return {
    trigger: "axis",
    backgroundColor: ECHART_THEME.tooltipBg,
    borderColor: ECHART_THEME.tooltipBorder,
    textStyle: {
      color: "#ffffff",
      fontFamily: "Space Grotesk, sans-serif",
    },
  };
}

function withEchartTheme(option) {
  return {
    animationDuration: 450,
    animationEasing: "cubicOut",
    color: ECHART_THEME.palette,
    textStyle: {
      fontFamily: "Space Grotesk, sans-serif",
      color: ECHART_THEME.textColor,
    },
    ...option,
  };
}

function parseSemicolonCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ";" && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }

  out.push(current);
  return out;
}

function normalizeEan(value) {
  return String(value || "").replace(/\D/g, "");
}

function displayEan(ean) {
  const key = normalizeEan(ean);
  const label = gEanLabelMap.get(key);
  return label ? `${label} (${ean})` : ean;
}

function makeSortableHeader(columns, sortState, tableName) {
  const cells = columns.map((column) => {
    const isActive = sortState.key === column.key;
    const indicator = isActive ? (sortState.direction === "desc" ? "↓" : "↑") : "↕";
    const eanClass = column.key === "label" ? " ean" : "";
    return `<th class='sortable-header${eanClass}' data-sort-table='${tableName}' data-sort-key='${column.key}'>${column.label}<span class='sort-indicator'>${indicator}</span></th>`;
  });
  return `<thead><tr>${cells.join("")}</tr></thead>`;
}

function compareValues(a, b, direction) {
  if (typeof a === "string" || typeof b === "string") {
    const result = String(a).localeCompare(String(b), "cs");
    return direction === "asc" ? result : -result;
  }
  const result = Number(a) - Number(b);
  return direction === "asc" ? result : -result;
}

function toggleSort(sortState, key) {
  if (sortState.key === key) {
    sortState.direction = sortState.direction === "desc" ? "asc" : "desc";
  } else {
    sortState.key = key;
    sortState.direction = "desc";
  }
}

function matchesSummarySearch(ean, query) {
  if (!query) {
    return true;
  }
  const display = displayEan(ean).toLowerCase();
  const normalizedQuery = query.toLowerCase();
  return display.includes(normalizedQuery) || normalizeEan(ean).includes(normalizeEan(query));
}

function buildEanLabelMapFromText(csvText) {
  const map = new Map();
  const lines = csvText.replaceAll("\r\n", "\n").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return map;
  }

  const header = parseSemicolonCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const eanIndex = header.indexOf("ean");
  const aliasIndex = header.indexOf("alias");
  const memberNameIndex = header.indexOf("jmeno clena");

  if (eanIndex < 0) {
    return map;
  }

  for (let i = 1; i < lines.length; i += 1) {
    const parts = parseSemicolonCsvLine(lines[i]);
    const ean = normalizeEan(parts[eanIndex]);
    if (!ean) {
      continue;
    }

    const alias = aliasIndex >= 0 ? String(parts[aliasIndex] || "").trim() : "";
    const member = memberNameIndex >= 0 ? String(parts[memberNameIndex] || "").trim() : "";
    const chosen = alias || member;
    if (chosen) {
      map.set(ean, chosen);
    }
  }

  return map;
}

const EAN_LABELS_STORE = "eanLabelsStore";
const EAN_LABELS_DB = "edc-app-db";
const EAN_LABELS_TABLE = "customEanLabels";

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EAN_LABELS_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(EAN_LABELS_TABLE)) {
        db.createObjectStore(EAN_LABELS_TABLE);
      }
    };
  });
}

async function saveEanLabelsToDb(mapData) {
  try {
    const db = await openIndexedDb();
    const tx = db.transaction(EAN_LABELS_TABLE, "readwrite");
    const store = tx.objectStore(EAN_LABELS_TABLE);
    const entries = Array.from(mapData.entries());
    await new Promise((resolve, reject) => {
      store.clear();
      let count = 0;
      for (const [ean, label] of entries) {
        const req = store.put({ ean, label }, ean);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          count += 1;
          if (count === entries.length) resolve();
        };
      }
      if (entries.length === 0) resolve();
    });
  } catch (err) {
    console.warn("Failed to save EAN labels to IndexedDB:", err);
  }
}

async function loadEanLabelsFromDb() {
  try {
    const db = await openIndexedDb();
    const tx = db.transaction(EAN_LABELS_TABLE, "readonly");
    const store = tx.objectStore(EAN_LABELS_TABLE);
    const entries = [];
    await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const records = request.result;
        for (const record of records) {
          if (record && record.ean && record.label) {
            entries.push([record.ean, record.label]);
          }
        }
        resolve();
      };
    });
    return new Map(entries);
  } catch (err) {
    console.warn("Failed to load EAN labels from IndexedDB:", err);
    return new Map();
  }
}

async function loadEanLabelMap() {
  if (isMemberSharingPage) {
    gEanLabelMap = new Map();
    updateEanLabelsStatus();
    return;
  }

  try {
    const resp = await fetch("eany.csv", { cache: "no-store" });
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      let csvText = "";
      try {
        csvText = new TextDecoder("windows-1250").decode(buffer);
      } catch {
        csvText = new TextDecoder("utf-8").decode(buffer);
      }
      const loadedMap = buildEanLabelMapFromText(csvText);
      if (loadedMap.size > 0) {
        gEanLabelMap = new Map([...gEanLabelMap, ...loadedMap]);
      }
    }
  } catch {
    // Pri otevreni pres file:// muze fetch failnout; pak zustane fallback na surove EAN.
  }

  const dbMap = await loadEanLabelsFromDb();
  if (dbMap.size > 0) {
    gEanLabelMap = new Map([...gEanLabelMap, ...dbMap]);
  }

  updateEanLabelsStatus();
}

function updateEanLabelsStatus() {
  if (dom.eanLabelsStatus) {
    dom.eanLabelsStatus.textContent = `EAN databáze: ${gEanLabelMap.size} pojmenovaných EAN`;
  }
}

const gEanLabelMapReady = loadEanLabelMap();

async function handleEanLabelsUpload(file) {
  try {
    const text = await readFileAsText(file);
    const uploadedMap = buildEanLabelMapFromText(text);
    
    if (uploadedMap.size === 0) {
      if (dom.eanLabelsStatus) {
        dom.eanLabelsStatus.textContent = "⚠ Soubor neobsahuje platné EAN data. Formát musí být: EAN;alias;jmeno clena";
        dom.eanLabelsStatus.style.color = "#c2410c";
      }
      return;
    }

    gEanLabelMap = new Map([...gEanLabelMap, ...uploadedMap]);
    
    await saveEanLabelsToDb(gEanLabelMap);
    
    updateEanLabelsStatus();
    
    if (dom.eanLabelsStatus) {
      dom.eanLabelsStatus.textContent = `✓ Přidáno ${uploadedMap.size} EAN. Databáze: ${gEanLabelMap.size} pojmenovaných EAN`;
      dom.eanLabelsStatus.style.color = "#15803d";
      setTimeout(() => {
        if (dom.eanLabelsStatus) {
          updateEanLabelsStatus();
          dom.eanLabelsStatus.style.color = "#5f6d5c";
        }
      }, 3500);
    }

    if (gData) {
      renderSummary(gData);
      if (isSharingLikePage) {
        renderCurrentView();
      }
    }
  } catch (err) {
    if (dom.eanLabelsStatus) {
      dom.eanLabelsStatus.textContent = `✗ Chyba: ${err instanceof Error ? err.message : String(err)}`;
      dom.eanLabelsStatus.style.color = "#c2410c";
    }
  }
}

if (dom.uploadEanLabels) {
  dom.uploadEanLabels.addEventListener("change", async () => {
    const file = dom.uploadEanLabels.files && dom.uploadEanLabels.files[0];
    if (!file) {
      return;
    }
    await gEanLabelMapReady;
    await handleEanLabelsUpload(file);
    dom.uploadEanLabels.value = "";
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sum(values) {
  return values.reduce((acc, v) => acc + v, 0);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function parseKwh(input) {
  if (!input || input.trim() === "") {
    return 0;
  }
  const parsed = Number.parseFloat(input.replaceAll(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(parts) {
  const dateParts = parts[0].split(".");
  const timeParts = parts[1].split(":");
  assert(dateParts.length === 3 && timeParts.length === 2, "Neplatné datum/čas v CSV.");
  const day = Number.parseInt(dateParts[0], 10);
  const month = Number.parseInt(dateParts[1], 10) - 1;
  const year = Number.parseInt(dateParts[2], 10);
  const hour = Number.parseInt(timeParts[0], 10);
  const minute = Number.parseInt(timeParts[1], 10);
  return new Date(year, month, day, hour, minute, 0, 0);
}

function printDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDatetimeLocalValue(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function ensureAllocationSourceSection() {
  if (!(pageMode === "sharing" || pageMode === "member-sharing" || pageMode === "simulation")) {
    return null;
  }

  let section = document.getElementById("allocationSourceSection");
  if (section) {
    return section;
  }

  const summarySection = document.getElementById("summarySection");
  const appShell = document.querySelector(".app-shell");
  if (!summarySection || !appShell) {
    return null;
  }

  section = document.createElement("section");
  section.id = "allocationSourceSection";
  section.className = "card allocation-source-card";
  section.hidden = true;
  //section.innerHTML = "<div class='allocation-source-head'><h2>Zdroj toku sdílení</h2><span id='allocationSourceBadge' class='allocation-source-badge'></span></div><p id='allocationSourceText' class='allocation-source-text'></p>";
  section.innerHTML = "";
  appShell.insertBefore(section, summarySection);
  return section;
}

function getRequestedAllocationMode() {
  if (window.edcAuth && typeof window.edcAuth.getSharingFlowMode === "function") {
    const mode = window.edcAuth.getSharingFlowMode();
    if (mode === "exact" || mode === "estimate") {
      return mode;
    }
  }
  return "auto";
}

function getAllocationModeInfo(data) {
  const hasExactAllocations = Boolean(data && data.hasExactAllocations);
  const requestedMode = getRequestedAllocationMode();

  if (requestedMode === "estimate") {
    return {
      effectiveMode: "estimate",
      badge: "Odhad",
      badgeClass: "is-estimate",
      description: hasExactAllocations
        ? "Tenant admin vynutil odhad. Přesné vazby jsou nahrané, ale v tomto zobrazení se nepoužívají."
        : "Přesné vazby nejsou aktivní, rozpad toku sdílení se počítá odhadem z agregovaných hodnot.",
    };
  }

  if (requestedMode === "exact") {
    if (hasExactAllocations) {
      return {
        effectiveMode: "exact",
        badge: "Přesná data",
        badgeClass: "is-exact",
        description: "Tenant admin vynutil použití přesných vazeb výrobna → odběr z nahraného šipkového souboru.",
      };
    }

    return {
      effectiveMode: "estimate",
      badge: "Chybí přesná data",
      badgeClass: "is-warning",
      description: "Tenant admin požaduje přesná data, ale pro tento tenant zatím nejsou nahrané přesné vazby. Aplikace proto dočasně používá odhad.",
    };
  }

  if (hasExactAllocations) {
    return {
      effectiveMode: "exact",
      badge: "Přesná data",
      badgeClass: "is-exact",
      description: "Aplikace automaticky používá přesné vazby výrobna → odběr z nahraného šipkového souboru.",
    };
  }

  return {
    effectiveMode: "estimate",
    badge: "Odhad",
    badgeClass: "is-estimate",
    description: "Přesné vazby nejsou nahrané, proto aplikace automaticky používá odhad toku sdílení z agregovaných hodnot.",
  };
}

function renderAllocationSourceInfo(data) {
  if (pageMode === "enerkom-report") {
    return;
  }

  const section = ensureAllocationSourceSection();
  if (!section) {
    return;
  }

  if (!data) {
    section.hidden = true;
    return;
  }

  const badge = document.getElementById("allocationSourceBadge");
  const text = document.getElementById("allocationSourceText");
  if (!badge || !text) {
    return;
  }

  const modeInfo = getAllocationModeInfo(data);
  badge.className = `allocation-source-badge ${modeInfo.badgeClass}`;
  badge.textContent = modeInfo.badge;
  text.textContent = modeInfo.description;
  section.hidden = false;
}

function getActiveData() {
  return gFilteredData || gData;
}

function buildFilteredData(sourceData, fromDate, toDate) {
  const filteredIntervals = sourceData.intervals.filter((interval) => interval.start >= fromDate && interval.start <= toDate);

  if (filteredIntervals.length === 0) {
    return {
      ...sourceData,
      intervals: [],
      dateFrom: new Date(fromDate.getTime()),
      dateTo: new Date(toDate.getTime()),
    };
  }

  return {
    ...sourceData,
    intervals: filteredIntervals,
    dateFrom: filteredIntervals[0].start,
    dateTo: new Date(filteredIntervals[filteredIntervals.length - 1].start.getTime() + 15 * 60000),
  };
}

function parseCsv(content, filename) {
  const lines = content.replaceAll("\r\n", "\n").split("\n").filter((line) => line.trim().length > 0);
  assert(lines.length > 1, "CSV je prázdné nebo neobsahuje data.");

  const header = lines[0].split(";");
  assert(header[0] === "Datum" && header[1] === "Cas od" && header[2] === "Cas do", "Neplatná CSV hlavička.");

  const producers = [];
  const consumers = [];

  for (let i = 3; i < header.length - 1; i += 2) {
    const before = header[i].trim();
    const after = header[i + 1].trim();
    if (!before || !after) {
      continue;
    }
    assert(before.startsWith("IN-") && after.startsWith("OUT-"), `Neplatný pár sloupců: ${before}, ${after}`);
    const beforeId = before.substring(3, before.length - 2);
    const afterId = after.substring(4, after.length - 2);
    assert(beforeId === afterId, `Neshoda IN/OUT EAN: ${before} vs ${after}`);

    const kindSuffix = before.slice(-2);
    if (kindSuffix === "-D") {
      producers.push({ name: beforeId, csvIndex: i });
    } else if (kindSuffix === "-O") {
      consumers.push({ name: beforeId, csvIndex: i });
    }
  }

  assert(producers.length > 0, "CSV neobsahuje výrobní EAN (-D).");
  assert(consumers.length > 0, "CSV neobsahuje odběrné EAN (-O).");

  producers.sort((a, b) => a.name.localeCompare(b.name));
  consumers.sort((a, b) => a.name.localeCompare(b.name));

  const intervals = [];

  for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
    const parts = lines[lineNo].split(";");
    if (parts.length < 3) {
      continue;
    }
    const start = parseDate(parts);

    const intervalProducers = [];
    const intervalConsumers = [];

    for (const p of producers) {
      let before = parseKwh(parts[p.csvIndex]);
      let after = parseKwh(parts[p.csvIndex + 1]);
      before = Math.max(0, before);
      after = clamp(after, 0, before);
      intervalProducers.push({ before, after, missed: 0 });
    }

    for (const c of consumers) {
      let before = -parseKwh(parts[c.csvIndex]);
      let after = -parseKwh(parts[c.csvIndex + 1]);
      before = Math.max(0, before);
      after = clamp(after, 0, before);
      intervalConsumers.push({ before, after, missed: 0 });
    }

    const sumProductionBefore = sum(intervalProducers.map((m) => m.before));
    const sumProductionAfter = sum(intervalProducers.map((m) => m.after));
    const sumConsumeBefore = sum(intervalConsumers.map((m) => m.before));
    const sumConsumeAfter = sum(intervalConsumers.map((m) => m.after));

    const sharedByProducers = Math.max(0, sumProductionBefore - sumProductionAfter);
    const sharedByConsumers = Math.max(0, sumConsumeBefore - sumConsumeAfter);
    const shared = Math.min(sharedByProducers, sharedByConsumers);

    const leftoverProduction = sumProductionAfter;
    const unmetConsumption = sumConsumeAfter;
    const missedTotal = leftoverProduction > 0.01 && unmetConsumption > 0.01 ? Math.min(leftoverProduction, unmetConsumption) : 0;

    if (missedTotal > 0) {
      if (leftoverProduction > 0) {
        for (const m of intervalProducers) {
          m.missed = (m.after / leftoverProduction) * missedTotal;
        }
      }
      if (unmetConsumption > 0) {
        for (const m of intervalConsumers) {
          m.missed = (m.after / unmetConsumption) * missedTotal;
        }
      }
    }

    intervals.push({
      start,
      producers: intervalProducers,
      consumers: intervalConsumers,
      sumProduction: sumProductionBefore,
      sumSharing: shared,
      sumMissed: missedTotal,
    });
  }

  assert(intervals.length > 0, "CSV neobsahuje platné intervaly.");

  const from = intervals[0].start;
  const to = new Date(intervals[intervals.length - 1].start.getTime() + 15 * 60000);

  return {
    filename,
    producers,
    consumers,
    intervals,
    dateFrom: from,
    dateTo: to,
  };
}

function aggregateSummary(data) {
  const producerStats = data.producers.map((p) => ({
    name: p.name,
    before: 0,
    after: 0,
    missed: 0,
  }));
  const consumerStats = data.consumers.map((c) => ({
    name: c.name,
    before: 0,
    after: 0,
    missed: 0,
  }));

  for (const interval of data.intervals) {
    for (let i = 0; i < interval.producers.length; i += 1) {
      producerStats[i].before += interval.producers[i].before;
      producerStats[i].after += interval.producers[i].after;
      producerStats[i].missed += interval.producers[i].missed;
    }
    for (let i = 0; i < interval.consumers.length; i += 1) {
      consumerStats[i].before += interval.consumers[i].before;
      consumerStats[i].after += interval.consumers[i].after;
      consumerStats[i].missed += interval.consumers[i].missed;
    }
  }

  return { producerStats, consumerStats };
}

function fmt(n) {
  return `${n.toFixed(2)} kWh`;
}

function fmtNum(n) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function getMemberOwnedProducerCount() {
  if (!isMemberSharingPage || !gMemberScope || !Array.isArray(gMemberScope.ownProducers)) {
    return 0;
  }
  return gMemberScope.ownProducers.length;
}

function getMemberOwnedConsumerCount() {
  if (!isMemberSharingPage || !gMemberScope || !Array.isArray(gMemberScope.ownConsumers)) {
    return 0;
  }
  return gMemberScope.ownConsumers.length;
}

function renderMeta(data) {
  if (!dom.metaSection) {
    return;
  }

  dom.metaSection.hidden = false;
  if (dom.metaFilename) {
    dom.metaFilename.textContent = data.filename;
  }
  if (dom.metaFrom) {
    dom.metaFrom.textContent = printDate(data.dateFrom);
  }
  if (dom.metaTo) {
    dom.metaTo.textContent = printDate(data.dateTo);
  }
  if (dom.metaIntervals) {
    dom.metaIntervals.textContent = String(data.intervals.length);
  }
  if (dom.metaProducers) {
    dom.metaProducers.textContent = String(data.producers.length);
  }
  if (dom.metaConsumers) {
    dom.metaConsumers.textContent = String(data.consumers.length);
  }
}

function renderSummary(data) {
  if (!dom.summarySection) {
    return;
  }
  const { producerStats, consumerStats } = aggregateSummary(data);
  const ownProducerSet = isMemberSharingPage && gMemberScope && Array.isArray(gMemberScope.ownProducers)
    ? new Set(gMemberScope.ownProducers)
    : null;
  const ownConsumerSet = isMemberSharingPage && gMemberScope && Array.isArray(gMemberScope.ownConsumers)
    ? new Set(gMemberScope.ownConsumers)
    : null;
  const producerAllocations = computeProducerConsumerAllocations(data);
  const selectedProducerAllocations = isSharingLikePage && gSelectedProducerName
    ? producerAllocations.find((producer) => producer.name === gSelectedProducerName) || null
    : null;
  const consumerBreakdownMap = new Map();
  const producerConsumerBreakdownMap = new Map();
  for (const producer of producerAllocations) {
    for (const allocation of producer.consumerAllocations) {
      if (allocation.shared <= 0.001) {
        continue;
      }
      const breakdown = consumerBreakdownMap.get(allocation.name) || [];
      breakdown.push({ producerName: producer.name, shared: allocation.shared });
      consumerBreakdownMap.set(allocation.name, breakdown);
      const producerBreakdown = producerConsumerBreakdownMap.get(producer.name) || [];
      producerBreakdown.push({ consumerName: allocation.name, shared: allocation.shared });
      producerConsumerBreakdownMap.set(producer.name, producerBreakdown);
    }
  }
  consumerBreakdownMap.forEach((breakdown) => {
    breakdown.sort((a, b) => b.shared - a.shared);
  });
  producerConsumerBreakdownMap.forEach((breakdown) => {
    breakdown.sort((a, b) => b.shared - a.shared);
  });
  const producerConsumerShareMap = new Map(
    producerAllocations.map((producer) => [
      producer.name,
      new Map(
        producer.consumerAllocations
          .filter((allocation) => allocation.shared > 0.001)
          .map((allocation) => [allocation.name, allocation.shared])
      ),
    ])
  );

  if (gSelectedProducerName && !producerConsumerShareMap.has(gSelectedProducerName)) {
    gSelectedProducerName = null;
  }

  dom.summarySection.hidden = false;

  dom.producerSummary.innerHTML = makeSortableHeader([
    { key: "label", label: "EAN" },
    { key: "before", label: "Výroba před" },
    { key: "after", label: "Po sdílení" },
    { key: "shared", label: "Sdíleno" },
    { key: "missed", label: "Ušlá příležitost" },
  ], gProducerSort, "producer");
  const pBody = document.createElement("tbody");
  const visibleProducers = producerStats
    .map((producer) => ({
      ...producer,
      label: displayEan(producer.name),
      shared: Math.max(0, producer.before - producer.after),
    }))
    .filter((producer) => !ownProducerSet || ownProducerSet.has(producer.name))
    .filter((producer) => matchesSummarySearch(producer.name, gProducerSearch))
    .sort((a, b) => compareValues(a[gProducerSort.key], b[gProducerSort.key], gProducerSort.direction));

  const visibleProducerNames = new Set(visibleProducers.map((producer) => producer.name));
  gExpandedProducerNames = new Set([...gExpandedProducerNames].filter((name) => visibleProducerNames.has(name)));

  for (const p of visibleProducers) {
    const sharedValue = p.shared;
    const isExpanded = gExpandedProducerNames.has(p.name);
    const breakdown = producerConsumerBreakdownMap.get(p.name) || [];
    const breakdownTotal = breakdown.reduce((sumValue, item) => sumValue + item.shared, 0);

    const tr = document.createElement("tr");
    tr.className = "interactive-row";
    tr.dataset.producerName = p.name;
    if (isExpanded) {
      tr.classList.add("is-selected");
    }
    tr.innerHTML =
      `<td class='ean'><div class='producer-main-cell'><button type='button' class='row-toggle' aria-expanded='${isExpanded ? "true" : "false"}'>${isExpanded ? "−" : "+"}</button><span>${p.label}</span></div></td><td>${fmt(p.before)}</td><td>${fmt(p.after)}</td><td>${fmt(sharedValue)}</td><td>${fmt(p.missed)}</td>`;
    pBody.appendChild(tr);

    if (isExpanded) {
      const detailRow = document.createElement("tr");
      detailRow.className = "producer-detail-row";
      const detailCell = document.createElement("td");
      detailCell.className = "ean";
      detailCell.colSpan = 5;

      const breakdownBars = breakdown.length === 0
        ? "<div class='producer-breakdown-empty'>Tato výrobna nemá žádné sdílení pro odběry.</div>"
        : breakdown
          .map((item) => {
            const percentage = breakdownTotal > 0 ? (item.shared / breakdownTotal) * 100 : 0;
            return `
              <div class='producer-breakdown-bar-row'>
                <div class='producer-breakdown-bar-label'>${displayEan(item.consumerName)}</div>
                <div class='producer-breakdown-bar-track'>
                  <div class='producer-breakdown-bar-fill' style='width: ${percentage.toFixed(1)}%'></div>
                </div>
                <div class='producer-breakdown-bar-value'>${percentage.toFixed(1)} % | ${fmt(item.shared)}</div>
              </div>`;
          })
          .join("");

      detailCell.innerHTML = `
        <div class='producer-breakdown'>
          <div class='producer-breakdown-header'>
            <strong>Rozpad sdílení výrobny ${displayEan(p.name)}</strong>
            <span>Celkem sdíleno: ${fmt(Math.max(0, p.before - p.after))}</span>
          </div>
          <div class='producer-breakdown-bars'>${breakdownBars}</div>
        </div>`;
      detailRow.appendChild(detailCell);
      pBody.appendChild(detailRow);
    }
  }
  if (visibleProducers.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = "<td class='ean' colspan='5'>Žádný výrobní EAN neodpovídá hledání.</td>";
    pBody.appendChild(emptyRow);
  }
  dom.producerSummary.appendChild(pBody);

  dom.consumerSummary.innerHTML = makeSortableHeader([
    { key: "label", label: "EAN" },
    { key: "before", label: "Spotřeba před" },
    { key: "after", label: "Po sdílení" },
    { key: "shared", label: "Sdíleno" },
    { key: "missed", label: "Ušlá příležitost" },
  ], gConsumerSort, "consumer");
  const cBody = document.createElement("tbody");
  const producerConsumerShares = selectedProducerAllocations
    ? producerConsumerShareMap.get(gSelectedProducerName) || new Map()
    : null;
  const baseConsumers = producerConsumerShares
    ? consumerStats
      .filter((consumer) => producerConsumerShares.has(consumer.name))
      .filter((consumer) => !ownConsumerSet || ownConsumerSet.has(consumer.name))
    : (ownConsumerSet ? consumerStats.filter((consumer) => ownConsumerSet.has(consumer.name)) : consumerStats);

  const filteredConsumers = baseConsumers
    .map((consumer) => ({
      ...consumer,
      label: displayEan(consumer.name),
      shared: producerConsumerShares ? (producerConsumerShares.get(consumer.name) || 0) : Math.max(0, consumer.before - consumer.after),
    }))
    .filter((consumer) => matchesSummarySearch(consumer.name, gConsumerSearch))
    .sort((a, b) => compareValues(a[gConsumerSort.key], b[gConsumerSort.key], gConsumerSort.direction));

  const visibleConsumerNames = new Set(filteredConsumers.map((consumer) => consumer.name));
  gExpandedConsumerNames = new Set([...gExpandedConsumerNames].filter((name) => visibleConsumerNames.has(name)));
  const allVisibleExpanded = filteredConsumers.length > 0 && filteredConsumers.every((consumer) => gExpandedConsumerNames.has(consumer.name));

  for (const c of filteredConsumers) {
    const sharedValue = c.shared;
    const isExpanded = gExpandedConsumerNames.has(c.name);
    const breakdown = consumerBreakdownMap.get(c.name) || [];
    const breakdownTotal = breakdown.reduce((sumValue, item) => sumValue + item.shared, 0);

    const tr = document.createElement("tr");
    tr.className = "interactive-row";
    tr.dataset.consumerName = c.name;
    if (isExpanded) {
      tr.classList.add("is-selected");
    }
    tr.innerHTML =
      `<td class='ean'><div class='consumer-main-cell'><button type='button' class='row-toggle' aria-expanded='${isExpanded ? "true" : "false"}'>${isExpanded ? "−" : "+"}</button><span>${c.label}</span></div></td><td>${fmt(c.before)}</td><td>${fmt(c.after)}</td><td>${fmt(sharedValue)}</td><td>${fmt(c.missed)}</td>`;
    cBody.appendChild(tr);

    if (isExpanded) {
      const detailRow = document.createElement("tr");
      detailRow.className = "consumer-detail-row";
      const detailCell = document.createElement("td");
      detailCell.className = "ean";
      detailCell.colSpan = 5;

      const breakdownBars = breakdown.length === 0
        ? "<div class='consumer-breakdown-empty'>K tomuto odběrnému EAN nebylo nalezeno žádné sdílení od výroben.</div>"
        : breakdown
          .map((item) => {
            const percentage = breakdownTotal > 0 ? (item.shared / breakdownTotal) * 100 : 0;
            const highlighted = gSelectedProducerName && item.producerName === gSelectedProducerName ? " is-highlighted" : "";
            return `
              <div class='consumer-breakdown-bar-row${highlighted}'>
                <div class='consumer-breakdown-bar-label'>${displayEan(item.producerName)}</div>
                <div class='consumer-breakdown-bar-track'>
                  <div class='consumer-breakdown-bar-fill' style='width: ${percentage.toFixed(1)}%'></div>
                </div>
                <div class='consumer-breakdown-bar-value'>${percentage.toFixed(1)} % | ${fmt(item.shared)}</div>
              </div>`;
          })
          .join("");

      detailCell.innerHTML = `
        <div class='consumer-breakdown'>
          <div class='consumer-breakdown-header'>
            <strong>Rozpad sdílení pro ${displayEan(c.name)}</strong>
            <span>Celkem sdíleno: ${fmt(Math.max(0, c.before - c.after))}</span>
          </div>
          <div class='consumer-breakdown-bars'>${breakdownBars}</div>
        </div>`;
      detailRow.appendChild(detailCell);
      cBody.appendChild(detailRow);
    }
  }
  if (filteredConsumers.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = "<td class='ean' colspan='5'>Žádný odběrný EAN neodpovídá zvolenému filtru nebo hledání.</td>";
    cBody.appendChild(emptyRow);
  }
  dom.consumerSummary.appendChild(cBody);

  if (dom.consumerFilterStatus) {
    dom.consumerFilterStatus.textContent = gSelectedProducerName
      ? `Filtr odběrných EAN pro výrobnu: ${displayEan(gSelectedProducerName)}`
      : (isMemberSharingPage ? "Zobrazeny jsou tvoje odběrné EAN." : "Zobrazeny jsou všechny odběrné EAN.");
  }
  if (dom.clearProducerFilterBtn) {
    dom.clearProducerFilterBtn.hidden = !gSelectedProducerName;
  }
  if (dom.toggleAllConsumersBtn) {
    dom.toggleAllConsumersBtn.hidden = filteredConsumers.length === 0;
    dom.toggleAllConsumersBtn.textContent = allVisibleExpanded ? "Sbalit vše" : "Rozbalit vše";
  }
}

function renderAllocationInputs(data) {
  if (!dom.simulationSection || !dom.allocationsTable) {
    return;
  }
  dom.simulationSection.hidden = false;
  const historicalModel = getHistoricalSharingModel(data);
  renderMethodologyMatrix(data, historicalModel);
  renderConsumerProducerRecommendations(data, historicalModel);
  dom.allocationsTable.innerHTML =
    "<thead><tr><th class='ean'>Výrobní EAN</th><th>Návrh alokačního klíče výrobna → odběr</th><th>Optimalizovaný klíč výrobna → odběr</th><th>Součet optimalizace [%]</th><th>Souhrn</th></tr></thead>";
  const body = document.createElement("tbody");

  data.producers.forEach((producer, producerIndex) => {
    const baselineRow = Array.isArray(historicalModel.baseAllocations[producerIndex])
      ? historicalModel.baseAllocations[producerIndex]
      : [];
    const baselineSummary = summarizeProducerAllocationRow(baselineRow, data.consumers);
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class='ean'>${displayEan(producer.name)}</td>
       <td class='ean'>${baselineSummary}</td>
       <td id='optimalProducerAlloc_${producerIndex}' class='ean'>-</td>
       <td id='optimalProducerAllocSum_${producerIndex}'>-</td>
       <td id='rowResultProducer_${producerIndex}' class='ean'>-</td>`;
    body.appendChild(tr);
  });

  const noteRow = document.createElement("tr");
  noteRow.innerHTML = "<td class='ean' colspan='5'>Každá výrobna má vlastní alokační klíč na odběrná místa. Součet alokací jedné výrobny je v metodice omezen na max. 100 %.</td>";
  body.appendChild(noteRow);

  dom.allocationsTable.appendChild(body);
}

const METHODOLOGY_MAX_ROUNDS = 5;
const MAX_PRIORITY_LINKS = 5;
const HISTORICAL_WEIGHT_DEFAULTS = {
  currentMonth: 1.1,
  lastYearSameMonth: 2.4,
  recentWeeks: 0.7,
  baseline: 0.2,
};

function toCentiKwh(value) {
  return Math.max(0, Math.floor(((Number(value) || 0) + 1e-9) * 100));
}

function fromCentiKwh(value) {
  return (Number(value) || 0) / 100;
}

function floorPercent(value) {
  return Math.max(0, Math.floor(((Number(value) || 0) + 1e-9) * 100) / 100);
}

function normalizePercentRow(values, maxTotal = 100) {
  const cleaned = values.map((value) => clamp(Number(value) || 0, 0, maxTotal));
  const total = sum(cleaned);
  if (total <= maxTotal + 1e-9) {
    return cleaned.map((value) => floorPercent(value));
  }

  const ratio = maxTotal / total;
  return cleaned.map((value) => floorPercent(value * ratio));
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(2)} %`;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });
}

function sanitizeWeight(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(numeric, 0, 10);
}

function buildWeightsKey(weights) {
  return [weights.currentMonth, weights.lastYearSameMonth, weights.recentWeeks, weights.baseline]
    .map((value) => Number(value).toFixed(3))
    .join("|");
}

function readHistoricalWeightsFromInputs() {
  return {
    currentMonth: sanitizeWeight(dom.weightCurrentMonth && dom.weightCurrentMonth.value, HISTORICAL_WEIGHT_DEFAULTS.currentMonth),
    lastYearSameMonth: sanitizeWeight(dom.weightLastYearSameMonth && dom.weightLastYearSameMonth.value, HISTORICAL_WEIGHT_DEFAULTS.lastYearSameMonth),
    recentWeeks: sanitizeWeight(dom.weightRecentWeeks && dom.weightRecentWeeks.value, HISTORICAL_WEIGHT_DEFAULTS.recentWeeks),
    baseline: sanitizeWeight(dom.weightBaseline && dom.weightBaseline.value, HISTORICAL_WEIGHT_DEFAULTS.baseline),
  };
}

function syncHistoricalWeightsToInputs(weights) {
  if (dom.weightCurrentMonth) {
    dom.weightCurrentMonth.value = String(weights.currentMonth);
  }
  if (dom.weightLastYearSameMonth) {
    dom.weightLastYearSameMonth.value = String(weights.lastYearSameMonth);
  }
  if (dom.weightRecentWeeks) {
    dom.weightRecentWeeks.value = String(weights.recentWeeks);
  }
  if (dom.weightBaseline) {
    dom.weightBaseline.value = String(weights.baseline);
  }
}

function getHistoricalWeights() {
  if (!gHistoricalWeights) {
    gHistoricalWeights = { ...HISTORICAL_WEIGHT_DEFAULTS };
    syncHistoricalWeightsToInputs(gHistoricalWeights);
  }
  return gHistoricalWeights;
}

function setHistoricalWeights(nextWeights) {
  gHistoricalWeights = {
    currentMonth: sanitizeWeight(nextWeights.currentMonth, HISTORICAL_WEIGHT_DEFAULTS.currentMonth),
    lastYearSameMonth: sanitizeWeight(nextWeights.lastYearSameMonth, HISTORICAL_WEIGHT_DEFAULTS.lastYearSameMonth),
    recentWeeks: sanitizeWeight(nextWeights.recentWeeks, HISTORICAL_WEIGHT_DEFAULTS.recentWeeks),
    baseline: sanitizeWeight(nextWeights.baseline, HISTORICAL_WEIGHT_DEFAULTS.baseline),
  };
  syncHistoricalWeightsToInputs(gHistoricalWeights);
  gHistoricalModel = null;
}

function renderHistoricalWeightsStatus(model) {
  if (!dom.historicalWeightsStatus) {
    return;
  }

  const w = model.weights;
  dom.historicalWeightsStatus.textContent = `Aktivní váhy: aktuální měsíc ${w.currentMonth.toFixed(2)} | stejný měsíc loni ${w.lastYearSameMonth.toFixed(2)} | poslední 4 týdny ${w.recentWeeks.toFixed(2)} | ostatní ${w.baseline.toFixed(2)}`;
}

function getMethodologyRoundLimit(data) {
  const sseSize = (Array.isArray(data && data.producers) ? data.producers.length : 0)
    + (Array.isArray(data && data.consumers) ? data.consumers.length : 0);
  if (sseSize > 50) {
    return 1;
  }
  return Math.max(1, Math.min(METHODOLOGY_MAX_ROUNDS, data.consumers.length || 1));
}

function resolveMethodologyRounds(data, requestedRounds) {
  const maxRounds = getMethodologyRoundLimit(data);
  const parsed = Number.parseInt(requestedRounds, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return maxRounds;
  }
  return Math.max(1, Math.min(maxRounds, parsed));
}

function getHistoryReference(intervals) {
  const now = new Date();
  const hasCurrentMonthData = intervals.some((interval) => (
    interval.start.getFullYear() === now.getFullYear()
    && interval.start.getMonth() === now.getMonth()
  ));
  const anchor = hasCurrentMonthData
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : (intervals.length > 0
      ? new Date(intervals[intervals.length - 1].start.getFullYear(), intervals[intervals.length - 1].start.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), 1));
  const hasYearAgoMonthData = intervals.some((interval) => (
    interval.start.getFullYear() === anchor.getFullYear() - 1
    && interval.start.getMonth() === anchor.getMonth()
  ));

  return {
    anchor,
    hasCurrentMonthData,
    hasYearAgoMonthData,
  };
}

function getHistoricalIntervalWeight(start, historyReference, weights) {
  const sameCurrentMonth = start.getFullYear() === historyReference.anchor.getFullYear()
    && start.getMonth() === historyReference.anchor.getMonth();
  if (sameCurrentMonth) {
    return weights.currentMonth;
  }

  const sameMonthLastYear = start.getFullYear() === historyReference.anchor.getFullYear() - 1
    && start.getMonth() === historyReference.anchor.getMonth();
  if (sameMonthLastYear && historyReference.hasYearAgoMonthData) {
    return weights.lastYearSameMonth;
  }

  const dayDiff = Math.abs(historyReference.anchor.getTime() - start.getTime()) / 86400000;
  if (dayDiff <= 28) {
    return weights.recentWeeks;
  }

  return weights.baseline;
}

function buildEstimatedIntervalAllocationMatrix(interval) {
  const producerCount = Array.isArray(interval.producers) ? interval.producers.length : 0;
  const consumerCount = Array.isArray(interval.consumers) ? interval.consumers.length : 0;
  const matrix = Array.from({ length: producerCount }, () => Array(consumerCount).fill(0));
  const totalConsumerReceived = interval.consumers.reduce(
    (sumValue, consumer) => sumValue + Math.max(0, (Number(consumer.before) || 0) - (Number(consumer.after) || 0)),
    0,
  );

  if (totalConsumerReceived < 0.001) {
    return matrix;
  }

  for (let producerIndex = 0; producerIndex < producerCount; producerIndex += 1) {
    const producerShared = Math.max(
      0,
      (Number(interval.producers[producerIndex] && interval.producers[producerIndex].before) || 0)
      - (Number(interval.producers[producerIndex] && interval.producers[producerIndex].after) || 0),
    );
    if (producerShared < 0.001) {
      continue;
    }

    for (let consumerIndex = 0; consumerIndex < consumerCount; consumerIndex += 1) {
      const consumerShared = Math.max(
        0,
        (Number(interval.consumers[consumerIndex] && interval.consumers[consumerIndex].before) || 0)
        - (Number(interval.consumers[consumerIndex] && interval.consumers[consumerIndex].after) || 0),
      );
      if (consumerShared < 0.001) {
        continue;
      }
      matrix[producerIndex][consumerIndex] = producerShared * (consumerShared / totalConsumerReceived);
    }
  }

  return matrix;
}

function getIntervalAllocationMatrix(data, interval) {
  const shouldUseExactAllocations = getAllocationModeInfo(data).effectiveMode === "exact";
  if (shouldUseExactAllocations && Array.isArray(interval.exactAllocations)) {
    return interval.exactAllocations.map((row) => Array.isArray(row)
      ? row.map((value) => Number(value) || 0)
      : Array(data.consumers.length).fill(0));
  }
  return buildEstimatedIntervalAllocationMatrix(interval);
}

function buildHistoricalSharingModel(data) {
  const historyReference = getHistoryReference(data.intervals);
  const weights = getHistoricalWeights();
  const producerCount = data.producers.length;
  const consumerCount = data.consumers.length;
  const weightedPairShared = Array.from({ length: producerCount }, () => Array(consumerCount).fill(0));
  const weightedProducerSupply = Array(producerCount).fill(0);
  const weightedConsumerNeed = Array(consumerCount).fill(0);
  const weightedConsumerShared = Array(consumerCount).fill(0);

  for (const interval of data.intervals) {
    const weight = getHistoricalIntervalWeight(interval.start, historyReference, weights);
    const matrix = getIntervalAllocationMatrix(data, interval);

    for (let producerIndex = 0; producerIndex < producerCount; producerIndex += 1) {
      const producerBefore = Math.max(0, Number(interval.producers[producerIndex] && interval.producers[producerIndex].before) || 0);
      weightedProducerSupply[producerIndex] += producerBefore * weight;

      for (let consumerIndex = 0; consumerIndex < consumerCount; consumerIndex += 1) {
        const shared = Number(matrix[producerIndex] && matrix[producerIndex][consumerIndex]) || 0;
        weightedPairShared[producerIndex][consumerIndex] += shared * weight;
        weightedConsumerShared[consumerIndex] += shared * weight;
      }
    }

    for (let consumerIndex = 0; consumerIndex < consumerCount; consumerIndex += 1) {
      weightedConsumerNeed[consumerIndex] += Math.max(0, Number(interval.consumers[consumerIndex] && interval.consumers[consumerIndex].before) || 0) * weight;
    }
  }

  const consumerNeedDenominator = sum(weightedConsumerNeed);
  const fallbackNeedDistribution = consumerNeedDenominator > 0.001
    ? normalizePercentRow(weightedConsumerNeed.map((value) => (value / consumerNeedDenominator) * 100))
    : normalizePercentRow(Array.from({ length: consumerCount }, () => 100 / Math.max(consumerCount, 1)));

  const baseAllocations = weightedPairShared.map((row, producerIndex) => {
    const baseDenominator = weightedProducerSupply[producerIndex] > 0.001
      ? weightedProducerSupply[producerIndex]
      : row.reduce((sumValue, value) => sumValue + value, 0);
    if (baseDenominator <= 0.001) {
      return fallbackNeedDistribution.slice();
    }
    const normalizedRow = normalizePercentRow(row.map((value) => (value / baseDenominator) * 100));
    if (sum(normalizedRow) <= 0.001) {
      return fallbackNeedDistribution.slice();
    }
    return normalizedRow;
  });

  const suggestedBase = sum(weightedConsumerShared) > 0.001
    ? weightedConsumerShared
    : weightedConsumerNeed;
  const suggestedDenominator = sum(suggestedBase);
  const suggestedAllocations = suggestedDenominator > 0.001
    ? normalizePercentRow(suggestedBase.map((value) => (value / suggestedDenominator) * 100))
    : normalizePercentRow(Array.from({ length: consumerCount }, () => 100 / Math.max(consumerCount, 1)));

  const fallbackProducerOrder = weightedProducerSupply
    .map((value, producerIndex) => ({ producerIndex, value }))
    .sort((a, b) => b.value - a.value)
    .map((item) => item.producerIndex);

  const prioritiesByConsumer = Array.from({ length: consumerCount }, (_unused, consumerIndex) => {
    const ranked = weightedPairShared
      .map((row, producerIndex) => ({
        producerIndex,
        shared: row[consumerIndex],
        allocation: baseAllocations[producerIndex][consumerIndex],
      }))
      .filter((item) => item.shared > 0.001 || item.allocation > 0.009)
      .sort((a, b) => b.shared - a.shared || b.allocation - a.allocation)
      .slice(0, MAX_PRIORITY_LINKS)
      .map((item) => item.producerIndex);

    if (ranked.length > 0) {
      return ranked;
    }

    return fallbackProducerOrder.slice(0, Math.min(MAX_PRIORITY_LINKS, fallbackProducerOrder.length));
  });

  const referenceLabel = formatMonthLabel(historyReference.anchor);
  const sourceSummary = historyReference.hasYearAgoMonthData
    ? `historie skupiny: ${referenceLabel} + silnější váha stejného měsíce ${historyReference.anchor.getFullYear() - 1}`
    : `historie skupiny: ${referenceLabel} + fallback posledních 4 týdnů`;

  return {
    sourceData: data,
    weights,
    weightsKey: buildWeightsKey(weights),
    referenceLabel,
    sourceSummary,
    hasCurrentMonthData: historyReference.hasCurrentMonthData,
    hasYearAgoMonthData: historyReference.hasYearAgoMonthData,
    weightedPairShared,
    baseAllocations,
    prioritiesByConsumer,
    suggestedAllocations,
  };
}

function getHistoricalSharingModel(data) {
  const activeWeights = getHistoricalWeights();
  const activeWeightsKey = buildWeightsKey(activeWeights);
  if (gHistoricalModel && gHistoricalModel.sourceData === data && gHistoricalModel.weightsKey === activeWeightsKey) {
    return gHistoricalModel;
  }
  gHistoricalModel = buildHistoricalSharingModel(data);
  return gHistoricalModel;
}

function renderMethodologyMatrix(data, model) {
  if (!dom.methodologyMatrix || !dom.methodologyPriorityMatrix) {
    return;
  }

  dom.methodologyMatrix.innerHTML = "";
  dom.methodologyPriorityMatrix.innerHTML = "";

  const matrixHead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th class='ean'>Výrobní EAN</th>";
  data.consumers.forEach((consumer) => {
    const th = document.createElement("th");
    th.className = "ean";
    th.textContent = displayEan(consumer.name);
    headRow.appendChild(th);
  });
  const totalHead = document.createElement("th");
  totalHead.textContent = "Součet klíče";
  headRow.appendChild(totalHead);
  matrixHead.appendChild(headRow);
  dom.methodologyMatrix.appendChild(matrixHead);

  const matrixBody = document.createElement("tbody");
  data.producers.forEach((producer, producerIndex) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td class='ean'>${displayEan(producer.name)}</td>`;
    let rowSum = 0;
    for (let consumerIndex = 0; consumerIndex < data.consumers.length; consumerIndex += 1) {
      const cellValue = Number(model.baseAllocations[producerIndex][consumerIndex]) || 0;
      rowSum += cellValue;
      const td = document.createElement("td");
      td.textContent = formatPercent(cellValue);
      row.appendChild(td);
    }
    const sumCell = document.createElement("td");
    sumCell.innerHTML = `<strong>${formatPercent(rowSum)}</strong>`;
    row.appendChild(sumCell);
    matrixBody.appendChild(row);
  });
  dom.methodologyMatrix.appendChild(matrixBody);

  const priorityHead = document.createElement("thead");
  const priorityHeadRow = document.createElement("tr");
  priorityHeadRow.innerHTML = "<th class='ean'>Odběrný EAN</th><th>Doporučený podíl sdílení [%]</th><th>Priorita 1</th><th>Priorita 2</th><th>Priorita 3</th><th>Priorita 4</th><th>Priorita 5</th>";
  priorityHead.appendChild(priorityHeadRow);
  dom.methodologyPriorityMatrix.appendChild(priorityHead);

  const priorityBody = document.createElement("tbody");
  data.consumers.forEach((consumer, consumerIndex) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td class='ean'>${displayEan(consumer.name)}</td><td>${formatPercent(model.suggestedAllocations[consumerIndex] || 0)}</td>`;
    const priorities = model.prioritiesByConsumer[consumerIndex] || [];
    for (let priorityIndex = 0; priorityIndex < MAX_PRIORITY_LINKS; priorityIndex += 1) {
      const producerIndex = priorities[priorityIndex];
      const td = document.createElement("td");
      if (Number.isInteger(producerIndex)) {
        td.className = "ean";
        td.textContent = displayEan(data.producers[producerIndex].name);
      } else {
        td.textContent = "-";
      }
      row.appendChild(td);
    }
    priorityBody.appendChild(row);
  });
  dom.methodologyPriorityMatrix.appendChild(priorityBody);

  renderHistoricalWeightsStatus(model);
}

function getConsumerProducerRecommendations(data, model, consumerIndex) {
  const pairs = data.producers.map((producer, producerIndex) => ({
    producerIndex,
    ean: displayEan(producer.name),
    weightedShared: Number(model.weightedPairShared[producerIndex] && model.weightedPairShared[producerIndex][consumerIndex]) || 0,
  }));

  const weightedTotal = pairs.reduce((sumValue, item) => sumValue + item.weightedShared, 0);
  if (weightedTotal > 0.001) {
    return pairs
      .map((item) => ({
        ...item,
        percent: (item.weightedShared / weightedTotal) * 100,
      }))
      .filter((item) => item.percent > 0.09)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, MAX_PRIORITY_LINKS);
  }

  const priorities = model.prioritiesByConsumer[consumerIndex] || [];
  const fallbackCount = Math.min(MAX_PRIORITY_LINKS, priorities.length);
  if (fallbackCount <= 0) {
    return [];
  }

  const equalShare = 100 / fallbackCount;
  return priorities.slice(0, fallbackCount).map((producerIndex) => ({
    producerIndex,
    ean: displayEan(data.producers[producerIndex].name),
    weightedShared: 0,
    percent: equalShare,
  }));
}

function renderConsumerProducerRecommendations(data, model) {
  if (!dom.consumerProducerRecommendations) {
    return;
  }

  dom.consumerProducerRecommendations.innerHTML = "";

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th class='ean'>Odběrný EAN</th><th>Doporučený podíl sdílení odběrného EAN [%]</th><th>Doporučené výrobní EAN 1-5 (podíl sdílení [%])</th>";
  head.appendChild(headRow);
  dom.consumerProducerRecommendations.appendChild(head);

  const body = document.createElement("tbody");
  data.consumers.forEach((consumer, consumerIndex) => {
    const row = document.createElement("tr");
    const recommendations = getConsumerProducerRecommendations(data, model, consumerIndex);
    const recommendationText = recommendations.length > 0
      ? recommendations.map((item, index) => `${index + 1}. ${item.ean} (${formatPercent(item.percent)})`).join("<br>")
      : "Bez doporučení (chybí historická data).";

    row.innerHTML =
      `<td class='ean'>${displayEan(consumer.name)}</td>
       <td>${formatPercent(model.suggestedAllocations[consumerIndex] || 0)}</td>
       <td class='ean'>${recommendationText}</td>`;
    body.appendChild(row);
  });

  dom.consumerProducerRecommendations.appendChild(body);
}

function buildSimulationPlan(data, consumerPreferences) {
  const model = getHistoricalSharingModel(data);
  const preferenceFactors = model.suggestedAllocations.map((suggestedValue, index) => {
    const requestedValue = clamp(Number(consumerPreferences[index]) || 0, 0, 100);
    if (suggestedValue > 0.001) {
      return requestedValue / suggestedValue;
    }
    return requestedValue > 0 ? 1 + requestedValue / 100 : 0;
  });

  const matrix = model.baseAllocations.map((row) => normalizePercentRow(
    row.map((value, consumerIndex) => value * preferenceFactors[consumerIndex]),
  ));

  const prioritiesByConsumer = Array.from({ length: data.consumers.length }, (_unused, consumerIndex) => {
    const ranked = data.producers
      .map((_producer, producerIndex) => ({
        producerIndex,
        allocation: matrix[producerIndex][consumerIndex],
        historyWeight: model.weightedPairShared[producerIndex][consumerIndex],
      }))
      .filter((item) => item.allocation > 0.009)
      .sort((a, b) => b.historyWeight - a.historyWeight || b.allocation - a.allocation)
      .slice(0, MAX_PRIORITY_LINKS)
      .map((item) => item.producerIndex);

    if (ranked.length > 0) {
      return ranked;
    }
    return model.prioritiesByConsumer[consumerIndex] || [];
  });

  return {
    matrix,
    prioritiesByConsumer,
    suggestedAllocations: model.suggestedAllocations,
    sourceSummary: model.sourceSummary,
  };
}

function describePrioritySources(data, model, consumerIndex) {
  const priorities = model.prioritiesByConsumer[consumerIndex] || [];
  if (priorities.length === 0) {
    return "Bez historie, použije se průběžná optimalizace podle odběru.";
  }

  return priorities.map((producerIndex, priorityIndex) => {
    const producer = data.producers[producerIndex];
    const allocation = model.baseAllocations[producerIndex][consumerIndex] || 0;
    return `${priorityIndex + 1}. ${displayEan(producer.name)} (${formatPercent(allocation)})`;
  }).join("<br>");
}

function proportionalTake(producerRemaining, amount) {
  const total = sum(producerRemaining);
  if (amount <= 0 || total <= 0) {
    return Array(producerRemaining.length).fill(0);
  }

  const base = producerRemaining.map((rem) => Math.floor((amount * rem) / total));
  const remainders = producerRemaining.map((rem, i) => ({
    i,
    r: (amount * rem) / total - base[i],
  }));

  let baseSum = sum(base);
  remainders.sort((a, b) => b.r - a.r);

  for (const item of remainders) {
    if (baseSum >= amount) {
      break;
    }
    if (base[item.i] < producerRemaining[item.i]) {
      base[item.i] += 1;
      baseSum += 1;
    }
  }

  // Guard against any accidental overflow due to rounding corrections.
  for (let i = 0; i < base.length; i += 1) {
    base[i] = Math.min(base[i], producerRemaining[i]);
  }

  let missing = amount - sum(base);
  if (missing > 0) {
    for (let i = 0; i < base.length && missing > 0; i += 1) {
      const canAdd = producerRemaining[i] - base[i];
      if (canAdd > 0) {
        const add = Math.min(canAdd, missing);
        base[i] += add;
        missing -= add;
      }
    }
  }

  return base;
}

function simulateSharing(data, allocations, costsPerKwh, rounds) {
  assert(allocations.length === data.consumers.length, "Nesedí počet alokací a odběrných EAN.");
  assert(sum(allocations) <= 100.0001, `Soucet alokaci musi byt <= 100. Aktualne: ${sum(allocations).toFixed(2)} %`);

  const roundsUsed = resolveMethodologyRounds(data, rounds);
  const plan = buildSimulationPlan(data, allocations);
  const sharingPerConsumer = Array(data.consumers.length).fill(0);
  const sharingPerProducer = Array(data.producers.length).fill(0);
  const producerToConsumer = Array.from({ length: data.producers.length }, () =>
    Array(data.consumers.length).fill(0),
  );
  const perRoundPerEan = Array.from({ length: roundsUsed }, () => Array(data.consumers.length).fill(0));
  const intervalTotals = [];

  for (const interval of data.intervals) {
    const producerRemaining = interval.producers.map((producer) => toCentiKwh(producer.before));
    const remaining = interval.consumers.map((consumer) => toCentiKwh(consumer.before));
    const intervalProduction = sum(producerRemaining) / 100;
    const intervalConsumption = sum(remaining) / 100;
    let intervalShared = 0;

    for (let round = 0; round < roundsUsed; round += 1) {
      if (sum(producerRemaining) <= 0) {
        break;
      }

      const producerBeforeRound = producerRemaining.slice();
      const producerSharedThisRound = Array(data.producers.length).fill(0);
      let sharedThisRound = 0;

      for (let priorityIndex = 0; priorityIndex < MAX_PRIORITY_LINKS; priorityIndex += 1) {
        for (let consumerIndex = 0; consumerIndex < data.consumers.length; consumerIndex += 1) {
          if (remaining[consumerIndex] <= 0) {
            continue;
          }

          const producerIndex = plan.prioritiesByConsumer[consumerIndex] && plan.prioritiesByConsumer[consumerIndex][priorityIndex];
          if (!Number.isInteger(producerIndex)) {
            continue;
          }

          const allocationPercent = Number(plan.matrix[producerIndex] && plan.matrix[producerIndex][consumerIndex]) || 0;
          if (allocationPercent <= 0) {
            continue;
          }

          const quota = Math.trunc((producerBeforeRound[producerIndex] * allocationPercent) / 100);
          const producerStillAvailable = producerRemaining[producerIndex] - producerSharedThisRound[producerIndex];
          const shared = Math.min(remaining[consumerIndex], quota, producerStillAvailable);
          if (shared <= 0) {
            continue;
          }

          remaining[consumerIndex] -= shared;
          producerSharedThisRound[producerIndex] += shared;
          sharedThisRound += shared;
          intervalShared += fromCentiKwh(shared);
          perRoundPerEan[round][consumerIndex] += fromCentiKwh(shared);

          const kwh = fromCentiKwh(shared);
          sharingPerProducer[producerIndex] += kwh;
          producerToConsumer[producerIndex][consumerIndex] += kwh;
          sharingPerConsumer[consumerIndex] += kwh;
        }
      }

      for (let producerIndex = 0; producerIndex < producerRemaining.length; producerIndex += 1) {
        producerRemaining[producerIndex] = Math.max(0, producerRemaining[producerIndex] - producerSharedThisRound[producerIndex]);
      }

      if (sharedThisRound <= 0) {
        break;
      }
    }

    intervalTotals.push({
      label: printDate(interval.start),
      production: intervalProduction,
      consumption: intervalConsumption,
      shared: intervalShared,
    });
  }

  const profitPerEan = sharingPerConsumer.map((kwh, i) => kwh * costsPerKwh[i]);
  return {
    sharingPerEan: sharingPerConsumer,
    sharingPerProducer,
    producerToConsumer,
    profitPerEan,
    sharingPerRoundPerEan: perRoundPerEan,
    intervalTotals,
    totalSharing: sum(sharingPerConsumer),
    totalProfit: sum(profitPerEan),
    roundsUsed,
    plan,
  };
}

function simulateFastTotalProfit(data, allocations, costsPerKwh, rounds) {
  const result = simulateSharing(data, allocations, costsPerKwh, rounds);
  return result.totalSharing * 1000000 + result.totalProfit;
}

function randomWeights(size) {
  const arr = Array.from({ length: size }, () => Math.random());
  const s = sum(arr);
  return arr.map((v) => (v / s) * 99.99);
}

function optimizeAllocations(data, costsPerKwh, rounds, maxFails, restarts, progress) {
  let bestOverall = null;

  for (let restart = 1; restart <= restarts; restart += 1) {
    let current = randomWeights(data.consumers.length);
    let currentProfit = simulateFastTotalProfit(data, current, costsPerKwh, rounds);
    let bestLocal = current.slice();
    let bestLocalProfit = currentProfit;

    let fails = 0;
    while (fails < maxFails) {
      const candidate = current.slice();
      let a = Math.trunc(Math.random() * candidate.length);
      let b = Math.trunc(Math.random() * candidate.length);
      if (a === b) {
        b = (b + 1) % candidate.length;
      }

      const movable = Math.min(candidate[b], Math.random() * 6);
      candidate[b] -= movable;
      candidate[a] += movable;

      const cap = 100 - candidate[a];
      if (cap < 0) {
        candidate[b] += -cap;
        candidate[a] = 100;
      }

      for (let i = 0; i < candidate.length; i += 1) {
        candidate[i] = clamp(candidate[i], 0, 100);
      }

      const s = sum(candidate);
      if (s > 100) {
        const ratio = 100 / s;
        for (let i = 0; i < candidate.length; i += 1) {
          candidate[i] *= ratio;
        }
      }

      const candidateProfit = simulateFastTotalProfit(data, candidate, costsPerKwh, rounds);
      if (candidateProfit > currentProfit) {
        current = candidate;
        currentProfit = candidateProfit;
        fails = 0;

        if (candidateProfit > bestLocalProfit) {
          bestLocal = candidate.slice();
          bestLocalProfit = candidateProfit;
        }
      } else {
        fails += 1;
      }
    }

    if (!bestOverall || bestLocalProfit > bestOverall.totalProfit) {
      const full = simulateSharing(data, bestLocal, costsPerKwh, rounds);
      bestOverall = {
        allocations: bestLocal,
        ...full,
      };
    }

    progress(restart, restarts, bestOverall);
  }

  return bestOverall;
}

function renderSimulationResult(data, result) {
  dom.simulationResult.innerHTML =
    "<thead><tr><th class='ean'>Odběrný EAN</th><th>Sdíleno</th><th>Průměr na kolo</th></tr></thead>";

  const producerAllocationMatrix = Array.isArray(result.producerAllocationMatrix)
    ? result.producerAllocationMatrix
    : [];

  data.producers.forEach((producer, producerIndex) => {
    const optimizedCell = document.getElementById(`optimalProducerAlloc_${producerIndex}`);
    const sumCell = document.getElementById(`optimalProducerAllocSum_${producerIndex}`);
    const summaryCell = document.getElementById(`rowResultProducer_${producerIndex}`);
    const row = Array.isArray(producerAllocationMatrix[producerIndex])
      ? producerAllocationMatrix[producerIndex]
      : [];
    const rowSum = row.reduce((acc, value) => acc + (Number(value) || 0), 0);

    if (optimizedCell) {
      optimizedCell.innerHTML = summarizeProducerAllocationRow(row, data.consumers);
    }
    if (sumCell) {
      sumCell.textContent = formatPercent(rowSum);
      sumCell.style.color = rowSum > 100.0001 ? "#c2410c" : "";
    }
    if (summaryCell) {
      summaryCell.textContent = `Sdíleno ${fmt(result.sharingPerProducer[producerIndex] || 0)}`;
    }
  });

  const body = document.createElement("tbody");
  for (let i = 0; i < data.consumers.length; i += 1) {
    const tr = document.createElement("tr");
    const avgPerRound = sum(result.sharingPerRoundPerEan.map((row) => row[i])) / result.sharingPerRoundPerEan.length;

    tr.innerHTML =
      `<td class='ean'>${displayEan(data.consumers[i].name)}</td><td>${fmt(result.sharingPerEan[i])}</td><td>${fmt(avgPerRound)}</td>`;
    body.appendChild(tr);

  }

  const total = document.createElement("tr");
  total.innerHTML =
    `<td class='ean'><strong>CELKEM</strong></td><td><strong>${fmt(result.totalSharing)}</strong></td><td></td>`;
  body.appendChild(total);

  dom.simulationResult.appendChild(body);
}

function renderProducerConsumerMatrix(data, result) {
  dom.producerConsumerMatrix.innerHTML = "";
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th class='ean'>Výrobce → Odběratel</th>";

  data.consumers.forEach((c) => {
    const th = document.createElement("th");
    th.className = "ean";
    th.textContent = displayEan(c.name);
    headRow.appendChild(th);
  });

  const totalTh = document.createElement("th");
  totalTh.textContent = "Celkem od výrobce";
  headRow.appendChild(totalTh);

  const thead = document.createElement("thead");
  thead.appendChild(headRow);
  dom.producerConsumerMatrix.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let p = 0; p < data.producers.length; p += 1) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class='ean'>${displayEan(data.producers[p].name)}</td>`;
    for (let c = 0; c < data.consumers.length; c += 1) {
      const td = document.createElement("td");
      td.textContent = fmt(result.producerToConsumer[p][c]);
      tr.appendChild(td);
    }
    const total = document.createElement("td");
    total.innerHTML = `<strong>${fmt(result.sharingPerProducer[p])}</strong>`;
    tr.appendChild(total);
    tbody.appendChild(tr);
  }

  dom.producerConsumerMatrix.appendChild(tbody);
}

function drawBarChart(canvas, labels, values, color) {
  const chart = createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 450,
    color: [color],
    grid: {
      left: 52,
      right: 24,
      top: 24,
      bottom: 70,
    },
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "item",
      formatter: (params) => `${params.name}<br/>${Number(params.value).toFixed(2)} kWh`,
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        interval: 0,
        rotate: 35,
        color: "#20301e",
        formatter: (value) => (value.length > 24 ? `${value.slice(0, 24)}...` : value),
      },
      axisLine: { lineStyle: { color: "#ced8c9" } },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      nameTextStyle: { color: "#4f5f4c" },
      axisLabel: { color: "#4f5f4c" },
      splitLine: { lineStyle: { color: "#dce5d8" } },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 36,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          shadowBlur: 8,
          shadowColor: "rgba(20, 40, 28, 0.12)",
        },
      },
    ],
  }));

  if (!chart) {
    return;
  }
}

function drawProducerOverviewChart(canvas, producerStats, tooltip) {
  const labels = producerStats.map((p) => displayEan(p.name));
  const production = producerStats.map((p) => Math.max(0, p.before));
  const shared = producerStats.map((p) => Math.max(0, p.before - p.after));
  const missed = producerStats.map((p) => Math.max(0, p.missed));
  const remainderAfterSharing = producerStats.map((p) => Math.max(0, p.after));
  const sharedBarData = shared.map((value, index) => {
    const [top, bottom] = getExecutiveColorPair(index);
    return {
      value,
      itemStyle: {
        color: makeExecutiveGradient(top, bottom),
      },
    };
  });

  createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 500,
    color: ["#10b981", "#dc2626"],
    legend: {
      bottom: 6,
      textStyle: {
        color: "#20301e",
        fontFamily: "Space Grotesk, sans-serif",
      },
    },
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        if (!params.length) return "";
        const idx = params[0].dataIndex;
        const prod = production[idx] || 0;
        const lines = [
          `<strong>${labels[idx]}</strong>`,
          `Výroba (celkem): ${prod.toFixed(1)} kWh`,
        ];
        lines.push(`Ušlá příležitost: ${missed[idx].toFixed(1)} kWh`);
        for (const item of params) {
          const pct = prod > 0 ? ((Number(item.value) / prod) * 100).toFixed(1) : "0.0";
          lines.push(`${item.marker} ${item.seriesName}: ${Number(item.value).toFixed(1)} kWh (${pct}%)`);
        }
        return lines.join("<br/>");
      },
    },
    grid: {
      left: 58,
      right: 30,
      top: 24,
      bottom: 82,
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        interval: 0,
        rotate: 28,
        color: "#20301e",
        formatter: (value) => (value.length > 22 ? `${value.slice(0, 22)}...` : value),
      },
      axisLine: { lineStyle: { color: "#ced8c9" } },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      axisLabel: { color: "#4f5f4c" },
      splitLine: { lineStyle: { color: "#dce5d8" } },
    },
    series: [
      {
        name: "Sdílení",
        type: "bar",
        stack: "allocation",
        data: sharedBarData,
        barMaxWidth: 46,
        itemStyle: { borderRadius: [0, 0, 6, 6] },
      },
      {
        name: "Nesdílená výroba",
        type: "bar",
        stack: "allocation",
        data: remainderAfterSharing,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: makeExecutiveGradient("#f6b1b1", "#e67b7b"),
        },
      },
    ],
  }));
}

function drawTimelineChart(canvas, points, tooltip) {
  createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 450,
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "axis",
      formatter: (params) => {
        if (!params.length) return "";
        const lines = [`<strong>${params[0].axisValueLabel}</strong>`];
        for (const p of params) {
          lines.push(`${p.marker} ${p.seriesName}: ${Number(p.value).toFixed(2)} kWh`);
        }
        return lines.join("<br/>");
      },
    },
    legend: {
      bottom: 6,
      textStyle: { color: "#20301e", fontFamily: "Space Grotesk, sans-serif" },
    },
    grid: {
      left: 58,
      right: 24,
      top: 24,
      bottom: 78,
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.label),
      axisLabel: {
        color: "#20301e",
        rotate: 40,
        formatter: (value) => (value.length > 16 ? `${value.slice(0, 16)}...` : value),
      },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: "#ced8c9" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#4f5f4c",
        formatter: (value) => `${Number(value).toFixed(1)} kWh`,
      },
      splitLine: { lineStyle: { color: "#dce5d8" } },
    },
    series: [
      {
        name: "Výroba",
        type: "line",
        data: points.map((p) => p.production),
        smooth: 0.25,
        showSymbol: points.length <= 120,
        symbolSize: 5,
        lineStyle: { width: 2.5, color: "#2563eb" },
        itemStyle: { color: "#2563eb" },
      },
      {
        name: "Spotřeba",
        type: "line",
        data: points.map((p) => p.consumption),
        smooth: 0.25,
        showSymbol: points.length <= 120,
        symbolSize: 5,
        lineStyle: { width: 2.5, color: "#f59e0b" },
        itemStyle: { color: "#f59e0b" },
      },
      {
        name: "Sdílení",
        type: "line",
        data: points.map((p) => p.shared),
        smooth: 0.25,
        showSymbol: points.length <= 120,
        symbolSize: 5,
        lineStyle: { width: 2.8, color: "#10b981" },
        itemStyle: { color: "#10b981" },
        areaStyle: { color: "rgba(16, 185, 129, 0.16)" },
      },
    ],
  }));
}

function renderCharts(data, result) {
  drawBarChart(
    dom.consumerChart,
    data.consumers.map((c) => displayEan(c.name)),
    result.sharingPerEan,
    "#0f766e",
  );

  drawBarChart(
    dom.producerChart,
    data.producers.map((p) => displayEan(p.name)),
    result.sharingPerProducer,
    "#2563eb",
  );

  drawTimelineChart(dom.timelineChart, result.intervalTotals, null);
}

function drawPieChart(canvas, values, colors, labels, tooltip) {
  const total = values.reduce((a, b) => a + b, 0);
  const seriesData = values.map((value, i) => ({
    value,
    name: labels[i],
    itemStyle: { color: colors[i] },
  }));

  createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 500,
    color: colors,
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "item",
      formatter: (params) => {
        const pct = total > 0 ? ((Number(params.value) / total) * 100).toFixed(1) : "0.0";
        return `<strong>${params.name}</strong><br/>${Number(params.value).toFixed(1)} kWh (${pct}%)`;
      },
    },
    series: [
      {
        type: "pie",
        radius: "78%",
        center: ["50%", "52%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 2,
          shadowBlur: 12,
          shadowColor: "rgba(20, 40, 28, 0.16)",
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: {
            show: false,
          },
        },
        data: seriesData,
      },
    ],
  }));
}
function renderProducerPieCharts(producerStats) {
  const container = document.getElementById("producerPieCharts");
  const section = document.getElementById("producerPieChartsSection");
  
  if (!container || !section) return;
  
  container.innerHTML = "";
  let renderedCharts = 0;
  const ownProducerSet = isMemberSharingPage && gMemberScope && Array.isArray(gMemberScope.ownProducers)
    ? new Set(gMemberScope.ownProducers)
    : null;
  
  const colors = ["#5ea99b", "#c9957b", "#e67b7b"];
  const labels = ["Sdílení", "Ušlá příl.", "Zůstatek"];
  
  for (const producer of producerStats) {
    if (ownProducerSet && !ownProducerSet.has(producer.name)) {
      continue;
    }
    const shared = Math.max(0, producer.before - producer.after);
    const missed = Math.max(0, producer.missed);
    const remainder = Math.max(0, producer.after - producer.missed);
    
    const values = [shared, missed, remainder];
    const total = values.reduce((a, b) => a + b, 0);
    
    if (total === 0) continue;
    
    const wrapper = document.createElement("div");
    wrapper.className = "pie-chart-container";
    
    const h3 = document.createElement("h3");
    h3.textContent = displayEan(producer.name);
    wrapper.appendChild(h3);
    
    const canvas = document.createElement("div");
    canvas.className = "pie-chart-canvas";
    wrapper.appendChild(canvas);
    
    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = "font-size: 10px; color: #5f6d5c; margin-top: 0.4rem; line-height: 1.3;";
    statsDiv.innerHTML = `
      <div><span style="color: #5ea99b;">●</span> Sdílení: ${shared.toFixed(1)} kWh</div>
      <div><span style="color: #c9957b;">●</span> Ušlá příl.: ${missed.toFixed(1)} kWh</div>
      <div><span style="color: #e67b7b;">●</span> Zůstatek: ${remainder.toFixed(1)} kWh</div>
    `;
    wrapper.appendChild(statsDiv);
    
    container.appendChild(wrapper);
    
    drawPieChart(canvas, values, colors, labels, null);
    renderedCharts += 1;
  }

  if (renderedCharts === 0) {
    section.hidden = true;
    container.innerHTML = "";
  } else {
    section.hidden = false;
  }
  
}

const CONSUMER_COLORS = [
  "#5f8fbe", "#5ea99b", "#c8a063", "#8498ae", "#9c8bc9",
  "#6ea8ca", "#96b876", "#c9957b", "#869ed9", "#7fb8ad",
  "#ba9484", "#95a4b8", "#80b8d6", "#8caf8a", "#9d93c7",
];

const PRODUCER_COLORS = [
  "#5f8fbe", "#5ea99b", "#c8a063", "#8498ae", "#9c8bc9",
  "#6ea8ca", "#96b876", "#c9957b", "#869ed9", "#7fb8ad",
  "#ba9484", "#95a4b8", "#80b8d6", "#8caf8a", "#9d93c7",
];

function computeProducerConsumerAllocations(data) {
  const result = data.producers.map((p) => ({
    name: p.name,
    consumerAllocations: data.consumers.map((c) => ({ name: c.name, shared: 0 })),
  }));

  const shouldUseExactAllocations = getAllocationModeInfo(data).effectiveMode === "exact";

  if (shouldUseExactAllocations) {
    for (const interval of data.intervals) {
      if (!Array.isArray(interval.exactAllocations)) {
        continue;
      }

      for (let pi = 0; pi < interval.exactAllocations.length; pi += 1) {
        const row = Array.isArray(interval.exactAllocations[pi]) ? interval.exactAllocations[pi] : [];
        for (let ci = 0; ci < row.length; ci += 1) {
          result[pi].consumerAllocations[ci].shared += Number(row[ci]) || 0;
        }
      }
    }

    return result;
  }

  for (const interval of data.intervals) {
    const totalConsumerReceived = interval.consumers.reduce(
      (s, c) => s + Math.max(0, c.before - c.after), 0
    );
    if (totalConsumerReceived < 0.001) continue;

    for (let pi = 0; pi < interval.producers.length; pi += 1) {
      const producerShared = Math.max(0, interval.producers[pi].before - interval.producers[pi].after);
      if (producerShared < 0.001) continue;
      for (let ci = 0; ci < interval.consumers.length; ci += 1) {
        const consumerReceived = Math.max(0, interval.consumers[ci].before - interval.consumers[ci].after);
        result[pi].consumerAllocations[ci].shared += producerShared * (consumerReceived / totalConsumerReceived);
      }
    }
  }

  return result;
}

function renderProducerConsumerPieCharts(data) {
  const container = document.getElementById("producerConsumerPieCharts");
  const section = document.getElementById("producerConsumerPieChartsSection");
  if (!container || !section) return;

  const memberOwnProducerCount = isMemberSharingPage && gMemberScope && Array.isArray(gMemberScope.ownProducers)
    ? gMemberScope.ownProducers.length
    : 0;

  if (isMemberSharingPage && memberOwnProducerCount === 0) {
    section.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";
  let renderedCharts = 0;
  const ownProducerSet = isMemberSharingPage && gMemberScope && Array.isArray(gMemberScope.ownProducers)
    ? new Set(gMemberScope.ownProducers)
    : null;

  const allocations = computeProducerConsumerAllocations(data);

  for (const producer of allocations) {
    if (ownProducerSet && !ownProducerSet.has(producer.name)) {
      continue;
    }
    const totalShared = producer.consumerAllocations.reduce((s, ca) => s + ca.shared, 0);
    if (totalShared < 0.001) continue;

    // Merge consumers below 5% into "Ostatní"
    const mainItems = [];
    let othersKwh = 0;
    for (let i = 0; i < producer.consumerAllocations.length; i += 1) {
      const ca = producer.consumerAllocations[i];
      if (ca.shared / totalShared >= 0.05) {
        mainItems.push({ name: ca.name, shared: ca.shared, colorIndex: i });
      } else {
        othersKwh += ca.shared;
      }
    }
    if (othersKwh > 0.001) {
      mainItems.push({ name: null, shared: othersKwh, colorIndex: -1 });
    }

    const values = mainItems.map((it) => it.shared);
    const colors = mainItems.map((it) => it.colorIndex >= 0 ? CONSUMER_COLORS[it.colorIndex % CONSUMER_COLORS.length] : "#9ca3af");
    const labels = mainItems.map((it) => it.name ? displayEan(it.name) : "Ostatní");

    const wrapper = document.createElement("div");
    wrapper.className = "pie-chart-container";

    const h3 = document.createElement("h3");
    h3.textContent = displayEan(producer.name);
    wrapper.appendChild(h3);

    const canvas = document.createElement("div");
    canvas.className = "pie-chart-canvas";
    wrapper.appendChild(canvas);

    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = "font-size: 10px; color: #5f6d5c; margin-top: 0.4rem; line-height: 1.3;";
    statsDiv.innerHTML = mainItems
      .map((it, i) => `<div><span style="color: ${colors[i]}">●</span> ${it.name ? displayEan(it.name) : "Ostatní"}: ${it.shared.toFixed(1)} kWh</div>`)
      .join("");
    wrapper.appendChild(statsDiv);

    container.appendChild(wrapper);

    drawPieChart(canvas, values, colors, labels, null);
    renderedCharts += 1;
  }

  if (renderedCharts === 0) {
    section.hidden = true;
    container.innerHTML = "";
  } else {
    section.hidden = false;
  }
}

function computeConsumerProducerAllocations(data) {
  const result = data.consumers.map((consumer) => ({
    name: consumer.name,
    producerAllocations: data.producers.map((producer) => ({ name: producer.name, shared: 0 })),
  }));

  const shouldUseExactAllocations = getAllocationModeInfo(data).effectiveMode === "exact";

  if (shouldUseExactAllocations) {
    // Transpose the exact allocation matrix: exactAllocations[pi][ci] → result[ci].producerAllocations[pi]
    for (const interval of data.intervals) {
      if (!Array.isArray(interval.exactAllocations)) continue;
      for (let pi = 0; pi < interval.exactAllocations.length; pi += 1) {
        const row = Array.isArray(interval.exactAllocations[pi]) ? interval.exactAllocations[pi] : [];
        for (let ci = 0; ci < row.length; ci += 1) {
          result[ci].producerAllocations[pi].shared += Number(row[ci]) || 0;
        }
      }
    }
    return result;
  }

  for (const interval of data.intervals) {
    const totalConsumerReceived = interval.consumers.reduce(
      (sumValue, consumer) => sumValue + Math.max(0, consumer.before - consumer.after),
      0,
    );
    if (totalConsumerReceived < 0.001) {
      continue;
    }

    for (let producerIndex = 0; producerIndex < interval.producers.length; producerIndex += 1) {
      const producerShared = Math.max(0, interval.producers[producerIndex].before - interval.producers[producerIndex].after);
      if (producerShared < 0.001) {
        continue;
      }

      for (let consumerIndex = 0; consumerIndex < interval.consumers.length; consumerIndex += 1) {
        const consumerReceived = Math.max(0, interval.consumers[consumerIndex].before - interval.consumers[consumerIndex].after);
        if (consumerReceived < 0.001) {
          continue;
        }

        result[consumerIndex].producerAllocations[producerIndex].shared += producerShared * (consumerReceived / totalConsumerReceived);
      }
    }
  }

  return result;
}

function renderConsumerProducerPieCharts(data) {
  const container = document.getElementById("consumerProducerPieCharts");
  const section = document.getElementById("consumerProducerPieChartsSection");
  if (!container || !section) return;

  const isMemberWithConsumers = isMemberSharingPage && getMemberOwnedConsumerCount() > 0;
  if (!isMemberWithConsumers) {
    section.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";
  let renderedCharts = 0;
  const ownConsumerSet = isMemberSharingPage && gMemberScope && Array.isArray(gMemberScope.ownConsumers)
    ? new Set(gMemberScope.ownConsumers)
    : null;

  const allocations = computeConsumerProducerAllocations(data);

  for (const consumer of allocations) {
    if (ownConsumerSet && !ownConsumerSet.has(consumer.name)) {
      continue;
    }

    const totalShared = consumer.producerAllocations.reduce((sumValue, allocation) => sumValue + allocation.shared, 0);
    if (totalShared < 0.001) {
      continue;
    }

    const mainItems = [];
    let othersKwh = 0;
    for (let i = 0; i < consumer.producerAllocations.length; i += 1) {
      const allocation = consumer.producerAllocations[i];
      if (allocation.shared < 0.001) continue;
      if (allocation.shared / totalShared >= 0.05) {
        mainItems.push({ name: allocation.name, shared: allocation.shared, colorIndex: i });
      } else {
        othersKwh += allocation.shared;
      }
    }
    if (othersKwh > 0.001) {
      mainItems.push({ name: null, shared: othersKwh, colorIndex: -1 });
    }

    const values = mainItems.map((item) => item.shared);
    const colors = mainItems.map((item) => item.colorIndex >= 0 ? PRODUCER_COLORS[item.colorIndex % PRODUCER_COLORS.length] : "#9ca3af");
    const labels = mainItems.map((item) => item.name ? displayEan(item.name) : "Ostatní");

    const wrapper = document.createElement("div");
    wrapper.className = "pie-chart-container";

    const h3 = document.createElement("h3");
    h3.textContent = displayEan(consumer.name);
    wrapper.appendChild(h3);

    const canvas = document.createElement("div");
    canvas.className = "pie-chart-canvas";
    wrapper.appendChild(canvas);

    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = "font-size: 10px; color: #5f6d5c; margin-top: 0.4rem; line-height: 1.3;";
    statsDiv.innerHTML = mainItems
      .map((item, i) => `<div><span style="color: ${colors[i]}">●</span> ${item.name ? displayEan(item.name) : "Ostatní"}: ${item.shared.toFixed(1)} kWh</div>`)
      .join("");
    wrapper.appendChild(statsDiv);

    container.appendChild(wrapper);

    drawPieChart(canvas, values, colors, labels, null);
    renderedCharts += 1;
  }

  if (renderedCharts === 0) {
    section.hidden = true;
    container.innerHTML = "";
  } else {
    section.hidden = false;
  }
}

function computeAverageDay(intervals) {
  // Bucket structure: key = "HH:MM", value = accumulated sums
  const buckets = new Map();
  const dayCounts = new Map();

  for (const interval of intervals) {
    const h = interval.start.getHours().toString().padStart(2, "0");
    const m = interval.start.getMinutes().toString().padStart(2, "0");
    const key = `${h}:${m}`;

    if (!buckets.has(key)) {
      buckets.set(key, { label: key, production: 0, consumption: 0, shared: 0, count: 0 });
    }
    const bucket = buckets.get(key);
    bucket.production += interval.sumProduction;
    bucket.consumption += interval.consumers.reduce((s, c) => s + c.before, 0);
    bucket.shared += interval.sumSharing;
    bucket.count += 1;
  }

  // Sort by time and compute averages
  const sorted = Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label));
  for (const b of sorted) {
    if (b.count > 0) {
      b.production /= b.count;
      b.consumption /= b.count;
      b.shared /= b.count;
    }
  }
  return sorted;
}

function getChartIntervalsForCurrentMode(data, scopeMode = "auto") {
  if (!isMemberSharingPage || !gMemberScope) {
    return data.intervals;
  }

  const ownProducerSet = new Set(
    (Array.isArray(gMemberScope.ownProducers) ? gMemberScope.ownProducers : [])
      .map((value) => normalizeEan(value))
      .filter(Boolean),
  );
  const ownConsumerSet = new Set(
    (Array.isArray(gMemberScope.ownConsumers) ? gMemberScope.ownConsumers : [])
      .map((value) => normalizeEan(value))
      .filter(Boolean),
  );

  const ownProducerIndexes = data.producers
    .map((producer, index) => ({ name: normalizeEan(producer.name), index }))
    .filter((item) => ownProducerSet.has(item.name))
    .map((item) => item.index);

  const ownConsumerIndexes = data.consumers
    .map((consumer, index) => ({ name: normalizeEan(consumer.name), index }))
    .filter((item) => ownConsumerSet.has(item.name))
    .map((item) => item.index);

  let chartConsumerIndexes = ownConsumerIndexes;

  // For owner-producer view, chart consumption should aggregate all consumers linked to any owned producer.
  if (scopeMode !== "consumer" && ownProducerIndexes.length > 0) {
    const allocations = computeProducerConsumerAllocations(data);
    const linkedConsumerSet = new Set();

    for (const producerIndex of ownProducerIndexes) {
      const producerAllocation = allocations[producerIndex];
      if (!producerAllocation || !Array.isArray(producerAllocation.consumerAllocations)) {
        continue;
      }

      producerAllocation.consumerAllocations.forEach((allocation, consumerIndex) => {
        if ((Number(allocation.shared) || 0) > 0.001) {
          linkedConsumerSet.add(consumerIndex);
        }
      });
    }

    chartConsumerIndexes = Array.from(linkedConsumerSet).sort((a, b) => a - b);
  }

  return data.intervals.map((interval) => {
    const producers = Array.isArray(interval.producers) ? interval.producers : [];
    const consumers = Array.isArray(interval.consumers) ? interval.consumers : [];

    const ownProductionBefore = ownProducerIndexes.reduce((sumValue, idx) => sumValue + (Number(producers[idx] && producers[idx].before) || 0), 0);
    const ownProductionAfter = ownProducerIndexes.reduce((sumValue, idx) => sumValue + (Number(producers[idx] && producers[idx].after) || 0), 0);
    const ownConsumptionBefore = chartConsumerIndexes.reduce((sumValue, idx) => sumValue + (Number(consumers[idx] && consumers[idx].before) || 0), 0);
    const ownConsumptionAfter = chartConsumerIndexes.reduce((sumValue, idx) => sumValue + (Number(consumers[idx] && consumers[idx].after) || 0), 0);

    const sharedByOwnProducers = Math.max(0, ownProductionBefore - ownProductionAfter);
    const sharedByOwnConsumers = Math.max(0, ownConsumptionBefore - ownConsumptionAfter);
    const intervalSharing = ownProducerIndexes.length > 0
      ? Math.min(sharedByOwnProducers, sharedByOwnConsumers)
      : sharedByOwnConsumers;

    return {
      start: interval.start,
      sumProduction: ownProductionBefore,
      sumSharing: intervalSharing,
      consumers: [{ before: ownConsumptionBefore }],
    };
  });
}

function drawAverageDayChart(canvas, points, showConsumptionOrOptions, tooltip) {
  let showProduction = true;
  let showConsumption = false;

  if (
    showConsumptionOrOptions
    && typeof showConsumptionOrOptions === "object"
    && !Array.isArray(showConsumptionOrOptions)
  ) {
    showProduction = showConsumptionOrOptions.showProduction !== false;
    showConsumption = Boolean(showConsumptionOrOptions.showConsumption);
  } else {
    showConsumption = Boolean(showConsumptionOrOptions);
  }

  const series = [];

  if (showProduction) {
    series.push({
      name: "Výroba",
      type: "line",
      data: points.map((p) => p.production),
      smooth: 0.25,
      showSymbol: points.length <= 120,
      symbolSize: 5,
      lineStyle: { width: 2.4, color: "#1f4f8b" },
      itemStyle: { color: "#1f4f8b" },
    });
  }

  if (showConsumption) {
    series.push({
      name: "Spotřeba",
      type: "line",
      data: points.map((p) => p.consumption),
      smooth: 0.25,
      showSymbol: points.length <= 120,
      symbolSize: 5,
      lineStyle: { width: 2.4, color: "#b45309" },
      itemStyle: { color: "#b45309" },
    });
  }

  series.push({
    name: "Sdílení",
    type: "line",
    data: points.map((p) => p.shared),
    smooth: 0.25,
    showSymbol: points.length <= 120,
    symbolSize: 5,
    lineStyle: { width: 2.8, color: "#0f766e" },
    itemStyle: { color: "#0f766e" },
    areaStyle: { color: "rgba(15, 118, 110, 0.14)" },
  });

  createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 450,
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "axis",
      formatter: (params) => {
        if (!params.length) return "";
        const lines = [`<strong>${params[0].axisValueLabel}</strong>`];
        for (const p of params) {
          lines.push(`${p.marker} ${p.seriesName}: ${Number(p.value).toFixed(2)} kWh`);
        }
        return lines.join("<br/>");
      },
    },
    legend: {
      right: 10,
      top: 14,
      orient: "vertical",
      textStyle: { color: "#20301e", fontFamily: "Space Grotesk, sans-serif" },
    },
    grid: {
      left: 58,
      right: 170,
      top: 26,
      bottom: 56,
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.label),
      axisLabel: {
        color: "#20301e",
        interval: 3,
      },
      axisLine: { lineStyle: { color: "#ced8c9" } },
      splitLine: { show: true, lineStyle: { color: "#eef3ea" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#4f5f4c",
        formatter: (value) => Number(value).toFixed(2),
      },
      splitLine: { lineStyle: { color: "#dce5d8" } },
    },
    series,
  }));
}

function computeBestDay(intervals, options) {
  const mode = options && options.mode === "production"
    ? "production"
    : options && options.mode === "consumption"
      ? "consumption"
      : "sharing";

  // Group intervals by date string (YYYY-MM-DD)
  const days = new Map();
  for (const interval of intervals) {
    const d = interval.start;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(interval);
  }

  // Find the day with the selected metric
  let bestKey = null;
  let bestMetric = -1;
  for (const [key, dayIntervals] of days) {
    const totalProduction = dayIntervals.reduce((s, iv) => s + iv.sumProduction, 0);
    const totalSharing = dayIntervals.reduce((s, iv) => s + iv.sumSharing, 0);
    const totalConsumption = dayIntervals.reduce(
      (s, iv) => s + iv.consumers.reduce((consSum, c) => consSum + (Number(c.before) || 0), 0),
      0,
    );
    const metric = mode === "production"
      ? totalProduction
      : mode === "consumption"
        ? totalConsumption
        : totalSharing;
    if (metric > bestMetric) {
      bestMetric = metric;
      bestKey = key;
    }
  }

  if (!bestKey) return { date: null, points: [], totalProduction: 0, totalSharing: 0 };

  const dayIntervals = days.get(bestKey);
  const totalProduction = dayIntervals.reduce((s, iv) => s + iv.sumProduction, 0);
  const totalSharing = dayIntervals.reduce((s, iv) => s + iv.sumSharing, 0);
  const points = dayIntervals
    .map((iv) => {
      const h = iv.start.getHours().toString().padStart(2, "0");
      const m = iv.start.getMinutes().toString().padStart(2, "0");
      return {
        label: `${h}:${m}`,
        production: iv.sumProduction,
        consumption: iv.consumers.reduce((s, c) => s + c.before, 0),
        shared: iv.sumSharing,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // Format date as D.M.YYYY
  const [y, mo, dd] = bestKey.split("-");
  const dateLabel = `${parseInt(dd, 10)}.${parseInt(mo, 10)}.${y}`;

  return { date: dateLabel, points, totalProduction, totalSharing };
}

function computeDailyConsumerTotals(intervals) {
  const days = new Map();

  for (const interval of intervals) {
    const d = interval.start;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!days.has(key)) {
      days.set(key, { key, consumption: 0, shared: 0 });
    }

    const bucket = days.get(key);
    const consumption = interval.consumers.reduce((sumValue, consumer) => sumValue + (Number(consumer.before) || 0), 0);
    bucket.consumption += consumption;
    bucket.shared += Number(interval.sumSharing) || 0;
  }

  return Array.from(days.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((day) => {
      const [year, month, date] = day.key.split("-");
      return {
        label: `${Number.parseInt(date, 10)}.${Number.parseInt(month, 10)}.`,
        consumption: day.consumption,
        shared: day.shared,
      };
    });
}

function computeDailyProducerTotals(intervals) {
  const days = new Map();

  for (const interval of intervals) {
    const d = interval.start;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!days.has(key)) {
      days.set(key, { key, production: 0, shared: 0 });
    }

    const bucket = days.get(key);
    bucket.production += Number(interval.sumProduction) || 0;
    bucket.shared += Number(interval.sumSharing) || 0;
  }

  return Array.from(days.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((day) => {
      const [year, month, date] = day.key.split("-");
      return {
        label: `${Number.parseInt(date, 10)}.${Number.parseInt(month, 10)}.`,
        production: day.production,
        shared: day.shared,
      };
    });
}

function computeDailyProducerBreakdown(intervals, producers) {
  const producerCount = Array.isArray(producers) ? producers.length : 0;
  const days = new Map();

  for (const interval of intervals) {
    const d = interval.start;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!days.has(key)) {
      days.set(key, {
        key,
        sharedByProducer: Array(producerCount).fill(0),
        nonSharedTotal: 0,
      });
    }

    const bucket = days.get(key);
    const intervalProducers = Array.isArray(interval.producers) ? interval.producers : [];
    for (let i = 0; i < producerCount; i += 1) {
      const producer = intervalProducers[i] || { before: 0, after: 0 };
      const before = Number(producer.before) || 0;
      const after = Number(producer.after) || 0;
      bucket.sharedByProducer[i] += Math.max(0, before - after);
      bucket.nonSharedTotal += Math.max(0, after);
    }
  }

  const sorted = Array.from(days.values()).sort((a, b) => a.key.localeCompare(b.key));
  const labels = sorted.map((day) => {
    const [year, month, date] = day.key.split("-");
    return `${Number.parseInt(date, 10)}.${Number.parseInt(month, 10)}.`;
  });

  return {
    labels,
    sharedByProducerSeries: Array.from({ length: producerCount }, (_unused, producerIndex) =>
      sorted.map((day) => Number(day.sharedByProducer[producerIndex]) || 0),
    ),
    nonSharedSeries: sorted.map((day) => Number(day.nonSharedTotal) || 0),
  };
}

function renderFlowHeatmap(data) {
  const wrap = document.getElementById("flowHeatmapWrap");
  const section = document.getElementById("flowHeatmapSection");
  if (!wrap || !section) return;

  // Only show on the main sharing page, not on the member view
  if (isMemberSharingPage) {
    section.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  const allocations = computeProducerConsumerAllocations(data);
  const consumers = data.consumers;

  // Filter out producers and consumers with zero total flow
  const activeProducers = allocations.filter(p =>
    p.consumerAllocations.some(ca => ca.shared > 0.001)
  );
  if (activeProducers.length === 0 || consumers.length === 0) {
    section.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  // Global max for colour scale
  const globalMax = Math.max(...activeProducers.flatMap(p =>
    p.consumerAllocations.map(ca => ca.shared)
  ));

  function cellBg(value) {
    if (globalMax < 0.001 || value < 0.001) return "";
    const alpha = Math.max(0.06, value / globalMax);
    return `background:rgba(39,174,96,${alpha.toFixed(3)});`;
  }

  function cellText(value, rowTotal) {
    if (value < 0.001) return `<span style="color:#ccc;">—</span>`;
    const pct = rowTotal > 0.001 ? (value / rowTotal * 100).toFixed(1) : "0";
    return `<strong>${fmt(value)}</strong><br><small style="color:#555;font-size:0.78em;">${pct} %</small>`;
  }

  const colHeaders = consumers.map(c =>
    `<th style="text-align:center;padding:6px 8px;font-size:0.8em;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(displayEan(c.name))}">${escHtml(displayEan(c.name))}</th>`
  ).join("");

  const rows = activeProducers.map(p => {
    const rowTotal = p.consumerAllocations.reduce((s, ca) => s + ca.shared, 0);
    const cells = consumers.map((_, ci) => {
      const v = p.consumerAllocations[ci] ? p.consumerAllocations[ci].shared : 0;
      return `<td style="text-align:center;padding:6px 8px;font-size:0.82em;${cellBg(v)}">${cellText(v, rowTotal)}</td>`;
    }).join("");
    return `<tr>
      <td style="padding:6px 10px;white-space:nowrap;font-weight:600;font-size:0.85em;">${escHtml(displayEan(p.name))}</td>
      ${cells}
      <td style="padding:6px 10px;text-align:right;color:var(--muted);font-size:0.82em;white-space:nowrap;">${fmt(rowTotal)}</td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `
    <table style="border-collapse:collapse;font-size:0.88em;min-width:100%;">
      <thead>
        <tr style="background:var(--surface,#f6f7f5);">
          <th style="text-align:left;padding:6px 10px;">Výrobna</th>
          ${colHeaders}
          <th style="text-align:right;padding:6px 10px;color:var(--muted);">Celkem</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  section.hidden = false;
}

function escHtml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderEffTrendChart(data) {
  const section = document.getElementById("effTrendSection");
  const el = document.getElementById("effTrendChart");
  if (!section || !el) return;

  // Member view: only show when member has own producers
  if (isMemberSharingPage) {
    if (getMemberOwnedProducerCount() === 0) { section.hidden = true; return; }
  }

  // Resolve producer filter: specific selection, member's own set, or all
  const producerIdx = gSelectedProducerName
    ? data.producers.findIndex(p => p.name === gSelectedProducerName)
    : -1;
  const ownIndices = (isMemberSharingPage && !gSelectedProducerName && gMemberScope && Array.isArray(gMemberScope.ownProducers))
    ? gMemberScope.ownProducers.map(name => data.producers.findIndex(p => p.name === name)).filter(i => i >= 0)
    : null;

  const map = new Map();
  for (const iv of data.intervals) {
    const d = iv.start instanceof Date ? iv.start : new Date(iv.start);
    const key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    const cur = map.get(key) || { production: 0, sharing: 0 };
    if (producerIdx >= 0 && Array.isArray(iv.producers) && iv.producers[producerIdx]) {
      const p = iv.producers[producerIdx];
      cur.production += Number(p.before) || 0;
      cur.sharing    += Math.max(0, (Number(p.before) || 0) - (Number(p.after) || 0));
    } else if (ownIndices && Array.isArray(iv.producers)) {
      for (const idx of ownIndices) {
        const p = iv.producers[idx];
        if (!p) continue;
        cur.production += Number(p.before) || 0;
        cur.sharing    += Math.max(0, (Number(p.before) || 0) - (Number(p.after) || 0));
      }
    } else {
      cur.production += Number(iv.sumProduction) || 0;
      cur.sharing    += Number(iv.sumSharing)    || 0;
    }
    map.set(key, cur);
  }
  const sorted = [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return;

  const titleEl = section.querySelector(".sharing-section-head h2");
  if (titleEl) {
    titleEl.textContent = producerIdx >= 0
      ? `Efektivita sdílení – ${displayEan(gSelectedProducerName)}`
      : "Efektivita sdílení – denní trend";
  }

  const labels = sorted.map(([k]) => { const [,m,d] = k.split("-"); return `${Number(d)}.${Number(m)}.`; });
  const eff    = sorted.map(([,v]) => v.production > 0.01 ? +(v.sharing / v.production * 100).toFixed(1) : null);

  destroyChartForElement(el);
  const chart = echarts.init(el);
  chart.setOption({
    tooltip: { trigger: "axis", formatter: params => {
      const p = params[0];
      return `${labels[p.dataIndex]}<br/>${p.seriesName}: ${p.value != null ? p.value + " %" : "—"}`;
    }},
    grid: { top: 20, bottom: 40, left: 50, right: 20, containLabel: false },
    xAxis: { type: "category", data: labels, axisLabel: { fontSize: 10, rotate: 45, interval: Math.floor(labels.length / 20) } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: v => v + " %", fontSize: 10 } },
    series: [{
      name: "Efektivita",
      type: "line",
      data: eff,
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: { color: "#28a745", width: 2 },
      itemStyle: { color: "#28a745" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: "rgba(40,167,69,0.35)" }, { offset: 1, color: "rgba(40,167,69,0)" }] } },
      connectNulls: false,
    }],
  });
  section.hidden = false;
}

function renderActivityHeatmap(data) {
  const section = document.getElementById("activityHeatmapSection");
  const wrap    = document.getElementById("activityHeatmapWrap");
  if (!section || !wrap) return;

  // Member view: only show when member has own producers
  if (isMemberSharingPage) {
    if (getMemberOwnedProducerCount() === 0) { section.hidden = true; return; }
  }

  // Resolve producer filter: specific selection, member's own set, or all
  const producerIdx = gSelectedProducerName
    ? data.producers.findIndex(p => p.name === gSelectedProducerName)
    : -1;
  const ownIndices = (isMemberSharingPage && !gSelectedProducerName && gMemberScope && Array.isArray(gMemberScope.ownProducers))
    ? gMemberScope.ownProducers.map(name => data.producers.findIndex(p => p.name === name)).filter(i => i >= 0)
    : null;

  const titleEl = section.querySelector(".sharing-section-head h2");
  if (titleEl) {
    titleEl.textContent = producerIdx >= 0
      ? `Aktivita sdílení – ${displayEan(gSelectedProducerName)} – den × hodina`
      : "Aktivita sdílení – den × hodina";
  }

  const dayMap = new Map();
  for (const iv of data.intervals) {
    const d = iv.start instanceof Date ? iv.start : new Date(iv.start);
    const key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    if (!dayMap.has(key)) dayMap.set(key, new Array(24).fill(0));
    let sharing;
    if (producerIdx >= 0 && Array.isArray(iv.producers) && iv.producers[producerIdx]) {
      const p = iv.producers[producerIdx];
      sharing = Math.max(0, (Number(p.before) || 0) - (Number(p.after) || 0));
    } else if (ownIndices && Array.isArray(iv.producers)) {
      sharing = 0;
      for (const idx of ownIndices) {
        const p = iv.producers[idx];
        if (!p) continue;
        sharing += Math.max(0, (Number(p.before) || 0) - (Number(p.after) || 0));
      }
    } else {
      sharing = Number(iv.sumSharing) || 0;
    }
    dayMap.get(key)[d.getHours()] += sharing;
  }
  const sorted = [...dayMap.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return;

  let globalMax = 0;
  for (const [,hours] of sorted) for (const v of hours) if (v > globalMax) globalMax = v;

  const fmtV = v => {
    if (v < 0.05) return "";
    if (v >= 1000) return (v/1000).toFixed(1) + " MWh";
    return v.toFixed(1) + " kWh";
  };

  const hourLabels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2,"0"));
  let html = '<table class="sharing-heatmap-table"><thead><tr><th></th>' +
    hourLabels.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";

  for (const [key, hours] of sorted) {
    const [,m,d] = key.split("-");
    html += `<tr><td class="sharing-heatmap-day">${Number(d)}.${Number(m)}.</td>`;
    for (const v of hours) {
      const alpha = globalMax > 0 ? v / globalMax : 0;
      const bg = alpha < 0.05
        ? "var(--surface-2,#f9fafb)"
        : `rgba(${Math.round(40+(230-40)*(1-alpha))},${Math.round(167+(243-167)*(1-alpha))},${Math.round(69+(244-69)*(1-alpha))},1)`;
      const color = alpha > 0.5 ? "#fff" : "#555";
      html += `<td style="background:${bg};color:${color}" title="${fmtV(v) || "0 kWh"}">${fmtV(v)}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  wrap.innerHTML = html;
  section.hidden = false;
}

function renderProducerDailyTotalsChart(data) {
  const canvas = document.getElementById("producerDailyTotalsChart");
  const section = document.getElementById("producerDailyTotalsSection");
  const description = section ? section.querySelector(".section-description") : null;
  if (!canvas || !section) {
    return;
  }

  const shouldRenderForPage = pageMode === "sharing"
    || pageMode === "enerkom-report"
    || (isMemberSharingPage && getMemberOwnedProducerCount() > 0);
  if (!shouldRenderForPage) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  const chartIntervals = getChartIntervalsForCurrentMode(data);
  const points = computeDailyProducerTotals(chartIntervals);
  if (!points.length) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  section.hidden = false;

  const totalProduction = points.reduce((sumValue, point) => sumValue + point.production, 0);
  const totalShared = points.reduce((sumValue, point) => sumValue + point.shared, 0);
  const remainderValues = points.map((point) => Math.max(0, point.production - point.shared));
  const producerPalette = EXECUTIVE_COLOR_PAIRS;

  if (description) {
    description.textContent = `Součet za období: výroba ${fmt(totalProduction)} | sdílení ${fmt(totalShared)}. Denní sloupce jsou skládané do jedné celkové výroby.`;
  }

  if (pageMode === "sharing") {
    const breakdown = computeDailyProducerBreakdown(chartIntervals, data.producers);
    const producerSummaries = Array.isArray(data.producers)
      ? data.producers.map((producer, index) => {
        let production = 0;
        let shared = 0;
        let remainder = 0;

        for (const interval of chartIntervals) {
          const item = Array.isArray(interval.producers) ? interval.producers[index] : null;
          const before = Number(item && item.before) || 0;
          const after = Number(item && item.after) || 0;
          production += before;
          shared += Math.max(0, before - after);
          remainder += Math.max(0, after);
        }

        const producerName = displayEan(producer.name);
        const labelOnly = producerName.includes(" (") ? producerName.split(" (")[0] : producerName;
        const eanValue = String(producer.name || "");
        const eanSuffix = eanValue.slice(-6);
        const shortName = labelOnly.length > 24 ? `${labelOnly.slice(0, 24)}...` : labelOnly;
        const firstLine = `${shortName} (${eanSuffix})`;
        const secondLine = `V:${fmt(production)} S:${fmt(shared)} Z:${fmt(remainder)}`;
        return {
          legendName: `${firstLine}\n${secondLine}`,
          totalShared: shared,
        };
      })
      : [];

    const sharedSeries = Array.isArray(data.producers)
      ? data.producers.map((producer, index) => {
        const palette = producerPalette[index % producerPalette.length];
        return {
          name: producerSummaries[index] ? producerSummaries[index].legendName : `Sdílení ${displayEan(producer.name)}`,
          type: "bar",
          stack: "daily-production",
          data: breakdown.sharedByProducerSeries[index] || [],
          barMaxWidth: 30,
          totalValue: producerSummaries[index] ? producerSummaries[index].totalShared : 0,
          itemStyle: {
            color: makeExecutiveGradient(palette[0], palette[1]),
            borderRadius: [3, 3, 0, 0],
            borderColor: "rgba(255,255,255,0.45)",
            borderWidth: 0.6,
          },
        };
      })
      : [];

    const nonSharedTotal = remainderValues.reduce((sumValue, value) => sumValue + value, 0);
    const nonSharedSeries = {
      name: `Nesdílená výroba | Z:${fmt(nonSharedTotal)}`,
      type: "bar",
      stack: "daily-production",
      data: breakdown.nonSharedSeries,
      barMaxWidth: 30,
      totalValue: nonSharedTotal,
      itemStyle: {
        color: makeExecutiveGradient("#f6b1b1", "#e67b7b"),
        borderRadius: [3, 3, 0, 0],
        borderColor: "rgba(255,255,255,0.5)",
        borderWidth: 0.6,
      },
    };

    const sortedSharedSeries = [...sharedSeries]
      .sort((a, b) => (Number(b.totalValue) || 0) - (Number(a.totalValue) || 0))
      .map(({ totalValue, ...series }) => series);
    const stackedSeries = [...sortedSharedSeries, (({ totalValue, ...series }) => series)(nonSharedSeries)];

    createChartForCanvas(canvas, withEchartTheme({
      animationDuration: 450,
      tooltip: {
        ...buildEchartTooltip(),
        trigger: "axis",
        formatter: (params) => {
          if (!params.length) return "";
          const lines = [`<strong>${params[0].axisValueLabel}</strong>`];
          let total = 0;
          for (const p of params) {
            const value = Number(p.value) || 0;
            if (value <= 0) {
              continue;
            }
            total += value;
            const label = String(p.seriesName || "").replace(/\n/g, "<br/>");
            lines.push(`${p.marker} ${label}: ${value.toFixed(2)} kWh`);
          }
          lines.push(`<strong>Celkem výroba: ${total.toFixed(2)} kWh</strong>`);
          return lines.join("<br/>");
        },
      },
      legend: {
        left: 56,
        right: 24,
        bottom: 6,
        type: "scroll",
        orient: "horizontal",
        textStyle: { color: "#20301e", fontFamily: "Space Grotesk, sans-serif", fontSize: 11, lineHeight: 15 },
      },
      grid: {
        left: 58,
        right: 30,
        top: 20,
        bottom: 126,
      },
      xAxis: {
        type: "category",
        data: breakdown.labels,
        axisLabel: {
          color: "#20301e",
          interval: Math.max(0, Math.floor(breakdown.labels.length / 12)),
          margin: 14,
        },
        axisLine: { lineStyle: { color: "#ced8c9" } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "kWh",
        axisLabel: {
          color: "#4f5f4c",
          formatter: (value) => Number(value).toFixed(2),
        },
        splitLine: { lineStyle: { color: "#dce5d8" } },
      },
      series: [
        ...stackedSeries,
      ],
    }));
    return;
  }

  createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 450,
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "axis",
      formatter: (params) => {
        if (!params.length) return "";
        const lines = [`<strong>${params[0].axisValueLabel}</strong>`];
        const total = params.reduce((sumValue, item) => sumValue + (Number(item.value) || 0), 0);
        for (const p of params) {
          lines.push(`${p.marker} ${p.seriesName}: ${Number(p.value).toFixed(2)} kWh`);
        }
        lines.push(`<strong>Celkem výroba: ${total.toFixed(2)} kWh</strong>`);
        return lines.join("<br/>");
      },
    },
    legend: {
      right: 10,
      top: 14,
      orient: "vertical",
      textStyle: { color: "#20301e", fontFamily: "Space Grotesk, sans-serif" },
    },
    grid: {
      left: 58,
      right: 170,
      top: 26,
      bottom: 56,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLabel: {
        color: "#20301e",
        interval: Math.max(0, Math.floor(points.length / 12)),
      },
      axisLine: { lineStyle: { color: "#ced8c9" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      axisLabel: {
        color: "#4f5f4c",
        formatter: (value) => Number(value).toFixed(2),
      },
      splitLine: { lineStyle: { color: "#dce5d8" } },
    },
    series: [
      {
        name: "Sdílení",
        type: "bar",
        stack: "daily-production",
        data: points.map((point) => point.shared),
        barMaxWidth: 30,
        itemStyle: {
          color: makeExecutiveGradient("#92cec1", "#5ea99b"),
          borderRadius: [0, 0, 3, 3],
          borderColor: "rgba(255,255,255,0.45)",
          borderWidth: 0.6,
        },
      },
      {
        name: "Nesdílená výroba",
        type: "bar",
        stack: "daily-production",
        data: remainderValues,
        barMaxWidth: 30,
        itemStyle: {
          color: makeExecutiveGradient("#f6b1b1", "#e67b7b"),
          borderRadius: [3, 3, 0, 0],
          borderColor: "rgba(255,255,255,0.5)",
          borderWidth: 0.6,
        },
      },
    ],
  }));
}

function renderConsumerDailyTotalsChart(data) {
  const canvas = document.getElementById("consumerDailyTotalsChart");
  const section = document.getElementById("consumerDailyTotalsSection");
  const description = section ? section.querySelector(".section-description") : null;
  if (!canvas || !section) {
    return;
  }

  const isMemberWithConsumers = isMemberSharingPage && getMemberOwnedConsumerCount() > 0;
  if (!isMemberWithConsumers) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  const chartIntervals = getChartIntervalsForCurrentMode(data, "consumer");
  const points = computeDailyConsumerTotals(chartIntervals);
  if (!points.length) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  section.hidden = false;

  const totalConsumption = points.reduce((sumValue, point) => sumValue + point.consumption, 0);
  const totalShared = points.reduce((sumValue, point) => sumValue + point.shared, 0);
  const nonSharedValues = points.map((point) => Math.max(0, point.consumption - point.shared));

  if (description) {
    description.textContent = `Součet za období: spotřeba ${fmt(totalConsumption)} | sdílení ${fmt(totalShared)}. Denní sloupce jsou skládané do jedné celkové spotřeby.`;
  }

  createChartForCanvas(canvas, withEchartTheme({
    animationDuration: 450,
    tooltip: {
      ...buildEchartTooltip(),
      trigger: "axis",
      formatter: (params) => {
        if (!params.length) return "";
        const lines = [`<strong>${params[0].axisValueLabel}</strong>`];
        const total = params.reduce((sumValue, item) => sumValue + (Number(item.value) || 0), 0);
        for (const p of params) {
          lines.push(`${p.marker} ${p.seriesName}: ${Number(p.value).toFixed(2)} kWh`);
        }
        lines.push(`<strong>Celkem spotřeba: ${total.toFixed(2)} kWh</strong>`);
        return lines.join("<br/>");
      },
    },
    legend: {
      right: 10,
      top: 14,
      orient: "vertical",
      textStyle: { color: "#20301e", fontFamily: "Space Grotesk, sans-serif" },
    },
    grid: {
      left: 58,
      right: 170,
      top: 26,
      bottom: 56,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      axisLabel: {
        color: "#20301e",
        interval: Math.max(0, Math.floor(points.length / 12)),
      },
      axisLine: { lineStyle: { color: "#ced8c9" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      axisLabel: {
        color: "#4f5f4c",
        formatter: (value) => Number(value).toFixed(2),
      },
      splitLine: { lineStyle: { color: "#dce5d8" } },
    },
    series: [
      {
        name: "Nesdílená spotřeba",
        type: "bar",
        stack: "daily-consumption",
        data: nonSharedValues,
        barMaxWidth: 30,
        itemStyle: { color: "#f59e0b" },
      },
      {
        name: "Sdílení",
        type: "bar",
        stack: "daily-consumption",
        data: points.map((point) => point.shared),
        barMaxWidth: 30,
        itemStyle: { color: "#10b981" },
      },
    ],
  }));
}

function renderBestDayChart(data) {
  const canvas = document.getElementById("bestDayChart");
  const section = document.getElementById("bestDaySection");
  const title = document.getElementById("bestDayTitle");
  const description = section ? section.querySelector(".section-description") : null;
  const toggle = document.getElementById("bestDayShowConsumption");
  const controls = section ? section.querySelector(".chart-controls") : null;
  if (!canvas || !section) return;

  const memberOwnProducerCount = getMemberOwnedProducerCount();
  const isMemberWithoutProducers = isMemberSharingPage && memberOwnProducerCount === 0;
  if (isMemberWithoutProducers) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  const chartIntervals = getChartIntervalsForCurrentMode(data);
  const bestDayMode = isMemberSharingPage ? "production" : "sharing";
  const { date, points, totalProduction } = computeBestDay(chartIntervals, { mode: bestDayMode });
  if (!points.length) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  section.hidden = false;

  if (title && date) {
    if (isMemberSharingPage) {
      title.textContent = `Výrobny - Nejlepší den – ${date}`;
    } else {
      title.textContent = `Nejlepší den – ${date}`;
    }
  }

  if (description) {
    if (isMemberSharingPage) {
      const totalSharing = points.reduce((sumValue, point) => sumValue + point.shared, 0);
      description.textContent = `Souhrn dne výroben: výroba ${fmt(totalProduction)} | sdílení ${fmt(totalSharing)}.`;
    } else {
      description.textContent = "Den s nejvyšším celkovým sdílením.";
    }
  }

  if (controls) {
    controls.hidden = isMemberSharingPage;
  }

  const redraw = () => {
    if (isMemberSharingPage) {
      drawAverageDayChart(canvas, points, {
        showProduction: true,
        showConsumption: false,
      }, null);
      return;
    }
    const showConsumption = toggle ? toggle.checked : true;
    drawAverageDayChart(canvas, points, showConsumption, null);
  };

  if (toggle) {
    toggle.removeEventListener("change", toggle._bestDayHandler);
    toggle._bestDayHandler = redraw;
    toggle.addEventListener("change", redraw);
  }

  redraw();
}

function renderConsumerBestDayChart(data) {
  const canvas = document.getElementById("consumerBestDayChart");
  const section = document.getElementById("consumerBestDaySection");
  const title = document.getElementById("consumerBestDayTitle");
  const description = section ? section.querySelector(".section-description") : null;
  if (!canvas || !section) return;

  const isMemberWithConsumers = isMemberSharingPage && getMemberOwnedConsumerCount() > 0;
  if (!isMemberWithConsumers) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  const chartIntervals = getChartIntervalsForCurrentMode(data, "consumer");
  const { date, points } = computeBestDay(chartIntervals, { mode: "sharing" });
  if (!points.length) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  section.hidden = false;

  if (title && date) {
    title.textContent = `Odběry - Nejlepší den – ${date}`;
  }

  if (description) {
    const totalConsumption = points.reduce((sumValue, point) => sumValue + point.consumption, 0);
    const totalSharing = points.reduce((sumValue, point) => sumValue + point.shared, 0);
    description.textContent = `Souhrn dne odběrů: spotřeba ${fmt(totalConsumption)} | sdílení ${fmt(totalSharing)}.`;
  }

  drawAverageDayChart(canvas, points, {
    showProduction: false,
    showConsumption: true,
  }, null);
}

function renderAverageDayChart(data) {
  const canvas = document.getElementById("averageDayChart");
  const section = document.getElementById("averageDaySection");
  const description = section ? section.querySelector(".section-description") : null;
  const toggle = document.getElementById("avgDayShowConsumption");
  const controls = section ? section.querySelector(".chart-controls") : null;
  if (!canvas || !section) return;

  const memberOwnProducerCount = getMemberOwnedProducerCount();
  const isMemberWithoutProducers = isMemberSharingPage && memberOwnProducerCount === 0;
  if (isMemberWithoutProducers) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  const chartIntervals = getChartIntervalsForCurrentMode(data);
  const points = computeAverageDay(chartIntervals);
  if (!points.length) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  section.hidden = false;

  if (description) {
    if (isMemberSharingPage) {
      const totalProduction = points.reduce((sumValue, point) => sumValue + point.production, 0);
      const totalSharing = points.reduce((sumValue, point) => sumValue + point.shared, 0);
      description.textContent = `Souhrn profilu výroben: výroba ${fmt(totalProduction)} | sdílení ${fmt(totalSharing)}.`;
    } else {
      description.textContent = "Průměr přes všechny dny v souboru – výroba, spotřeba a sdílení po 15minutových intervalech.";
    }
  }

  const sectionTitle = section ? section.querySelector("h2") : null;
  if (sectionTitle && isMemberSharingPage) {
    sectionTitle.textContent = "Výrobny - Průměrný den";
  }

  if (controls) {
    controls.hidden = isMemberSharingPage;
  }

  const redraw = () => {
    if (isMemberSharingPage) {
      drawAverageDayChart(canvas, points, {
        showProduction: true,
        showConsumption: false,
      }, null);
      return;
    }
    const showConsumption = toggle ? toggle.checked : true;
    drawAverageDayChart(canvas, points, showConsumption, null);
  };

  if (toggle) {
    toggle.removeEventListener("change", toggle._avgDayHandler);
    toggle._avgDayHandler = redraw;
    toggle.addEventListener("change", redraw);
  }

  redraw();
}

function renderConsumerAverageDayChart(data) {
  const canvas = document.getElementById("consumerAverageDayChart");
  const section = document.getElementById("consumerAverageDaySection");
  const description = section ? section.querySelector(".section-description") : null;
  if (!canvas || !section) return;

  const isMemberWithConsumers = isMemberSharingPage && getMemberOwnedConsumerCount() > 0;
  if (!isMemberWithConsumers) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  const chartIntervals = getChartIntervalsForCurrentMode(data, "consumer");
  const points = computeAverageDay(chartIntervals);
  if (!points.length) {
    section.hidden = true;
    destroyChartForElement(canvas);
    return;
  }

  section.hidden = false;

  if (description) {
    const totalConsumption = points.reduce((sumValue, point) => sumValue + point.consumption, 0);
    const totalSharing = points.reduce((sumValue, point) => sumValue + point.shared, 0);
    description.textContent = `Souhrn profilu odběrů: spotřeba ${fmt(totalConsumption)} | sdílení ${fmt(totalSharing)}.`;
  }

  const sectionTitle = section ? section.querySelector("h2") : null;
  if (sectionTitle) {
    sectionTitle.textContent = "Odběry - Průměrný den";
  }

  drawAverageDayChart(canvas, points, {
    showProduction: false,
    showConsumption: true,
  }, null);
}

function makeCsvRow(values) {
  return `${values.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")}\n`;
}

function makeSemicolonRow(values) {
  return `${values.map((v) => String(v ?? "")).join(";")}\n`;
}

function formatDateDdMmYyyy(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatEdcAllocationKey(percentValue) {
  const value = Math.max(0, (Number(percentValue) || 0) / 100);
  if (value <= 0) {
    return "";
  }
  const formatted = value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return formatted.replace(".", ",");
}

function getEdcExportContext() {
  const groupContext = getSimGroupContext();
  const groupId = String(groupContext.groupId || "");

  const today = new Date();
  const validFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    groupId,
    operation: "Editovat",
    dateFrom: formatDateDdMmYyyy(validFrom),
    dateTo: "31.12.9999",
  };
}

function buildResultCsv(data, result) {
  const producerAllocationMatrix = Array.isArray(result.producerAllocationMatrix)
    ? result.producerAllocationMatrix
    : [];
  const exportContext = getEdcExportContext();

  let csv = "";
  csv += makeSemicolonRow([
    "IdSkupinySdileni",
    "Operace",
    "EANo",
    "DatumOd",
    "DatumDo",
    "EANd1",
    "AlokacniKlic1",
    "EANd2",
    "AlokacniKlic2",
    "EANd3",
    "AlokacniKlic3",
    "EANd4",
    "AlokacniKlic4",
    "EANd5",
    "AlokacniKlic5",
  ]);

  data.consumers.forEach((consumer, consumerIndex) => {
    const producerAllocations = data.producers
      .map((producer, producerIndex) => ({
        producerEan: producer.name,
        allocationPercent: Number(producerAllocationMatrix[producerIndex] && producerAllocationMatrix[producerIndex][consumerIndex]) || 0,
      }))
      .filter((item) => item.allocationPercent > 0.0001)
      .sort((a, b) => b.allocationPercent - a.allocationPercent)
      .slice(0, 5);

    const pairColumns = [];
    for (let i = 0; i < 5; i += 1) {
      const allocation = producerAllocations[i];
      if (allocation) {
        pairColumns.push(allocation.producerEan, formatEdcAllocationKey(allocation.allocationPercent));
      } else {
        pairColumns.push("", "");
      }
    }

    csv += makeSemicolonRow([
      exportContext.groupId,
      exportContext.operation,
      consumer.name,
      exportContext.dateFrom,
      exportContext.dateTo,
      ...pairColumns,
    ]);
  });

  return csv;
}

function buildReadableCsv(data, result) {
  const producerAllocationMatrix = Array.isArray(result.producerAllocationMatrix)
    ? result.producerAllocationMatrix
    : [];

  const eanLabel = (ean) => gEanLabelMap.get(normalizeEan(ean)) || "";

  const formatPercent2 = (pct) => {
    const val = Math.max(0, Number(pct) || 0);
    return val > 0 ? val.toFixed(2).replace(".", ",") + " %" : "";
  };

  let csv = "";
  csv += makeSemicolonRow([
    "EANo",
    "NazevOdbernehomista",
    "EANd1",
    "NazevVyrobny1",
    "AlokacniKlic1",
    "EANd2",
    "NazevVyrobny2",
    "AlokacniKlic2",
    "EANd3",
    "NazevVyrobny3",
    "AlokacniKlic3",
    "EANd4",
    "NazevVyrobny4",
    "AlokacniKlic4",
    "EANd5",
    "NazevVyrobny5",
    "AlokacniKlic5",
  ]);

  data.consumers.forEach((consumer, consumerIndex) => {
    const producerAllocations = data.producers
      .map((producer, producerIndex) => ({
        producerEan: producer.name,
        allocationPercent: Number(producerAllocationMatrix[producerIndex] && producerAllocationMatrix[producerIndex][consumerIndex]) || 0,
      }))
      .filter((item) => item.allocationPercent > 0.0001)
      .sort((a, b) => b.allocationPercent - a.allocationPercent)
      .slice(0, 5);

    const pairColumns = [];
    for (let i = 0; i < 5; i += 1) {
      const allocation = producerAllocations[i];
      if (allocation) {
        pairColumns.push(
          allocation.producerEan,
          eanLabel(allocation.producerEan),
          formatPercent2(allocation.allocationPercent),
        );
      } else {
        pairColumns.push("", "", "");
      }
    }

    csv += makeSemicolonRow([
      consumer.name,
      eanLabel(consumer.name),
      ...pairColumns,
    ]);
  });

  return csv;
}

function summarizeProducerAllocationRow(row, consumers, maxItems = 5) {
  if (!Array.isArray(row) || row.length === 0) {
    return "-";
  }

  const items = row
    .map((value, index) => ({
      index,
      value: Number(value) || 0,
    }))
    .filter((item) => item.value > 0.009)
    .sort((a, b) => b.value - a.value)
    .slice(0, Math.max(1, maxItems));

  if (items.length === 0) {
    return "Bez aktivní alokace";
  }

  return items
    .map((item) => {
      const consumer = consumers[item.index];
      const consumerName = consumer ? displayEan(consumer.name) : `Odběr ${item.index + 1}`;
      return `${consumerName} (${formatPercent(item.value)})`;
    })
    .join("<br>");
}

function triggerCsvDownload(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getCurrentMonthRangeMs() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { from: from.getTime(), to: to.getTime() };
}

function setCurrentMonthFilter() {
  if (!dom.filterDateFrom || !dom.filterDateTo) return;
  const { from, to } = getCurrentMonthRangeMs();
  dom.filterDateFrom.value = toDatetimeLocalValue(new Date(from));
  dom.filterDateTo.value   = toDatetimeLocalValue(new Date(to));
  syncTimeThermometerFromInputs();
}

function getTimePresetRangeMs(preset) {
  const now = new Date();
  const thisMonthFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const thisMonthTo = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  if (preset === "thisMonth") {
    return { from: thisMonthFrom.getTime(), to: thisMonthTo.getTime() };
  }
  if (preset === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { from: from.getTime(), to: to.getTime() };
  }
  if (preset === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    return { from: from.getTime(), to: to.getTime() };
  }
  if (preset === "yesterday") {
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    return { from: from.getTime(), to: to.getTime() };
  }
  if (preset === "last7d") {
    return { from: now.getTime() - 7 * 24 * 60 * 60 * 1000, to: now.getTime() };
  }
  if (preset === "last30d") {
    return { from: now.getTime() - 30 * 24 * 60 * 60 * 1000, to: now.getTime() };
  }
  if (preset === "thisYear") {
    const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    return { from: from.getTime(), to: to.getTime() };
  }
  return null;
}

function applyTimePreset(preset, triggerReload = true) {
  if (!dom.filterDateFrom || !dom.filterDateTo) {
    return;
  }
  const range = getTimePresetRangeMs(preset);
  if (!range) {
    return;
  }

  dom.filterDateFrom.value = toDatetimeLocalValue(new Date(range.from));
  dom.filterDateTo.value = toDatetimeLocalValue(new Date(range.to));
  syncTimeThermometerFromInputs();

  if (!triggerReload) {
    return;
  }

  if (isSharingLikePage) {
    reloadServerDataWithCurrentFilter();
  } else {
    applyTimeFilterAndRender();
  }
}

function getActiveDateRangeMs() {
  const { from: defFrom, to: defTo } = getCurrentMonthRangeMs();
  const fromDate = dom.filterDateFrom ? parseDatetimeLocalValue(dom.filterDateFrom.value) : null;
  const toDate   = dom.filterDateTo   ? parseDatetimeLocalValue(dom.filterDateTo.value)   : null;
  return {
    from: fromDate ? fromDate.getTime() : defFrom,
    to:   toDate   ? toDate.getTime()   : defTo,
  };
}

function resetTimeFilterToFullRange() {
  if (!gData || !dom.filterDateFrom || !dom.filterDateTo) {
    return;
  }
  const lastIntervalStart = gData.intervals.length > 0
    ? gData.intervals[gData.intervals.length - 1].start
    : gData.dateFrom;
  dom.filterDateFrom.value = toDatetimeLocalValue(gData.dateFrom);
  dom.filterDateTo.value = toDatetimeLocalValue(lastIntervalStart);
  syncTimeThermometerFromInputs();
}

function getTimeFilterBounds() {
  if (!gData) {
    return null;
  }
  const minDate = gData.dateFrom;
  const maxDate = gData.intervals.length > 0
    ? gData.intervals[gData.intervals.length - 1].start
    : gData.dateFrom;
  return { minDate, maxDate };
}

function getNearestIntervalIndex(dateValue) {
  if (!gData || !gData.intervals || gData.intervals.length === 0) {
    return 0;
  }
  const target = dateValue.getTime();
  const intervals = gData.intervals;
  if (target <= intervals[0].start.getTime()) {
    return 0;
  }
  const lastIndex = intervals.length - 1;
  if (target >= intervals[lastIndex].start.getTime()) {
    return lastIndex;
  }

  for (let i = 0; i < intervals.length - 1; i += 1) {
    const currentTs = intervals[i].start.getTime();
    const nextTs = intervals[i + 1].start.getTime();
    if (target >= currentTs && target <= nextTs) {
      return Math.abs(target - currentTs) <= Math.abs(nextTs - target) ? i : i + 1;
    }
  }

  return 0;
}

function updateTimeThermometerFill() {
  if (!dom.timeThermometerFill || !dom.timeThermometerFrom || !dom.timeThermometerTo) {
    return;
  }
  const max = Number.parseInt(dom.timeThermometerFrom.max || "0", 10);
  if (!Number.isFinite(max) || max <= 0) {
    dom.timeThermometerFill.style.left = "0%";
    dom.timeThermometerFill.style.width = "100%";
    return;
  }
  const fromValue = Number.parseInt(dom.timeThermometerFrom.value || "0", 10);
  const toValue = Number.parseInt(dom.timeThermometerTo.value || String(max), 10);
  const left = (Math.min(fromValue, toValue) / max) * 100;
  const right = (Math.max(fromValue, toValue) / max) * 100;
  dom.timeThermometerFill.style.left = `${left}%`;
  dom.timeThermometerFill.style.width = `${Math.max(1, right - left)}%`;
}

function syncTimeThermometerFromInputs() {
  if (!gData || !dom.timeThermometerFrom || !dom.timeThermometerTo) {
    return;
  }
  const maxIndex = Math.max(0, gData.intervals.length - 1);
  dom.timeThermometerFrom.min = "0";
  dom.timeThermometerTo.min = "0";
  dom.timeThermometerFrom.max = String(maxIndex);
  dom.timeThermometerTo.max = String(maxIndex);

  if (dom.timeThermometerMinLabel && dom.timeThermometerMaxLabel) {
    const bounds = getTimeFilterBounds();
    if (bounds) {
      dom.timeThermometerMinLabel.textContent = printDate(bounds.minDate);
      dom.timeThermometerMaxLabel.textContent = printDate(bounds.maxDate);
    }
  }

  const fromDate = dom.filterDateFrom ? parseDatetimeLocalValue(dom.filterDateFrom.value) : null;
  const toDate = dom.filterDateTo ? parseDatetimeLocalValue(dom.filterDateTo.value) : null;
  const fromIndex = getNearestIntervalIndex(fromDate || gData.dateFrom);
  const toIndex = getNearestIntervalIndex(toDate || (gData.intervals[maxIndex] ? gData.intervals[maxIndex].start : gData.dateFrom));

  dom.timeThermometerFrom.value = String(Math.min(fromIndex, toIndex));
  dom.timeThermometerTo.value = String(Math.max(fromIndex, toIndex));
  updateTimeThermometerFill();
}

function applyThermometerToDateInputs() {
  if (!gData || !dom.timeThermometerFrom || !dom.timeThermometerTo || !dom.filterDateFrom || !dom.filterDateTo) {
    return;
  }
  if (gData.intervals.length === 0) {
    dom.filterDateFrom.value = toDatetimeLocalValue(gData.dateFrom);
    dom.filterDateTo.value = toDatetimeLocalValue(gData.dateFrom);
    updateTimeThermometerFill();
    return;
  }

  let fromIndex = Number.parseInt(dom.timeThermometerFrom.value || "0", 10);
  let toIndex = Number.parseInt(dom.timeThermometerTo.value || "0", 10);
  if (fromIndex > toIndex) {
    const tmp = fromIndex;
    fromIndex = toIndex;
    toIndex = tmp;
  }

  dom.timeThermometerFrom.value = String(fromIndex);
  dom.timeThermometerTo.value = String(toIndex);
  dom.filterDateFrom.value = toDatetimeLocalValue(gData.intervals[fromIndex].start);
  dom.filterDateTo.value = toDatetimeLocalValue(gData.intervals[toIndex].start);
  updateTimeThermometerFill();
}

function renderSharingPage(data) {
  if (dom.sharingSection) {
    if (isMemberSharingPage) {
      dom.sharingSection.hidden = true;
      if (dom.producerChart) {
        destroyChartForElement(dom.producerChart);
      }
    } else {
      dom.sharingSection.hidden = false;
    }
  }

  const { producerStats } = aggregateSummary(data);
  if (dom.producerChart && !isMemberSharingPage) {
    drawProducerOverviewChart(dom.producerChart, producerStats, null);
  }
  renderEmbedTenantTotals(data);
  renderEffTrendChart(data);
  renderActivityHeatmap(data);
  renderProducerDailyTotalsChart(data);
  renderConsumerDailyTotalsChart(data);
  renderProducerPieCharts(producerStats);
  renderProducerConsumerPieCharts(data);
  renderConsumerProducerPieCharts(data);
  renderBestDayChart(data);
  renderConsumerBestDayChart(data);
  renderAverageDayChart(data);
  renderConsumerAverageDayChart(data);

  if (dom.optProgress) {
    dom.optProgress.textContent = data.intervals.length > 0
      ? "Zobrazen přehled výroben: sdílení a zůstatek po sdílení. Ušlá příležitost je v detailu po najetí myší."
      : "Ve zvoleném období nejsou žádná data. Uprav časový filtr.";
  }
}

function renderEmbedTenantTotals(_data) {
  if (pageMode !== "enerkom-report") {
    return;
  }

  const totalProductionEl = document.getElementById("tenantTotalProduction");
  const totalSharingEl = document.getElementById("tenantTotalSharing");
  const currentMonthProductionEl = document.getElementById("tenantCurrentMonthProduction");
  const currentMonthSharingEl = document.getElementById("tenantCurrentMonthSharing");
  const lastMonthProductionEl = document.getElementById("tenantLastMonthProduction");
  const lastMonthSharingEl = document.getElementById("tenantLastMonthSharing");
  const totalCo2SavedEl = document.getElementById("tenantTotalCo2Saved");
  const currentMonthCo2SavedEl = document.getElementById("tenantCurrentMonthCo2Saved");
  const lastMonthCo2SavedEl = document.getElementById("tenantLastMonthCo2Saved");

  if (!totalProductionEl || !totalSharingEl) {
    return;
  }

  // Always use the full dataset for period breakdowns — the filtered view covers only
  // the last 30 days, which would cut off the beginning of the previous month.
  const fullData = gData || _data;
  if (!fullData || fullData.intervals.length === 0) {
    return;
  }

  // Derive the reference month from the LAST interval in the full dataset, not from
  // the wall clock. This way the labels stay correct even for historical imports.
  const lastInterval = fullData.intervals[fullData.intervals.length - 1];
  const lastStart = lastInterval.start instanceof Date ? lastInterval.start : new Date(lastInterval.start);
  const currentMonthStart = new Date(lastStart.getFullYear(), lastStart.getMonth(), 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(lastStart.getFullYear(), lastStart.getMonth() + 1, 1, 0, 0, 0, 0);
  const lastMonthStart = new Date(lastStart.getFullYear(), lastStart.getMonth() - 1, 1, 0, 0, 0, 0);
  const CO2_KG_PER_KWH = 0.4;

  const totals = fullData.intervals.reduce((acc, interval) => {
    const start = interval && interval.start instanceof Date ? interval.start : new Date(interval && interval.start);
    const production = Number(interval.sumProduction) || 0;
    const sharing = Number(interval.sumSharing) || 0;
    acc.production += production;
    acc.sharing += sharing;

    if (start >= currentMonthStart && start < nextMonthStart) {
      acc.currentMonthProduction += production;
      acc.currentMonthSharing += sharing;
    } else if (start >= lastMonthStart && start < currentMonthStart) {
      acc.lastMonthProduction += production;
      acc.lastMonthSharing += sharing;
    }

    return acc;
  }, {
    production: 0,
    sharing: 0,
    currentMonthProduction: 0,
    currentMonthSharing: 0,
    lastMonthProduction: 0,
    lastMonthSharing: 0,
  });

  totalProductionEl.textContent = fmt(totals.production);
  totalSharingEl.textContent = fmt(totals.sharing);

  // Update row labels to show the actual month names
  const monthFmt = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" });
  const currentMonthLabelEl = document.getElementById("tenantCurrentMonthLabel");
  const lastMonthLabelEl = document.getElementById("tenantLastMonthLabel");
  if (currentMonthLabelEl) currentMonthLabelEl.textContent = monthFmt.format(currentMonthStart);
  if (lastMonthLabelEl) lastMonthLabelEl.textContent = monthFmt.format(lastMonthStart);

  if (currentMonthProductionEl) {
    currentMonthProductionEl.textContent = fmt(totals.currentMonthProduction);
  }
  if (currentMonthSharingEl) {
    currentMonthSharingEl.textContent = fmt(totals.currentMonthSharing);
  }
  if (lastMonthProductionEl) {
    lastMonthProductionEl.textContent = fmt(totals.lastMonthProduction);
  }
  if (lastMonthSharingEl) {
    lastMonthSharingEl.textContent = fmt(totals.lastMonthSharing);
  }

  if (totalCo2SavedEl) {
    totalCo2SavedEl.textContent = `${fmtNum(totals.sharing * CO2_KG_PER_KWH)} kg CO2`;
  }
  if (currentMonthCo2SavedEl) {
    currentMonthCo2SavedEl.textContent = `${fmtNum(totals.currentMonthSharing * CO2_KG_PER_KWH)} kg CO2`;
  }
  if (lastMonthCo2SavedEl) {
    lastMonthCo2SavedEl.textContent = `${fmtNum(totals.lastMonthSharing * CO2_KG_PER_KWH)} kg CO2`;
  }
}

function setupEmbedSnippet() {
  const settingsPanel = document.getElementById("settingsPanel");
  const embedSection  = document.getElementById("embedSettingsSection");
  const codeOutput    = document.getElementById("embedCodeOutput");
  if (!codeOutput) return;

  if (pageMode === "enerkom-report") {
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get("tenantId") || "";
    const srcUrl = `${window.location.origin}/enerkom-report.html?tenantId=${encodeURIComponent(tenantId)}`;
    codeOutput.value = `<iframe src="${srcUrl}" style="width:100%;min-height:2200px;border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    if (embedSection) embedSection.hidden = false;
  } else if (pageMode === "sharing") {
    const isAdmin = window.edcAuth && typeof window.edcAuth.isAdmin === "function"
      ? window.edcAuth.isAdmin()
      : false;
    if (!isAdmin) return;
    const tenantId = (window.edcAuth && typeof window.edcAuth.getTenantId === "function"
      ? window.edcAuth.getTenantId()
      : new URLSearchParams(window.location.search).get("tenantId")) || "";
    const srcUrl = `${window.location.origin}/enerkom-report.html?tenantId=${encodeURIComponent(tenantId)}`;
    codeOutput.value = `<iframe src="${srcUrl}" style="width:100%;min-height:2200px;border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    if (settingsPanel) settingsPanel.hidden = false;
  }
}

async function loadEmbedTenantData() {
  if (pageMode !== "enerkom-report") {
    return;
  }

  setupEmbedSnippet();

  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get("tenantId") || "";
  if (!tenantId) {
    if (dom.status) {
      dom.status.textContent = "Chybí parametr tenantId v URL.";
    }
    return;
  }

  if (dom.status) {
    dom.status.textContent = "Načítám tenant data pro embed...";
  }

  const apiBase = String(window.EDC_AUTH_API_BASE || "/api").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/public/tenant-sharing-data?tenantId=${encodeURIComponent(tenantId)}`, {
    method: "GET",
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    clearAllDataSections();
    if (dom.status) {
      dom.status.textContent = payload && payload.error ? payload.error : "Nepodařilo se načíst tenant data.";
    }
    return;
  }

  const nextLabels = payload && payload.eanLabels && typeof payload.eanLabels === "object"
    ? payload.eanLabels
    : {};
  gMemberScope = null;
  gEanLabelMap = new Map([...gEanLabelMap, ...Object.entries(nextLabels)]);
  updateEanLabelsStatus();

  const hydrated = hydrateServerSharingData(payload.data);
  onDataLoaded(hydrated);
}

function renderCurrentView() {
  const activeData = getActiveData();
  if (!activeData) {
    renderAllocationSourceInfo(null);
    return;
  }

  renderMeta(activeData);
  renderAllocationSourceInfo(activeData);
  renderSummary(activeData);

  if (isSharingLikePage) {
    renderSharingPage(activeData);
  }
}

function applyTimeFilterAndRender() {
  if (!gData || !isSharingLikePage) {
    return;
  }

  const rawFrom = dom.filterDateFrom ? parseDatetimeLocalValue(dom.filterDateFrom.value) : null;
  const rawTo = dom.filterDateTo ? parseDatetimeLocalValue(dom.filterDateTo.value) : null;
  const fallbackFrom = gData.dateFrom;
  const fallbackTo = gData.intervals.length > 0 ? gData.intervals[gData.intervals.length - 1].start : gData.dateFrom;

  let fromDate = rawFrom || fallbackFrom;
  let toDate = rawTo || fallbackTo;

  if (fromDate > toDate) {
    const tmp = fromDate;
    fromDate = toDate;
    toDate = tmp;
  }

  if (dom.filterDateFrom) {
    dom.filterDateFrom.value = toDatetimeLocalValue(fromDate);
  }
  if (dom.filterDateTo) {
    dom.filterDateTo.value = toDatetimeLocalValue(toDate);
  }
  syncTimeThermometerFromInputs();

  gFilteredData = buildFilteredData(gData, fromDate, toDate);

  if (dom.timeFilterInfo) {
    if (gFilteredData.intervals.length === 0) {
      dom.timeFilterInfo.textContent = `Ve zvoleném období ${printDate(fromDate)} až ${printDate(toDate)} nejsou žádné intervaly.`;
    } else {
      dom.timeFilterInfo.textContent = `Zobrazeno ${gFilteredData.intervals.length} z ${gData.intervals.length} intervalů (${printDate(gFilteredData.dateFrom)} až ${printDate(gFilteredData.dateTo)}).`;
    }
  }

  renderCurrentView();
}

function onDataLoaded(data) {
  gData = data;
  gFilteredData = null;
  gLastResult = null;
  gHistoricalModel = null;
  gSelectedProducerName = null;
  if (!isMemberSharingPage) {
    gMemberScope = null;
  }
  gExpandedConsumerNames = new Set();
  gExpandedProducerNames = new Set();
  gProducerSearch = "";
  gConsumerSearch = "";
  gProducerSort = { key: "shared", direction: "desc" };
  gConsumerSort = { key: "shared", direction: "desc" };
  if (dom.producerSearchInput) {
    dom.producerSearchInput.value = "";
  }
  if (dom.consumerSearchInput) {
    dom.consumerSearchInput.value = "";
  }
  if (dom.status) {
    dom.status.textContent = `Nahráno: ${data.filename}`;
  }
  if (dom.optProgress) {
    dom.optProgress.textContent = "";
  }
  if (dom.exportBtn) {
    dom.exportBtn.disabled = true;
  }
  if (dom.exportReadableBtn) {
    dom.exportReadableBtn.disabled = true;
  }

  renderAllocationSourceInfo(data);

  if (pageMode === "enerkom-report") {
    const lastIntervalStart = data.intervals.length > 0
      ? data.intervals[data.intervals.length - 1].start
      : data.dateTo;
    const toDate = new Date(lastIntervalStart.getTime());
    const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const boundedFrom = fromDate < data.dateFrom ? data.dateFrom : fromDate;

    gFilteredData = buildFilteredData(data, boundedFrom, toDate);
    renderCurrentView();
    if (dom.optProgress) {
      dom.optProgress.textContent = `Grafy zobrazují posledních 30 dní (${printDate(boundedFrom)} až ${printDate(toDate)}).`;
    }
    return;
  }

  if (isSharingLikePage) {
    if (dom.timeFilterSection) {
      dom.timeFilterSection.hidden = false;
    }
    if (data._serverFiltered) {
      // Data loaded from server with date range – sync filter inputs from returned dateFrom/dateTo
      if (dom.filterDateFrom && data.dateFrom) {
        dom.filterDateFrom.value = toDatetimeLocalValue(new Date(Number(data.dateFrom)));
      }
      if (dom.filterDateTo && data.dateTo) {
        dom.filterDateTo.value = toDatetimeLocalValue(new Date(Number(data.dateTo)));
      }
      syncTimeThermometerFromInputs();
    } else {
      resetTimeFilterToFullRange();
    }
    applyTimeFilterAndRender();
  } else {
    renderMeta(data);
    renderSummary(data);
  }

  if (pageMode === "simulation") {
    if (dom.rounds) {
      const recommendedRounds = getMethodologyRoundLimit(data);
      dom.rounds.value = String(recommendedRounds);
      dom.rounds.max = String(recommendedRounds);
      dom.rounds.title = `Dle metodiky EDC lze pro tuto SSE použít maximálně ${recommendedRounds} kol.`;
    }
    renderAllocationInputs(data);
  }

  // Po nahrání pouze zobraz grafy skutečného sdílení z dat.
  const { producerStats } = aggregateSummary(data);
  if (dom.simulationResult) {
    dom.simulationResult.innerHTML = "";
  }
  if (dom.producerConsumerMatrix) {
    dom.producerConsumerMatrix.innerHTML = "";
  }
  if (dom.exportBtn) {
    dom.exportBtn.disabled = true;
  }
  if (dom.exportReadableBtn) {
    dom.exportReadableBtn.disabled = true;
  }

  if (dom.producerChart) {
    if (!isSharingLikePage) {
      drawBarChart(
        dom.producerChart,
        producerStats.map((p) => displayEan(p.name)),
        producerStats.map((p) => Math.max(0, p.before - p.after)),
        "#2563eb",
      );
    }
  }

  if (dom.consumerChart) {
    drawBarChart(dom.consumerChart, ["čekám na simulaci"], [0], "#d1d5db");
  }
  if (dom.timelineChart) {
    drawTimelineChart(dom.timelineChart, [{ label: "0", production: 0, consumption: 0, shared: 0 }], null);
  }
  if (dom.optProgress && !isSharingLikePage) {
    dom.optProgress.textContent =
      pageMode === "simulation"
        ? `Připraven metodický návrh simulace | ${getHistoricalSharingModel(data).sourceSummary} | doporučeno ${getMethodologyRoundLimit(data)} kol.`
        : "Zobrazen graf sdílení za výrobny z nahraných dat (bez simulace).";
  }
}

function hydrateServerSharingData(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Server nevrátil data ve správném formátu.");
  }

  const producers = Array.isArray(payload.producers) ? payload.producers : [];
  const consumers = Array.isArray(payload.consumers) ? payload.consumers : [];
  const intervalsRaw = Array.isArray(payload.intervals) ? payload.intervals : [];

  const intervals = intervalsRaw.map((interval) => ({
    start: new Date(Number(interval.start) || 0),
    producers: Array.isArray(interval.producers) ? interval.producers.map((item) => ({
      before: Number(item.before) || 0,
      after: Number(item.after) || 0,
      missed: Number(item.missed) || 0,
    })) : [],
    consumers: Array.isArray(interval.consumers) ? interval.consumers.map((item) => ({
      before: Number(item.before) || 0,
      after: Number(item.after) || 0,
      missed: Number(item.missed) || 0,
    })) : [],
    exactAllocations: Array.isArray(interval.exactAllocations)
      ? interval.exactAllocations.map((row) => Array.isArray(row) ? row.map((value) => Number(value) || 0) : [])
      : null,
    sumProduction: Number(interval.sumProduction) || 0,
    sumSharing: Number(interval.sumSharing) || 0,
    sumMissed: Number(interval.sumMissed) || 0,
  }));

  const fallbackFrom = intervals.length > 0 ? intervals[0].start : new Date();
  const fallbackTo = intervals.length > 0
    ? new Date(intervals[intervals.length - 1].start.getTime() + 15 * 60000)
    : fallbackFrom;

  return {
    filename: String(payload.filename || "server-edc.csv"),
    producers: producers.map((item, idx) => ({ name: String(item.name || ""), csvIndex: Number(item.csvIndex) || idx })),
    consumers: consumers.map((item, idx) => ({ name: String(item.name || ""), csvIndex: Number(item.csvIndex) || idx })),
    intervals,
    hasExactAllocations: Boolean(payload.hasExactAllocations),
    dateFrom: Number.isFinite(Number(payload.dateFrom)) ? new Date(Number(payload.dateFrom)) : fallbackFrom,
    dateTo: Number.isFinite(Number(payload.dateTo)) ? new Date(Number(payload.dateTo)) : fallbackTo,
    _serverFiltered: true,
  };
}

function clearAllDataSections() {
  gData = null;
  gFilteredData = null;
  gLastResult = null;
  gHistoricalModel = null;
  gMemberScope = null;
  renderAllocationSourceInfo(null);

  const sectionIds = [
    "metaSection", "summarySection", "sharingSection", "simulationSection", "timeFilterSection",
    "producerPieChartsSection", "producerConsumerPieChartsSection", "consumerProducerPieChartsSection",
    "effTrendSection", "activityHeatmapSection",
    "producerDailyTotalsSection", "consumerDailyTotalsSection",
    "bestDaySection", "consumerBestDaySection", "averageDaySection", "consumerAverageDaySection",
  ];
  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  if (dom.methodologyMatrix) {
    dom.methodologyMatrix.innerHTML = "";
  }
  if (dom.methodologyPriorityMatrix) {
    dom.methodologyPriorityMatrix.innerHTML = "";
  }
  if (dom.historicalWeightsStatus) {
    dom.historicalWeightsStatus.textContent = "";
  }
}

async function loadMemberSharingData() {
  if (!isMemberSharingPage) {
    return;
  }

  const token = (window.edcAuth && typeof window.edcAuth.getToken === "function"
    ? window.edcAuth.getToken()
    : localStorage.getItem("edc_auth_token")) || "";
  if (!token) {
    if (dom.status) {
      dom.status.textContent = "Pro zobrazení dat se přihlas.";
    }
    return;
  }

  if (dom.status) {
    dom.status.textContent = "Načítám data z databáze...";
  }

  const apiBase = String(window.EDC_AUTH_API_BASE || "/api").replace(/\/$/, "");
  const selectedMemberId = window.edcAuth && typeof window.edcAuth.getSelectedMemberId === "function"
    ? window.edcAuth.getSelectedMemberId()
    : "";
  const isAdmin = window.edcAuth && typeof window.edcAuth.isAdmin === "function"
    ? window.edcAuth.isAdmin()
    : false;

  console.log("[EDC-ANALYZER] loadMemberSharingData: selectedMemberId=", selectedMemberId, "isAdmin=", isAdmin);

  const { from: dateFrom, to: dateTo } = getActiveDateRangeMs();
  let endpoint = `/member/sharing-data?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  if (selectedMemberId && isAdmin) {
    const tenantId = (window.edcAuth && typeof window.edcAuth.getUser === "function"
      ? (window.edcAuth.getUser() && window.edcAuth.getUser().tenantId)
      : null) || (window.edcAuthState && window.edcAuthState.user && window.edcAuthState.user.tenantId) || "";
    endpoint = `/admin/member-sharing-data?tenantId=${encodeURIComponent(tenantId)}&memberId=${encodeURIComponent(selectedMemberId)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    console.log("[EDC-ANALYZER] Loading member data with endpoint:", endpoint);
  } else if (!selectedMemberId && isAdmin) {
    console.log("[EDC-ANALYZER] Admin with no member selected, waiting for selection...");
    clearAllDataSections();
    if (dom.status) {
      dom.status.textContent = "Vyberte člena ze seznamu výše.";
    }
    return;
  } else {
    console.log("[EDC-ANALYZER] Using default member endpoint (no member selected or not admin)");
  }

  const response = await fetch(`${apiBase}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const errMsg = payload && payload.error ? payload.error : "Nepodarilo se nacist data clena.";
    clearAllDataSections();
    if (isSharingLikePage && dom.timeFilterSection) {
      dom.timeFilterSection.hidden = false;
    }
    if (dom.status) {
      dom.status.textContent = errMsg;
    }
    return;
  }

  const nextLabels = payload && payload.eanLabels && typeof payload.eanLabels === "object"
    ? payload.eanLabels
    : {};
  gMemberScope = payload && payload.memberScope && typeof payload.memberScope === "object"
    ? payload.memberScope
    : { ownProducers: [], ownConsumers: [] };
  gEanLabelMap = new Map([...gEanLabelMap, ...Object.entries(nextLabels)]);
  updateEanLabelsStatus();

  const hydrated = hydrateServerSharingData(payload.data);
  console.log("[EDC-ANALYZER] loadMemberSharingData completed successfully, data loaded");
  onDataLoaded(hydrated);
}

async function loadAdminGroupSharingData() {
  if (!["sharing", "simulation"].includes(pageMode)) {
    return;
  }

  const token = (window.edcAuth && typeof window.edcAuth.getToken === "function"
    ? window.edcAuth.getToken()
    : localStorage.getItem("edc_auth_token")) || "";
  if (!token) {
    return;
  }

  const isAdmin = window.edcAuth && typeof window.edcAuth.isAdmin === "function"
    ? window.edcAuth.isAdmin()
    : false;
  if (!isAdmin) {
    return;
  }

  const selectedGroupId = window.edcAuth && typeof window.edcAuth.getSelectedGroupId === "function"
    ? window.edcAuth.getSelectedGroupId()
    : "";

  if (!selectedGroupId) {
    clearAllDataSections();
    if (dom.status) {
      dom.status.textContent = "Vyberte skupinu sdílení ze seznamu výše.";
    }
    return;
  }

  if (dom.status) {
    dom.status.textContent = "Načítám data skupiny sdílení...";
  }

  const apiBase = String(window.EDC_AUTH_API_BASE || "/api").replace(/\/$/, "");
  const { from: dateFrom, to: dateTo } = getActiveDateRangeMs();
  const response = await fetch(`${apiBase}/admin/sharing-data?groupId=${encodeURIComponent(selectedGroupId)}&dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const errMsg = payload && payload.error ? payload.error : "Nepodařilo se načíst data skupiny sdílení.";
    clearAllDataSections();
    if (dom.timeFilterSection) {
      dom.timeFilterSection.hidden = false;
    }
    if (dom.status) {
      dom.status.textContent = errMsg;
    }
    return;
  }

  const nextLabels = payload && payload.eanLabels && typeof payload.eanLabels === "object"
    ? payload.eanLabels
    : {};
  gMemberScope = null;
  gEanLabelMap = new Map([...gEanLabelMap, ...Object.entries(nextLabels)]);
  updateEanLabelsStatus();

  const hydrated = hydrateServerSharingData(payload.data);
  onDataLoaded(hydrated);
}

async function readFileAsText(file) {
  const buffer = await file.arrayBuffer();

  // UTF-8 first (strict). If bytes are not valid UTF-8, fall back to Windows-1250 for Czech CSV exports.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1250").decode(buffer);
  }
}

if (dom.uploadCsv) {
  dom.uploadCsv.addEventListener("change", async () => {
    const file = dom.uploadCsv.files && dom.uploadCsv.files[0];
    if (!file) {
      return;
    }

    try {
      if (dom.status) {
        dom.status.textContent = "Načítám a zpracovávám CSV...";
      }
      await gEanLabelMapReady;
      const text = await readFileAsText(file);
      const parsed = parseCsv(text, file.name);
      onDataLoaded(parsed);
    } catch (err) {
      if (dom.status) {
        dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  });
}

function reloadServerDataWithCurrentFilter() {
  if (isMemberSharingPage) {
    gEanLabelMapReady.then(() => loadMemberSharingData()).catch((err) => {
      if (dom.status) dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
    });
  } else if (["sharing", "simulation"].includes(pageMode)) {
    gEanLabelMapReady.then(() => loadAdminGroupSharingData()).catch((err) => {
      if (dom.status) dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
    });
  }
}

if (dom.filterDateFrom) {
  dom.filterDateFrom.addEventListener("change", () => {
    if (isSharingLikePage) {
      reloadServerDataWithCurrentFilter();
    } else {
      applyTimeFilterAndRender();
    }
  });
}

if (dom.filterDateTo) {
  dom.filterDateTo.addEventListener("change", () => {
    if (isSharingLikePage) {
      reloadServerDataWithCurrentFilter();
    } else {
      applyTimeFilterAndRender();
    }
  });
}

if (dom.timeThermometerFrom) {
  dom.timeThermometerFrom.addEventListener("input", () => {
    applyThermometerToDateInputs();
    applyTimeFilterAndRender();
  });
}

if (dom.timeThermometerTo) {
  dom.timeThermometerTo.addEventListener("input", () => {
    applyThermometerToDateInputs();
    applyTimeFilterAndRender();
  });
}

if (dom.timeFilterResetBtn) {
  dom.timeFilterResetBtn.addEventListener("click", () => {
    if (!gData) {
      return;
    }
    if (isSharingLikePage) {
      setCurrentMonthFilter();
      reloadServerDataWithCurrentFilter();
    } else {
      resetTimeFilterToFullRange();
      applyTimeFilterAndRender();
    }
  });
}

if (dom.presetThisMonthBtn) {
  dom.presetThisMonthBtn.addEventListener("click", () => {
    if (dom.timePresetSelect) {
      dom.timePresetSelect.value = "thisMonth";
    }
    applyTimePreset("thisMonth");
  });
}

if (dom.presetLastMonthBtn) {
  dom.presetLastMonthBtn.addEventListener("click", () => {
    if (dom.timePresetSelect) {
      dom.timePresetSelect.value = "lastMonth";
    }
    applyTimePreset("lastMonth");
  });
}

if (dom.timePresetApplyBtn) {
  dom.timePresetApplyBtn.addEventListener("click", () => {
    const preset = dom.timePresetSelect ? dom.timePresetSelect.value : "thisMonth";
    if (preset === "custom") {
      if (isSharingLikePage) {
        reloadServerDataWithCurrentFilter();
      } else {
        applyTimeFilterAndRender();
      }
      return;
    }
    applyTimePreset(preset);
  });
}

if (dom.timePresetSelect) {
  dom.timePresetSelect.addEventListener("change", () => {
    const preset = dom.timePresetSelect.value;
    if (preset === "custom") {
      return;
    }
    applyTimePreset(preset);
  });
}

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.kind === "hist-weight") {
    const nextWeights = readHistoricalWeightsFromInputs();
    setHistoricalWeights(nextWeights);
    if (pageMode === "simulation" && gData) {
      renderAllocationInputs(gData);
      if (gLastResult) {
        gLastResult = null;
        if (dom.exportBtn) { dom.exportBtn.disabled = true; }
        if (dom.exportReadableBtn) { dom.exportReadableBtn.disabled = true; }
        if (dom.optProgress) {
          dom.optProgress.textContent = "Váhy aktualizovány. Pro nové výsledky spusť znovu optimalizaci.";
        }
      }
    }
    return;
  }
});

if (dom.producerSummary) {
  dom.producerSummary.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const sortHeader = target.closest("th[data-sort-table='producer']");
    if (sortHeader instanceof HTMLElement) {
      const sortKey = sortHeader.dataset.sortKey;
      if (!sortKey || !gData) {
        return;
      }
      toggleSort(gProducerSort, sortKey);
      renderSummary(getActiveData());
      return;
    }
    const toggleBtn = target.closest("button.row-toggle");
    if (toggleBtn instanceof HTMLElement && gData && isSharingLikePage) {
      const row = target.closest("tr[data-producer-name]");
      if (row instanceof HTMLTableRowElement) {
        const producerName = row.dataset.producerName;
        if (producerName) {
          if (gExpandedProducerNames.has(producerName)) {
            gExpandedProducerNames.delete(producerName);
          } else {
            gExpandedProducerNames.add(producerName);
          }
          renderSummary(getActiveData());
          return;
        }
      }
    }
    const row = target.closest("tr[data-producer-name]");
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const producerName = row.dataset.producerName;
    if (!producerName || !gData || !isSharingLikePage) {
      return;
    }
    gSelectedProducerName = gSelectedProducerName === producerName ? null : producerName;
    renderSummary(getActiveData());
    const activeData = getActiveData();
    renderEffTrendChart(activeData);
    renderActivityHeatmap(activeData);
  });
}

if (dom.consumerSummary) {
  dom.consumerSummary.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !gData || !isSharingLikePage) {
      return;
    }
    const sortHeader = target.closest("th[data-sort-table='consumer']");
    if (sortHeader instanceof HTMLElement) {
      const sortKey = sortHeader.dataset.sortKey;
      if (!sortKey) {
        return;
      }
      toggleSort(gConsumerSort, sortKey);
      renderSummary(getActiveData());
      return;
    }
    const toggleBtn = target.closest("button.row-toggle");
    if (toggleBtn instanceof HTMLElement) {
      const row = target.closest("tr[data-consumer-name]");
      if (row instanceof HTMLTableRowElement) {
        const consumerName = row.dataset.consumerName;
        if (consumerName) {
          if (gExpandedConsumerNames.has(consumerName)) {
            gExpandedConsumerNames.delete(consumerName);
          } else {
            gExpandedConsumerNames.add(consumerName);
          }
          renderSummary(getActiveData());
          return;
        }
      }
    }
    const row = target.closest("tr[data-consumer-name]");
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const consumerName = row.dataset.consumerName;
    if (!consumerName) {
      return;
    }
    if (gExpandedConsumerNames.has(consumerName)) {
      gExpandedConsumerNames.delete(consumerName);
    } else {
      gExpandedConsumerNames.add(consumerName);
    }
    renderSummary(getActiveData());
  });
}

if (dom.producerSearchInput) {
  dom.producerSearchInput.addEventListener("input", () => {
    gProducerSearch = dom.producerSearchInput.value.trim();
    if (!getActiveData()) {
      return;
    }
    renderSummary(getActiveData());
  });
}

if (dom.consumerSearchInput) {
  dom.consumerSearchInput.addEventListener("input", () => {
    gConsumerSearch = dom.consumerSearchInput.value.trim();
    if (!getActiveData()) {
      return;
    }
    renderSummary(getActiveData());
  });
}

if (dom.producerSearchClear) {
  dom.producerSearchClear.addEventListener("click", () => {
    dom.producerSearchInput.value = "";
    gProducerSearch = "";
    if (!getActiveData()) {
      return;
    }
    renderSummary(getActiveData());
  });
}

if (dom.consumerSearchClear) {
  dom.consumerSearchClear.addEventListener("click", () => {
    dom.consumerSearchInput.value = "";
    gConsumerSearch = "";
    if (!getActiveData()) {
      return;
    }
    renderSummary(getActiveData());
  });
}

if (dom.toggleAllConsumersBtn) {
  dom.toggleAllConsumersBtn.addEventListener("click", () => {
    const activeData = getActiveData();
    if (!activeData) {
      return;
    }
    const { consumerStats } = aggregateSummary(activeData);
    const allocations = computeProducerConsumerAllocations(activeData);
    const selectedProducerAllocations = gSelectedProducerName
      ? allocations.find((producer) => producer.name === gSelectedProducerName) || null
      : null;
    const visibleConsumers = selectedProducerAllocations
      ? consumerStats.filter((consumer) => selectedProducerAllocations.consumerAllocations.some((allocation) => allocation.name === consumer.name && allocation.shared > 0.001))
      : consumerStats;

    const allVisibleExpanded = visibleConsumers.length > 0 && visibleConsumers.every((consumer) => gExpandedConsumerNames.has(consumer.name));
    if (allVisibleExpanded) {
      visibleConsumers.forEach((consumer) => gExpandedConsumerNames.delete(consumer.name));
    } else {
      visibleConsumers.forEach((consumer) => gExpandedConsumerNames.add(consumer.name));
    }
    renderSummary(activeData);
  });
}

if (dom.clearProducerFilterBtn) {
  dom.clearProducerFilterBtn.addEventListener("click", () => {
    if (!gData || !gSelectedProducerName) {
      return;
    }
    gSelectedProducerName = null;
    renderSummary(getActiveData());
  });
}

function getSimToken() {
  return (window.edcAuth && typeof window.edcAuth.getToken === "function"
    ? window.edcAuth.getToken()
    : localStorage.getItem("edc_auth_token")) || "";
}

function getSimGroupContext() {
  const groupId = (window.edcAuth && typeof window.edcAuth.getSelectedGroupId === "function"
    ? window.edcAuth.getSelectedGroupId()
    : "") || "";
  const tenantId = (window.edcAuth && typeof window.edcAuth.getUser === "function"
    ? (window.edcAuth.getUser() && window.edcAuth.getUser().tenantId)
    : null) || "";
  const dateFrom = gData && gData.dateFrom ? gData.dateFrom.getTime() : 0;
  const dateTo = gData && gData.dateTo ? gData.dateTo.getTime() : 0;
  return { groupId, tenantId, dateFrom, dateTo };
}

function setSimBusyState(busy) {
  if (dom.simulateBtn) { dom.simulateBtn.disabled = busy; }
  if (dom.optimizeBtn) { dom.optimizeBtn.disabled = busy; }
  const bar = document.getElementById("simProgressBar");
  if (bar) { bar.style.display = busy ? "" : "none"; }
  if (!busy) {
    const progressEl = document.getElementById("simProgressValue");
    const etaEl = document.getElementById("simProgressEta");
    if (progressEl) { progressEl.value = 0; }
    if (etaEl) { etaEl.textContent = ""; }
  }
}

function updateSimProgressBar(percent, etaSecs, message) {
  const progressEl = document.getElementById("simProgressValue");
  const etaEl = document.getElementById("simProgressEta");
  if (progressEl) { progressEl.value = percent; }
  if (etaEl) {
    const etaText = etaSecs != null && etaSecs > 1
      ? ` | odhad dokončení: ${etaSecs < 60 ? `${Math.round(etaSecs)} s` : `${Math.round(etaSecs / 60)} min`}`
      : "";
    etaEl.textContent = (message || "") + etaText;
  }
}

async function streamSimulationJob(jobId, token, onProgress, onDone, onError) {
  const apiBase = String(window.EDC_AUTH_API_BASE || "/api").replace(/\/$/, "");
  let resp;
  try {
    resp = await fetch(`${apiBase}/admin/simulate/${jobId}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    onError(`Chyba připojení: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!resp.ok) {
    onError("Nepodařilo se připojit ke streamu průběhu.");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) { continue; }
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === "progress") { onProgress(evt); }
        else if (evt.type === "done") { onDone(evt); return; }
        else if (evt.type === "error") { onError(evt.message || "Chyba simulace."); return; }
      }
    }
  } finally {
    reader.cancel();
  }
}

async function runServerSimulation() {
  if (!gData) { return; }
  const token = getSimToken();
  if (!token) {
    if (dom.optProgress) { dom.optProgress.textContent = "Pro spuštění simulace se přihlas."; }
    return;
  }

  const { groupId, tenantId, dateFrom, dateTo } = getSimGroupContext();
  const rounds = Number.parseInt(dom.rounds && dom.rounds.value, 10) || 0;
  const maxFails = Number.parseInt(dom.maxFails && dom.maxFails.value, 10) || 200;
  const restarts = Number.parseInt(dom.restarts && dom.restarts.value, 10) || 5;
  const weights = readHistoricalWeightsFromInputs();

  setSimBusyState(true);
  if (dom.optProgress) {
    dom.optProgress.textContent = "Spouštím výpočet nejlepší alokace na serveru...";
  }

  const apiBase = String(window.EDC_AUTH_API_BASE || "/api").replace(/\/$/, "");
  let jobId;
  try {
    const startResp = await fetch(`${apiBase}/admin/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        groupId: groupId || null,
        tenantId: tenantId ? String(tenantId) : null,
        dateFrom,
        dateTo,
        mode: "optimize",
        rounds,
        maxFails,
        restarts,
        weights,
      }),
    });
    let startPayload = {};
    try { startPayload = await startResp.json(); } catch { /* noop */ }
    if (!startResp.ok) {
      if (dom.optProgress) { dom.optProgress.textContent = `Chyba spuštění: ${startPayload.error || "Neznámá chyba."}`; }
      setSimBusyState(false);
      return;
    }
    jobId = startPayload.jobId;
  } catch (err) {
    if (dom.optProgress) { dom.optProgress.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`; }
    setSimBusyState(false);
    return;
  }

  updateSimProgressBar(0, null, "Optimalizace zahájena...");

  await streamSimulationJob(
    jobId,
    token,
    (evt) => {
      updateSimProgressBar(evt.percent, evt.etaSecs, evt.message);
      if (dom.optProgress) { dom.optProgress.textContent = evt.message || ""; }
    },
    (evt) => {
      setSimBusyState(false);
      const result = evt.result;
      if (!result) { return; }

      // server nevrací profit — zajisti kompatibilitu s renderSimulationResult
      if (!Array.isArray(result.profitPerEan)) {
        result.profitPerEan = Array(result.sharingPerEan.length).fill(0);
      }
      if (result.totalProfit == null) { result.totalProfit = 0; }

      gLastResult = result;
      if (dom.exportBtn) { dom.exportBtn.disabled = false; }
      if (dom.exportReadableBtn) { dom.exportReadableBtn.disabled = false; }

      const sourceSummary = result.sourceSummary || "";
      if (dom.optProgress) {
        dom.optProgress.textContent = `HOTOVO | Nejlepší sdílení: ${result.totalSharing.toFixed(2)} kWh | ${sourceSummary}`;
      }

      renderSimulationResult(gData, result);
      renderProducerConsumerMatrix(gData, result);
      renderCharts(gData, result);
    },
    (errMsg) => {
      setSimBusyState(false);
      if (dom.optProgress) { dom.optProgress.textContent = `Chyba: ${errMsg}`; }
    },
  );
}

if (dom.simulateBtn) {
  dom.simulateBtn.addEventListener("click", () => {
    runServerSimulation().catch((err) => {
      setSimBusyState(false);
      if (dom.optProgress) { dom.optProgress.textContent = `Chyba výpočtu: ${err instanceof Error ? err.message : String(err)}`; }
    });
  });
}

if (dom.optimizeBtn) {
  dom.optimizeBtn.addEventListener("click", () => {
    runServerSimulation().catch((err) => {
      setSimBusyState(false);
      if (dom.optProgress) { dom.optProgress.textContent = `Chyba optimalizace: ${err instanceof Error ? err.message : String(err)}`; }
    });
  });
}

if (dom.exportBtn) {
  dom.exportBtn.addEventListener("click", () => {
  if (!gData || !gLastResult) {
    return;
  }
  const content = buildResultCsv(gData, gLastResult);
  const base = gData.filename.replace(/\.csv$/i, "");
  triggerCsvDownload(`${base}_edc_import.csv`, content);
  });
}

if (dom.exportReadableBtn) {
  dom.exportReadableBtn.addEventListener("click", () => {
    if (!gData || !gLastResult) {
      return;
    }
    const content = buildReadableCsv(gData, gLastResult);
    const base = gData.filename.replace(/\.csv$/i, "");
    triggerCsvDownload(`${base}_prehledny.csv`, content);
  });
}

if (isMemberSharingPage) {
  window.addEventListener("edc-auth-state", () => {
    gEanLabelMapReady
      .then(() => loadMemberSharingData())
      .catch((err) => {
        if (dom.status) {
          dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
        }
      });
  });

  window.addEventListener("edc-member-filter-changed", (event) => {
    console.log("[EDC-ANALYZER] edc-member-filter-changed event received:", event.detail);
    gEanLabelMapReady
      .then(() => loadMemberSharingData())
      .catch((err) => {
        if (dom.status) {
          dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
        }
      });
  });

  gEanLabelMapReady
    .then(() => loadMemberSharingData())
    .catch((err) => {
      if (dom.status) {
        dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
      }
    });

  // Expose API for auth-client.js
  window.edcAnalyzer = {
    refreshMemberData: function() {
      console.log("[EDC-ANALYZER] refreshMemberData called from external");
      gEanLabelMapReady
        .then(() => loadMemberSharingData())
        .catch((err) => {
          if (dom.status) {
            dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
          }
        });
    }
  };
}

if (["sharing", "simulation"].includes(pageMode)) {
  window.addEventListener("edc-auth-state", () => {
    setupEmbedSnippet();
    gEanLabelMapReady
      .then(() => loadAdminGroupSharingData())
      .catch((err) => {
        if (dom.status) {
          dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
        }
      });
  });

  window.addEventListener("edc-sharing-group-changed", () => {
    gEanLabelMapReady
      .then(() => loadAdminGroupSharingData())
      .catch((err) => {
        if (dom.status) {
          dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
        }
      });
  });

  gEanLabelMapReady
    .then(() => loadAdminGroupSharingData())
    .catch((err) => {
      if (dom.status) {
        dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
      }
    });

  window.edcAnalyzer = window.edcAnalyzer || {};
  window.edcAnalyzer.refreshGroupData = function () {
    gEanLabelMapReady
      .then(() => loadAdminGroupSharingData())
      .catch((err) => {
        if (dom.status) {
          dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
        }
      });
  };
}

if (pageMode === "enerkom-report") {
  gEanLabelMapReady
    .then(() => loadEmbedTenantData())
    .catch((err) => {
      if (dom.status) {
        dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
      }
    });
}

if (isSharingLikePage) {
  window.addEventListener("edc-sharing-flow-mode-changed", () => {
    if (!gData) {
      return;
    }
    renderCurrentView();
  });
}

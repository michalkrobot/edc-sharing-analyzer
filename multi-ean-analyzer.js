const dom = {
  uploadCsv: document.getElementById("uploadCsv"),
  rounds: document.getElementById("rounds"),
  maxFails: document.getElementById("maxFails"),
  restarts: document.getElementById("restarts"),
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
  allocationsTable: document.getElementById("allocationsTable"),
  simulationResult: document.getElementById("simulationResult"),
  producerConsumerMatrix: document.getElementById("producerConsumerMatrix"),
  consumerChart: document.getElementById("consumerChart"),
  producerChart: document.getElementById("producerChart"),
  timelineChart: document.getElementById("timelineChart"),
  simulateBtn: document.getElementById("simulateBtn"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  exportBtn: document.getElementById("exportBtn"),
  optProgress: document.getElementById("optProgress"),
};

const pageMode = document.body.dataset.page || "simulation";

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
let gLastResult = null;
let gEanLabelMap = new Map(Object.entries(DEFAULT_EAN_LABELS));
let gSelectedProducerName = null;
let gExpandedConsumerNames = new Set();
let gProducerSearch = "";
let gConsumerSearch = "";
let gProducerSort = { key: "shared", direction: "desc" };
let gConsumerSort = { key: "shared", direction: "desc" };

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

async function loadEanLabelMap() {
  try {
    const resp = await fetch("eany.csv", { cache: "no-store" });
    if (!resp.ok) {
      return;
    }
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
  } catch {
    // Pri otevreni pres file:// muze fetch failnout; pak zustane fallback na surove EAN.
  }
}

const gEanLabelMapReady = loadEanLabelMap();

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

function renderMeta(data) {
  dom.metaSection.hidden = false;
  dom.metaFilename.textContent = data.filename;
  dom.metaFrom.textContent = printDate(data.dateFrom);
  dom.metaTo.textContent = printDate(data.dateTo);
  dom.metaIntervals.textContent = String(data.intervals.length);
  dom.metaProducers.textContent = String(data.producers.length);
  dom.metaConsumers.textContent = String(data.consumers.length);
}

function renderSummary(data) {
  const { producerStats, consumerStats } = aggregateSummary(data);
  const producerAllocations = computeProducerConsumerAllocations(data);
  const selectedProducerAllocations = pageMode === "sharing" && gSelectedProducerName
    ? producerAllocations.find((producer) => producer.name === gSelectedProducerName) || null
    : null;
  const consumerBreakdownMap = new Map();
  for (const producer of producerAllocations) {
    for (const allocation of producer.consumerAllocations) {
      if (allocation.shared <= 0.001) {
        continue;
      }
      const breakdown = consumerBreakdownMap.get(allocation.name) || [];
      breakdown.push({ producerName: producer.name, shared: allocation.shared });
      consumerBreakdownMap.set(allocation.name, breakdown);
    }
  }
  consumerBreakdownMap.forEach((breakdown) => {
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
    .filter((producer) => matchesSummarySearch(producer.name, gProducerSearch))
    .sort((a, b) => compareValues(a[gProducerSort.key], b[gProducerSort.key], gProducerSort.direction));

  for (const p of visibleProducers) {
    const tr = document.createElement("tr");
    if (pageMode === "sharing") {
      tr.className = "interactive-row";
      tr.dataset.producerName = p.name;
      if (gSelectedProducerName === p.name) {
        tr.classList.add("is-selected");
      }
    }
    tr.innerHTML =
      `<td class='ean'>${p.label}</td><td>${fmt(p.before)}</td><td>${fmt(p.after)}</td><td>${fmt(p.shared)}</td><td>${fmt(p.missed)}</td>`;
    pBody.appendChild(tr);
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
  const filteredConsumers = (producerConsumerShares
    ? consumerStats.filter((consumer) => producerConsumerShares.has(consumer.name))
    : consumerStats)
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

      const breakdownRows = breakdown.length === 0
        ? "<tr><td class='ean' colspan='3'>K tomuto odběrnému EAN nebylo nalezeno žádné sdílení od výroben.</td></tr>"
        : breakdown
          .map((item) => {
            const highlighted = gSelectedProducerName && item.producerName === gSelectedProducerName ? " class='is-highlighted'" : "";
            const percentage = breakdownTotal > 0 ? (item.shared / breakdownTotal) * 100 : 0;
            return `<tr${highlighted}><td class='ean'>${displayEan(item.producerName)}</td><td>${fmt(item.shared)}</td><td>${percentage.toFixed(1)} %</td></tr>`;
          })
          .join("");
      const breakdownBars = breakdown.length === 0
        ? ""
        : breakdown
          .map((item) => {
            const percentage = breakdownTotal > 0 ? (item.shared / breakdownTotal) * 100 : 0;
            return `
              <div class='consumer-breakdown-bar-row'>
                <div class='consumer-breakdown-bar-label'>${displayEan(item.producerName)}</div>
                <div class='consumer-breakdown-bar-track'>
                  <div class='consumer-breakdown-bar-fill' style='width: ${percentage.toFixed(1)}%'></div>
                </div>
                <div class='consumer-breakdown-bar-value'>${percentage.toFixed(1)} %</div>
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
          <table class='consumer-breakdown-table'>
            <thead>
              <tr><th class='ean'>Výrobní EAN</th><th>Sdíleno</th><th>Podíl</th></tr>
            </thead>
            <tbody>${breakdownRows}</tbody>
          </table>
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
      : "Zobrazeny jsou všechny odběrné EAN.";
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
  const remembered = data.consumers.map((c, idx) => Number.parseFloat(localStorage.getItem(`multi_ean_alloc_${c.name}`) || String((100 / data.consumers.length).toFixed(2) || (idx === 0 ? 100 : 0))));

  const rememberedCost = data.consumers.map((c) => Number.parseFloat(localStorage.getItem(`multi_ean_cost_${c.name}`) || "2"));

  dom.allocationsTable.innerHTML =
    "<thead><tr><th class='ean'>Odběrný EAN</th><th>Alokace [%]</th><th>Cena [Kč/kWh]</th><th>Souhrn</th></tr></thead>";
  const body = document.createElement("tbody");

  data.consumers.forEach((c, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class='ean'>${displayEan(c.name)}</td>
       <td><input data-kind='alloc' data-index='${i}' type='number' min='0' max='100' step='0.01' value='${remembered[i].toFixed(2)}' /></td>
       <td><input data-kind='cost' data-index='${i}' type='number' min='0' max='100' step='0.01' value='${rememberedCost[i].toFixed(2)}' /></td>
       <td id='rowResult_${i}' class='ean'>-</td>`;
    body.appendChild(tr);
  });

  const sumRow = document.createElement("tr");
  sumRow.innerHTML = "<td class='ean'><strong>Součet alokací</strong></td><td id='allocSumCell'><strong>0.00 %</strong></td><td></td><td class='ean'>Musí být <= 100 %</td>";
  body.appendChild(sumRow);

  dom.allocationsTable.appendChild(body);
  updateAllocationSum();
}

function readAllocationInputs() {
  const allocations = [];
  const costs = [];

  document.querySelectorAll("input[data-kind='alloc']").forEach((el) => {
    allocations.push(Number.parseFloat(el.value) || 0);
  });
  document.querySelectorAll("input[data-kind='cost']").forEach((el) => {
    costs.push(Number.parseFloat(el.value) || 0);
  });

  if (gData) {
    gData.consumers.forEach((c, i) => {
      localStorage.setItem(`multi_ean_alloc_${c.name}`, String(allocations[i]));
      localStorage.setItem(`multi_ean_cost_${c.name}`, String(costs[i]));
    });
  }

  return { allocations, costs };
}

function updateAllocationSum() {
  const { allocations } = readAllocationInputs();
  const s = sum(allocations);
  const cell = document.getElementById("allocSumCell");
  if (!cell) {
    return;
  }
  const cls = s <= 100.0001 ? "value-ok" : "value-danger";
  cell.innerHTML = `<strong class='${cls}'>${s.toFixed(2)} %</strong>`;
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

  const sharingPerConsumer = Array(data.consumers.length).fill(0);
  const sharingPerProducer = Array(data.producers.length).fill(0);
  const producerToConsumer = Array.from({ length: data.producers.length }, () =>
    Array(data.consumers.length).fill(0),
  );
  const perRoundPerEan = Array.from({ length: rounds }, () => Array(data.consumers.length).fill(0));
  const intervalTotals = [];

  for (const interval of data.intervals) {
    const producerRemaining = interval.producers.map((p) => Math.round(p.before * 100));
    const remaining = interval.consumers.map((c) => Math.round(c.before * 100));
    const intervalProduction = sum(producerRemaining) / 100;
    const intervalConsumption = sum(remaining) / 100;
    let intervalShared = 0;

    for (let round = 0; round < rounds; round += 1) {
      const energyThisRound = sum(producerRemaining);
      if (energyThisRound <= 0) {
        break;
      }

      for (let i = 0; i < allocations.length; i += 1) {
        const quota = Math.trunc((energyThisRound * allocations[i]) / 100);
        const shared = Math.min(remaining[i], quota);
        if (shared <= 0) {
          continue;
        }

        remaining[i] -= shared;
        intervalShared += shared / 100;
        perRoundPerEan[round][i] += shared / 100;

        const takeFromProducers = proportionalTake(producerRemaining, shared);
        for (let p = 0; p < takeFromProducers.length; p += 1) {
          const take = takeFromProducers[p];
          producerRemaining[p] -= take;
          const kwh = take / 100;
          sharingPerProducer[p] += kwh;
          producerToConsumer[p][i] += kwh;
        }

        sharingPerConsumer[i] += shared / 100;
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
  };
}

function simulateFastTotalProfit(data, allocations, costsPerKwh, rounds) {
  return simulateSharing(data, allocations, costsPerKwh, rounds).totalProfit;
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
    "<thead><tr><th class='ean'>Odběrný EAN</th><th>Sdíleno</th><th>Zisk</th><th>Průměr na kolo</th></tr></thead>";

  const body = document.createElement("tbody");
  for (let i = 0; i < data.consumers.length; i += 1) {
    const tr = document.createElement("tr");
    const avgPerRound = sum(result.sharingPerRoundPerEan.map((row) => row[i])) / result.sharingPerRoundPerEan.length;

    tr.innerHTML =
      `<td class='ean'>${displayEan(data.consumers[i].name)}</td><td>${fmt(result.sharingPerEan[i])}</td><td>${result.profitPerEan[i].toFixed(2)} Kc</td><td>${fmt(avgPerRound)}</td>`;
    body.appendChild(tr);

    const rowResult = document.getElementById(`rowResult_${i}`);
    if (rowResult) {
      rowResult.textContent = `Sdíleno ${result.sharingPerEan[i].toFixed(2)} kWh | ${result.profitPerEan[i].toFixed(2)} Kč`;
    }
  }

  const total = document.createElement("tr");
  total.innerHTML =
    `<td class='ean'><strong>CELKEM</strong></td><td><strong>${fmt(result.totalSharing)}</strong></td><td><strong>${result.totalProfit.toFixed(2)} Kc</strong></td><td></td>`;
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
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  const pad = { l: 42, r: 10, t: 14, b: 50 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const maxVal = Math.max(...values, 1);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#1f2a1d";
  ctx.font = "12px Space Grotesk";

  ctx.strokeStyle = "#dce5d8";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    const v = maxVal * (1 - i / 4);
    ctx.fillText(v.toFixed(1), 4, y + 4);
  }

  const barW = chartW / values.length;
  for (let i = 0; i < values.length; i += 1) {
    const barH = (values[i] / maxVal) * chartH;
    const x = pad.l + i * barW + 4;
    const y = pad.t + chartH - barH;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(6, barW - 8), barH);

    ctx.save();
    ctx.translate(x + Math.max(6, barW - 8) / 2, h - 6);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#263024";
    const shortLabel = labels[i].length > 16 ? `${labels[i].slice(0, 15)}...` : labels[i];
    ctx.fillText(shortLabel, 0, 0);
    ctx.restore();
  }
}

function drawProducerOverviewChart(canvas, producerStats) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const labels = producerStats.map((p) => displayEan(p.name));
  const production = producerStats.map((p) => Math.max(0, p.before));
  const shared = producerStats.map((p) => Math.max(0, p.before - p.after));
  const missed = producerStats.map((p) => Math.max(0, p.missed));
  const remainder = producerStats.map((p) => Math.max(0, p.after - p.missed));

  const w = canvas.width;
  const h = canvas.height;
  const pad = { l: 50, r: 12, t: 60, b: 48 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const maxVal = Math.max(...production, 1);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#1f2a1d";
  ctx.font = "13px Space Grotesk";

  ctx.strokeStyle = "#dce5d8";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    const v = maxVal * (1 - i / 4);
    ctx.fillText(v.toFixed(1), 4, y + 5);
  }

  const stackSeries = [
    { values: shared, color: "#0f766e", label: "Sdílení" },
    { values: missed, color: "#b91c1c", label: "Ušlá příležitost" },
    { values: remainder, color: "#d97706", label: "Zůstatek" },
  ];

  const groupW = chartW / Math.max(1, labels.length);
  const barW = Math.max(20, Math.min(80, groupW - 8));

  for (let i = 0; i < labels.length; i += 1) {
    const x = pad.l + i * groupW + (groupW - barW) / 2;
    let currentTop = pad.t + chartH;

    // Collect small segments for separate text layout
    const smallSegments = [];

    // Draw stacked segments with percentage labels
    for (let s = 0; s < stackSeries.length; s += 1) {
      const val = stackSeries[s].values[i];
      const barH = (val / maxVal) * chartH;
      const y = currentTop - barH;
      ctx.fillStyle = stackSeries[s].color;
      ctx.fillRect(x, y, barW, barH);

      // Add percentage text - inside if tall enough, otherwise collect for later
      const pct = ((val / production[i]) * 100).toFixed(0);
      ctx.font = "bold 12px Space Grotesk";
      
      if (barH > 22) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pct}%`, x + barW / 2, y + barH / 2);
        ctx.textBaseline = "alphabetic";
      } else if (barH > 0) {
        smallSegments.push({ y: y + barH / 2, pct });
      }
      ctx.textAlign = "left";

      currentTop = y;
    }

    // Draw text for small segments with proper spacing
    const lineHeight = 15;
    smallSegments.sort((a, b) => a.y - b.y);
    let lastY = -Infinity;
    for (const seg of smallSegments) {
      let textY = Math.max(seg.y, lastY + lineHeight);
      ctx.fillStyle = "#20301e";
      ctx.font = "bold 12px Space Grotesk";
      ctx.textAlign = "left";
      ctx.fillText(`${seg.pct}%`, x + barW + 12, textY);
      lastY = textY;
    }

    // Blue outline marks the total production column height
    const totalH = (production[i] / maxVal) * chartH;
    const totalY = pad.t + chartH - totalH;
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, totalY - 1, barW + 2, totalH + 2);

    // Show total production value just above the column (clamped below label area)
    ctx.fillStyle = "#1f2a1d";
    ctx.font = "bold 11px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText(production[i].toFixed(1), x + barW / 2, Math.max(pad.t - 3, totalY - 5));
    ctx.textAlign = "left";

    // Producer name label at top (above chart area), word-wrapped
    const maxLabelWidth = groupW - 4;
    ctx.font = "bold 11px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1f2a1d";
    const labelWords = labels[i].split(" ");
    let curLine = "";
    const lines = [];
    for (const word of labelWords) {
      const testLine = curLine ? `${curLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxLabelWidth - 4) {
        curLine = testLine;
      } else {
        if (curLine) lines.push(curLine);
        curLine = word;
      }
    }
    if (curLine) lines.push(curLine);

    const lineH = 13;
    const maxLines = Math.min(lines.length, 4);
    for (let l = 0; l < maxLines; l += 1) {
      ctx.fillText(lines[l], x + barW / 2, 12 + l * lineH);
    }
    ctx.textAlign = "left";
  }

  // Legend – horizontal, centered at the bottom
  const legendItems = [
    { color: "#2563eb", label: "Výroba (celkem)" },
    { color: "#0f766e", label: "Sdílení" },
    { color: "#b91c1c", label: "Ušlá příležitost" },
    { color: "#d97706", label: "Zůstatek" },
  ];
  ctx.font = "11px Space Grotesk";
  let totalLegendWidth = 0;
  for (const item of legendItems) {
    totalLegendWidth += 16 + ctx.measureText(item.label).width + 20;
  }
  let legendX = (w - totalLegendWidth) / 2;
  const legendY = h - 14;
  for (const item of legendItems) {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, legendY - 10, 12, 12);
    legendX += 16;
    ctx.fillStyle = "#20301e";
    ctx.fillText(item.label, legendX, legendY);
    legendX += ctx.measureText(item.label).width + 20;
  }
}

function drawTimelineChart(canvas, points) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  const pad = { l: 46, r: 12, t: 16, b: 52 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const maxVal = Math.max(
    ...points.map((p) => p.production),
    ...points.map((p) => p.consumption),
    ...points.map((p) => p.shared),
    1,
  );

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#dce5d8";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
  }

  const drawSeries = (key, color) => {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    for (let i = 0; i < points.length; i += 1) {
      const x = pad.l + (chartW * i) / Math.max(1, points.length - 1);
      const y = pad.t + chartH - (points[i][key] / maxVal) * chartH;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  };

  drawSeries("production", "#2563eb");
  drawSeries("consumption", "#d97706");
  drawSeries("shared", "#0f766e");

  ctx.fillStyle = "#20301e";
  ctx.font = "12px Space Grotesk";
  ctx.fillText("modrá: výroba", 8, h - 30);
  ctx.fillText("oranžová: spotřeba", 150, h - 30);
  ctx.fillText("zelená: sdíleno", 320, h - 30);

  const skip = Math.ceil(points.length / 12);
  for (let i = 0; i < points.length; i += skip) {
    const x = pad.l + (chartW * i) / Math.max(1, points.length - 1);
    ctx.save();
    ctx.translate(x, h - 5);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(points[i].label.slice(5, 16), 0, 0);
    ctx.restore();
  }
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

  drawTimelineChart(dom.timelineChart, result.intervalTotals);
}

function drawPieChart(canvas, values, colors) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = Math.min(w, h) / 2 - 8;

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  let currentAngle = -Math.PI / 2;
  
  for (let i = 0; i < values.length; i += 1) {
    const sliceAngle = (values[i] / total) * 2 * Math.PI;
    
    // Draw pie slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = colors[i];
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw percentage label
    const midAngle = currentAngle + sliceAngle / 2;
    const labelDist = radius * 0.65;
    const labelX = centerX + Math.cos(midAngle) * labelDist;
    const labelY = centerY + Math.sin(midAngle) * labelDist;
    
    const pct = ((values[i] / total) * 100).toFixed(0);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Space Grotesk";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    if (pct > 5) {
      ctx.fillText(`${pct}%`, labelX, labelY);
    }

    currentAngle += sliceAngle;
  }
}

function renderProducerPieCharts(producerStats) {
  const container = document.getElementById("producerPieCharts");
  const section = document.getElementById("producerPieChartsSection");
  
  if (!container || !section) return;
  
  container.innerHTML = "";
  
  const colors = ["#0f766e", "#b91c1c", "#d97706"];
  
  for (const producer of producerStats) {
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
    
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 180;
    wrapper.appendChild(canvas);
    
    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = "font-size: 10px; color: #5f6d5c; margin-top: 0.4rem; line-height: 1.3;";
    statsDiv.innerHTML = `
      <div><span style="color: #0f766e;">●</span> Sdílení: ${shared.toFixed(1)} kWh</div>
      <div><span style="color: #b91c1c;">●</span> Ušlá příl.: ${missed.toFixed(1)} kWh</div>
      <div><span style="color: #d97706;">●</span> Zůstatek: ${remainder.toFixed(1)} kWh</div>
    `;
    wrapper.appendChild(statsDiv);
    
    container.appendChild(wrapper);
    
    drawPieChart(canvas, values, colors);
  }
  
  section.hidden = false;
}

const CONSUMER_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#9333ea", "#dc2626", "#b45309", "#4f46e5",
  "#059669", "#0284c7", "#c026d3", "#ca8a04", "#15803d",
];

function computeProducerConsumerAllocations(data) {
  const result = data.producers.map((p) => ({
    name: p.name,
    consumerAllocations: data.consumers.map((c) => ({ name: c.name, shared: 0 })),
  }));

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

  container.innerHTML = "";

  const allocations = computeProducerConsumerAllocations(data);

  for (const producer of allocations) {
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

    const wrapper = document.createElement("div");
    wrapper.className = "pie-chart-container";

    const h3 = document.createElement("h3");
    h3.textContent = displayEan(producer.name);
    wrapper.appendChild(h3);

    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 180;
    wrapper.appendChild(canvas);

    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = "font-size: 10px; color: #5f6d5c; margin-top: 0.4rem; line-height: 1.3;";
    statsDiv.innerHTML = mainItems
      .map((it, i) => `<div><span style="color: ${colors[i]}">●</span> ${it.name ? displayEan(it.name) : "Ostatní"}: ${it.shared.toFixed(1)} kWh</div>`)
      .join("");
    wrapper.appendChild(statsDiv);

    container.appendChild(wrapper);

    drawPieChart(canvas, values, colors);
  }

  section.hidden = false;
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

function drawAverageDayChart(canvas, points, showConsumption) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const pad = { l: 52, r: 180, t: 20, b: 50 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;

  const seriesForScale = [
    ...points.map((p) => p.production),
    ...points.map((p) => p.shared),
    ...(showConsumption ? points.map((p) => p.consumption) : []),
  ];
  const maxVal = Math.max(...seriesForScale, 1);

  ctx.clearRect(0, 0, w, h);

  // Grid lines + Y-axis labels
  ctx.strokeStyle = "#dce5d8";
  ctx.fillStyle = "#5f6d5c";
  ctx.font = "11px Space Grotesk";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    const v = maxVal * (1 - i / 4);
    ctx.fillText(v.toFixed(2), pad.l - 4, y + 4);
  }
  ctx.textAlign = "left";

  const drawSeries = (key, color, width) => {
    ctx.beginPath();
    ctx.lineWidth = width || 2;
    ctx.strokeStyle = color;
    for (let i = 0; i < points.length; i += 1) {
      const x = pad.l + (chartW * i) / Math.max(1, points.length - 1);
      const y = pad.t + chartH - (points[i][key] / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawSeries("production", "#2563eb", 2);
  if (showConsumption) drawSeries("consumption", "#d97706", 2);
  drawSeries("shared", "#0f766e", 2.5);

  // X-axis labels – show every full hour
  ctx.fillStyle = "#263024";
  ctx.font = "10px Space Grotesk";
  ctx.textAlign = "center";
  for (let i = 0; i < points.length; i += 1) {
    if (points[i].label.endsWith(":00")) {
      const x = pad.l + (chartW * i) / Math.max(1, points.length - 1);
      ctx.fillText(points[i].label, x, pad.t + chartH + 14);
      ctx.strokeStyle = "#e5e9e4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + chartH);
      ctx.stroke();
    }
  }
  ctx.textAlign = "left";

  // Legend on the right
  const legendX = w - pad.r + 16;
  const legendItems = [
    { color: "#2563eb", label: "Výroba" },
    ...(showConsumption ? [{ color: "#d97706", label: "Spotřeba" }] : []),
    { color: "#0f766e", label: "Sdílení" },
  ];
  ctx.font = "12px Space Grotesk";
  let legendY = pad.t + 10;
  for (const item of legendItems) {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = "#20301e";
    ctx.fillText(item.label, legendX + 18, legendY + 10);
    legendY += 22;
  }
}

function computeBestDay(intervals) {
  // Group intervals by date string (YYYY-MM-DD)
  const days = new Map();
  for (const interval of intervals) {
    const d = interval.start;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(interval);
  }

  // Find the day with the highest total sharing
  let bestKey = null;
  let bestSharing = -1;
  for (const [key, dayIntervals] of days) {
    const totalSharing = dayIntervals.reduce((s, iv) => s + iv.sumSharing, 0);
    if (totalSharing > bestSharing) {
      bestSharing = totalSharing;
      bestKey = key;
    }
  }

  if (!bestKey) return { date: null, points: [] };

  const dayIntervals = days.get(bestKey);
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

  return { date: dateLabel, points };
}

function renderBestDayChart(data) {
  const canvas = document.getElementById("bestDayChart");
  const section = document.getElementById("bestDaySection");
  const title = document.getElementById("bestDayTitle");
  const toggle = document.getElementById("bestDayShowConsumption");
  if (!canvas || !section) return;

  const { date, points } = computeBestDay(data.intervals);
  if (!points.length) return;

  if (title && date) title.textContent = `Nejlepší den – ${date}`;

  const redraw = () => {
    const showConsumption = toggle ? toggle.checked : true;
    drawAverageDayChart(canvas, points, showConsumption);
  };

  if (toggle) {
    toggle.removeEventListener("change", toggle._bestDayHandler);
    toggle._bestDayHandler = redraw;
    toggle.addEventListener("change", redraw);
  }

  redraw();
  section.hidden = false;
}

function renderAverageDayChart(data) {
  const canvas = document.getElementById("averageDayChart");
  const section = document.getElementById("averageDaySection");
  const toggle = document.getElementById("avgDayShowConsumption");
  if (!canvas || !section) return;

  const points = computeAverageDay(data.intervals);

  const redraw = () => {
    const showConsumption = toggle ? toggle.checked : true;
    drawAverageDayChart(canvas, points, showConsumption);
  };

  if (toggle) {
    toggle.removeEventListener("change", toggle._avgDayHandler);
    toggle._avgDayHandler = redraw;
    toggle.addEventListener("change", redraw);
  }

  redraw();
  section.hidden = false;
}

function makeCsvRow(values) {
  return `${values.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")}\n`;
}

function buildResultCsv(data, result) {
  let csv = "";
  csv += makeCsvRow(["Summary", "Value"]);
  csv += makeCsvRow(["File", data.filename]);
  csv += makeCsvRow(["From", printDate(data.dateFrom)]);
  csv += makeCsvRow(["To", printDate(data.dateTo)]);
  csv += makeCsvRow(["Total sharing kWh", fmtNum(result.totalSharing)]);
  csv += makeCsvRow(["Total profit CZK", fmtNum(result.totalProfit)]);
  csv += "\n";

  csv += makeCsvRow(["Consumer", "Allocation %", "Sharing kWh", "Profit CZK"]);
  result.allocations.forEach((a, i) => {
    csv += makeCsvRow([
      data.consumers[i].name,
      fmtNum(a),
      fmtNum(result.sharingPerEan[i]),
      fmtNum(result.profitPerEan[i]),
    ]);
  });
  csv += "\n";

  csv += makeCsvRow(["Producer", "Contributed sharing kWh"]);
  result.sharingPerProducer.forEach((s, i) => {
    csv += makeCsvRow([data.producers[i].name, fmtNum(s)]);
  });
  csv += "\n";

  csv += makeCsvRow(["Producer", ...data.consumers.map((c) => c.name)]);
  for (let p = 0; p < data.producers.length; p += 1) {
    csv += makeCsvRow([
      data.producers[p].name,
      ...data.consumers.map((_, c) => fmtNum(result.producerToConsumer[p][c])),
    ]);
  }
  csv += "\n";

  csv += makeCsvRow(["Interval", "Production kWh", "Consumption kWh", "Shared kWh"]);
  result.intervalTotals.forEach((it) => {
    csv += makeCsvRow([it.label, fmtNum(it.production), fmtNum(it.consumption), fmtNum(it.shared)]);
  });

  return csv;
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

function onDataLoaded(data) {
  gData = data;
  gLastResult = null;
  gSelectedProducerName = null;
  gExpandedConsumerNames = new Set();
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
  dom.status.textContent = `Nahráno: ${data.filename}`;
  if (dom.optProgress) {
    dom.optProgress.textContent = "";
  }
  if (dom.exportBtn) {
    dom.exportBtn.disabled = true;
  }
  renderMeta(data);
  renderSummary(data);
  if (pageMode === "simulation") {
    renderAllocationInputs(data);
  }
  if (pageMode === "sharing" && dom.sharingSection) {
    dom.sharingSection.hidden = false;
  }

  // Po nahrání pouze zobraz grafy skutečného sdílení z CSV (bez simulace).
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

  if (dom.producerChart) {
    if (pageMode === "sharing") {
      drawProducerOverviewChart(dom.producerChart, producerStats);
      renderProducerPieCharts(producerStats);
      renderProducerConsumerPieCharts(data);
      renderBestDayChart(data);
      renderAverageDayChart(data);
    } else {
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
    drawTimelineChart(dom.timelineChart, [{ label: "0", production: 0, consumption: 0, shared: 0 }]);
  }
  if (dom.optProgress) {
    dom.optProgress.textContent =
      pageMode === "sharing"
        ? "Zobrazen přehled výroben: výroba, sdílení, zůstatek a ušlá příležitost."
        : "Zobrazen graf sdílení za výrobny z nahraných dat (bez simulace).";
  }
}

async function readFileAsText(file) {
  return await file.text();
}

dom.uploadCsv.addEventListener("change", async () => {
  const file = dom.uploadCsv.files && dom.uploadCsv.files[0];
  if (!file) {
    return;
  }

  try {
    dom.status.textContent = "Načítám a zpracovávám CSV...";
    await gEanLabelMapReady;
    const text = await readFileAsText(file);
    const parsed = parseCsv(text, file.name);
    onDataLoaded(parsed);
  } catch (err) {
    dom.status.textContent = `Chyba: ${err instanceof Error ? err.message : String(err)}`;
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.kind === "alloc" || target.dataset.kind === "cost") {
    updateAllocationSum();
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
      renderSummary(gData);
      return;
    }
    const row = target.closest("tr[data-producer-name]");
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const producerName = row.dataset.producerName;
    if (!producerName || !gData || pageMode !== "sharing") {
      return;
    }
    gSelectedProducerName = gSelectedProducerName === producerName ? null : producerName;
    renderSummary(gData);
  });
}

if (dom.consumerSummary) {
  dom.consumerSummary.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !gData || pageMode !== "sharing") {
      return;
    }
    const sortHeader = target.closest("th[data-sort-table='consumer']");
    if (sortHeader instanceof HTMLElement) {
      const sortKey = sortHeader.dataset.sortKey;
      if (!sortKey) {
        return;
      }
      toggleSort(gConsumerSort, sortKey);
      renderSummary(gData);
      return;
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
    renderSummary(gData);
  });
}

if (dom.producerSearchInput) {
  dom.producerSearchInput.addEventListener("input", () => {
    gProducerSearch = dom.producerSearchInput.value.trim();
    if (!gData) {
      return;
    }
    renderSummary(gData);
  });
}

if (dom.consumerSearchInput) {
  dom.consumerSearchInput.addEventListener("input", () => {
    gConsumerSearch = dom.consumerSearchInput.value.trim();
    if (!gData) {
      return;
    }
    renderSummary(gData);
  });
}

if (dom.producerSearchClear) {
  dom.producerSearchClear.addEventListener("click", () => {
    dom.producerSearchInput.value = "";
    gProducerSearch = "";
    if (!gData) {
      return;
    }
    renderSummary(gData);
  });
}

if (dom.consumerSearchClear) {
  dom.consumerSearchClear.addEventListener("click", () => {
    dom.consumerSearchInput.value = "";
    gConsumerSearch = "";
    if (!gData) {
      return;
    }
    renderSummary(gData);
  });
}

if (dom.toggleAllConsumersBtn) {
  dom.toggleAllConsumersBtn.addEventListener("click", () => {
    if (!gData) {
      return;
    }
    const { consumerStats } = aggregateSummary(gData);
    const allocations = computeProducerConsumerAllocations(gData);
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
    renderSummary(gData);
  });
}

if (dom.clearProducerFilterBtn) {
  dom.clearProducerFilterBtn.addEventListener("click", () => {
    if (!gData || !gSelectedProducerName) {
      return;
    }
    gSelectedProducerName = null;
    renderSummary(gData);
  });
}

if (dom.simulateBtn) {
  dom.simulateBtn.addEventListener("click", () => {
  if (!gData) {
    return;
  }

  try {
    const rounds = Number.parseInt(dom.rounds.value, 10);
    const { allocations, costs } = readAllocationInputs();
    const result = simulateSharing(gData, allocations, costs, rounds);
    result.allocations = allocations.slice();
    gLastResult = result;
    if (dom.optProgress) {
      dom.optProgress.textContent = "Simulace dokončena.";
    }
    if (dom.exportBtn) {
      dom.exportBtn.disabled = false;
    }
    renderSimulationResult(gData, result);
    renderProducerConsumerMatrix(gData, result);
    renderCharts(gData, result);
  } catch (err) {
    if (dom.optProgress) {
      dom.optProgress.textContent = `Chyba simulace: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  });
}

if (dom.optimizeBtn) {
  dom.optimizeBtn.addEventListener("click", () => {
  if (!gData) {
    return;
  }

  try {
    const rounds = Number.parseInt(dom.rounds.value, 10);
    const maxFails = Number.parseInt(dom.maxFails.value, 10);
    const restarts = Number.parseInt(dom.restarts.value, 10);
    const { costs } = readAllocationInputs();

    if (dom.optProgress) {
      dom.optProgress.textContent = "Spouštím optimalizaci...";
    }

    setTimeout(() => {
      const result = optimizeAllocations(gData, costs, rounds, maxFails, restarts, (step, total, best) => {
        if (dom.optProgress) {
          dom.optProgress.textContent = `Optimalizace ${step}/${total} | Nejlepší zisk: ${best.totalProfit.toFixed(2)} Kč`;
        }
      });

      const inputs = document.querySelectorAll("input[data-kind='alloc']");
      result.allocations.forEach((v, i) => {
        if (inputs[i]) {
          inputs[i].value = v.toFixed(2);
        }
      });
      updateAllocationSum();

      gLastResult = result;
      if (dom.exportBtn) {
        dom.exportBtn.disabled = false;
      }
      renderSimulationResult(gData, result);
      renderProducerConsumerMatrix(gData, result);
      renderCharts(gData, result);
      if (dom.optProgress) {
        dom.optProgress.textContent = `HOTOVO | Nejlepší zisk: ${result.totalProfit.toFixed(2)} Kč | Sdíleno: ${result.totalSharing.toFixed(2)} kWh`;
      }
    }, 20);
  } catch (err) {
    if (dom.optProgress) {
      dom.optProgress.textContent = `Chyba optimalizace: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  });
}

if (dom.exportBtn) {
  dom.exportBtn.addEventListener("click", () => {
  if (!gData || !gLastResult) {
    return;
  }
  const content = buildResultCsv(gData, gLastResult);
  const base = gData.filename.replace(/\.csv$/i, "");
  triggerCsvDownload(`${base}_multi_ean_results.csv`, content);
  });
}

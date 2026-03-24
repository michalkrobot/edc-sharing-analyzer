const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("./multi-ean-analyzer.js", "utf8");
const csv = fs.readFileSync("./Export-dat-2026-03-23-07-18-report-23_03_2026_19_19.csv", "utf8");

function makeEl(id) {
  return {
    id,
    value: "5",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    files: null,
    className: "",
    width: 640,
    height: 300,
    addEventListener: () => {},
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    click: () => {},
    getContext: () => ({
      clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
      fillText: () => {}, save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}
    }),
  };
}

const elements = new Map();
const ids = [
  "uploadCsv","rounds","maxFails","restarts","status","metaSection","summarySection","simulationSection",
  "metaFilename","metaFrom","metaTo","metaIntervals","metaProducers","metaConsumers",
  "producerSummary","consumerSummary","allocationsTable","simulationResult","producerConsumerMatrix",
  "consumerChart","producerChart","timelineChart","simulateBtn","optimizeBtn","exportBtn","optProgress"
];
for (const id of ids) elements.set(id, makeEl(id));

elements.get("rounds").value = "5";
elements.get("maxFails").value = "300";
elements.get("restarts").value = "5";

const context = {
  console,
  Math,
  Date,
  Number,
  String,
  Array,
  Object,
  Blob: function Blob() {},
  URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: (fn) => fn(),
  document: {
    getElementById: (id) => elements.get(id) || makeEl(id),
    querySelectorAll: () => [],
    createElement: () => makeEl("created"),
    addEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {} },
  },
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "multi-ean-analyzer.js" });

const data = context.parseCsv(csv, "attached.csv");
const allocations = Array(data.consumers.length).fill(100 / data.consumers.length);
const costs = Array(data.consumers.length).fill(2);
const result = context.simulateSharing(data, allocations, costs, 5);

console.log("PARSE_OK", data.producers.length, data.consumers.length, data.intervals.length);
console.log("SIM_OK", result.totalSharing.toFixed(2), result.totalProfit.toFixed(2));
console.log("MATRIX_OK", result.producerToConsumer.length, result.producerToConsumer[0].length);

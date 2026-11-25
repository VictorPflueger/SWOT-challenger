// The data contracts (brief section 10): every contract accepts a valid answer and refuses a broken one;
// every request schema, in the form js/wire.js sends, carries no keyword the API refuses and stays far
// inside its limits of 24 optional and 16 union-typed parameters; the shared handoff schema's JSON file
// and its module are equal, and both the brief's example (4.3) and a SWOT handoff validate against it.
// Each kind of check first fails on a planted error. Prints SCHEMAS CONTROLS OK and SCHEMAS OK.
// Usage: node tests/schemas.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { validate, describeErrors } from "../js/schema.js";
import { toWire, refused, countParameters } from "../js/wire.js";
import { SCHEMAS, REQUESTS, STRATEGY_KINDS } from "../schemas/swot.js";
import HANDOFF_MODULE from "../schemas/strategy-challenge-1.js";

const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const controls = [];
const checks = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => checks.push([!!ok, what]);
const ok = (value, name) => validate(value, SCHEMAS[name], SCHEMAS);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---- valid answers, one per contract -----------------------------------------------------------------
const item = (id, text, source = "user", extra = {}) => ({ id, text, source, added: false, ...extra });
const VALID = {
  Item: item("s4", "Installed base of 40,000 drives", "ai", { confidence: "medium", basis: "Annual report figures for drives in service" }),
  Swot: {
    company: { name: "Fictional Drives", sector: "industrial_manufacturing", country: "DE", description: "Maker of industrial drives and gearboxes" },
    strengths: [item("s1", "Quality")], weaknesses: [item("w1", "Too few service technicians")],
    opportunities: [item("o1", "Drives as a service")], threats: [item("t1", "Low-cost rivals")]
  },
  Completion: {
    sector: "industrial_manufacturing",
    items: [{ quadrant: "strengths", text: "Installed base of 40,000 drives", basis: "Drives in service, as the annual report counts them", confidence: "medium" }],
    misfiled: [{ item: "w1", belongs_in: "threats", reason: "The shortage of technicians comes from the labour market, outside the company" }]
  },
  Signal: { title: "Data Act applies to connected products", summary: "Connected products placed on the market from September 2026 must give users their data.", url: "https://digital-strategy.ec.europa.eu/en", published: "2025-09-12", quadrants: ["threats"] },
  Issues: {
    issues: [{
      id: "I1", title: "Customers' data rights are missing", type: "missing", description: "The Data Act gives users access to their machines' data, which the service model sells today.",
      items: ["o1"], quadrants: ["threats"], impact: 4, likelihood: 4, horizon: "now", evidence: [{ url: "https://digital-strategy.ec.europa.eu/en", title: "Data Act" }], confidence: "high",
      added_items: [{ quadrant: "threats", text: "Customers may take their machines' data to rivals", basis: "Data Act, applicable since 12 September 2025" }]
    }]
  },
  Assessment: {
    impacts: [{ issue: "I1", monetisable: true, reason: "", kpis: [{ id: "industrial_manufacturing.service_revenue_share", name: "Share of service revenue", unit: "%", direction: "down", change_low: -4, change_high: -1, definition: "", basis: "Service contracts that depend on exclusive data" }], eur_year_low: 1000000, eur_year_high: 3000000, basis: "Service revenue at risk", confidence: "medium" }],
    factors: [
      { item: "s1", weight: 0.5, rating: 3, reason: "Customers praise reliability, rivals match it" },
      { item: "w1", weight: 0.5, rating: 1, reason: "Service calls wait weeks" },
      { item: "o1", weight: 0.5, rating: 2, reason: "Launched, few contracts" },
      { item: "t1", weight: 0.5, rating: 2, reason: "Prices under pressure" }
    ]
  },
  Strategies: {
    strategies: [
      { id: "R1", type: "ST", title: "Offer customers their data through an open portal", items: ["s1", "t1"], issue: "I1", kind: "mitigate", ratings: [{ item: "t1", to: 3 }], residual: [{ likelihood: 2, eur_year_low: 500000, eur_year_high: 1500000, basis: "A portal keeps most customers with the company", confidence: "medium" }], upside: [], effort: "M", time_to_impact: "6 to 12 months", first_step: "Product management drafts the portal's scope", owner: "Product management", recommended: true },
      { id: "R2", type: "SO", title: "Sell uptime with the drives", items: ["s1", "o1"], issue: "I1", kind: "advantage", ratings: [{ item: "o1", to: 3 }], residual: [], upside: [{ likelihood: 3, eur_year_low: 1000000, eur_year_high: 2000000, basis: "Customers pay for hours of running instead of parts", confidence: "low" }], effort: "L", time_to_impact: "12 to 24 months", first_step: "Sales picks three pilot customers", owner: "Sales", recommended: false }
    ]
  },
  Summary: { headline: "{{fact:at_stake}} a year at stake", situation: "The team's SWOT misses its customers' new data rights.", findings: ["One", "Two", "Three"], recommendation: "Open the data before rivals do.", assumptions: ["A", "B", "C"] },
  Decision: { kept: ["s4"], removed: [], edited: [{ id: "o3", text: "Heat services for the town" }], chosen: ["R1"] },
  Scenario: {
    id: "s2", source: "authored", as_of: "2026-11-23",
    company: { name: "Fictional Drives", sector: "industrial_manufacturing", country: "DE", description: { en: "A maker of drives", de: "Ein Hersteller von Antrieben" }, fictional: true },
    sources: [{ url: "https://digital-strategy.ec.europa.eu/en/policies/data-act", read_on: "2026-11-23" }],
    entered: { strengths: [{ id: "s1", text: { en: "Quality", de: "Qualität" } }], weaknesses: [], opportunities: [], threats: [] },
    answers: { en: {}, de: {} }, recorded_choice: ["R1"]
  },
  Recording: {
    id: "live", source: "live", as_of: "2026-11-24", language: "de",
    company: { name: "Beispiel GmbH", sector: "industrial_manufacturing", country: "Deutschland", description: { de: "Ein Hersteller von Antrieben" }, fictional: false },
    sources: [],
    entered: { strengths: [{ id: "s1", text: { de: "Qualität" } }], weaknesses: [], opportunities: [], threats: [] },
    answers: { de: {} },
    decision: { kept: ["s2"], removed: [], edited: [], chosen: [] },
    recorded_choice: [],
    run: { preset: "balanced", model: "claude-haiku-5-5", effort: "medium", thinking: "adaptive", research: false, cap_eur: 0.5, spent_eur: 0.0091, seconds: 84, requests: 5, summary_unchecked: false, audit: [] }
  },
  RunEvent: { type: "answer", step: "challenge", at: 1200, data: {} },
  AuditEvent: { at: 1200, step: "challenge", agent: "red_team", model: "claude-haiku-5-5", effort: "medium", thinking: "adaptive", max_tokens: 8000, stop_reason: "end_turn", usage: { input_tokens: 2400, output_tokens: 900, web_search_requests: 0 }, problems: [], repaired: false }
};
VALID.Issue = VALID.Issues.issues[0];
VALID.Impact = VALID.Assessment.impacts[0];
VALID.Factor = VALID.Assessment.factors[0];
VALID.Strategy = VALID.Strategies.strategies[0];
VALID.Signals = { signals: [VALID.Signal] };

// ---- broken answers: [contract, what is wrong, the change] -----------------------------------------------
const BROKEN = [
  ["Item", "a text over 90 characters", (x) => { x.text = "x".repeat(91); }],
  ["Item", "a field the contract does not know", (x) => { x.colour = "red"; }],
  ["Swot", "a ninth strength", (x) => { x.strengths = Array.from({ length: 9 }, (_, i) => item(`s${i + 1}`, "A strength")); }],
  ["Completion", "a quadrant that does not exist", (x) => { x.items[0].quadrant = "risks"; }],
  ["Completion", "a basis over 140 characters", (x) => { x.items[0].basis = "y".repeat(141); }],
  ["Signals", "a page that is not https", (x) => { x.signals[0].url = "http://example.org"; }],
  ["Signals", "a date that is no date", (x) => { x.signals[0].published = "12 September 2025"; }],
  ["Issues", "an issue type that does not exist", (x) => { x.issues[0].type = "vague"; }],
  ["Issues", "an impact of 6", (x) => { x.issues[0].impact = 6; }],
  ["Issues", "an id that is not an issue id", (x) => { x.issues[0].id = "Issue 1"; }],
  ["Assessment", "a rating of 5", (x) => { x.factors[0].rating = 5; }],
  ["Assessment", "a weight above 1", (x) => { x.factors[0].weight = 1.5; }],
  ["Strategies", "seven strategies", (x) => { x.strategies = Array.from({ length: 7 }, (_, i) => ({ ...x.strategies[0], id: `R${i + 1}` })); }],
  ["Strategies", "a TOWS type that does not exist", (x) => { x.strategies[0].type = "SW"; }],
  ["Strategies", "a strategy with one item", (x) => { x.strategies[0].items = ["s1"]; }],
  ["Strategies", "a range without what it rests on", (x) => { delete x.strategies[0].residual[0].basis; }],
  ["Strategies", "a range whose confidence is a number", (x) => { x.strategies[0].residual[0].confidence = 0.7; }],
  ["Summary", "two findings instead of three", (x) => { x.findings = ["One", "Two"]; }],
  ["Decision", "a strategy id that is no id", (x) => { x.chosen = ["strategy one"]; }],
  ["Scenario", "a company not marked fictional", (x) => { x.company.fictional = false; }],
  ["Recording", "a company whose fictional mark is a word", (x) => { x.company.fictional = "no"; }],
  ["Recording", "texts in both languages", (x) => { x.entered.strengths[0].text = { en: "Quality", de: "Qualität" }; }],
  ["Recording", "a key field in its run", (x) => { x.run.key = "sk-ant-…"; }],
  ["RunEvent", "a step that does not exist", (x) => { x.step = "review"; }],
  ["AuditEvent", "an effort the presets never send", (x) => { x.effort = "max"; }]
];

// ---- the checks can fail ----------------------------------------------------------------------------
control(refused({ type: "object", properties: { a: { type: "string", maxLength: 3 } } }).length === 2, "control: refused() finds a length limit and an object left open");
control(refused({ type: "object", additionalProperties: false, properties: { a: { oneOf: [{ type: "string" }, { type: "null" }] }, b: { type: "string", pattern: "\\bword\\b" }, c: { type: "array", minItems: 2 } } }).length === 3, "control: refused() finds oneOf, a word boundary and minItems 2");
const counted = countParameters({ type: "object", required: ["a"], properties: { a: { type: ["string", "null"] }, b: { anyOf: [{ type: "string" }, { type: "integer" }] } } });
control(counted.optional === 1 && counted.union === 2, "control: countParameters counts an optional and two union-typed parameters");
control(!ok({ ...VALID.Item, text: "x".repeat(91) }, "Item").valid, "control: the validator refuses a text over its limit");

// ---- every contract: valid accepted, broken refused --------------------------------------------------------
for (const name of Object.keys(SCHEMAS)) {
  const r = ok(VALID[name], name);
  check(r.valid, `${name} accepts a valid answer${r.valid ? "" : `: ${describeErrors(r.errors)}`}`);
}
for (const [name, what, change] of BROKEN) {
  const x = clone(VALID[name]);
  change(x);
  check(!ok(x, name).valid, `${name} refuses ${what}`);
}
check(Object.entries(STRATEGY_KINDS).every(([type, kind]) => (/^[SW]O$/.test(type) ? kind === "advantage" : kind === "mitigate")), "TOWS: SO and WO turn into an advantage, ST and WT mitigate");

// ---- the request schemas on the wire ------------------------------------------------------------------
for (const [step, name] of Object.entries(REQUESTS)) {
  const wire = toWire(SCHEMAS[name], SCHEMAS);
  const bad = refused(wire);
  check(!bad.length, `${step} (${name}): the wire schema carries no keyword the API refuses${bad.length ? `: ${bad.slice(0, 5).join("; ")}` : ""}`);
  const n = countParameters(wire);
  check(n.optional <= 24 && n.union <= 16, `${step} (${name}): ${n.optional} optional and ${n.union} union-typed parameters (limits 24 and 16)`);
  check(validate(VALID[name], wire).valid, `${step} (${name}): a valid answer still passes the wire schema`);
}
const wireCompletion = toWire(SCHEMAS.Completion, SCHEMAS);
check(/at most 90 characters/.test(wireCompletion.properties.items.items.properties.text.description || "") && /at most 16 items/.test(wireCompletion.properties.items.description || ""), "the wire moves a limit it takes out into the field's description, so the model still reads it");
check(JSON.stringify(SCHEMAS.Completion).includes('"maxLength":90'), "the contract itself keeps the limit, for the check in code");

// ---- the shared handoff schema ------------------------------------------------------------------------
const HANDOFF = JSON.parse(read("schemas/strategy-challenge-1.json"));
check(JSON.stringify(HANDOFF) === JSON.stringify(HANDOFF_MODULE), "schemas/strategy-challenge-1.js equals the JSON file");
const H = (value) => validate(value, HANDOFF, HANDOFF.$defs);
const example = JSON.parse(read("tests/fixtures/handoff-4.3.json"));
const he = H(example);
check(he.valid, `the brief's example (4.3) validates${he.valid ? "" : `: ${describeErrors(he.errors)}`}`);
const swot = clone(example);
swot.tool = { id: "swot-challenger", name: "SWOT Challenger", version: "0.1.0", url: "https://victorpflueger.github.io/SWOT-challenger/" };
swot.framework = { type: "swot", areas: [{ id: "strengths", label: "Strengths", items: [{ id: "s1", text: "Quality", source: "user" }] }, { id: "threats", label: "Threats", items: [{ id: "t4", text: "Customers may take their machines' data to rivals", source: "ai", confidence: "high", basis: "Data Act" }] }] };
swot.responses[0].changes = [{ action: "rate", item: "t1", from: 2, to: 3 }];
swot.figures.score = { name: "efe", scale: "1-4", before: 1.9, after: 2.85 };
swot.figures.pressure = { label: "Items challenged", before: 6, after: 2, of: 11 };
swot.issues[0].eur_year_low = null; swot.issues[0].eur_year_high = null; swot.issues[0].eur_year_expected = null;
const hs = H(swot);
check(hs.valid, `a SWOT handoff with rate changes, the EFE score and an issue without euros validates${hs.valid ? "" : `: ${describeErrors(hs.errors)}`}`);
const wrong = [
  ["a schema name of another version", (x) => { x.schema = "strategy-challenge/2"; }],
  ["a SWOT area that is a PESTEL dimension", (x) => { x.framework.areas[0].id = "political"; }],
  ["a rating changed to 5", (x) => { x.responses[0].changes[0].to = 5; }],
  ["a figure written as text", (x) => { x.figures.at_stake_eur_year = "€3.7m"; }],
  ["an API key field", (x) => { x.api_key = "sk-ant-test"; }]
];
for (const [what, change] of wrong) { const x = clone(swot); change(x); check(!H(x).valid, `the handoff schema refuses ${what}`); }

let failed = 0;
const report = (results, token) => {
  for (const [good, what] of results) console.log(`${good ? "PASS" : "FAIL"}  ${what}`);
  const f = results.filter(([good]) => !good).length;
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "SCHEMAS CONTROLS OK"), report(checks, "SCHEMAS CHECKS OK")].filter(Boolean);
if (failed) { console.log(`\n${failed} schema checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + checks.length} schema checks passed.\n${tokens.join("\n")}\nSCHEMAS OK`);

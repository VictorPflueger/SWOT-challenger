// The sector KPI library (data/kpis.js, brief 6.4): the thirteen sectors with names in both languages;
// 8 to 12 KPIs each and exactly the brief's ten in "general"; every KPI with an id of the form
// <sector>.<name>, names and definitions in both languages, a unit, a direction and a source; the brief's
// starting points for the three scenario sectors; no benchmark value in any definition; Vici's writing
// rules on every text when a ViciDesign checkout is at hand. Each check first fails on a planted error.
// Prints KPIS CONTROLS OK and KPIS OK. Usage: node tests/kpis.mjs [--require-vici]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SECTORS, KPIS, kpisFor, kpiById } from "../data/kpis.js";
import { REQUIRE_VICI, viciDir } from "./lib/harness.mjs";

const SECTOR_IDS = ["telecom", "transport_logistics", "automotive_mobility", "industrial_manufacturing", "energy_utilities", "retail_consumer", "banking", "insurance", "health_life_sciences", "public_sector", "software_digital", "chemicals_materials", "general"];
const GENERAL = ["revenue", "ebit_margin", "gross_margin", "free_cash_flow", "customer_churn", "net_promoter_score", "customer_acquisition_cost", "customer_lifetime_value", "staff_turnover", "co2_per_unit"];
const STARTING_POINTS = {
  transport_logistics: ["cost_per_teu", "average_freight_rate", "schedule_reliability", "vessel_utilisation", "fuel_cost_per_teu", "co2_per_teu_km", "empty_repositioning_cost"],
  industrial_manufacturing: ["order_intake", "book_to_bill", "service_revenue_share", "recurring_revenue_share", "on_time_delivery", "connected_installed_base", "warranty_cost", "technician_utilisation"],
  energy_utilities: ["customer_churn", "cost_to_serve", "gross_margin_per_mwh", "saidi", "smart_meter_share", "bad_debt", "heat_customers"]
};

/** Problems of a library: the rules of brief 6.4 as code, so a control can plant an error. */
function problems(sectors, kpis) {
  const out = [];
  const ids = sectors.map((s) => s.id);
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...SECTOR_IDS].sort())) out.push(`sectors are ${ids.join(", ")}`);
  for (const s of sectors) if (!s.name?.en || !s.name?.de) out.push(`sector ${s.id} lacks a name in a language`);
  const seen = new Set();
  for (const k of kpis) {
    const where = k.id || "a KPI without id";
    if (seen.has(k.id)) out.push(`${where}: id used twice`);
    seen.add(k.id);
    if (!/^[a-z_]+\.[a-z0-9_]+$/.test(k.id || "") || !k.id.startsWith(`${k.sector}.`)) out.push(`${where}: id is not <sector>.<name>`);
    if (!ids.includes(k.sector)) out.push(`${where}: unknown sector`);
    for (const lang of ["en", "de"]) {
      if (!k.name?.[lang]) out.push(`${where}: no ${lang} name`);
      if (!k.definition?.[lang] || k.definition[lang].length > 220) out.push(`${where}: ${lang} definition missing or over 220 characters`);
    }
    if (!k.unit) out.push(`${where}: no unit`);
    if (!["higher", "lower"].includes(k.better)) out.push(`${where}: better is "${k.better}"`);
    if (!(k.source === "common practice" || /^https:\/\//.test(k.source || ""))) out.push(`${where}: source is "${k.source}"`);
    // A definition, never a benchmark: no money amount and no share other than the 100 % of a ratio's break-even.
    for (const lang of ["en", "de"]) {
      const d = k.definition?.[lang] || "";
      if (/€\s?\d|\d\s?€|\d[\d.,]*\s?(EUR|euros?)\b/i.test(d)) out.push(`${where}: a money amount in the ${lang} definition`);
      const shares = [...d.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((m) => m[1]).filter((v) => v !== "100");
      if (shares.length) out.push(`${where}: a share of ${shares.join(", ")} % in the ${lang} definition reads like a benchmark`);
    }
  }
  for (const id of ids) {
    const n = kpis.filter((k) => k.sector === id).length;
    if (id === "general" ? n !== 10 : n < 8 || n > 12) out.push(`${id} has ${n} KPIs`);
  }
  const general = kpis.filter((k) => k.sector === "general").map((k) => k.id.split(".")[1]);
  if (JSON.stringify([...general].sort()) !== JSON.stringify([...GENERAL].sort())) out.push(`general holds ${general.join(", ")}`);
  for (const [sector, names] of Object.entries(STARTING_POINTS)) {
    const missing = names.filter((n) => !kpis.some((k) => k.id === `${sector}.${n}`));
    if (missing.length) out.push(`${sector} lacks the brief's ${missing.join(", ")}`);
  }
  return out;
}

const controls = [];
const checks = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => checks.push([!!ok, what]);
const plant = (fn) => { const k = KPIS.map((x) => JSON.parse(JSON.stringify(x))); fn(k); return problems(SECTORS, k); };

control(plant((k) => { k[1].id = k[0].id; }).some((p) => /used twice/.test(p)), "control: a duplicate id is caught");
control(plant((k) => { k[10].definition.en += " A good carrier spends €25 per TEU."; }).some((p) => /money amount/.test(p)), "control: a benchmark in euros is caught");
control(plant((k) => { k[10].definition.de += " Üblich sind 85 %."; }).some((p) => /benchmark/.test(p)), "control: a benchmark share is caught");
control(plant((k) => { k.splice(k.findIndex((x) => x.sector === "banking"), 1); }).some((p) => /banking has 7 KPIs/.test(p)), "control: a sector with seven KPIs is caught");
control(plant((k) => { k[0].better = "more"; }).some((p) => /better is/.test(p)), "control: an unknown direction is caught");

const found = problems(SECTORS, KPIS);
check(!found.length, `the library follows brief 6.4${found.length ? `: ${found.join("; ")}` : ""}`);
check(KPIS.length >= 13 * 8, `${KPIS.length} KPIs in ${SECTORS.length} sectors`);
const t = kpisFor("transport_logistics");
check(t[0].sector === "transport_logistics" && t.at(-1).sector === "general" && t.length === KPIS.filter((k) => k.sector === "transport_logistics").length + 10, "kpisFor gives a sector's KPIs, then the ten of general");
check(kpiById("energy_utilities.saidi")?.name.en === "Minutes of grid outage per customer a year" && kpiById("nothing.here") === null, "kpiById finds a KPI by its id and nothing for an unknown one");
check(Object.isFrozen(KPIS) && Object.isFrozen(KPIS[0]) && Object.isFrozen(KPIS[0].name), "the library is frozen, so no screen can change it by accident");

// Vici's writing rules on every name and definition, page by page in each language.
const dir = viciDir();
if (dir) {
  const { writingProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "writing.mjs")).href);
  for (const lang of ["en", "de"]) {
    const texts = [...SECTORS.map((s) => s.name[lang]), ...KPIS.flatMap((k) => [k.name[lang], k.definition[lang]])];
    const html = `<html lang="${lang === "de" ? "de" : "en-GB"}"><body>${texts.map((x) => `<p>${x.replace(/</g, "&lt;")}</p>`).join("")}</body></html>`;
    const w = writingProblems(html);
    check(!w.length, `${lang === "en" ? "English" : "German"}: the ${texts.length} names and definitions keep Vici's writing rules${w.length ? `: ${w.join("; ")}` : ""}`);
  }
} else {
  check(!REQUIRE_VICI, "Vici's writing rules: no ViciDesign checkout in VICI_DIR or next to this repository");
  if (!REQUIRE_VICI) console.log("SKIP  Vici's writing rules: no ViciDesign checkout at hand");
}

let failed = 0;
const report = (results, token) => {
  for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  const f = results.filter(([ok]) => !ok).length;
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "KPIS CONTROLS OK"), report(checks, "KPIS CHECKS OK")].filter(Boolean);
if (failed) { console.log(`\n${failed} KPI checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + checks.length} KPI checks passed.\n${tokens.join("\n")}\nKPIS OK`);

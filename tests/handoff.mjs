// The handoff file (brief 4.3 and 10; AC-21), without a browser. For each scenario in both languages, with
// the recorded choice, with no strategy chosen and with every strategy chosen, and for a live run's file:
//   - the file passes the shared schema (schemas/strategy-challenge-1.json) and the references it can't hold;
//   - the quadrants are its areas, a strategy is a response whose changes are rate entries, the score is EFE;
//   - its figures are the engine's numbers for that choice, and pressure counts the challenged items the
//     choice leaves unaddressed;
//   - nothing in it is shaped like a key, and it carries no prompt and no thinking;
//   - the Prototype Ideator's own reader (js/handoff.js of the checkout at IDEATOR_DIR) reads it.
// Planted defects (an unknown issue, a missing field, a wrong schema name) must fail both checks.
// Prints HANDOFF CONTROLS OK and HANDOFF OK. Usage: IDEATOR_DIR=../PrototypeIdeator node tests/handoff.mjs
// [--require-ideator]; without the flag, a missing Ideator checkout is skipped and said so.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { handoffFor, handoffProblems, countryCode, HANDOFF_SCHEMA } from "../js/handoff.js";
import { assemble, figuresFor } from "../js/scenario.js";
import { addressed } from "../js/simulation.js";
import S1 from "../data/scenarios/s1.js";
import S2 from "../data/scenarios/s2.js";
import S3 from "../data/scenarios/s3.js";

const requireIdeator = process.argv.includes("--require-ideator");
const IDEATOR = process.env.IDEATOR_DIR || path.resolve("../PrototypeIdeator");
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const CREATED = new Date("2026-11-24T09:30:00.000Z");

let reader = null;
const ideatorFile = path.join(IDEATOR, "js", "handoff.js");
if (existsSync(ideatorFile)) reader = (await import(pathToFileURL(ideatorFile).href)).readHandoff;
else if (requireIdeator) check(false, `the Prototype Ideator's reader at ${ideatorFile} (set IDEATOR_DIR)`);
else console.log(`SKIP  the Prototype Ideator's reader: no checkout at ${IDEATOR}`);

// ---- controls: a planted defect fails our check and the Ideator's reader ---------------------------
const base = handoffFor({ run: assemble(S2, "en"), scenario: S2, chosen: S2.recorded_choice, lang: "en", mode: "simulation", created: CREATED });
const planted = {
  "a response that names an issue the file doesn't have": (j) => { j.responses[0].issue = "I9"; },
  "an issue without its band": (j) => { delete j.issues[0].band; },
  "a schema name of another version": (j) => { j.schema = "strategy-challenge/2"; },
  "a figure given as text": (j) => { j.figures.at_stake_eur_year = "€4.9m"; }
};
const controls = [];
controls.push([handoffProblems(base).length === 0, "the recorded S2 file in English passes before anything is planted"]);
if (reader) controls.push([reader(base, { file: "s2.json" }).ok, "the Ideator reads the clean S2 file"]);
for (const [name, plant] of Object.entries(planted)) {
  const j = JSON.parse(JSON.stringify(base));
  plant(j);
  controls.push([handoffProblems(j).length > 0, `our check catches ${name}`]);
  if (reader) controls.push([!reader(j, { file: "planted.json" }).ok, `the Ideator refuses ${name}`]);
}
for (const [ok, what] of controls) console.log(`${ok ? "PASS" : "FAIL"}  control: ${what}`);
if (controls.some(([ok]) => !ok)) { console.log("\nHANDOFF CONTROLS FAILED"); process.exit(1); }
console.log("HANDOFF CONTROLS OK");

// ---- every scenario, both languages, three choices ---------------------------------------------------
const near = (a, b) => Math.abs(a - b) < 1e-9;
let files = 0;
for (const scenario of [S1, S2, S3]) {
  for (const lang of ["en", "de"]) {
    const run = assemble(scenario, lang);
    const choices = { recorded: scenario.recorded_choice, none: [], all: run.strategies.map((s) => s.id) };
    for (const [label, chosen] of Object.entries(choices)) {
      const name = `${scenario.id} ${lang} ${label}`;
      const json = JSON.parse(JSON.stringify(handoffFor({ run, scenario, chosen, lang, mode: "simulation", created: CREATED })));
      files += 1;
      const problems = handoffProblems(json);
      check(!problems.length, `${name}: passes the shared schema and its references${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
      const f = figuresFor(run, chosen);
      const g = json.figures;
      check(near(g.at_stake_eur_year, f.stake.value) && near(g.left_eur_year, f.left) && near(g.upside_eur_year, f.upside), `${name}: at stake, left and upside are the engine's (${g.at_stake_eur_year}, ${g.left_eur_year}, ${g.upside_eur_year})`);
      check(g.score.name === "efe" && g.score.scale === "1-4" && near(g.score.before, f.efe.before.value) && near(g.score.after, f.efe.after.value), `${name}: the score is EFE before and after, as the engine has it`);
      const named = new Set(run.issues.flatMap((i) => i.items));
      const challenged = run.items.filter((i) => !i.added && named.has(i.id)).map((i) => i.id);
      const fixed = new Set(addressed(run, chosen).keys());
      check(g.pressure.before === f.items.challenged && g.pressure.before === challenged.length && g.pressure.after === challenged.filter((id) => !fixed.has(id)).length && g.pressure.of === f.items.total, `${name}: pressure counts ${g.pressure.before} challenged of ${g.pressure.of}, ${g.pressure.after} still unaddressed`);
      check(json.framework.type === "swot" && json.framework.areas.map((a) => a.id).join() === "strengths,weaknesses,opportunities,threats", `${name}: the four quadrants are its areas, in order`);
      check(json.framework.areas.reduce((n, a) => n + a.items.length, 0) === run.items.length, `${name}: every item of the run is in its area`);
      check(json.responses.length === run.strategies.length && json.responses.every((r) => r.changes.length > 0 && r.changes.every((c) => c.action === "rate")), `${name}: each strategy is a response whose changes are rate entries`);
      check(json.responses.filter((r) => r.chosen).map((r) => r.id).sort().join() === [...chosen].sort().join(), `${name}: the chosen responses are the choice`);
      for (const i of json.issues) {
        const e = run.issues.find((x) => x.id === i.id).expected;
        if (e === null) check(i.eur_year_expected === 0 && /^(Not priced|Nicht beziffert)/.test(i.eur_basis), `${name}: issue ${i.id} is not priced and says so`);
        else check(near(i.eur_year_expected, e), `${name}: issue ${i.id}'s expected euros are the engine's`);
      }
      check(json.company.fictional === true && json.mode === "simulation" && json.model === null && json.language === lang, `${name}: a recorded run of a fictional company, in ${lang}`);
      const text = JSON.stringify(json);
      check(!/sk-ant-|"thinking"|"prompt"|"system"/.test(text), `${name}: no key, prompt or thinking`);
      if (reader) {
        const r = reader(json, { file: `${name}.json` });
        check(r.ok && r.issues.length === json.issues.length, `${name}: the Prototype Ideator reads it${r.ok ? `, ${r.issues.length} issues` : `: ${r.problems.slice(0, 2).join("; ")}`}`);
      }
    }
  }
}

// ---- a live run's file ------------------------------------------------------------------------------
const live = handoffFor({ run: assemble(S2, "de"), chosen: ["R1"], lang: "de", mode: "live", model: "claude-haiku-5-5", created: CREATED, country: "Deutschland" });
files += 1;
check(!handoffProblems(live).length, "a live run's file passes the shared schema and its references");
check(live.mode === "live" && live.model === "claude-haiku-5-5" && live.company.fictional === false, "a live run's file names its model and says the company is not fictional");
check(live.company.country === "DE" && countryCode("Germany") === "DE" && countryCode("at") === "AT" && countryCode("Atlantis") === "ZZ", "a country as entered becomes its code, or ZZ when unknown");
check(live.schema === HANDOFF_SCHEMA && live.tool.id === "swot-challenger" && /^https:\/\//.test(live.tool.url), "the file names its schema and the tool");
if (reader) check(reader(live, { file: "live.json" }).ok, "the Prototype Ideator reads a live run's file");

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} handoff checks failed.`); process.exit(1); }
console.log(`\nHANDOFF OK: ${files} files pass the shared schema${reader ? " and the Prototype Ideator's reader" : ""}`);

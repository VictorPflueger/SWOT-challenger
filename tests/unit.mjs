// Units of the simulation, without a browser:
//   estimate    the session cost of a simulated run comes from each scenario's five recorded requests, at
//               the dated list price of Haiku 5.5 and the dated rate of 1 USD = 0.894 EUR (js/config.js and
//               TECH_NOTES.md say the same), and an independent recount here, with the prices written out
//               from the pricing page, agrees within 1e-9 for every scenario in both languages;
//   formats     a session cost reads "< €0.01" below half a cent and "≈ €0.05" above, in both languages;
//   method      the Method dialog's worked example is the golden case SW1 of tests/fixtures/golden.json,
//               and the engine works it through to the golden figures;
//   simulation  each step shows the items it has reached; the items the recorded choice addresses are the
//               ones whose rating it raises; the tiles' figures for a choice are the engine's.
// Prints UNIT OK. Usage: node tests/unit.mjs
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { golden, exact } from "./lib/fixtures.mjs";
import { estimateRun, requestsOf, usageOf, tokensOf, ESTIMATE, REQUEST_STEPS } from "../js/estimate.js";
import { MODELS, DEFAULT_MODEL, FX_USD_EUR, PRICES_READ_ON } from "../js/config.js";
import { sessionCost } from "../js/format.js";
import { SW1, sw1Figures } from "../js/method.js";
import { createRun, itemsAt, addressed, sameChoice, STEP } from "../js/simulation.js";
import { figuresFor } from "../js/scenario.js";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const near = (a, b) => Math.abs(a - b) <= 1e-9;
const scenarios = {};
for (const id of ["s1", "s2", "s3"]) scenarios[id] = (await import(`../data/scenarios/${id}.js`)).default;

// ---- estimate ------------------------------------------------------------------------------------------
// Haiku 5.5's list prices in US dollars per million tokens, written out from
// https://platform.claude.com/docs/en/about-claude/pricing as read on 23 November 2026.
const HAIKU = { input: 0.1, output: 0.5 };
const RATE = 0.894;
const haiku = MODELS.find((m) => m.id === "claude-haiku-5-5");
check(DEFAULT_MODEL === "claude-haiku-5-5" && haiku.price.input === HAIKU.input && haiku.price.output === HAIKU.output && FX_USD_EUR === RATE && PRICES_READ_ON === "2026-11-23", `js/config.js holds Haiku 5.5 as the default at $${HAIKU.input} and $${HAIKU.output} per million tokens, read on ${PRICES_READ_ON}, and 1 USD = ${RATE} EUR`);
const notes = fs.readFileSync(path.join(APP_ROOT, "TECH_NOTES.md"), "utf8");
check(notes.includes("0.894") && notes.includes("23 November 2026") && /Haiku 5\.5[^\n]*\$0\.10[^\n]*\$0\.50/.test(notes), "TECH_NOTES.md records the same prices, rate and date");
for (const id of Object.keys(scenarios)) {
  for (const lang of ["en", "de"]) {
    const reqs = requestsOf(scenarios[id], lang);
    const answers = scenarios[id].answers[lang];
    const shape = reqs.map((r) => r.step).join() === REQUEST_STEPS.join() && reqs.every((r) => r.output === answers[r.step] && r.schema && r.input?.company?.name === scenarios[id].company.name);
    // The recount: characters over four, rounded up, for the input as JSON and the schema; the
    // allowances added once a request; prices per token.
    let usd = 0;
    for (const r of reqs) {
      const len = (x) => Math.ceil(JSON.stringify(x).length / 4);
      const input = 1200 + len(r.input) + len(r.schema) + 40;
      const output = len(r.output) + 800;
      usd += (input * HAIKU.input + output * HAIKU.output) / 1e6;
      if (usageOf(r).input_tokens !== input || usageOf(r).output_tokens !== output) usd = NaN;
    }
    const e = estimateRun(scenarios[id], lang);
    check(shape && e.requests === 5 && near(e.usd, usd) && near(e.eur, usd * RATE), `${id} in ${lang === "en" ? "English" : "German"}: five requests (${REQUEST_STEPS.join(", ")}) estimated at $${e.usd.toFixed(6)}, €${e.eur.toFixed(6)}, the recount agreeing within 1e-9`);
  }
}
check(ESTIMATE.charsPerToken === 4 && ESTIMATE.systemTokens === 1200 && ESTIMATE.thinkingTokens === 800 && tokensOf("abcde") === 2 && tokensOf({ a: 1 }) === 2, "the estimate's assumptions: four characters a token, 1,200 tokens of system prompt and 800 of thinking a request");

// ---- formats -------------------------------------------------------------------------------------------
check(sessionCost(0.0046, "en") === "< €0.01" && sessionCost(0.0046, "de") === "< 0,01 €" && sessionCost(0.0512, "en") === "≈ €0.05" && sessionCost(0.0512, "de") === "≈ 0,05 €" && sessionCost(0.005, "en") === "≈ €0.01", "a session cost under half a cent reads < €0.01, otherwise ≈ and cents, in both languages");

// ---- method --------------------------------------------------------------------------------------------
const g = golden().SW1;
const same = SW1.length === g.items.length && SW1.every((x, i) => x.id === g.items[i].id && x.quadrant === g.items[i].quadrant && near(x.weight, exact(g.items[i].weight)) && x.rating === g.items[i].rating && x.after === g.items[i].after);
const f = sw1Figures();
const worked = near(f.before.ife, exact(g.before.ife)) && near(f.before.efe, exact(g.before.efe)) && near(f.after.ife, exact(g.after.ife)) && near(f.after.efe, exact(g.after.efe)) && f.before.ie.cell === g.before.cell && f.after.ie.cell === g.after.cell && f.before.ie.zone === g.before.zone && f.after.ie.zone === g.after.zone;
check(same && worked, `the Method dialog's worked example is SW1, and the engine gives its golden figures (IFE ${f.before.ife} to ${f.after.ife}, EFE ${f.before.efe} to ${f.after.efe}, cell ${f.before.ie.cell} to ${f.after.ie.cell})`);

// ---- simulation ----------------------------------------------------------------------------------------
for (const id of Object.keys(scenarios)) {
  const run = createRun(scenarios[id]);
  const r = run.byLang.en;
  const entered = Object.values(scenarios[id].entered).flat().length;
  const ai = r.items.filter((i) => i.source === "ai" && !i.added).length;
  const added = r.items.filter((i) => i.added).length;
  const counts = [STEP.start, STEP.complete, STEP.challenge, STEP.summary].map((s) => itemsAt(r, s).length);
  check(counts.join() === [entered, entered + ai, entered + ai + added, entered + ai + added].join(), `${id}: the steps show the team's ${entered} items, then the Completer's ${ai}, then the ${added} the challenge added (${counts.join(", ")})`);
  const fixed = addressed(r, run.recorded);
  const raised = r.factors.filter((x) => figuresFor(r, run.recorded) && r.strategies.some((s) => run.recorded.includes(s.id) && s.changes.some((c) => c.item === x.id && c.to > x.rating)));
  check(fixed.size === raised.length && raised.every((x) => fixed.get(x.id).from === x.rating && fixed.get(x.id).to > x.rating && run.recorded.includes(fixed.get(x.id).strategy.id)), `${id}: the recorded choice addresses the ${fixed.size} items whose rating it raises`);
}
check(sameChoice(["R1", "R2"], ["R2", "R1"]) && !sameChoice(["R1"], ["R1", "R2"]) && !sameChoice([], ["R1"]), "two choices are the same when they hold the same strategies, in any order");

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} unit checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} unit checks passed.\nUNIT OK`);

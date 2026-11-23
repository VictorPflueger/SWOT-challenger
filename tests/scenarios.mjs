// The three scenarios and their checker (brief 7, AC-06): tools/check-scenarios.mjs passes S1, S2 and S3
// in both languages along the recorded choice and three others, and the scenario rules fail on a planted
// defect of each kind the brief lists (a schema break, a missing id, a missing language, placeholders
// that differ between the languages, prose that fails the fact audit, a figure that no longer matches the
// frozen reference, a source missing from DATA_SOURCES.md, anything shaped like a key, a thinking block)
// and on the guards of brief 6.7. Each defect is planted in a copy of S2, which passes before it.
// Prints SCENARIOS CONTROLS OK, SCENARIOS CHECKS OK and SCENARIOS OK. Usage: node tests/scenarios.mjs
import { checkAll, inputs } from "../tools/check-scenarios.mjs";
import { scenarioProblems } from "../js/scenario_check.js";
import S2 from "../data/scenarios/s2.js";

const copy = () => JSON.parse(JSON.stringify(S2));
const both = (s, fn) => { for (const lang of ["en", "de"]) fn(s.answers[lang], lang); return s; };
const base = inputs(S2);

/** Each planted defect: a name, the changed scenario (and inputs), and a word its problem must contain. */
const PLANTED = [
  ["a schema break", () => both(copy(), (a) => { a.challenge.issues[0].impact = 7; }), "contract"],
  ["a missing id", () => both(copy(), (a) => { a.strategise.strategies[0].items = ["w2", "o9"]; }), "does not exist"],
  ["a missing language", () => { const s = copy(); delete s.answers.de; return s; }, "contract"],
  ["placeholders that differ between the languages", () => { const s = copy(); s.answers.de.summary.recommendation = s.answers.de.summary.recommendation.replace("{{fact:left}}", "{{fact:upside}}"); return s; }, "differ"],
  ["prose that fails the fact audit", () => both(copy(), (a, lang) => { a.challenge.issues[3].description += lang === "en" ? " It costs €2m a year." : " Es kostet 2 Mio. € im Jahr."; }), "fact audit"],
  ["a number word above twelve", () => both(copy(), (a, lang) => { a.strategise.strategies[0].first_step = lang === "en" ? "Connect twenty lines" : "Zwanzig Linien anschließen"; }), "fact audit"],
  ["a fact the Writer did not cite through the engine", () => both(copy(), (a) => { a.summary.situation = a.summary.situation.replace("{{fact:at_stake}}", "{{fact:at_risk}}"); }), "unknown fact"],
  ["a figure that no longer matches the frozen reference", () => both(copy(), (a) => { a.assess.factors[0].weight = 0.15; a.assess.factors[1].weight = 0.15; }), "frozen reference"],
  ["a source missing from DATA_SOURCES.md", () => [copy(), { ...base, dataSources: base.dataSources.split("\n").filter((l) => !l.includes("policies/data-act")).join("\n") }], "DATA_SOURCES.md"],
  ["anything shaped like a key", () => both(copy(), (a) => { a.complete.items[0].basis = "sk-ant-api03-abcdefghijklmnop"; }), "API key"],
  ["a thinking block", () => { const s = copy(); s.answers.en.challenge.thinking = "Let me think about the SWOT."; return s; }, "thinking"],
  ["weights that miss 1 by more than 0.05", () => both(copy(), (a) => { a.assess.factors[0].weight = 0.2; }), "weights add up"],
  ["a strength rated below 3", () => both(copy(), (a) => { a.assess.factors[0].rating = 2; }), "strength"],
  ["a strategy whose type does not match its items", () => both(copy(), (a) => { a.strategise.strategies[2].items = ["s2", "t1"]; }), "pairs"],
  ["a residual above the issue's risk", () => both(copy(), (a) => { a.strategise.strategies[1].residual[0].likelihood = 5; a.strategise.strategies[1].residual[0].eur_year_high = 9000000; }), "more at risk"],
  ["a weakness rated above 2 after a strategy", () => both(copy(), (a) => { a.strategise.strategies[0].ratings[0].to = 3; }), "weakness"],
  ["a missing factor that also names an item of the SWOT", () => both(copy(), (a) => { a.challenge.issues[2].items = ["o1"]; }), "factor it adds carries it"]
];

const controls = [];
const clean = scenarioProblems(S2, base);
controls.push([clean.length === 0, `control: S2 passes before any defect is planted${clean.length ? `: ${clean.join("; ")}` : ""}`]);
for (const [name, make, word] of PLANTED) {
  const made = make();
  const [scenario, inp] = Array.isArray(made) ? made : [made, base];
  const problems = scenarioProblems(scenario, inp);
  const hit = problems.some((p) => p.includes(word));
  controls.push([hit, `control: ${name} is caught${hit ? "" : ` (got: ${problems.slice(0, 2).join("; ") || "nothing"})`}`]);
}

const checks = [];
const results = await checkAll();
const ids = results.map((r) => r.id).join(" ");
checks.push([ids === "s1 s2 s3", `the checker finds the three scenarios (${ids})`]);
for (const r of results) checks.push([!r.problems.length, `${r.id} ${r.name} passes every rule in English and German, along four choices${r.problems.length ? `:\n      ${r.problems.join("\n      ")}` : ""}`]);

let failed = 0;
const report = (list, token) => {
  const f = list.filter(([ok]) => !ok).length;
  for (const [ok, what] of list) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "SCENARIOS CONTROLS OK"), report(checks, "SCENARIOS CHECKS OK")].filter(Boolean);
if (failed) { console.log(`\n${failed} checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + checks.length} checks passed.\n${tokens.join("\n")}\nSCENARIOS OK`);

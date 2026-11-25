// The guards of PLAN.md 3.1 (brief 6.7), without a browser (AC-19). Each refusal is planted in a valid
// answer of the scenario Arvento Drives and must come back with its own message, the words the one repair
// request sends to the model; the valid answers pass untouched. Prints GUARDS OK.
// Usage: node tests/guards.mjs
import { answerProblems } from "../js/guards.js";
import { assemble } from "../js/scenario.js";
import { FACT_KEYS } from "../js/facts.js";
import S2 from "../data/scenarios/s2.js";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const clone = (x) => JSON.parse(JSON.stringify(x));
const lang = "en";
const A = S2.answers[lang];
const run = assemble(S2, lang);
const urls = S2.sources.map((s) => s.url);
const ctx = {
  complete: { entered: run.items.filter((i) => i.source === "user"), sector: S2.company.sector },
  challenge: { items: run.items.filter((i) => !i.added), urls },
  assess: { items: run.items, issues: run.issues, sector: run.sector },
  strategise: { items: run.items, issues: run.issues, factors: run.factors.map((f) => ({ item: f.id, rating: f.rating })) },
  summary: { facts: new Set([...FACT_KEYS, ...run.issues.map((i) => `issue.${i.id}.expected`)]), evidence: { titles: run.issues.flatMap((i) => i.evidence.map((e) => e.title)), urls } }
};

// The valid answers pass.
for (const step of Object.keys(ctx)) check(answerProblems(step, A[step], ctx[step]).length === 0, `${step}: the recorded answer passes every guard`);

/** [step, what, change, the words the refusal must hold] */
const PLANTED = [
  ["complete", "a sector other than the one the person chose", (a) => { a.sector = "banking"; }, /chose the sector industrial_manufacturing/],
  ["complete", "an unknown sector when the agents decide", (a) => { a.sector = "space_mining"; }, /not one of the sectors given/, { sector: null }],
  ["complete", "five new items in one field", (a) => { for (let i = 0; i < 5; i++) a.items.push({ quadrant: "threats", text: `New threat ${"abcde"[i]}`, basis: "Assumption: a test", confidence: "low" }); }, /add at most 4/],
  ["complete", "a field over eight items", (a) => { for (let i = 0; i < 4; i++) a.items.push({ quadrant: "strengths", text: `New strength ${"abcd"[i]}`, basis: "Assumption: a test", confidence: "low" }); a.items.push(...[0, 1].map((i) => ({ quadrant: "strengths", text: `Another ${i}`, basis: "x", confidence: "low" }))); }, /at most 8|add at most 4/],
  ["complete", "a field left under three", (a) => { a.items = a.items.filter((i) => i.quadrant !== "opportunities"); }, /fill it to at least 3/],
  ["complete", "a repeat of the person's item", (a) => { a.items.push({ quadrant: "strengths", text: run.items.find((i) => i.id === "s1").text, basis: "x", confidence: "low" }); }, /repeats an item the person entered/],
  ["complete", "a text over 90 characters", (a) => { a.items[0].text = "x".repeat(91); }, /Completion contract/],
  ["complete", "a note on an item the person did not enter", (a) => { a.misfiled.push({ item: "s9", belongs_in: "threats", reason: "x" }); }, /did not enter/],
  ["challenge", "more than eight issues", (a) => { while (a.issues.length < 9) a.issues.push({ ...clone(a.issues[1]), id: `I${a.issues.length + 1}` }); }, /Issues contract|at most 8/],
  ["challenge", "an unknown item", (a) => { a.issues[1].items = ["s9"]; }, /names s9, which is not an item/],
  ["challenge", "an unknown type", (a) => { a.issues[1].type = "vague"; }, /Issues contract/],
  ["challenge", "a missing issue without its added item", (a) => { const m = a.issues.find((i) => i.type === "missing"); m.added_items = []; }, /adds the missing factor/],
  ["challenge", "evidence not among the signals", (a) => { a.issues[1].evidence = [{ url: "https://example.org/made-up", title: "Made up" }]; }, /not among the signals/],
  ["challenge", "ids out of order", (a) => { a.issues[0].id = "I7"; }, /number them I1, I2/],
  ["assess", "weights that miss 1 by more than 0.05", (a) => { a.factors.filter((f) => /^[sw]/.test(f.item)).forEach((f) => { f.weight *= 1.2; }); }, /internal weights add up to/],
  ["assess", "a strength below 3", (a) => { a.factors.find((f) => f.item.startsWith("s")).rating = 2; }, /a strength is 3 or 4/],
  ["assess", "a weakness above 2", (a) => { a.factors.find((f) => f.item.startsWith("w")).rating = 3; }, /a weakness is 1 or 2/],
  ["assess", "a KPI outside the library without a definition", (a) => { const im = a.impacts.find((x) => x.monetisable); im.kpis[0] = { ...im.kpis[0], id: "industrial_manufacturing.made_up", definition: "" }; }, /without a full definition/],
  ["assess", "low above high", (a) => { const im = a.impacts.find((x) => x.monetisable); [im.eur_year_low, im.eur_year_high] = [im.eur_year_high + 10, im.eur_year_low]; }, /runs backwards/],
  ["assess", "an issue without its assessment", (a) => { a.impacts.pop(); }, /has 0 assessments/],
  ["strategise", "a type that does not match its items", (a) => { a.strategies[0].type = a.strategies[0].type === "SO" ? "WT" : "SO"; }, /pairs|kind is/],
  ["strategise", "a kind that does not match its type", (a) => { a.strategies[0].kind = a.strategies[0].kind === "advantage" ? "mitigate" : "advantage"; }, /so its kind is/],
  ["strategise", "a residual above the issue's", (a) => { const s = a.strategies.find((x) => x.kind === "mitigate"); s.residual[0] = { ...s.residual[0], likelihood: 5, eur_year_low: 9e8, eur_year_high: 9.9e8 }; }, /leaves more at risk/],
  ["strategise", "a residual cheaper than the issue but more likely", (a) => { const s = a.strategies.find((x) => x.kind === "mitigate"); s.residual[0] = { ...s.residual[0], likelihood: 5, eur_year_low: 1000, eur_year_high: 2000 }; }, /more likely than it was/],
  ["strategise", "a weakness rated above 2 after the strategy", (a) => { const s = a.strategies.find((x) => x.items.some((i) => i.startsWith("w"))); const w = s.items.find((i) => i.startsWith("w")); s.ratings = [{ item: w, to: 3 }]; }, /a weakness stays at 2 or below/],
  ["strategise", "an unknown id", (a) => { a.strategies[0].items = [...a.strategies[0].items, "o9"]; }, /names o9, which is not an item/],
  ["strategise", "more than six strategies", (a) => { while (a.strategies.length < 7) a.strategies.push({ ...clone(a.strategies[0]), id: `R${a.strategies.length + 1}` }); }, /Strategies contract|return 2 to 6/],
  ["summary", "a number outside a placeholder", (a) => { a.situation = "The issues put 4.9 million euros at stake."; }, /writes figures in prose/],
  ["summary", "an unknown fact", (a) => { a.headline = "{{fact:made_up}} at stake"; }, /unknown facts/]
];

for (const [step, what, change, words, extra] of PLANTED) {
  const answer = clone(A[step]);
  change(answer);
  const problems = answerProblems(step, answer, { ...ctx[step], ...(extra || {}) });
  check(problems.length > 0 && problems.some((p) => words.test(p)), `${step} refuses ${what}${problems.length ? `: "${problems.find((p) => words.test(p)) || problems[0]}"` : ": nothing refused"}`);
}

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} guard checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} guard checks passed.\nGUARDS OK`);

// The scenario rules (brief 7, AC-06), shared by tools/check-scenarios.mjs and the tests. A scenario is a
// recorded run; it fails on an answer that breaks its schema or names an id that does not exist; on a
// missing language or texts whose placeholders differ between the languages; on prose that fails the fact
// audit; on a figure that no longer matches the frozen reference figures; on a source missing from
// DATA_SOURCES.md; on anything shaped like a key; on a thinking block. It also holds the guards of brief
// 6.7 and plays the run along the recorded choice and the other choices given, so any choice gives
// figures that hold together. Pure: the caller hands in DATA_SOURCES.md's text and the reference figures.
// A live recording ("Save run as simulation") is checked in its one language under the rules a live run
// obeys: its contract, the ids, the live guards, the fact audit of the Writer's text and the figures. The
// rules for an authored scenario that a live run cannot meet wait for its curation: the second language,
// sources listed in DATA_SOURCES.md, weights that add up to exactly 1 and no figures in any agent's prose.

import { validate, describeErrors } from "./schema.js";
import { SCHEMAS, REQUESTS, STRATEGY_KINDS } from "../schemas/swot.js";
import { KPIS } from "../data/kpis.js";
import { assemble, figuresFor, quadrantOf, sideOf, languagesOf } from "./scenario.js";
import { auditText, factKeysIn, FACT_KEYS } from "./facts.js";
import { issueExpected, expected, round9 } from "./risk.js";
import { REFUSE_TOLERANCE, RESCALE_TOLERANCE } from "./engine.js";
import { answerProblems } from "./guards.js";

const STEPS = ["complete", "challenge", "assess", "strategise", "summary"];
const KEY_SHAPE = /sk-ant-[A-Za-z0-9_-]{8,}|x-api-key/i;
const KPI_IDS = new Set(KPIS.map((k) => k.id));

/** Every string in a tree with its path. */
function strings(tree, path = "", out = []) {
  if (typeof tree === "string") out.push({ path, text: tree });
  else if (Array.isArray(tree)) tree.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (tree && typeof tree === "object") for (const [k, v] of Object.entries(tree)) strings(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** The tree with every string replaced by its placeholders, to compare the two languages' structure. */
function skeleton(tree) {
  if (typeof tree === "string") return `«${factKeysIn(tree).sort().join(",")}»`;
  if (Array.isArray(tree)) return tree.map(skeleton);
  if (tree && typeof tree === "object") return Object.fromEntries(Object.entries(tree).map(([k, v]) => [k, skeleton(v)]));
  return tree;
}

/** Fields whose strings are codes, not prose: ids, enums, addresses, dates. */
const CODE_FIELD = /(^|\.)(id|item|items|issue|quadrant|quadrants|belongs_in|type|kind|horizon|confidence|direction|effort|sector|url|unit|published)(\[\d+\])?$/;

/**
 * Problems with one scenario. Options: dataSources (DATA_SOURCES.md's text), reference (the frozen
 * figures: { [choiceName]: { chosen: [ids], figures } }), today (YYYY-MM-DD), choices (extra choices to
 * play, each a list of strategy ids). Returns a list of problems, each a sentence.
 */
export function scenarioProblems(scenario, { dataSources = "", reference = null, today = new Date().toISOString().slice(0, 10), choices = [] } = {}) {
  const out = [];
  const where = (s) => `${scenario?.id ?? "a scenario"}: ${s}`;

  // Keys and thinking blocks, anywhere in the file.
  const json = JSON.stringify(scenario);
  if (KEY_SHAPE.test(json)) out.push(where("holds something shaped like an API key"));
  // A run's audit names its thinking setting ("disabled" or "adaptive"); any other thinking field is a block.
  if (/"(redacted_thinking|signature)"\s*:/.test(json) || /"thinking"\s*:\s*(?!"(?:disabled|adaptive)")/.test(json) || /"type"\s*:\s*"(thinking|redacted_thinking)"/.test(json)) out.push(where("holds a thinking block"));
  const live = scenario?.source === "live";
  const LANGS = live ? [scenario.language].filter((l) => l === "en" || l === "de") : ["en", "de"];

  // The contract.
  const contract = live ? "Recording" : "Scenario";
  const v = validate(scenario, SCHEMAS[contract], SCHEMAS);
  if (!v.valid) { out.push(where(`breaks the ${contract} contract: ${describeErrors(v.errors)}`)); return out; }
  if (scenario.as_of > today) out.push(where(`is dated ${scenario.as_of}, after today`));

  // Every language, every agent's answer valid against its schema.
  for (const lang of LANGS) {
    const a = scenario.answers[lang];
    if (!a) { out.push(where(`has no answers in ${lang}`)); continue; }
    for (const step of STEPS) {
      const name = REQUESTS[step];
      if (!a[step]) { out.push(where(`has no ${step} answer in ${lang}`)); continue; }
      const r = validate(a[step], SCHEMAS[name], SCHEMAS);
      if (!r.valid) out.push(where(`its ${step} answer in ${lang} breaks the ${name} contract: ${describeErrors(r.errors)}`));
    }
  }
  if (out.length) return out;

  // The two languages: the same structure, numbers, ids and choices; the same placeholders in each text.
  const [en, de] = live ? ["", ""] : LANGS.map((l) => JSON.stringify(skeleton(scenario.answers[l])));
  if (en !== de) {
    const se = strings(scenario.answers.en);
    const sd = strings(scenario.answers.de);
    const diff = se.find((x, i) => !sd[i] || x.path !== sd[i].path || factKeysIn(x.text).sort().join() !== factKeysIn(sd[i].text).sort().join());
    out.push(where(`the English and German answers differ in more than their words${diff ? ` (first at ${diff.path})` : ""}`));
  }
  for (const lang of LANGS) {
    for (const s of strings(scenario.answers[lang])) {
      if (!CODE_FIELD.test(s.path) && /^\s*$/.test(s.text) && !/(^|\.)(reason|basis|definition)$/.test(s.path)) out.push(where(`${s.path} is empty in ${lang}`));
    }
  }

  // Ids, the guards of brief 6.7 and the rules of brief 6.2, in each language's assembly.
  let runs;
  try { runs = Object.fromEntries(LANGS.map((l) => [l, assemble(scenario, l)])); } catch (e) { out.push(where(`cannot be assembled: ${e.message}`)); return out; }
  const run = runs[LANGS[0]];
  const ids = new Set(run.items.map((i) => i.id));
  const before = run.items.filter((i) => !i.added);
  const missing = (id) => !ids.has(id);
  const check = (ok, text) => { if (!ok) out.push(where(text)); };

  const entered = new Set(Object.values(scenario.entered).flat().map((i) => i.id));
  for (const [q, list] of Object.entries(scenario.entered)) for (const it of list) check(quadrantOf(it.id) === q, `the team's item ${it.id} sits in ${q}`);
  check(entered.size === Object.values(scenario.entered).flat().length, "the team's items repeat an id");
  for (const q of ["strengths", "weaknesses", "opportunities", "threats"]) {
    // The person's check may remove AI items in a live run; the Completer filled the quadrant before it.
    const n = before.filter((i) => i.quadrant === q).length + run.removed.filter((i) => i.quadrant === q).length;
    const ai = run.items.filter((i) => i.quadrant === q && i.source === "ai" && !i.added).length + run.removed.filter((i) => i.quadrant === q).length;
    check(n >= 3, `${q} holds ${n} items after the Completer; it fills every quadrant to three`);
    check(ai <= 4, `the Completer adds ${ai} items to ${q}; at most four`);
    check(run.items.filter((i) => i.quadrant === q).length <= 8, `${q} holds more than eight items`);
  }
  for (const m of run.misfiled) {
    check(!missing(m.item) && entered.has(m.item), `the Completer flags ${m.item}, which the team did not enter`);
    check(quadrantOf(m.item) !== m.belongs_in, `the Completer says ${m.item} belongs where it already is`);
  }
  const issueIds = run.issues.map((i) => i.id);
  check(new Set(issueIds).size === issueIds.length, "issue ids repeat");
  for (const issue of run.issues) {
    for (const id of issue.items) check(!missing(id), `issue ${issue.id} names ${id}, which does not exist`);
    for (const id of issue.items) check(!run.items.find((i) => i.id === id)?.added, `issue ${issue.id} names ${id}, a factor the challenge itself added`);
    check(issue.type !== "missing" || issue.added_items.length === 1, `issue ${issue.id} is "missing" but adds no factor`);
    check(issue.type === "missing" || issue.added_items.length === 0, `issue ${issue.id} adds a factor but is not "missing"`);
    // A missing factor is the fault itself: the item it adds carries the issue, so the issue names no item
    // of the SWOT (TECH_NOTES.md, section 10). Its items would otherwise turn red for a fault they don't have.
    check(issue.type !== "missing" || issue.items.length === 0, `issue ${issue.id} is "missing" but names items of the SWOT (${issue.items.join(", ")}); the factor it adds carries it`);
    for (const e of issue.evidence) check(scenario.sources.some((s) => s.url === e.url), `issue ${issue.id} cites ${e.url}, which the scenario's sources do not list`);
  }
  const impacts = run.impacts;
  for (const issue of run.issues) check(impacts.filter((x) => x.issue === issue.id).length === 1, `issue ${issue.id} has ${impacts.filter((x) => x.issue === issue.id).length} assessments; it has one`);
  for (const im of impacts) {
    check(issueIds.includes(im.issue), `an assessment names ${im.issue}, which does not exist`);
    if (im.monetisable) {
      check(im.eur_year_low <= im.eur_year_high && im.eur_year_high > 0, `the euro range of ${im.issue} runs from ${im.eur_year_low} to ${im.eur_year_high}`);
      check(im.kpis.length >= 1, `${im.issue} is priced but moves no KPI`);
      check(!im.reason, `${im.issue} is priced but carries a reason for not being priced`);
    } else {
      check(!!im.reason && im.kpis.length === 0 && im.eur_year_low === 0 && im.eur_year_high === 0, `${im.issue} is not priced, so it needs a reason, no KPI and no euros`);
    }
    for (const k of im.kpis) {
      const sector = k.id.split(".")[0];
      check(KPI_IDS.has(k.id) || !!k.definition, `${im.issue} uses ${k.id}, which the library lacks, without a definition`);
      check(!KPI_IDS.has(k.id) || [run.sector, "general"].includes(sector), `${im.issue} uses ${k.id} from another sector than ${run.sector}`);
      check(k.change_low <= k.change_high, `${im.issue}: the change of ${k.id} runs backwards`);
      check(k.direction === "down" ? k.change_high <= 0 : k.change_low >= 0, `${im.issue}: ${k.id} goes ${k.direction} but its change says otherwise`);
    }
  }
  check(run.sector === scenario.company.sector, `the Completer's sector ${run.sector} is not the company's ${scenario.company.sector}`);

  // Factors: every item once, ratings on David's scales, each side's weights adding up to 1.
  const factorIds = run.factors.map((f) => f.id);
  for (const it of run.items) check(factorIds.filter((x) => x === it.id).length === 1, `item ${it.id} has ${factorIds.filter((x) => x === it.id).length} factors; it has one`);
  for (const f of run.factors) {
    check(!missing(f.id), `a factor names ${f.id}, which does not exist`);
    if (f.quadrant === "strengths") check(f.rating >= 3, `strength ${f.id} is rated ${f.rating}; a strength is 3 or 4`);
    if (f.quadrant === "weaknesses") check(f.rating <= 2, `weakness ${f.id} is rated ${f.rating}; a weakness is 1 or 2`);
  }
  for (const side of ["internal", "external"]) {
    const sum = round9(run.factors.filter((f) => sideOf(f.id) === side).reduce((s, f) => s + f.weight, 0));
    check(Math.abs(sum - 1) <= REFUSE_TOLERANCE, `the ${side} weights add up to ${sum}; more than ${REFUSE_TOLERANCE} from 1 is refused`);
    if (!live) check(Math.abs(sum - 1) <= RESCALE_TOLERANCE, `the ${side} weights add up to ${sum}; an authored scenario adds up to 1`);
  }

  // Strategies: type, kind, items, issue, ratings, residual or upside.
  const sIds = run.strategies.map((s) => s.id);
  check(new Set(sIds).size === sIds.length, "strategy ids repeat");
  for (const s of run.strategies) {
    const [inner, outer] = s.type.split("");
    const want = { S: "strengths", W: "weaknesses", O: "opportunities", T: "threats" };
    for (const id of s.items) check(!missing(id), `strategy ${s.id} names ${id}, which does not exist`);
    const internal = s.items.filter((id) => sideOf(id) === "internal");
    const external = s.items.filter((id) => sideOf(id) === "external");
    check(internal.length >= 1 && external.length >= 1, `strategy ${s.id} needs an internal and an external item`);
    check(internal.every((id) => quadrantOf(id) === want[inner]) && external.every((id) => quadrantOf(id) === want[outer]), `strategy ${s.id} is ${s.type} but pairs ${s.items.join(", ")}`);
    check(s.kind === STRATEGY_KINDS[s.type], `strategy ${s.id} is ${s.type}, so its kind is ${STRATEGY_KINDS[s.type]}, not ${s.kind}`);
    check(issueIds.includes(s.issue), `strategy ${s.id} answers ${s.issue}, which does not exist`);
    check(s.kind === "mitigate" ? !!s.residual && !s.upside : !!s.upside && !s.residual, `strategy ${s.id} (${s.kind}) needs ${s.kind === "mitigate" ? "a residual and no upside" : "an upside and no residual"}`);
    for (const r of s.ratings) {
      check(s.items.includes(r.item), `strategy ${s.id} rates ${r.item}, which it does not name`);
      const f = run.factors.find((x) => x.id === r.item);
      if (f?.quadrant === "weaknesses") check(r.to <= 2, `strategy ${s.id} rates weakness ${r.item} at ${r.to}; a weakness stays at 2 or below`);
      if (f?.quadrant === "strengths") check(r.to >= 3, `strategy ${s.id} rates strength ${r.item} at ${r.to}`);
      check(!f || r.to >= f.rating, `strategy ${s.id} lowers the rating of ${r.item}`);
    }
    if (s.residual) {
      const issue = run.issues.find((i) => i.id === s.issue);
      const own = issue ? issueExpected(issue) : null;
      const res = expected(s.residual.eur_year_low, s.residual.eur_year_high, s.residual.likelihood);
      check(own !== null && res <= own, `strategy ${s.id} leaves more at risk than issue ${s.issue} had`);
    }
  }
  for (const id of scenario.recorded_choice) check(sIds.includes(id), `the recorded choice names ${id}, which does not exist`);

  // The live pipeline's guards (js/guards.js) on every answer, in both languages: a recorded run obeys the
  // same rules as a live one, so it replays through the live checks and the stand-in of tests/live.mjs.
  for (const lang of LANGS) {
    const r = runs[lang];
    const a = scenario.answers[lang];
    const urls = scenario.sources.map((x) => x.url);
    const ctx = {
      complete: { entered: r.items.filter((i) => i.source === "user"), sector: scenario.company.sector },
      challenge: { items: r.items.filter((i) => !i.added), urls },
      assess: { items: r.items, issues: r.issues, sector: r.sector },
      strategise: { items: r.items, issues: r.issues, factors: r.factors.map((f) => ({ item: f.id, rating: f.rating })) },
      summary: { facts: new Set([...FACT_KEYS, ...r.issues.map((i) => `issue.${i.id}.expected`)]), evidence: { titles: r.issues.flatMap((i) => i.evidence.map((e) => e.title)), urls } }
    };
    for (const step of STEPS) {
      if (live && step === "summary" && scenario.run?.summary_unchecked) continue;
      for (const p of answerProblems(step, a[step], ctx[step])) out.push(where(`its ${step} answer in ${lang} fails the live guard: ${p}`));
    }
  }

  // The fact audit on every text an agent wrote, in every language; in a live recording on the Writer's
  // text, as the live guard has it, unless the run showed that text as unchecked.
  for (const lang of LANGS) {
    const r = runs[lang];
    const known = new Set([...FACT_KEYS, ...r.issues.map((i) => `issue.${i.id}.expected`)]);
    const evidence = { titles: r.issues.flatMap((i) => i.evidence.map((e) => e.title)), urls: scenario.sources.map((s) => s.url) };
    for (const s of strings(scenario.answers[lang])) {
      if (CODE_FIELD.test(s.path) || /(^|\.)evidence\[\d+\]\.title$/.test(s.path)) continue;
      if (live && (!s.path.startsWith("summary") || scenario.run?.summary_unchecked)) continue;
      const a = auditText(s.text, { facts: known, evidence });
      if (!a.pass) out.push(where(`${s.path} in ${lang} fails the fact audit: ${[...a.tokens, ...a.unknownFacts.map((k) => `unknown fact ${k}`)].join(", ")}`));
      if (!s.path.startsWith("summary") && factKeysIn(s.text).length) out.push(where(`${s.path} in ${lang} cites a fact; only the Writer does`));
    }
  }

  // Sources: every one in DATA_SOURCES.md with the date it was read (a live recording's at its curation).
  for (const src of live ? [] : scenario.sources) {
    const line = dataSources.split("\n").find((l) => l.includes(src.url));
    if (!line) out.push(where(`its source ${src.url} is missing from DATA_SOURCES.md`));
    else if (!line.includes(src.read_on)) out.push(where(`DATA_SOURCES.md lists ${src.url} without the date ${src.read_on}`));
  }

  // Play the run: the recorded choice, the other choices given, and against the frozen figures.
  const plays = [["recorded", scenario.recorded_choice], ...choices.map((c, i) => [`choice ${i + 1}`, c])];
  for (const [name, chosen] of plays) {
    let f;
    try { f = figuresFor(run, chosen); } catch (e) { out.push(where(`the ${name} cannot be played: ${e.message}`)); continue; }
    check(f.left <= f.stake.value + 1e-9, `with the ${name}, more is left than was at stake`);
    check(Number.isFinite(f.ife.after.value) && Number.isFinite(f.efe.after.value), `with the ${name}, a score is not a number`);
    for (const l of LANGS.slice(1)) {
      const g = figuresFor(runs[l], chosen);
      check(JSON.stringify(g) === JSON.stringify(f), `with the ${name}, the German run gives other figures than the English one`);
    }
  }
  if (reference) {
    for (const [name, ref] of Object.entries(reference)) {
      const f = figuresFor(run, ref.chosen);
      const got = { ife_before: f.ife.before.value, ife_after: f.ife.after.value, efe_before: f.efe.before.value, efe_after: f.efe.after.value, cell_before: f.ie.before.cell, cell_after: f.ie.after.cell, at_stake: f.stake.value, priced: f.stake.priced, issues: f.stake.of, left: f.left, upside: f.upside, challenged: f.items.challenged, total: f.items.total, added: f.items.added };
      for (const [k, want] of Object.entries(ref.figures)) {
        const ok = typeof want === "number" ? Math.abs(got[k] - want) <= 1e-9 : got[k] === want;
        check(ok, `${name}: ${k} is ${got[k]}, the frozen reference says ${want}`);
      }
    }
  }
  return out;
}

// The handoff file (brief 4.3 and 10; AC-21): the run as strategy-challenge/1, the JSON the Prototype Ideator
// reads without a model call. The quadrants are its areas, each issue keeps its KPI effects and its euro
// range with the engine's expected value, a strategy is a response whose changes are rate entries, and the
// score is the response to the market (EFE, 1 to 4). Every figure is a number the engine computed for the
// person's choice, so the file says what the tiles say. Code writes all of it; the file carries no key, no
// prompt and no thinking. handoffProblems() checks a file against the shared schema and the references the
// schema can't hold, the same way the Ideator's reader does, before the page offers it.

import { APP, QUADRANTS } from "./config.js";
import { t } from "./i18n/index.js";
import { figuresFor } from "./scenario.js";
import { addressed } from "./simulation.js";
import { band, expected } from "./risk.js";
import { renderFacts } from "./facts.js";
import { factValues } from "./engine.js";
import { zoneName } from "./format.js";
import { validate, describeErrors } from "./schema.js";
import SCHEMA from "../schemas/strategy-challenge-1.js";

export const HANDOFF_SCHEMA = "strategy-challenge/1";
export const TOOL = Object.freeze({ id: "swot-challenger", name: APP.name, version: APP.version, url: APP.url });

/** A date as the handoff writes it: YYYY-MM-DD. */
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/** The country as two capital letters: a code as given, a name in English or German through the region names, or ZZ, the unknown region. */
export function countryCode(value) {
  const v = String(value || "").trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  if (!v) return "ZZ";
  const want = v.toLocaleLowerCase("de");
  try {
    const names = ["en", "de"].map((l) => new Intl.DisplayNames([l], { type: "region" }));
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        // A retired code (DD, the old East Germany) is an alias of today's (DE): only canonical codes count.
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue;
        if (names.some((n) => { try { const name = n.of(code); return name && name !== code && name.toLocaleLowerCase("de") === want; } catch { return false; } })) return code;
      }
    }
  } catch { /* no region names in this engine */ }
  return "ZZ";
}

/**
 * The sources with the dates they were read: a recorded scenario's sources with their dates, research a
 * live run accepted with the run's date. Titles come from the issues' evidence where the source has none.
 */
export function sourcesOf({ run, scenario, today }) {
  const titles = new Map();
  for (const i of run.issues) for (const e of i.evidence || []) if (!titles.has(e.url)) titles.set(e.url, e.title);
  for (const s of run.signals || []) if (!titles.has(s.url)) titles.set(s.url, s.title);
  const out = [];
  const seen = new Set();
  const add = (url, title, read) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, title: title || titles.get(url) || new URL(url).hostname, read_on: day(read || today) });
  };
  for (const s of scenario?.sources || []) add(s.url, s.title, s.read_on);
  // A source an issue cites keeps the title the issue gives it, so the report names it the same way twice.
  for (const s of run.signals || []) add(s.url, titles.get(s.url) || s.title, today);
  for (const i of run.issues) for (const e of i.evidence || []) add(e.url, e.title, null);
  return out;
}

/** Item ids the Red team challenged among the entered and completed items, as the tile counts them. */
function challengedIds(run) {
  const named = new Set(run.issues.flatMap((i) => i.items || []));
  return run.items.filter((i) => !i.added && named.has(i.id)).map((i) => i.id);
}

/** A strategy's range as a handoff range: likelihood, euros and the engine's expected value. */
function range(r) {
  if (!r) return null;
  return { likelihood: r.likelihood, eur_year_low: r.eur_year_low, eur_year_high: r.eur_year_high, eur_year_expected: expected(r.eur_year_low, r.eur_year_high, r.likelihood) };
}

/**
 * The handoff file of a run. opts: { run (assemble()), scenario (for a recorded run's sources), chosen
 * (strategy ids), lang, mode ("simulation" | "live"), model (the live run's model id, else null), created
 * (a Date), country (the company's country as entered) }. Returns the plain object, not yet checked.
 */
export function handoffFor({ run, scenario = null, chosen = [], lang, mode, model = null, created = new Date(), country = null }) {
  const set = new Set(chosen);
  const f = figuresFor(run, chosen);
  const facts = factValues(f, lang, zoneName);
  const today = day(created);
  const impacts = new Map((run.impacts || []).map((x) => [x.issue, x]));
  const areas = QUADRANTS.map(({ id }) => ({
    id,
    label: t(`q.${id}`, null, lang),
    items: run.items.filter((i) => i.quadrant === id).map((i) => {
      const item = { id: i.id, text: i.text, source: i.source === "user" ? "user" : "ai" };
      if (i.source !== "user" && i.confidence) item.confidence = i.confidence;
      if (i.source !== "user" && i.basis) item.basis = i.basis;
      return item;
    })
  }));
  const sources = sourcesOf({ run, scenario, today });
  const readOn = new Map(sources.map((s) => [s.url, s.read_on]));
  const issues = run.issues.map((i) => {
    const a = impacts.get(i.id);
    const priced = !!a?.monetisable;
    return {
      id: i.id,
      title: i.title,
      type: i.type,
      description: i.description,
      areas: [...i.quadrants],
      items: [...(i.items || []), ...(i.added || [])],
      impact: i.impact,
      likelihood: i.likelihood,
      band: band(i.impact, i.likelihood),
      horizon: i.horizon,
      kpis: (a?.kpis || []).map((k) => ({ id: k.id, name: k.name, unit: k.unit, direction: k.direction, change_low: k.change_low, change_high: k.change_high, basis: k.basis })),
      eur_year_low: priced ? a.eur_year_low : 0,
      eur_year_high: priced ? a.eur_year_high : 0,
      eur_year_expected: priced ? expected(a.eur_year_low, a.eur_year_high, i.likelihood) : 0,
      eur_basis: priced ? a.basis : t("h.not.priced", { reason: a?.reason || t("h.not.priced.none", null, lang) }, lang),
      evidence: (i.evidence || []).map((e) => ({ url: e.url, title: e.title, read_on: readOn.get(e.url) || today })),
      confidence: i.confidence
    };
  });
  const responses = run.strategies.map((s) => ({
    id: s.id,
    issue: s.issue,
    kind: s.kind,
    chosen: set.has(s.id),
    title: s.title,
    first_step: s.first_step,
    owner: s.owner,
    changes: s.changes.filter((c) => Number.isInteger(c.from) && Number.isInteger(c.to)).map((c) => ({ action: "rate", item: c.item, from: c.from, to: c.to })),
    residual: range(s.residual),
    upside: range(s.upside),
    effort: s.effort,
    time_to_impact: s.time_to_impact
  }));
  const fixedIds = new Set(addressed(run, chosen).keys());
  const challenged = challengedIds(run);
  const s = run.summary;
  const r = (text) => renderFacts(text, facts);
  const summary = s
    ? { headline: r(s.headline), text: [r(s.situation), s.findings.map((x) => `- ${r(x)}`).join("\n"), r(s.recommendation)].join("\n\n") }
    : { headline: t("h.summary.none", { company: run.company.name }, lang), text: "" };
  return {
    schema: HANDOFF_SCHEMA,
    tool: { ...TOOL },
    created: created.toISOString(),
    language: lang,
    mode,
    model: mode === "live" ? model : null,
    company: {
      name: run.company.name,
      sector: run.sector || run.company.sector || "general",
      country: countryCode(country ?? run.company.country),
      description: run.company.description || "",
      fictional: mode !== "live"
    },
    framework: { type: "swot", areas },
    issues,
    responses,
    figures: {
      at_stake_eur_year: f.stake.value,
      left_eur_year: f.left,
      upside_eur_year: f.upside,
      score: { name: "efe", scale: "1-4", before: f.efe.before.value, after: f.efe.after.value },
      pressure: { label: t("p.kpi.items.label", null, lang), before: challenged.length, after: challenged.filter((id) => !fixedIds.has(id)).length, of: f.items.total }
    },
    summary,
    sources,
    disclaimer: t("h.disclaimer", null, lang)
  };
}

/** What is wrong with a handoff file: the shared schema's errors and the references it can't hold. */
export function handoffProblems(json) {
  if (!json || json.schema !== HANDOFF_SCHEMA) return [`not a ${HANDOFF_SCHEMA} file`];
  const v = validate(json, SCHEMA, SCHEMA.$defs);
  if (!v.valid) return describeErrors(v.errors).split("\n").filter(Boolean);
  const out = [];
  const ids = json.issues.map((i) => i.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) out.push(`issue ids appear twice: ${[...new Set(dupes)].join(", ")}`);
  const rids = json.responses.map((r) => r.id);
  if (new Set(rids).size !== rids.length) out.push("response ids appear twice");
  const items = new Set(json.framework.areas.flatMap((a) => a.items.map((i) => i.id)));
  for (const r of json.responses) {
    if (!ids.includes(r.issue)) out.push(`response ${r.id} names issue ${r.issue}, which the file doesn't have`);
    for (const c of r.changes) if (c.item && !items.has(c.item)) out.push(`response ${r.id} rates item ${c.item}, which the file doesn't have`);
  }
  for (const i of json.issues) for (const id of i.items) if (!items.has(id)) out.push(`issue ${i.id} names item ${id}, which the file doesn't have`);
  if (/sk-ant-/.test(JSON.stringify(json))) out.push("the file holds something shaped like an API key");
  return out;
}

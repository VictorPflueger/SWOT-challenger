// A scenario's recorded run, put together the way the page plays it: the team's items, the Completer's
// items and the factors the challenge added, each with its id; the issues with their euro ranges; the
// factors; the strategies with the ratings they set; and every figure for whichever strategies the
// person chooses. Pure functions, so the page, the scenario checker and the tests assemble a run the same
// way. Ids are given by order: the Completer's items follow the team's in each quadrant, and the factors
// the challenge adds follow those. A live run is a recording in one language that grows step by step
// (js/pipeline.js): a step not yet answered assembles as empty, and the person's check of the AI's items
// (its decision) takes the removed items out and puts the edited texts in, without changing any id.

import { QUADRANTS } from "./config.js";
import { figures, factValues, SIDE } from "./engine.js";
import { issueExpected, PROBABILITY } from "./risk.js";

const LETTER = { strengths: "s", weaknesses: "w", opportunities: "o", threats: "t" };
const QUADRANT_OF = { s: "strengths", w: "weaknesses", o: "opportunities", t: "threats" };
/** The quadrant an item id belongs to: s, w, o or t, then a number. */
export const quadrantOf = (id) => QUADRANT_OF[String(id)[0]];

/** The answers of one language, with the company and the team's items in that language. */
export function inLanguage(scenario, lang) {
  if (!["en", "de"].includes(lang)) throw new RangeError(`no language ${lang}`);
  const answers = scenario.answers?.[lang];
  if (!answers) throw new Error(`scenario ${scenario.id} has no answers in ${lang}`);
  return { answers, description: scenario.company.description?.[lang] ?? "" };
}

/** The languages a scenario holds: both for a recorded one, the run's own for a live recording. */
export const languagesOf = (scenario) => (scenario.source === "live" ? [scenario.language] : ["en", "de"]);

/**
 * The run of a scenario in one language, before any choice: { company, items, misfiled, issues, impacts,
 * factors, strategies, summary }. Items are [{ id, quadrant, text, source, added, confidence, basis }].
 */
export function assemble(scenario, lang) {
  const { answers, description } = inLanguage(scenario, lang);
  const items = [];
  const next = {};
  for (const { id: q } of QUADRANTS) {
    for (const it of scenario.entered[q]) items.push({ id: it.id, quadrant: q, text: it.text[lang], source: "user", added: false });
    next[q] = scenario.entered[q].length;
  }
  const push = (q, fields) => {
    next[q] += 1;
    const item = { id: `${LETTER[q]}${next[q]}`, quadrant: q, ...fields };
    items.push(item);
    return item;
  };
  const complete = answers.complete || { sector: scenario.company.sector || null, items: [], misfiled: [] };
  const decision = scenario.decision || { removed: [], edited: [] };
  const removedIds = new Set(decision.removed || []);
  const editedText = new Map((decision.edited || []).map((e) => [e.id, e.text]));
  const removed = [];
  for (const it of complete.items) {
    const item = push(it.quadrant, { text: it.text, source: "ai", added: false, confidence: it.confidence, basis: it.basis });
    if (editedText.has(item.id)) Object.assign(item, { text: editedText.get(item.id), edited: true, original: it.text });
    if (removedIds.has(item.id)) removed.push(items.pop());
  }
  const challenge = answers.challenge || { issues: [] };
  const issues = challenge.issues.map((issue) => {
    const added = issue.added_items.map((a) => push(a.quadrant, { text: a.text, source: "ai", added: true, basis: a.basis, issue: issue.id }).id);
    return { ...issue, added };
  });
  const assessed = answers.assess || { impacts: [], factors: [] };
  const impacts = assessed.impacts;
  for (const issue of issues) {
    const impact = impacts.find((x) => x.issue === issue.id);
    issue.monetisable = !!impact?.monetisable;
    issue.eur_year_low = impact?.monetisable ? impact.eur_year_low : null;
    issue.eur_year_high = impact?.monetisable ? impact.eur_year_high : null;
    issue.expected = issueExpected(issue);
  }
  const factors = assessed.factors.map((f) => ({ id: f.item, quadrant: quadrantOf(f.item), weight: f.weight, rating: f.rating, reason: f.reason }));
  const ratingOf = new Map(factors.map((f) => [f.id, f.rating]));
  const strategies = (answers.strategise?.strategies || []).map((s) => ({
    ...s,
    residual: s.residual[0] || null,
    upside: s.upside[0] || null,
    changes: s.ratings.map((r) => ({ action: "rate", item: r.item, from: ratingOf.get(r.item), to: r.to }))
  }));
  return {
    id: scenario.id,
    company: { ...scenario.company, description },
    items,
    removed,
    misfiled: complete.misfiled,
    sector: complete.sector,
    issues,
    impacts,
    factors,
    strategies,
    summary: answers.summary || null,
    signals: answers.research?.signals || [],
    recorded: [...(scenario.recorded_choice || [])]
  };
}

/** The strategy ids the agents recommend: preselected at the decision. */
export const recommended = (run) => run.strategies.filter((s) => s.recommended).map((s) => s.id);

/** Every figure of the run for a choice of strategy ids (brief 6.5). */
export function figuresFor(run, chosen = []) {
  const set = new Set(chosen);
  return figures({
    factors: run.factors,
    strategies: run.strategies.map((s) => ({ ...s, chosen: set.has(s.id) })),
    issues: run.issues,
    items: run.items
  });
}

/** The fact keys as display text for a choice, in a language: what {{fact:key}} renders to. */
export function factsFor(run, chosen, lang, zoneName) {
  return factValues(figuresFor(run, chosen), lang, zoneName);
}

/** Side of an item: internal for strengths and weaknesses, external for opportunities and threats. */
export const sideOf = (id) => SIDE[quadrantOf(id)];

/** A strategy's effect in euros a year: the residual's or the upside's expected value, or null. */
export function strategyEffect(strategy) {
  const r = strategy.residual || strategy.upside;
  if (!r) return null;
  return ((r.eur_year_low + r.eur_year_high) / 2) * PROBABILITY[r.likelihood];
}

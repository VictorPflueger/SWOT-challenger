// The SWOT engine: the two factor scores after Fred R. David (IFE over the internal items, EFE over the
// external ones), where the company stands on his IE matrix, the ratings after the chosen strategies,
// the items the challenge questions and the fact keys the Writer's text refers to (brief 6.5). Pure
// functions at full precision; js/risk.js holds the risk, the money and the rounding. Every score is a
// structured judgement, not a measurement: the weights and ratings are the AI's estimates.

import { round9, fixed, money, atStake, left, upside, issueExpected } from "./risk.js";

/** The side of each quadrant: internal factors feed IFE, external factors EFE. */
export const SIDE = Object.freeze({ strengths: "internal", weaknesses: "internal", opportunities: "external", threats: "external" });

/** Weights that miss 1 by more than this are rescaled to 1, and the panel says so (brief 6.5). */
export const RESCALE_TOLERANCE = 0.001;
/** Weights that miss 1 by more than this are refused before the engine sees them (brief 6.7). */
export const REFUSE_TOLERANCE = 0.05;

/**
 * The factor score of one side: Σ weight × rating over its items, rescaled when the weights miss 1.
 * factors: [{ id, quadrant, weight, rating }]. Returns { value, raw, weightSum, rescaled, count }.
 */
export function sideScore(factors, side) {
  const own = factors.filter((f) => SIDE[f.quadrant] === side);
  if (!own.length) throw new RangeError(`no ${side} factors to score`);
  const weightSum = round9(own.reduce((s, f) => s + f.weight, 0));
  if (weightSum <= 0) throw new RangeError(`the ${side} weights add up to ${weightSum}`);
  const raw = own.reduce((s, f) => s + f.weight * f.rating, 0);
  const rescaled = Math.abs(weightSum - 1) > RESCALE_TOLERANCE;
  return { value: round9(rescaled ? raw / weightSum : raw), raw: round9(raw), weightSum, rescaled, count: own.length };
}

/** Both factor scores: { ife, efe }, each as sideScore returns it. */
export function factorScores(factors) {
  return { ife: sideScore(factors, "internal"), efe: sideScore(factors, "external") };
}

/** The nine cells of the IE matrix, row by row from high and strong. */
export const CELLS = Object.freeze(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"]);
/** The strategy each cell asks for, after David: grow and build, hold and maintain, harvest or divest. */
export const ZONE = Object.freeze({ I: "grow", II: "grow", IV: "grow", III: "hold", V: "hold", VII: "hold", VI: "harvest", VIII: "harvest", IX: "harvest" });

/** 0 for strong or high (3.00 and up), 1 for average or medium (2.00 and up), 2 for weak or low. */
const level = (score) => (round9(score) >= 3 ? 0 : round9(score) >= 2 ? 1 : 2);

/** Where the company stands: IFE across, EFE up. Returns { cell, zone, row, column }. */
export function ieCell(ife, efe) {
  const row = level(efe);
  const column = level(ife);
  const cell = CELLS[row * 3 + column];
  return { cell, zone: ZONE[cell], row, column };
}

/**
 * The factors after the chosen strategies: each chosen strategy sets new ratings through its `rate`
 * changes ({ action: "rate", item, from, to }); where two touch the same item, the higher rating counts.
 * Choosing no strategy leaves every rating as it was.
 */
export function ratingsAfter(factors, strategies) {
  const best = new Map();
  for (const s of strategies) {
    if (!s.chosen) continue;
    for (const c of s.changes || []) {
      if (c.action !== "rate") continue;
      best.set(c.item, Math.max(best.get(c.item) ?? -Infinity, c.to));
    }
  }
  return factors.map((f) => (best.has(f.id) ? { ...f, rating: best.get(f.id) } : { ...f }));
}

/**
 * Items the challenge questions: distinct items named by issues, of the items before the challenge;
 * the items the challenge added are counted apart. items: [{ id, added }], issues: [{ items: [id] }].
 */
export function itemsChallenged(items, issues) {
  const named = new Set(issues.flatMap((i) => i.items || []));
  const before = items.filter((i) => !i.added);
  return { challenged: before.filter((i) => named.has(i.id)).length, total: before.length, added: items.length - before.length };
}

/**
 * Every figure of a run: the factor scores and IE cells before and after the decision, at stake, left
 * and upside, and the counts. input: { factors, strategies, issues, items }.
 */
export function figures({ factors, strategies = [], issues = [], items = [] }) {
  const before = factorScores(factors);
  const afterFactors = ratingsAfter(factors, strategies);
  const after = factorScores(afterFactors);
  const responses = strategies.map((s) => ({ issue: s.issue, chosen: !!s.chosen, residual: s.residual || null, upside: s.upside || null }));
  return {
    ife: { before: before.ife, after: after.ife },
    efe: { before: before.efe, after: after.efe },
    ie: { before: ieCell(before.ife.value, before.efe.value), after: ieCell(after.ife.value, after.efe.value) },
    stake: atStake(issues),
    left: left(issues, responses),
    upside: upside(responses),
    items: itemsChallenged(items, issues),
    issues: issues.map((i) => ({ id: i.id, expected: issueExpected(i) }))
  };
}

/**
 * The fact keys of brief 6.5 as display text in one language, for {{fact:key}} placeholders.
 * zoneName(zone, lang) names a zone in words; the caller brings it, so the engine stays free of the
 * dictionaries.
 */
export function factValues(f, lang, zoneName) {
  const out = {
    at_stake: money(f.stake.value, lang),
    left: money(f.left, lang),
    upside: money(f.upside, lang),
    "ife.before": fixed(f.ife.before.value, 2, lang),
    "ife.after": fixed(f.ife.after.value, 2, lang),
    "efe.before": fixed(f.efe.before.value, 2, lang),
    "efe.after": fixed(f.efe.after.value, 2, lang),
    "zone.before": zoneName(f.ie.before.zone, lang),
    "zone.after": zoneName(f.ie.after.zone, lang),
    "items.challenged": String(f.items.challenged),
    "items.total": String(f.items.total),
    "items.added": String(f.items.added),
    "issues.count": String(f.issues.length)
  };
  for (const i of f.issues) if (i.expected !== null) out[`issue.${i.id}.expected`] = money(i.expected, lang);
  return out;
}

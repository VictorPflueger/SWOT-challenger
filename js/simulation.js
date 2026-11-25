// The simulation: a scenario's recorded run, loaded when it is chosen, assembled once in each language,
// and what each step shows of it. Every figure comes from the engine through js/scenario.js, for
// whichever strategies the person adopts. Pure functions besides loadScenario, so the page and the tests
// read a run the same way.

import { SCENARIOS, DEFAULT_SCENARIO } from "../data/scenarios/index.js";
import { assemble, recommended, figuresFor, languagesOf } from "./scenario.js";
import { ratingsAfter } from "./engine.js";

/** The steps by name, as the step bar numbers them: Start is 0, Summary 5. */
export const STEP = Object.freeze({ start: 0, complete: 1, challenge: 2, assess: 3, strategise: 4, summary: 5 });
export const LAST_STEP = STEP.summary;

/** The scenario id the address names, else the default (S2, the talk track's company). */
export function scenarioIdFrom(value) {
  const v = String(value || "").toLowerCase();
  return SCENARIOS.some((s) => s.id === v) ? v : DEFAULT_SCENARIO;
}

const loaded = new Map();
/** A scenario's recorded run, loaded once (data/scenarios/sN.js). */
export async function loadScenario(id) {
  const entry = SCENARIOS.find((s) => s.id === scenarioIdFrom(id));
  if (!loaded.has(entry.id)) loaded.set(entry.id, (await entry.load()).default);
  return loaded.get(entry.id);
}

/**
 * A played run: the scenario and its run in both languages, with the agents' recommendation. A live
 * recording holds one language; its run shows in that language whichever language the page has.
 */
export function createRun(scenario) {
  const langs = languagesOf(scenario);
  const one = langs.length === 1 ? assemble(scenario, langs[0]) : null;
  const byLang = Object.freeze(one ? { en: one, de: one } : { en: assemble(scenario, "en"), de: assemble(scenario, "de") });
  return Object.freeze({ id: scenario.id, scenario, byLang, language: one ? langs[0] : null, recommended: recommended(byLang.en), recorded: [...(scenario.recorded_choice || [])] });
}

/** The items a step shows: the team's from Start, the Completer's from Complete, the added from Challenge. */
export function itemsAt(run, step) {
  return run.items.filter((it) => (it.source === "user" ? true : it.added ? step >= STEP.challenge : step >= STEP.complete));
}

/** The source an item shows: entered by the team, written by the AI, or added by the challenge. */
export const sourceOf = (item) => (item.source === "user" ? "entered" : item.added ? "added" : "ai");

/** The issues that name an item, in the Red team's order. */
export function issuesOf(run, itemId) {
  return run.issues.filter((i) => i.items.includes(itemId));
}

/** The issue that added an item, or null. */
export function issueAdding(run, itemId) {
  return run.issues.find((i) => i.added.includes(itemId)) || null;
}

/**
 * Items the adopted strategies address: those whose rating a chosen strategy raises. A map from item id
 * to { from, to, strategy }, where strategy is the chosen strategy that sets the rating that counts
 * (the higher one where two touch the same item, as the engine has it).
 */
export function addressed(run, chosen) {
  const set = new Set(chosen || []);
  const strategies = run.strategies.map((s) => ({ ...s, chosen: set.has(s.id) }));
  const after = new Map(ratingsAfter(run.factors, strategies).map((f) => [f.id, f.rating]));
  const out = new Map();
  for (const f of run.factors) {
    const to = after.get(f.id);
    if (to === f.rating) continue;
    const by = strategies.find((s) => s.chosen && s.changes.some((c) => c.item === f.id && c.to === to));
    out.set(f.id, { from: f.rating, to, strategy: by || null });
  }
  return out;
}

/** Item ids the Red team challenged among the entered and completed items, as the tile counts them. */
export function challengedIds(run) {
  const named = new Set(run.issues.flatMap((i) => i.items || []));
  return run.items.filter((i) => !i.added && named.has(i.id)).map((i) => i.id);
}

/**
 * How many challenged items a choice addresses: the note under Items challenged after the decision. An
 * item the choice raises but nobody challenged is addressed in the grid, but not counted here, so the note
 * stays a part of the tile's figure (review finding 6), as the handoff's pressure has it.
 */
export const challengedAddressed = (run, fixed) => challengedIds(run).filter((id) => fixed.has(id)).length;

/** The factor of an item: { weight, rating, reason }, or null. */
export const factorOf = (run, itemId) => run.factors.find((f) => f.id === itemId) || null;

/** Every figure for a choice, and for no choice: the tiles' old values. */
export function figuresOf(run, chosen) {
  return { before: figuresFor(run, []), after: figuresFor(run, chosen || []) };
}

/** Two lists of strategy ids hold the same strategies. */
export const sameChoice = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** The strategies in TOWS order (SO, WO, ST, WT), each type's in the Strategist's order. */
export const TOWS = Object.freeze(["SO", "WO", "ST", "WT"]);
export function strategiesByType(run) {
  return Object.fromEntries(TOWS.map((t) => [t, run.strategies.filter((s) => s.type === t)]));
}

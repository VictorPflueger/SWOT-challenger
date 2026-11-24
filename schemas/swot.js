// The SWOT Challenger's data contracts as JSON Schemas (brief section 10): the run's own shapes (Item,
// Swot, Factor, Decision, Scenario, Recording, RunEvent, AuditEvent) and the answers each agent returns (Completion,
// Signals, Issues, Assessment, Strategies, Summary). The answers' schemas keep every limit the person can
// read; js/wire.js strips what the API refuses before a request is sent, and js/schema.js and the guards
// check those limits in code. Every field of an answer is required and none has two types, so a request
// stays far inside the API's limits of 24 optional and 16 union-typed parameters (tests/schemas.mjs).
// "$ref": "Name.json" names another schema of SCHEMAS.

const QUADRANT = { enum: ["strengths", "weaknesses", "opportunities", "threats"] };
const CONFIDENCE = { enum: ["high", "medium", "low"] };
const ITEM_ID = { type: "string", pattern: "^[swot]\\d{1,2}$" };
const ISSUE_ID = { type: "string", pattern: "^I\\d{1,2}$" };
const STRATEGY_ID = { type: "string", pattern: "^R\\d{1,2}$" };
const SCALE5 = { type: "integer", minimum: 1, maximum: 5 };
const RATING = { type: "integer", minimum: 1, maximum: 4 };
const EUR = { type: "number", minimum: 0 };
const text = (max) => ({ type: "string", minLength: 1, maxLength: max });
const object = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties });
const list = (items, maxItems, minItems = 0) => ({ type: "array", items, minItems, maxItems });
const both = (max) => object({ en: text(max), de: text(max) });

/** Issue types (brief 6.2): how the SWOT is written, then business issues. */
export const ISSUE_TYPES = Object.freeze(["misfiled", "not_distinctive", "unsupported", "outdated", "contradiction", "missing", "misjudged", "customer", "competition", "technology", "regulation", "economy", "operations", "finance", "sustainability"]);
/** Horizons (brief 6.3): now (12 months), 1 to 3 years, more than 3 years. */
export const HORIZONS = Object.freeze(["now", "1_to_3_years", "over_3_years"]);
/** TOWS types and the kind each must have (brief 6.2). */
export const STRATEGY_KINDS = Object.freeze({ SO: "advantage", WO: "advantage", ST: "mitigate", WT: "mitigate" });

const Item = object({
  id: ITEM_ID,
  text: text(90),
  source: { enum: ["user", "ai"] },
  added: { type: "boolean", description: "true for a factor the challenge added" },
  confidence: CONFIDENCE,
  basis: text(140)
}, ["id", "text", "source", "added"]);

const Swot = object({
  company: object({ name: text(80), sector: { type: "string", pattern: "^[a-z_]+$" }, country: { type: "string", pattern: "^[A-Z]{2}$" }, description: text(200) }),
  strengths: list({ $ref: "Item.json" }, 8),
  weaknesses: list({ $ref: "Item.json" }, 8),
  opportunities: list({ $ref: "Item.json" }, 8),
  threats: list({ $ref: "Item.json" }, 8)
});

/** The Completer's answer: new items, the sector when asked, notes on items in the wrong quadrant. */
const Completion = object({
  sector: { type: "string", pattern: "^[a-z_]+$", description: "The sector id from the list given; the one the person chose when they chose one." },
  items: list(object({ quadrant: QUADRANT, text: text(90), basis: text(140), confidence: CONFIDENCE }), 16),
  misfiled: list(object({ item: ITEM_ID, belongs_in: QUADRANT, reason: text(140) }), 8)
});

/** The Scout's report through its client tool submit_signals. */
const Signal = object({
  title: text(100),
  summary: text(300),
  url: { type: "string", pattern: "^https://" },
  published: { type: "string", pattern: "^(\\d{4}-\\d{2}-\\d{2})?$", description: "The date the page was published, YYYY-MM-DD, or empty when unknown." },
  quadrants: list(QUADRANT, 4, 1)
});
const Signals = object({ signals: list({ $ref: "Signal.json" }, 8) });

/** One issue of the Red team. A "missing" issue carries the factor it adds in added_items. */
const Issue = object({
  id: ISSUE_ID,
  title: text(90),
  type: { enum: ISSUE_TYPES },
  description: text(300),
  items: list(ITEM_ID, 6),
  quadrants: list(QUADRANT, 4, 1),
  impact: SCALE5,
  likelihood: SCALE5,
  horizon: { enum: HORIZONS },
  evidence: list(object({ url: { type: "string", pattern: "^https://" }, title: text(120) }), 4),
  confidence: CONFIDENCE,
  added_items: list(object({ quadrant: QUADRANT, text: text(90), basis: text(140) }), 1)
});
const Issues = object({ issues: list({ $ref: "Issue.json" }, 8, 1) });

/** The Analyst's answer per issue: KPI effects and a euro range a year, or not monetisable with a reason. */
const Impact = object({
  issue: ISSUE_ID,
  monetisable: { type: "boolean" },
  reason: { type: "string", maxLength: 140, description: "Why the issue is not monetisable; empty when it is." },
  kpis: list(object({
    id: { type: "string", pattern: "^[a-z_]+\\.[a-z0-9_]+$" },
    name: text(60),
    unit: text(30),
    direction: { enum: ["up", "down"] },
    change_low: { type: "number" },
    change_high: { type: "number" },
    definition: { type: "string", maxLength: 200, description: "Empty for a KPI of the library; the full definition for a new one." },
    basis: text(140)
  }), 3),
  eur_year_low: EUR,
  eur_year_high: EUR,
  basis: { type: "string", maxLength: 200 },
  confidence: CONFIDENCE
});
/** The Analyst's weight and rating for one item, after David's scales. */
const Factor = object({ item: ITEM_ID, weight: { type: "number", minimum: 0, maximum: 1 }, rating: RATING, reason: text(140) });
const Assessment = object({ impacts: list({ $ref: "Impact.json" }, 8), factors: list({ $ref: "Factor.json" }, 40, 4) });

/** One TOWS strategy of the Strategist: one issue, one internal and one external item at least. */
const Strategy = object({
  id: STRATEGY_ID,
  type: { enum: Object.keys(STRATEGY_KINDS) },
  title: text(90),
  items: list(ITEM_ID, 6, 2),
  issue: ISSUE_ID,
  kind: { enum: ["mitigate", "advantage"] },
  ratings: list(object({ item: ITEM_ID, to: RATING }), 6),
  residual: list(object({ likelihood: SCALE5, eur_year_low: EUR, eur_year_high: EUR }), 1),
  upside: list(object({ likelihood: SCALE5, eur_year_low: EUR, eur_year_high: EUR }), 1),
  effort: { enum: ["S", "M", "L"] },
  time_to_impact: text(40),
  first_step: text(140),
  owner: text(60),
  recommended: { type: "boolean" }
});
const Strategies = object({ strategies: list({ $ref: "Strategy.json" }, 6, 2) });

/** The Writer's management summary: every figure a {{fact:key}} placeholder. */
const Summary = object({
  headline: text(120),
  situation: text(600),
  findings: list(text(300), 3, 3),
  recommendation: text(400),
  assumptions: list(text(200), 5, 3)
});

/** What the person decided: the AI items kept, removed or edited, and the strategies chosen. */
const Decision = object({
  kept: list(ITEM_ID, 32),
  removed: list(ITEM_ID, 32),
  edited: list(object({ id: ITEM_ID, text: text(90) }), 32),
  chosen: list(STRATEGY_ID, 6)
});

/** A recorded run: what the team entered, then every agent's answer, in English and German. */
const Scenario = object({
  id: { type: "string", pattern: "^s[1-3]$" },
  source: { enum: ["authored", "recorded"] },
  as_of: { type: "string", format: "date" },
  company: object({ name: text(80), sector: { type: "string", pattern: "^[a-z_]+$" }, country: { type: "string", pattern: "^[A-Z]{2}$" }, description: both(200), fictional: { const: true } }),
  sources: list(object({ url: { type: "string", pattern: "^https://" }, read_on: { type: "string", format: "date" } }), 40, 1),
  entered: object({
    strengths: list(object({ id: ITEM_ID, text: both(90) }), 8),
    weaknesses: list(object({ id: ITEM_ID, text: both(90) }), 8),
    opportunities: list(object({ id: ITEM_ID, text: both(90) }), 8),
    threats: list(object({ id: ITEM_ID, text: both(90) }), 8)
  }),
  answers: object({ en: { type: "object" }, de: { type: "object" } }),
  recorded_choice: list(STRATEGY_ID, 6)
});

/** A text in one language: { en } or { de }, for a live recording. */
const oneLanguage = (max, min = 1) => ({ anyOf: [object({ en: { type: "string", minLength: min, maxLength: max } }), object({ de: { type: "string", minLength: min, maxLength: max } })] });
const oneItem = object({ id: ITEM_ID, text: oneLanguage(90) });

const STEPS = ["start", "complete", "research", "challenge", "assess", "strategise", "summary"];
/** One event of a run, as the reducer of js/run.js reads it. */
const RunEvent = object({
  type: { enum: ["step_started", "answer", "refused", "repaired", "decision", "stopped", "done"] },
  step: { enum: STEPS },
  at: { type: "integer", minimum: 0 },
  data: { type: "object" }
});
/** One request to the API and its answer, without key, thinking or signatures. */
const AuditEvent = object({
  at: { type: "integer", minimum: 0 },
  step: { enum: STEPS },
  agent: { enum: ["completer", "scout", "red_team", "analyst", "strategist", "writer"] },
  model: text(60),
  effort: { enum: ["low", "medium", "high"] },
  thinking: { enum: ["disabled", "adaptive"] },
  max_tokens: { type: "integer", minimum: 1 },
  stop_reason: { type: "string" },
  usage: object({ input_tokens: { type: "integer", minimum: 0 }, output_tokens: { type: "integer", minimum: 0 }, web_search_requests: { type: "integer", minimum: 0 } }),
  problems: list({ type: "string" }, 64),
  repaired: { type: "boolean" }
});

/**
 * A live run saved as a simulation ("Save run as simulation"): the Scenario format in the run's one
 * language, a real company (not fictional), the sources its research accepted, the person's check of the
 * AI's items and the strategies chosen, and how the run went: settings, cost, time and each request's
 * usage. The builder curates it into a recorded scenario: a second language, a fictional company, checks.
 */
const Recording = object({
  id: { const: "live" },
  source: { const: "live" },
  as_of: { type: "string", format: "date" },
  language: { enum: ["en", "de"] },
  company: object({ name: text(80), sector: { type: "string", pattern: "^[a-z_]+$" }, country: { type: "string", maxLength: 60 }, description: oneLanguage(140, 0), fictional: { const: false } }),
  sources: list(object({ url: { type: "string", pattern: "^https://" }, read_on: { type: "string", format: "date" } }), 40),
  entered: object({ strengths: list(oneItem, 8), weaknesses: list(oneItem, 8), opportunities: list(oneItem, 8), threats: list(oneItem, 8) }),
  answers: { anyOf: [object({ en: { type: "object" } }), object({ de: { type: "object" } })] },
  decision: { $ref: "Decision.json" },
  recorded_choice: list(STRATEGY_ID, 6),
  run: object({
    preset: { enum: ["fast", "balanced", "thorough"] },
    model: text(60),
    effort: { enum: ["low", "medium", "high"] },
    thinking: { enum: ["disabled", "adaptive"] },
    research: { type: "boolean" },
    cap_eur: { type: "number", minimum: 0 },
    spent_eur: { type: "number", minimum: 0 },
    seconds: { type: "integer", minimum: 0 },
    requests: { type: "integer", minimum: 0 },
    summary_unchecked: { type: "boolean" },
    audit: list({ $ref: "AuditEvent.json" }, 32)
  })
});

/** Every contract by name, for validate(value, SCHEMAS.X, SCHEMAS). */
export const SCHEMAS = Object.freeze({ Item, Swot, Completion, Signal, Signals, Issue, Issues, Impact, Factor, Assessment, Strategy, Strategies, Summary, Decision, Scenario, Recording, RunEvent, AuditEvent });

/** The schema each request sends, by step (the Scout's as its tool's input schema). */
export const REQUESTS = Object.freeze({ complete: "Completion", research: "Signals", challenge: "Issues", assess: "Assessment", strategise: "Strategies", summary: "Summary" });

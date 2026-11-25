// The tool's settings in one place: the app, the policy, what the browser may keep, the quadrants and
// steps, the models with their list prices, the API's addresses and headers for the shared live client
// (js/anthropic.js, js/cost.js), the three presets, the budget cap, each step's output tokens and the
// limits the guards hold the agents to (PLAN.md, sections 3.1 and 3.4).

export const APP = Object.freeze({
  id: "swot",
  name: "SWOT Challenger",
  version: "1.0.0",
  url: "https://victorpflueger.github.io/SWOT-challenger/"
});

/** Who built the tool, as Vici's profile (src/brand/profile.json) names him: the report's byline uses it. */
export const AUTHOR = Object.freeze({
  name: "Victor Pflüger",
  linkedin: "https://www.linkedin.com/in/victorpflueger",
  website: "https://victorpflueger.github.io/VIP/index.html"
});

/**
 * The security policy, exactly as index.html's meta element carries it (brief 5.1). tests/policy.mjs
 * holds the two equal. The page talks to no host but the Claude API.
 */
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https://api.anthropic.com; object-src 'none'; base-uri 'none'; form-action 'none'";

/**
 * Everything the page may keep in the browser: the language choice. Vici keeps the theme under
 * "vc-theme" and its note that a guide has opened under "vc-guide:<path>#<id>". Nothing else is
 * stored, ever: no key, no input, no result (project instructions, "Nothing is kept").
 */
export const STORAGE = Object.freeze({ lang: "swot.lang" });

/** The four quadrants in reading order: internal above external, helpful on the left. */
export const QUADRANTS = Object.freeze([
  { id: "strengths", side: "internal", effect: "helpful" },
  { id: "weaknesses", side: "internal", effect: "harmful" },
  { id: "opportunities", side: "external", effect: "helpful" },
  { id: "threats", side: "external", effect: "harmful" }
]);

/** The steps of a run, in order (brief 1.1). */
export const STEPS = Object.freeze(["start", "complete", "challenge", "assess", "strategise", "summary"]);

/**
 * The models and their list prices in US dollars per million tokens, read on 23 November 2026 and again
 * on 24 November 2026 at https://platform.claude.com/docs/en/about-claude/pricing (TECH_NOTES.md,
 * section 1). Haiku 5.5 pays its long-prompt prices for a prompt over 100,000 tokens. The order is the
 * sister tools', so the shared client and cost meter behave alike in every tool; the default is
 * DEFAULT_MODEL. Product names stay as they are in both languages.
 */
export const MODELS = Object.freeze([
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", price: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 } },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01, longPrompt: { thresholdTokens: 100000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 } } },
  { id: "claude-opus-5-5", label: "Opus 5.5", price: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 } }
]);
/** Haiku 5.5 first: most people who run it live have little budget (project instructions, rule 10). */
export const DEFAULT_MODEL = "claude-haiku-5-5";
/** The models Advanced offers. Opus 5.5 is not needed here (PLAN.md, section 16). */
export const ADVANCED_MODELS = Object.freeze(["claude-haiku-5-5", "claude-sonnet-5-5"]);
/** The prices' date, as the Method dialog and the guide name it. */
export const PRICES_READ_ON = "2026-11-24";

/**
 * The API as the shared live client reaches it (TECH_NOTES.md, section 2): the addresses, the version
 * header the sister tools send and switch together, the header without which the browser blocks the
 * call, the web search tool the Scout uses and its fee ($10 per 1,000 searches plus their tokens), and
 * the Console pages the dialog links to.
 */
export const ANTHROPIC = Object.freeze({
  messagesUrl: "https://api.anthropic.com/v1/messages",
  modelsUrl: "https://api.anthropic.com/v1/models?limit=100",
  countTokensUrl: "https://api.anthropic.com/v1/messages/count_tokens",
  apiVersion: "2023-06-01",
  browserHeader: "anthropic-dangerous-direct-browser-access",
  webSearchTool: Object.freeze({ type: "web_search_20250305", name: "web_search", max_uses: 5 }),
  webSearchUsdPer1000: 10,
  consoleKeysUrl: "https://platform.claude.com/settings/keys",
  consoleWorkspacesUrl: "https://platform.claude.com/settings/workspaces"
});

/**
 * The three settings of the live-run dialog (PLAN.md, section 3.4). `thinking: null` leaves the field
 * out, which means adaptive thinking; Haiku 5.5 takes { type: "disabled" } at high effort or below, and
 * Sonnet 5.5 refuses it, so Thorough never sends it.
 */
export const PRESETS = Object.freeze([
  Object.freeze({ id: "fast", model: "claude-haiku-5-5", effort: "low", thinking: Object.freeze({ type: "disabled" }) }),
  Object.freeze({ id: "balanced", model: "claude-haiku-5-5", effort: "medium", thinking: null }),
  Object.freeze({ id: "thorough", model: "claude-sonnet-5-5", effort: "medium", thinking: null })
]);
export const DEFAULT_PRESET = "balanced";
export const EFFORTS = Object.freeze(["low", "medium", "high"]);

/** The budget cap a person sets for one live run, in euros (brief 5.3, D4). */
export const BUDGET = Object.freeze({ minEur: 0.05, maxEur: 3, defaultEur: 0.5, stepEur: 0.05 });

/**
 * Each request's output tokens: `max` to start (brief 5.4: 8,000 a step until Victor's first live runs
 * are measured) and `min`, what the budget cap may lower a request to before it stops the run instead.
 * Thinking counts towards these.
 */
export const STEP_TOKENS = Object.freeze({
  complete: Object.freeze({ max: 8000, min: 3000 }),
  research: Object.freeze({ max: 8000, min: 3000 }),
  challenge: Object.freeze({ max: 8000, min: 3000 }),
  assess: Object.freeze({ max: 8000, min: 3000 }),
  strategise: Object.freeze({ max: 8000, min: 3000 }),
  summary: Object.freeze({ max: 8000, min: 2000 })
});

/**
 * Research: five searches, at most three Scout requests (the first, a resend after pause_turn, one round
 * after refused URLs or a deferred search). A run sends at most ten requests: five agents, three for the
 * Scout and two repairs (PLAN.md, section 3.1). The pages a search returns come back as input tokens,
 * billed like any other, and the API states no size for them (web search tool, read on 24 November 2026),
 * so the budget's worst case allows 12,000 tokens a search: four times the 3,000 the estimate assumes.
 */
export const RESEARCH = Object.freeze({ maxUses: 5, maxRequests: 3, pageTokensPerSearch: 12000 });
export const MAX_REQUESTS = 10;

/** Above this many input tokens Haiku 5.5's prices rise fivefold, so budget.js refuses such a request. */
export const HAIKU_PROMPT_LIMIT = 100000;

/** What a person may enter and what the agents may return (PLAN.md, section 3.1; brief 6.7). */
export const LIMITS = Object.freeze({
  itemsPerQuadrant: 8,
  newPerQuadrant: 4,
  completeTo: 3,
  itemText: 90,
  basis: 140,
  companyName: 60,
  oneLine: 140,
  country: 60,
  issues: 8,
  strategiesMin: 2,
  strategiesMax: 6,
  weightsOff: 0.05
});

/** The models' reliable knowledge cutoff (models overview, read on 23 November 2026). */
export const KNOWLEDGE_CUTOFF = "2026-06";

/**
 * Dollars to euros at the sister prototypes' fixed rate, 1 USD = 0.894 EUR (brief 5.5, AC-09), so a cost
 * meter stays stable. For comparison: the ECB's reference rate of 20 November 2026 was 1.0990 USD per
 * euro, about 0.910 EUR per dollar (TECH_NOTES.md, section 1).
 */
export const FX_USD_EUR = 0.894;
export const ECB_REFERENCE = Object.freeze({ usdPerEur: 1.099, date: "2026-11-20", readOn: "2026-11-23" });

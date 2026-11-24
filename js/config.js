// The tool's settings in one place: the app, the policy, what the browser may keep, the quadrants and
// steps, and the models with their list prices, which the session-cost estimate of a simulated run uses
// now and the live run's cost meter from 0.3.0. The presets, caps and the live client's settings join
// this file with the live run itself (PLAN.md, M3).

export const APP = Object.freeze({
  id: "swot",
  name: "SWOT Challenger",
  version: "0.2.0",
  url: "https://victorpflueger.github.io/SWOT-challenger/"
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
 * The models and their list prices in US dollars per million tokens, read on 23 November 2026 at
 * https://platform.claude.com/docs/en/about-claude/pricing (TECH_NOTES.md, section 1). Haiku 5.5 pays
 * its long-prompt prices for a prompt over 100,000 tokens. Product names stay as they are in both
 * languages.
 */
export const MODELS = Object.freeze([
  { id: "claude-haiku-5-5", label: "Haiku 5.5", price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01, longPrompt: { thresholdTokens: 100000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 } } },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", price: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 } },
  { id: "claude-opus-5-5", label: "Opus 5.5", price: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 } }
]);
/** Haiku 5.5 first: most people who run it live have little budget (project instructions, rule 10). */
export const DEFAULT_MODEL = "claude-haiku-5-5";
/** The prices' date, as the Method dialog and the guide name it. */
export const PRICES_READ_ON = "2026-11-23";

/** The API's other prices: web search costs $10 per 1,000 searches plus its tokens. */
export const ANTHROPIC = Object.freeze({ webSearchUsdPer1000: 10 });

/**
 * Dollars to euros at the sister prototypes' fixed rate, 1 USD = 0.894 EUR (brief 5.5, AC-09), so a cost
 * meter stays stable. For comparison: the ECB's reference rate of 20 November 2026 was 1.0990 USD per
 * euro, about 0.910 EUR per dollar (TECH_NOTES.md, section 1).
 */
export const FX_USD_EUR = 0.894;
export const ECB_REFERENCE = Object.freeze({ usdPerEur: 1.099, date: "2026-11-20", readOn: "2026-11-23" });

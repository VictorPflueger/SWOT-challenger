// The tool's settings in one place. Version 0.1.0 holds the frame, the engine and the data contracts;
// the models, prices and caps of a live run join this file with the live run itself (PLAN.md, M3).

export const APP = Object.freeze({
  id: "swot",
  name: "SWOT Challenger",
  version: "0.1.0",
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

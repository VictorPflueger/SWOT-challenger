// The budget cap of a live run (PLAN.md 3.4, brief 5.7). Before each request, code works out its worst
// case: the estimated input, a fifth more for the estimate's error, and an allowance for the pages each web
// search may return, times the input price, plus max_tokens times the output price, plus the searches at $10 per 1,000. If what the run has
// spent plus that worst case passes the cap, max_tokens drops to the step's minimum; if even that does not
// fit, the request does not start (the Scout then searches less, or not at all). On Haiku 5.5 a request
// whose input, pages included, could pass 100,000 tokens is refused, because above that line every token
// costs five times as much. Pure functions in euros, at the four tools' shared rate (js/config.js).

import { MODELS, FX_USD_EUR, ANTHROPIC, STEP_TOKENS, HAIKU_PROMPT_LIMIT, RESEARCH } from "./config.js";

/** About four characters a token, for English and German alike (the estimate counts the same way). */
export const CHARS_PER_TOKEN = 4;

/** The tokens a text or a JSON value is estimated at. */
export function tokensIn(x) {
  const text = typeof x === "string" ? x : JSON.stringify(x ?? "");
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function priceOf(modelId, inputTokens = 0) {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) throw new RangeError(`no price for ${modelId}`);
  const long = model.price.longPrompt && inputTokens > model.price.longPrompt.thresholdTokens;
  return long ? model.price.longPrompt : model.price;
}

/**
 * The input a request may be billed for: its own tokens, with a fifth more for the error of counting four
 * characters a token, and the pages its searches may bring back.
 */
export const INPUT_MARGIN = 1.2;
export const inputWithPages = (inputTokens, searches = 0) => Math.ceil(inputTokens * INPUT_MARGIN) + searches * RESEARCH.pageTokensPerSearch;

/** The most one request can cost, in euros. */
export function worstCaseEur({ modelId, inputTokens, maxTokens, searches = 0 }) {
  const input = inputWithPages(inputTokens, searches);
  const p = priceOf(modelId, input);
  const usd = (input * p.input + maxTokens * p.output) / 1e6 + searches * (ANTHROPIC.webSearchUsdPer1000 / 1000);
  return usd * FX_USD_EUR;
}

/**
 * Whether a request may start, and with how many output tokens. Returns { ok: true, maxTokens, lowered,
 * worstEur } or { ok: false, reason, worstEur }, where reason is "cap" (even the step's minimum would pass
 * the cap) or "long" (a Haiku 5.5 request above 100,000 input tokens).
 */
export function planRequest({ modelId, step, inputTokens, spentEur = 0, capEur, searches = 0 }) {
  const tokens = STEP_TOKENS[step];
  if (!tokens) throw new RangeError(`no token budget for ${step}`);
  if (/haiku/.test(modelId) && inputWithPages(inputTokens, searches) > HAIKU_PROMPT_LIMIT) return { ok: false, reason: "long", worstEur: worstCaseEur({ modelId, inputTokens, maxTokens: tokens.min, searches }) };
  const full = worstCaseEur({ modelId, inputTokens, maxTokens: tokens.max, searches });
  if (spentEur + full <= capEur + 1e-12) return { ok: true, maxTokens: tokens.max, lowered: false, worstEur: full };
  const least = worstCaseEur({ modelId, inputTokens, maxTokens: tokens.min, searches });
  if (spentEur + least <= capEur + 1e-12) return { ok: true, maxTokens: tokens.min, lowered: true, worstEur: least };
  return { ok: false, reason: "cap", worstEur: least };
}

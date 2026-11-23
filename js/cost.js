// Usage into money: the API's `usage` objects priced at the list prices of js/config.js and converted at
// the fixed rate (brief 5.5). Pure functions, so the session-cost estimate now, the live cost meter from
// 0.3.0 and the tests use the same maths. Taken from the Sovereignty Assessment 2.0.0, where the sister
// prototypes share it.

import { MODELS, FX_USD_EUR, ANTHROPIC } from "./config.js";

/** Normalised usage with zero defaults. */
export function normalizeUsage(u = {}) {
  return {
    input_tokens: Number(u.input_tokens) || 0,
    output_tokens: Number(u.output_tokens) || 0,
    cache_creation_input_tokens: Number(u.cache_creation_input_tokens) || 0,
    cache_read_input_tokens: Number(u.cache_read_input_tokens) || 0,
    web_search_requests: Number(u.server_tool_use?.web_search_requests ?? u.web_search_requests) || 0
  };
}

/** USD cost of one response. Haiku switches to its long-prompt prices above 100,000 prompt tokens. */
export function usageCostUsd(modelId, usage) {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) throw new RangeError(`no price for the model ${modelId}`);
  const u = normalizeUsage(usage);
  const promptTokens = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
  const long = model.price.longPrompt && promptTokens > model.price.longPrompt.thresholdTokens;
  const p = long ? model.price.longPrompt : model.price;
  const perTok = (usdPerMillion) => usdPerMillion / 1e6;
  return (
    u.input_tokens * perTok(p.input) +
    u.cache_creation_input_tokens * perTok(p.cacheWrite) +
    u.cache_read_input_tokens * perTok(p.cacheRead) +
    u.output_tokens * perTok(p.output) +
    u.web_search_requests * (ANTHROPIC.webSearchUsdPer1000 / 1000)
  );
}

/** Euros from dollars at the fixed rate. */
export const toEur = (usd) => usd * FX_USD_EUR;

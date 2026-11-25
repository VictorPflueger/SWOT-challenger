// What a run costs before it runs (PLAN.md 3.4). A live run sends one request a step: Complete, Challenge,
// Assess, Strategise and Summary, each with its agent's system prompt (js/prompts.js), the run so far as
// JSON and the step's schema in its wire form, and gets the step's answer back. A recorded run holds every
// answer, so the estimate rebuilds those five requests from the real prompts and inputs, counts about four
// characters a token, adds an allowance for the model's thinking, and prices them at the list price of the
// chosen model (js/config.js) and the shared rate of 1 USD = 0.894 EUR.
//
// The simulation's Session cost tile shows this for its own scenario with the defaults (Haiku 5.5, research
// off). The live-run dialog shows it for the settings chosen, from the three scenarios' answer sizes, with
// research priced at its searches and the pages they return. A live run measures its cost instead. The
// assumptions are written down in TECH_NOTES.md, sections 10 and 11, and replaced by Victor's measured runs.

import { DEFAULT_MODEL, FX_USD_EUR, RESEARCH } from "./config.js";
import { usageCostUsd } from "./cost.js";
import { toWire } from "./wire.js";
import { SCHEMAS, REQUESTS, WIRE } from "../schemas/swot.js";
import { assemble, factsFor } from "./scenario.js";
import { systemFor, inputFor } from "./prompts.js";
import { zoneName } from "./format.js";

/** The estimate's assumptions. */
export const ESTIMATE = Object.freeze({
  /** About four characters a token, for English and German alike. */
  charsPerToken: 4,
  /** Hidden thinking a request with thinking left to the model (Balanced, Thorough); none when it is off (Fast). */
  thinkingTokens: 800,
  /** The message's own framing. */
  overheadTokens: 40,
  /** The Scout: the pages five searches return come back as input, and its signals as output. */
  research: Object.freeze({ inputTokens: 15000, outputTokens: 1500 }),
  /** Minutes for a whole run, the slower first request of each new schema included; research adds half a minute. */
  minutes: Object.freeze({ haiku: Object.freeze([1, 2]), sonnet: Object.freeze([2, 4]), research: 0.5 })
});

/** The steps that send a request, in order, and the schema each asks for. */
export const REQUEST_STEPS = Object.freeze(["complete", "challenge", "assess", "strategise", "summary"]);

/** Tokens of a text or a value written as JSON, at about four characters a token. */
export function tokensOf(x) {
  const text = typeof x === "string" ? x : JSON.stringify(x ?? "");
  return Math.ceil(text.length / ESTIMATE.charsPerToken);
}

/** The five requests of a scenario's run in one language: [{ step, system, input, schema, output }]. */
export function requestsOf(scenario, lang) {
  const run = assemble(scenario, lang);
  const chosen = scenario.recorded_choice || [];
  const opts = { lang, sectorChosen: scenario.company.sector, chosen, facts: factsFor(run, chosen, lang, zoneName), today: scenario.as_of };
  return REQUEST_STEPS.map((step) => ({
    step,
    system: systemFor(step),
    input: inputFor(step, run, opts),
    schema: toWire(SCHEMAS[REQUESTS[step]], WIRE),
    output: scenario.answers[lang][step]
  }));
}

/** The usage the API would report for one request, as the estimate counts it. */
export function usageOf(request, { thinkingTokens = ESTIMATE.thinkingTokens } = {}) {
  return {
    input_tokens: tokensOf(request.system) + tokensOf(request.input) + tokensOf(request.schema) + ESTIMATE.overheadTokens,
    output_tokens: tokensOf(request.output) + thinkingTokens
  };
}

/**
 * The estimate of a scenario's run in a language: { usd, eur, requests, model, tokens: { input, output } }.
 * modelId: one of js/config.js's models, Haiku 5.5 unless said otherwise; thinking: false when it is off.
 */
export function estimateRun(scenario, lang, { modelId = DEFAULT_MODEL, thinking = true } = {}) {
  let usd = 0;
  const tokens = { input: 0, output: 0 };
  const requests = requestsOf(scenario, lang);
  for (const r of requests) {
    const u = usageOf(r, { thinkingTokens: thinking ? ESTIMATE.thinkingTokens : 0 });
    usd += usageCostUsd(modelId, u);
    tokens.input += u.input_tokens;
    tokens.output += u.output_tokens;
  }
  return { usd, eur: usd * FX_USD_EUR, requests: requests.length, model: modelId, tokens };
}

/** The Scout's request as the estimate counts it: its prompt, the pages it reads, its signals, its searches. */
export function researchUsage({ thinking = true } = {}) {
  return {
    input_tokens: tokensOf(systemFor("research")) + ESTIMATE.research.inputTokens + ESTIMATE.overheadTokens,
    output_tokens: ESTIMATE.research.outputTokens + (thinking ? ESTIMATE.thinkingTokens : 0),
    server_tool_use: { web_search_requests: RESEARCH.maxUses }
  };
}

/**
 * The live-run dialog's estimate for a setting: { eurLow, eurHigh, minutes: [low, high] }, the range of
 * the three scenarios' runs in the page's language. settings: { model, thinking, research } as
 * js/pipeline.js's resolveSettings() gives them.
 */
export function estimateLive(scenarios, lang, settings) {
  const thinking = !settings.thinking;
  const costs = scenarios.map((s) => estimateRun(s, lang, { modelId: settings.model, thinking }).eur);
  const extra = settings.research ? usageCostUsd(settings.model, researchUsage({ thinking })) * FX_USD_EUR : 0;
  const [lo, hi] = /sonnet|opus/.test(settings.model) ? ESTIMATE.minutes.sonnet : ESTIMATE.minutes.haiku;
  const more = settings.research ? ESTIMATE.minutes.research : 0;
  return { eurLow: Math.min(...costs) + extra, eurHigh: Math.max(...costs) + extra, minutes: [lo + more, hi + more] };
}

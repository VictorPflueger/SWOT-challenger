// What a simulated run would cost if it ran live, estimated from the run itself. A live run sends one
// request a step (PLAN.md, 3.1): Complete, Challenge, Assess, Strategise and Summary, each with a system
// prompt, the state so far as JSON and the step's schema in its wire form, and gets the step's answer
// back. A recorded run holds every answer, so the estimate rebuilds those five requests in the run's
// language, counts about four characters a token, adds an allowance for the system prompt (until version
// 0.3.0 writes the prompts) and for the model's thinking, and prices them at the list price of the
// default model (js/config.js) and the shared rate of 1 USD = 0.894 EUR. Research is off by default and
// adds nothing here. A live run measures its cost instead of estimating it. The assumptions are written
// down in TECH_NOTES.md, section 10, and the Method dialog names them.

import { DEFAULT_MODEL, FX_USD_EUR } from "./config.js";
import { usageCostUsd } from "./cost.js";
import { toWire } from "./wire.js";
import { SCHEMAS, REQUESTS } from "../schemas/swot.js";
import { kpisFor } from "../data/kpis.js";
import { inLanguage } from "./scenario.js";

/** The estimate's assumptions, per request. */
export const ESTIMATE = Object.freeze({
  /** About four characters a token, for English and German alike. */
  charsPerToken: 4,
  /** The system prompt, until version 0.3.0 writes the real ones: about 1,200 tokens each. */
  systemTokens: 1200,
  /** Hidden thinking at the default preset (Balanced: medium effort, adaptive thinking). */
  thinkingTokens: 800,
  /** The message's own framing. */
  overheadTokens: 40
});

/** The steps that send a request, in order, and the schema each asks for. */
export const REQUEST_STEPS = Object.freeze(["complete", "challenge", "assess", "strategise", "summary"]);

/** Tokens of a text or a value written as JSON, at about four characters a token. */
export function tokensOf(x) {
  const text = typeof x === "string" ? x : JSON.stringify(x ?? "");
  return Math.ceil(text.length / ESTIMATE.charsPerToken);
}

/** The five requests of a scenario's run in one language: [{ step, input, schema, output }]. */
export function requestsOf(scenario, lang) {
  const { answers, description } = inLanguage(scenario, lang);
  const company = { name: scenario.company.name, sector: scenario.company.sector, country: scenario.company.country, description };
  const entered = Object.fromEntries(Object.entries(scenario.entered).map(([q, items]) => [q, items.map((it) => ({ id: it.id, text: it.text[lang] }))]));
  const completed = { entered, added: answers.complete.items, misfiled: answers.complete.misfiled };
  const issues = answers.challenge.issues;
  const kpis = kpisFor(scenario.company.sector).map((k) => ({ id: k.id, name: k.name[lang], unit: k.unit, better: k.better, definition: k.definition[lang] }));
  const { impacts, factors } = answers.assess;
  const strategies = answers.strategise.strategies;
  const inputs = {
    complete: { company, swot: entered },
    challenge: { company, swot: completed },
    assess: { company, swot: completed, issues, kpis },
    strategise: { company, swot: completed, issues, impacts, factors },
    summary: { company, swot: completed, issues, impacts, factors, strategies, decision: { chosen: scenario.recorded_choice } }
  };
  return REQUEST_STEPS.map((step) => ({ step, input: inputs[step], schema: toWire(SCHEMAS[REQUESTS[step]], SCHEMAS), output: answers[step] }));
}

/** The usage the API would report for one request, as the estimate counts it. */
export function usageOf(request) {
  return {
    input_tokens: ESTIMATE.systemTokens + tokensOf(request.input) + tokensOf(request.schema) + ESTIMATE.overheadTokens,
    output_tokens: tokensOf(request.output) + ESTIMATE.thinkingTokens
  };
}

/**
 * The estimate of a scenario's run in a language: { usd, eur, requests, model, tokens: { input, output } }.
 * modelId: one of js/config.js's models, Haiku 5.5 unless said otherwise.
 */
export function estimateRun(scenario, lang, { modelId = DEFAULT_MODEL } = {}) {
  let usd = 0;
  const tokens = { input: 0, output: 0 };
  const requests = requestsOf(scenario, lang);
  for (const r of requests) {
    const u = usageOf(r);
    usd += usageCostUsd(modelId, u);
    tokens.input += u.input_tokens;
    tokens.output += u.output_tokens;
  }
  return { usd, eur: usd * FX_USD_EUR, requests: requests.length, model: modelId, tokens };
}

// The live run (PLAN.md 3.1, brief 5): the agents, one request a step, on the person's own company with
// their own key, in this tab's memory only. Each step sends model, max_tokens, output_config (effort and
// the step's schema), thinking as the setting says, one system prompt and one user message that carries
// the run so far as JSON; no conversation is carried. Code checks every answer against its schema and the
// guards of brief 6.7 (js/guards.js); a failing answer gets one repair with its problems listed, at most
// two in a run, and a second failure stops the run with what is done. Two answers are kept instead: the
// Writer's text, shown unchecked, and the Analyst's, whose figures that still break a pricing rule are set
// aside, so their issues show as not priced (1.0.1). Before each request the budget cap
// is checked against the request's worst case (js/budget.js); after it, the meter adds the usage the API
// reports (js/cost.js). Errors are retried as brief 5.8 says (js/anthropic.js) and otherwise stop the run
// with what is done. Abort stops the request in flight and keeps what is done.
//
// The run builds a recording in the scenario format (schemas/swot.js, Recording), in the run's one
// language, so the presenter shows a live run exactly as it plays a recorded one, and "Save run as
// simulation" downloads it. The key is never part of it: js/keystore.js holds the key, and only the
// request goes to api.anthropic.com. Thinking is never kept or logged.

import { PRESETS, DEFAULT_PRESET, ANTHROPIC, RESEARCH, MAX_REQUESTS, QUADRANTS } from "./config.js";
import { streamMessage, withRetry, ApiError, isWebSearchDisabled } from "./anthropic.js";
import { getKey, redactSecrets } from "./keystore.js";
import { createCostTracker, normalizeUsage } from "./cost.js";
import { planRequest, tokensIn } from "./budget.js";
import { systemFor, inputFor, repairFor, AGENTS, SUBMIT_SIGNALS } from "./prompts.js";
import { answerProblems, schemaProblems, setAsidePricing } from "./guards.js";
import { t } from "./i18n/index.js";
import { toWire } from "./wire.js";
import { SCHEMAS, REQUESTS, WIRE } from "../schemas/swot.js";
import { assemble, factsFor } from "./scenario.js";
import { CHOICE_FACTS, FOLLOWS_CHOICE } from "./facts.js";
import { searchedUrls, deferredSearches, submissions, sortSignals, refusalFor, acceptanceFor, REMINDER, MAX_SCOUT_REQUESTS } from "./scout.js";

const LETTER = { strengths: "s", weaknesses: "w", opportunities: "o", threats: "t" };
/** The tokens of a request's frame: roles, separators, the tool and format wrappers. */
const OVERHEAD_TOKENS = 40;
/** The steps of the challenge, in order; research only when it is switched on. */
const CHAIN = Object.freeze(["research", "challenge", "assess", "strategise"]);

/** Why a run stopped before a request, or after a step's answer failed twice. */
export class StopRun extends Error {
  constructor(reason, step, extra = {}) {
    super(`stopped: ${reason} at ${step}`);
    this.name = "StopRun";
    this.reason = reason;
    this.step = step;
    Object.assign(this, extra);
  }
}

/**
 * The settings of a run from the dialog: a preset (fast, balanced, thorough) and, from Advanced, a model
 * and an effort. Haiku 5.5 takes thinking switched off up to high effort, which Fast asks for; Sonnet 5.5
 * refuses that, so with Sonnet the field is left out (adaptive thinking).
 */
export function resolveSettings({ preset = DEFAULT_PRESET, model = null, effort = null, research = false } = {}) {
  const p = PRESETS.find((x) => x.id === preset) || PRESETS.find((x) => x.id === DEFAULT_PRESET);
  const m = model || p.model;
  const e = effort || p.effort;
  const thinking = /haiku/.test(m) && p.thinking ? p.thinking : null;
  return Object.freeze({ preset: p.id, model: m, effort: e, thinking, research: !!research });
}

/**
 * A new recording from the Start form. company: { name, sector (id, or "" to let the agents decide),
 * country, description }; items: { strengths: [text…], … }; lang: the run's language; today: YYYY-MM-DD;
 * fictional: the company is one of the scenarios' fictional companies, filled in for a demo.
 */
export function newRecording({ company, items, lang, today, fictional = false }) {
  const entered = {};
  for (const { id: q } of QUADRANTS) entered[q] = (items[q] || []).map((text, i) => ({ id: `${LETTER[q]}${i + 1}`, text: { [lang]: text } }));
  return {
    id: "live",
    source: "live",
    as_of: today,
    language: lang,
    company: { name: company.name, sector: company.sector || "", country: company.country || "", description: { [lang]: company.description || "" }, fictional: !!fictional },
    sources: [],
    entered,
    answers: { [lang]: {} },
    decision: { kept: [], removed: [], edited: [], chosen: [] },
    recorded_choice: []
  };
}

/**
 * One live run. recording: from newRecording(); settings: from resolveSettings(); capEur: the cap;
 * transport and retry: js/anthropic.js's streamMessage and withRetry, replaced in unit tests; onEvent:
 * called with { type, … } whenever the run changes (step, retry, cost, repair, answer, stopped, done).
 */
export function createLiveRun({ recording, settings: initialSettings, capEur: initialCap, transport = streamMessage, retry = withRetry, key = getKey, now = () => Date.now(), today = recording.as_of, onEvent = () => {} }) {
  const rec = recording;
  const lang = rec.language;
  let settings = initialSettings;
  let capEur = initialCap;
  // One meter a model, so a run that moves to another model after a stop keeps each price right.
  const trackers = new Map();
  const trackerFor = (model) => { if (!trackers.has(model)) trackers.set(model, createCostTracker(model)); return trackers.get(model); };
  trackerFor(settings.model);
  const audit = [];
  const st = {
    status: "ready", step: null, stepStarted: 0, startedAt: null, finishedAt: null,
    requests: 0, repairs: 0, stop: null, retry: null, research: null, unchecked: null, lowered: [], setAside: [],
    sectorChosen: rec.company.sector || null, checked: false
  };
  let controller = null;

  const emit = (type, data = {}) => { try { onEvent({ type, ...data }); } catch (e) { console.error("[SWOT Challenger] a live-run listener failed:", e); } };
  const spent = () => [...trackers.values()].reduce((sum, tr) => sum + tr.snapshot().eur, 0);
  const costSnapshot = () => {
    const parts = [...trackers.values()].map((tr) => tr.snapshot());
    const total = (k) => parts.reduce((sum, x) => sum + x[k], 0);
    return { usd: total("usd"), eur: total("eur"), input_tokens: total("input_tokens"), output_tokens: total("output_tokens"), web_searches: total("web_searches"), requests: total("requests"), models: parts.map((x) => x.model) };
  };
  const answers = () => rec.answers[lang];
  const current = () => assemble(rec, lang);

  // ---- one request ----------------------------------------------------------------------------------
  /** A request's own input, as the budget counts it. */
  const inputTokensOf = (body) => tokensIn(body.system) + tokensIn(body.messages) + tokensIn(body.output_config?.format?.schema ?? "") + tokensIn(body.tools ?? "") + OVERHEAD_TOKENS;

  async function send(step, body, { searches = 0, repaired = false } = {}) {
    if (st.requests >= MAX_REQUESTS) throw new StopRun("requests", step);
    const inputTokens = inputTokensOf(body);
    const plan = planRequest({ modelId: settings.model, step, inputTokens, spentEur: spent(), capEur, searches });
    if (!plan.ok) throw new StopRun(plan.reason, step);
    if (plan.lowered && !st.lowered.includes(step)) st.lowered.push(step);
    const request = { ...body, max_tokens: plan.maxTokens };
    st.requests += 1;
    st.startedAt ??= now();
    controller = new AbortController();
    const { signal } = controller;
    try {
      const { message } = await retry(() => transport({ key: key(), body: request, signal }), {
        retries: 2,
        signal,
        onRetry: ({ attempt, waitMs }) => { st.retry = { attempt, waitMs, at: now() }; emit("retry", { step, attempt, waitMs }); }
      });
      st.retry = null;
      trackerFor(settings.model).add(message.usage);
      const u = normalizeUsage(message.usage);
      audit.push({
        at: now() - st.startedAt,
        step,
        agent: AGENTS[step],
        model: settings.model,
        effort: settings.effort,
        thinking: settings.thinking ? "disabled" : "adaptive",
        max_tokens: request.max_tokens,
        stop_reason: String(message.stop_reason || ""),
        usage: { input_tokens: u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens, output_tokens: u.output_tokens, web_search_requests: u.web_search_requests },
        problems: [],
        repaired
      });
      emit("cost", { eur: spent() });
      return message;
    } finally {
      st.retry = null;
      controller = null;
    }
  }

  /** The base of a structured request: model, system prompt, effort, the step's schema and thinking. */
  function structuredBody(step) {
    return {
      model: settings.model,
      system: systemFor(step),
      output_config: { effort: settings.effort, format: { type: "json_schema", schema: toWire(SCHEMAS[REQUESTS[step]], WIRE) } },
      ...(settings.thinking ? { thinking: settings.thinking } : {})
    };
  }

  /** A structured answer: its text, the parsed answer and every problem with it. */
  function read(step, message, ctx) {
    const text = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (message.stop_reason === "refusal") return { text, answer: null, problems: ["The model declined to answer this request."] };
    let answer;
    try { answer = JSON.parse(text); } catch {
      return { text, answer: null, problems: [message.stop_reason === "max_tokens" ? "The answer was cut off at the token limit; give a shorter one." : "The answer is not valid JSON in the schema given."] };
    }
    return { text, answer, problems: answerProblems(step, answer, ctx) };
  }

  /**
   * What an answer that still fails, with no repair left, may keep instead of stopping the run: the
   * Writer's text shows unchecked; the Analyst's figures that break a pricing rule are set aside, so their
   * issues show as not priced (1.0.1). Null: nothing, the run stops.
   */
  function settle(step, r, ctx) {
    if (!r.answer || schemaProblems(step, r.answer).length) return null;
    if (step === "summary") return { answer: r.answer, unchecked: r.problems };
    if (step !== "assess") return null;
    const s = setAsidePricing(r.answer, ctx, { setAside: t("s.assess.setaside", null, lang), noReason: t("h.not.priced.none", null, lang) });
    return answerProblems(step, s.answer, ctx).length ? null : s;
  }

  /** One step's request, checked, with one repair; a second failure stops the run unless settle() can keep it. */
  async function structured(step, ctxFor, opts = {}) {
    const input = inputFor(step, current(), { lang, today, ...opts });
    const body = structuredBody(step);
    let message = await send(step, { ...body, messages: [{ role: "user", content: JSON.stringify(input) }] });
    let r = read(step, message, ctxFor());
    if (!r.problems.length) return { answer: r.answer };
    audit[audit.length - 1].problems = r.problems.slice(0, 64);
    if (st.repairs < 2) {
      st.repairs += 1;
      emit("repair", { step, problems: r.problems });
      message = await send(step, { ...body, messages: [{ role: "user", content: repairFor(input, r.text, r.problems) }] }, { repaired: true });
      r = read(step, message, ctxFor());
      if (!r.problems.length) return { answer: r.answer };
      audit[audit.length - 1].problems = r.problems.slice(0, 64);
    }
    const kept = settle(step, r, ctxFor());
    if (kept) return kept;
    throw new StopRun("invalid", step, { problems: r.problems });
  }

  // ---- the steps ------------------------------------------------------------------------------------
  const STEPS = {
    async complete() {
      const { answer } = await structured("complete", () => ({ entered: current().items.filter((i) => i.source === "user"), sector: st.sectorChosen }), { sectorChosen: st.sectorChosen });
      answers().complete = answer;
      rec.company.sector = answer.sector;
    },

    async research() {
      const signals = await scout();
      answers().research = { signals };
      const urls = [...new Set(signals.map((s) => s.url))];
      rec.sources = urls.map((url) => ({ url, read_on: today }));
    },

    async challenge() {
      const signals = answers().research?.signals || [];
      const { answer } = await structured("challenge", () => ({ items: current().items.filter((i) => !i.added), urls: signals.map((s) => s.url) }), { signals });
      answers().challenge = answer;
    },

    async assess() {
      const { answer, setAside = [] } = await structured("assess", () => { const r = current(); return { items: r.items, issues: r.issues, sector: r.sector }; });
      answers().assess = answer;
      st.setAside = setAside;
    },

    async strategise() {
      const { answer } = await structured("strategise", () => { const r = current(); return { items: r.items, issues: r.issues, factors: r.factors.map((f) => ({ item: f.id, rating: f.rating })) }; });
      answers().strategise = answer;
    },

    async summary({ chosen, zoneName }) {
      const r = current();
      // The facts that follow the choice go to the Writer without their values: it cites them, and code fills
      // them for whatever choice the person makes, before or after the summary (review, new problem A).
      const facts = Object.fromEntries(Object.entries(factsFor(r, chosen, lang, zoneName)).map(([k, v]) => [k, CHOICE_FACTS.includes(k) ? FOLLOWS_CHOICE : v]));
      const evidence = { titles: r.issues.flatMap((i) => i.evidence.map((e) => e.title)), urls: rec.sources.map((s) => s.url) };
      const result = await structured("summary", () => ({ facts: new Set(Object.keys(facts)), evidence }), { chosen, facts });
      answers().summary = result.answer;
      st.unchecked = result.unchecked || null;
    }
  };

  /**
   * The Scout: searches, then submit_signals; returns the accepted signals and notes the outcome. It searches
   * as often as the cap allows, five times at most; when not one search fits, or a later request of its turn
   * would pass the cap, research ends there ("cap") and the run goes on without it.
   */
  async function scout() {
    const input = inputFor("research", current(), { lang, today });
    const submit = { name: SUBMIT_SIGNALS.name, description: SUBMIT_SIGNALS.description, input_schema: toWire(SCHEMAS.Signals, WIRE), strict: true };
    const bodyWith = (uses) => ({
      model: settings.model,
      system: systemFor("research"),
      tools: [{ ...ANTHROPIC.webSearchTool, max_uses: uses }, submit],
      tool_choice: { type: "auto" },
      output_config: { effort: settings.effort },
      ...(settings.thinking ? { thinking: settings.thinking } : {})
    });
    const first = [{ role: "user", content: JSON.stringify(input) }];
    const fits = (uses) => planRequest({ modelId: settings.model, step: "research", inputTokens: inputTokensOf({ ...bodyWith(uses), messages: first }), spentEur: spent(), capEur, searches: uses }).ok;
    let uses = RESEARCH.maxUses;
    while (uses > 0 && !fits(uses)) uses -= 1;
    if (!uses) { st.research = "cap"; return []; }
    const body = bodyWith(uses);
    let messages = [{ role: "user", content: JSON.stringify(input) }];
    const contents = [];
    let accepted = [];
    let submitted = 0;
    let reminded = false;
    let round = false;
    // The searches of the turn so far: a resend after pause_turn and a round of tool results go on with the
    // same turn, so only the searches left can run; a reminder starts a new turn with all of them again.
    let searched = 0;
    for (let n = 0; n < MAX_SCOUT_REQUESTS; n++) {
      let message;
      try {
        message = await send("research", { ...body, messages }, { searches: Math.max(0, uses - searched) });
      } catch (e) {
        if (e instanceof ApiError && isWebSearchDisabled(e)) { st.research = "off"; return []; }
        // A later request of the turn that could pass the cap or Haiku's line does not start; research ends.
        if (e instanceof StopRun && (e.reason === "cap" || e.reason === "long")) { st.research = accepted.length ? "found" : "cap"; return accepted.slice(0, 8); }
        throw e;
      }
      contents.push(message.content);
      searched += Number(message.usage?.server_tool_use?.web_search_requests ?? message.usage?.web_search_requests) || 0;
      const more = n + 1 < MAX_SCOUT_REQUESTS;
      if (message.stop_reason === "pause_turn") {
        // The paused turn goes back unchanged, so the server carries on where it stopped.
        messages = [...messages, { role: "assistant", content: message.content }];
        continue;
      }
      const subs = submissions(message.content);
      if (!subs.length) {
        if (!reminded && more) {
          reminded = true;
          searched = 0;
          messages = [...messages, { role: "assistant", content: message.content }, { role: "user", content: REMINDER }];
          continue;
        }
        break;
      }
      const urls = searchedUrls(contents);
      const results = [];
      let refused = [];
      for (const sub of subs) {
        const signals = schemaProblems("research", sub.input).length ? [] : sub.input.signals;
        submitted += signals.length;
        const sorted = sortSignals(signals, urls);
        for (const s of sorted.accepted) if (!accepted.some((a) => a.url === s.url)) accepted.push(s);
        refused = refused.concat(sorted.refused);
        results.push(sorted.refused.length ? refusalFor(sub.id, sorted.refused) : acceptanceFor(sub.id, sorted.accepted.length));
      }
      const deferred = deferredSearches(message.content).length > 0;
      if ((refused.length || deferred) && !round && more) {
        // One round: refused URLs come back with is_error, and a deferred search can run now.
        round = true;
        messages = [...messages, { role: "assistant", content: message.content }, { role: "user", content: results }];
        continue;
      }
      break;
    }
    st.research = accepted.length ? "found" : submitted ? "refused" : "none";
    return accepted.slice(0, 8);
  }

  // ---- running steps ----------------------------------------------------------------------------------
  /** Runs one step: the wait, the request, the answer or the stop. True when it gave an answer. */
  async function step(name, args) {
    st.status = "working";
    st.step = name;
    st.stepStarted = now();
    st.stop = null;
    emit("step", { step: name });
    try {
      await STEPS[name](args);
      emit("answer", { step: name });
      return true;
    } catch (e) {
      st.status = "stopped";
      st.stop = stopOf(e, name);
      emit("stopped", { stop: st.stop });
      return false;
    }
  }

  function stopOf(e, name) {
    if (e instanceof StopRun) return { reason: e.reason, step: e.step, problems: e.problems || [] };
    if (e?.name === "AbortError") return { reason: "aborted", step: name };
    if (e instanceof ApiError) return { reason: "error", step: name, error: { status: e.status, type: e.type, message: redactSecrets(e.message || ""), details: e.details || null, requestId: e.requestId || null } };
    return { reason: "error", step: name, error: { status: 0, type: "client_error", message: redactSecrets(String(e?.message || e)) } };
  }

  const done = (name) => {
    const a = answers();
    if (name === "research") return !settings.research || !!a.research;
    return !!a[name];
  };

  return {
    rec,
    get settings() { return settings; },
    get capEur() { return capEur; },
    /** The run as the page shows it. */
    snapshot() {
      return { ...st, spentEur: spent(), capEur, settings, audit: audit.slice(), cost: costSnapshot(), working: st.status === "working" };
    },
    /** New settings or a new cap after a stop, chosen in the dialog; the next request uses them. */
    reconfigure({ settings: next = settings, capEur: cap = capEur } = {}) {
      if (st.status === "working") return;
      settings = next;
      capEur = cap;
      trackerFor(settings.model);
    },
    /** The Completer. */
    async complete() {
      if (await step("complete")) { st.status = "check"; emit("check"); }
    },
    /**
     * The person's check of the AI's items before the challenge: removed and edited, by item id. The
     * challenge receives the SWOT as the person left it.
     */
    applyCheck({ removed = [], edited = [] } = {}) {
      const ai = current().items.filter((i) => i.source === "ai" && !i.added).map((i) => i.id);
      rec.decision.removed = removed.filter((id) => ai.includes(id));
      rec.decision.edited = edited.filter((e) => ai.includes(e.id) && !removed.includes(e.id)).map((e) => ({ id: e.id, text: String(e.text).trim().slice(0, 90) })).filter((e) => e.text);
      rec.decision.kept = ai.filter((id) => !rec.decision.removed.includes(id));
      st.checked = true;
    },
    /** Research when switched on, then the Red team, the Analyst and the Strategist, each in turn. */
    async challenge() {
      for (const name of CHAIN) {
        if (done(name)) continue;
        if (!(await step(name))) return;
      }
      st.status = "decide";
      emit("decide");
    },
    /** The Writer, after the person's decision. */
    async summarise({ chosen, zoneName }) {
      rec.decision.chosen = [...chosen];
      rec.recorded_choice = [...chosen];
      if (await step("summary", { chosen, zoneName })) {
        st.status = "done";
        st.finishedAt = now();
        emit("done");
      }
    },
    /**
     * A new choice once the summary is written. The Writer's text holds for any choice: it names no single
     * strategy and cites every figure through a placeholder that code fills in for the adopted choice. So
     * the choice changes without another request, as in a recorded run. False when the run is not done.
     */
    rechoose(chosen) {
      if (st.status !== "done") return false;
      rec.decision.chosen = [...chosen];
      rec.recorded_choice = [...chosen];
      emit("rechosen");
      return true;
    },
    /** Runs the stopped step again and goes on from there, as far as the person's turn. */
    async resume({ zoneName } = {}) {
      const s = st.stop?.step;
      if (!s) return;
      if (s === "complete") return this.complete();
      if (s === "summary") return this.summarise({ chosen: rec.decision.chosen, zoneName });
      return this.challenge();
    },
    /** Stops the request in flight; what is done stays. */
    abort() {
      controller?.abort();
    },
    /** The run in the scenario format, in its language, without key or thinking: "Save run as simulation". */
    toRecording() {
      const out = JSON.parse(JSON.stringify(rec));
      out.run = {
        preset: settings.preset,
        model: settings.model,
        effort: settings.effort,
        thinking: settings.thinking ? "disabled" : "adaptive",
        research: settings.research,
        cap_eur: capEur,
        spent_eur: spent(),
        seconds: st.startedAt === null ? 0 : Math.round(((st.finishedAt ?? now()) - st.startedAt) / 1000),
        requests: st.requests,
        summary_unchecked: !!st.unchecked,
        audit: audit.slice(0, 32)
      };
      return out;
    }
  };
}

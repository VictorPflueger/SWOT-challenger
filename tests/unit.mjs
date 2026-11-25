// Units of the simulation, without a browser:
//   estimate    the session cost of a simulated run comes from each scenario's five recorded requests, at
//               the dated list price of Haiku 5.5 and the dated rate of 1 USD = 0.894 EUR (js/config.js and
//               TECH_NOTES.md say the same), and an independent recount here, with the prices written out
//               from the pricing page, agrees within 1e-9 for every scenario in both languages;
//   formats     a session cost reads "< €0.01" below half a cent and "≈ €0.05" above, in both languages;
//   method      the Method dialog's worked example is the golden case SW1 of tests/fixtures/golden.json,
//               and the engine works it through to the golden figures;
//   simulation  each step shows the items it has reached; the items the recorded choice addresses are the
//               ones whose rating it raises; the tiles' figures for a choice are the engine's;
//   retries     the shared client tries again twice, after 1.5 and 4 seconds, or after retry-after up to 20
//               seconds, and never for a credit or spend limit, a key or a model refused (brief 5.8);
//   budget      each request's worst case in euros, the lowering to the step's minimum, the stop, and the
//               refusal of a Haiku 5.5 request above 100,000 input tokens;
//   meter       the cost of reported usage equals the prices written out by hand, searches and Haiku's long
//               prompts included, within 1e-9;
//   privacy     the private-data scan finds e-mail addresses, phone numbers, IBANs and classification
//               labels in its samples and nothing in clean SWOT texts;
//   api errors  every error the API can give reads as words and one next step, in English and German;
//   last resort the Analyst's figures that still break a pricing rule after the repair are set aside and
//               the run goes on to the summary, its saved recording passing the scenario checker; with no
//               repair left they are set aside at once; any other broken rule still stops the run (1.0.1).
// Prints UNIT OK. Usage: node tests/unit.mjs
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { golden, exact } from "./lib/fixtures.mjs";
import { estimateRun, requestsOf, usageOf, tokensOf, ESTIMATE, REQUEST_STEPS } from "../js/estimate.js";
import { systemFor } from "../js/prompts.js";
import { MODELS, DEFAULT_MODEL, FX_USD_EUR, PRICES_READ_ON } from "../js/config.js";
import { sessionCost } from "../js/format.js";
import { SW1, sw1Figures } from "../js/method.js";
import { createRun, itemsAt, addressed, sameChoice, STEP } from "../js/simulation.js";
import { figuresFor } from "../js/scenario.js";
import { withRetry, ApiError } from "../js/anthropic.js";
import { worstCaseEur, planRequest, tokensIn } from "../js/budget.js";
import { createCostTracker, usageCostUsd } from "../js/cost.js";
import { privateKinds, privacyFindings } from "../js/privacy.js";
import { apiMessage, webSearchOff } from "../js/api_messages.js";
import { newRecording, createLiveRun, resolveSettings } from "../js/pipeline.js";
import { zoneName } from "../js/format.js";
import { scenarioProblems } from "../js/scenario_check.js";
import { t } from "../js/i18n/index.js";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const near = (a, b) => Math.abs(a - b) <= 1e-9;
const scenarios = {};
for (const id of ["s1", "s2", "s3"]) scenarios[id] = (await import(`../data/scenarios/${id}.js`)).default;

// ---- estimate ------------------------------------------------------------------------------------------
// Haiku 5.5's list prices in US dollars per million tokens, written out from
// https://platform.claude.com/docs/en/about-claude/pricing as read on 23 and again on 24 November 2026.
const HAIKU = { input: 0.1, output: 0.5 };
const RATE = 0.894;
const haiku = MODELS.find((m) => m.id === "claude-haiku-5-5");
check(DEFAULT_MODEL === "claude-haiku-5-5" && haiku.price.input === HAIKU.input && haiku.price.output === HAIKU.output && FX_USD_EUR === RATE && PRICES_READ_ON === "2026-11-24", `js/config.js holds Haiku 5.5 as the default at $${HAIKU.input} and $${HAIKU.output} per million tokens, read on ${PRICES_READ_ON}, and 1 USD = ${RATE} EUR`);
const notes = fs.readFileSync(path.join(APP_ROOT, "TECH_NOTES.md"), "utf8");
check(notes.includes("0.894") && notes.includes("23 November 2026") && /Haiku 5\.5[^\n]*\$0\.10[^\n]*\$0\.50/.test(notes), "TECH_NOTES.md records the same prices, rate and date");
for (const id of Object.keys(scenarios)) {
  for (const lang of ["en", "de"]) {
    const reqs = requestsOf(scenarios[id], lang);
    const answers = scenarios[id].answers[lang];
    const shape = reqs.map((r) => r.step).join() === REQUEST_STEPS.join() && reqs.every((r) => r.output === answers[r.step] && r.schema && r.system === systemFor(r.step) && r.input?.company?.name === scenarios[id].company.name);
    // The recount: characters over four, rounded up, for the agent's system prompt, the input as JSON and
    // the schema; the allowances added once a request; prices per token.
    let usd = 0;
    for (const r of reqs) {
      const len = (x) => Math.ceil(JSON.stringify(x).length / 4);
      const input = Math.ceil(r.system.length / 4) + len(r.input) + len(r.schema) + 40;
      const output = len(r.output) + 800;
      usd += (input * HAIKU.input + output * HAIKU.output) / 1e6;
      if (usageOf(r).input_tokens !== input || usageOf(r).output_tokens !== output) usd = NaN;
    }
    const e = estimateRun(scenarios[id], lang);
    check(shape && e.requests === 5 && near(e.usd, usd) && near(e.eur, usd * RATE), `${id} in ${lang === "en" ? "English" : "German"}: five requests (${REQUEST_STEPS.join(", ")}) estimated at $${e.usd.toFixed(6)}, €${e.eur.toFixed(6)}, the recount agreeing within 1e-9`);
  }
}
check(ESTIMATE.charsPerToken === 4 && ESTIMATE.thinkingTokens === 800 && tokensOf("abcde") === 2 && tokensOf({ a: 1 }) === 2, "the estimate's assumptions: four characters a token, the agents' real system prompts and 800 tokens of thinking a request");

// ---- formats -------------------------------------------------------------------------------------------
check(sessionCost(0.0046, "en") === "< €0.01" && sessionCost(0.0046, "de") === "< 0,01 €" && sessionCost(0.0512, "en") === "≈ €0.05" && sessionCost(0.0512, "de") === "≈ 0,05 €" && sessionCost(0.005, "en") === "≈ €0.01", "a session cost under half a cent reads < €0.01, otherwise ≈ and cents, in both languages");

// ---- method --------------------------------------------------------------------------------------------
const g = golden().SW1;
const same = SW1.length === g.items.length && SW1.every((x, i) => x.id === g.items[i].id && x.quadrant === g.items[i].quadrant && near(x.weight, exact(g.items[i].weight)) && x.rating === g.items[i].rating && x.after === g.items[i].after);
const f = sw1Figures();
const worked = near(f.before.ife, exact(g.before.ife)) && near(f.before.efe, exact(g.before.efe)) && near(f.after.ife, exact(g.after.ife)) && near(f.after.efe, exact(g.after.efe)) && f.before.ie.cell === g.before.cell && f.after.ie.cell === g.after.cell && f.before.ie.zone === g.before.zone && f.after.ie.zone === g.after.zone;
check(same && worked, `the Method dialog's worked example is SW1, and the engine gives its golden figures (IFE ${f.before.ife} to ${f.after.ife}, EFE ${f.before.efe} to ${f.after.efe}, cell ${f.before.ie.cell} to ${f.after.ie.cell})`);

// ---- simulation ----------------------------------------------------------------------------------------
for (const id of Object.keys(scenarios)) {
  const run = createRun(scenarios[id]);
  const r = run.byLang.en;
  const entered = Object.values(scenarios[id].entered).flat().length;
  const ai = r.items.filter((i) => i.source === "ai" && !i.added).length;
  const added = r.items.filter((i) => i.added).length;
  const counts = [STEP.start, STEP.complete, STEP.challenge, STEP.summary].map((s) => itemsAt(r, s).length);
  check(counts.join() === [entered, entered + ai, entered + ai + added, entered + ai + added].join(), `${id}: the steps show the team's ${entered} items, then the Completer's ${ai}, then the ${added} the challenge added (${counts.join(", ")})`);
  const fixed = addressed(r, run.recorded);
  const raised = r.factors.filter((x) => figuresFor(r, run.recorded) && r.strategies.some((s) => run.recorded.includes(s.id) && s.changes.some((c) => c.item === x.id && c.to > x.rating)));
  check(fixed.size === raised.length && raised.every((x) => fixed.get(x.id).from === x.rating && fixed.get(x.id).to > x.rating && run.recorded.includes(fixed.get(x.id).strategy.id)), `${id}: the recorded choice addresses the ${fixed.size} items whose rating it raises`);
}
check(sameChoice(["R1", "R2"], ["R2", "R1"]) && !sameChoice(["R1"], ["R1", "R2"]) && !sameChoice([], ["R1"]), "two choices are the same when they hold the same strategies, in any order");

// ---- retries -------------------------------------------------------------------------------------------
// The client's waits are recorded instead of slept: setTimeout runs its callback at once and notes the delay.
{
  const realTimeout = globalThis.setTimeout;
  const waits = [];
  globalThis.setTimeout = (fn, ms) => { waits.push(ms); return realTimeout(fn, 0); };
  const attempt = async (err) => {
    waits.length = 0;
    let calls = 0;
    try { await withRetry(async () => { calls += 1; throw err; }); } catch { /* the last failure comes back */ }
    return { calls, waits: [...waits] };
  };
  const cases = [
    ["529 overloaded", new ApiError({ status: 529, type: "overloaded_error", message: "Overloaded" }), 3, [1500, 4000]],
    ["a lost connection", new ApiError({ status: 0, type: "network_error", message: "interrupted" }), 3, [1500, 4000]],
    ["429 with retry-after 7", new ApiError({ status: 429, type: "rate_limit_error", message: "rate limit", retryAfter: "7" }), 3, [7000, 7000]],
    ["429 with retry-after 60", new ApiError({ status: 429, type: "rate_limit_error", message: "rate limit", retryAfter: "60" }), 3, [20000, 20000]],
    ["429 at the spend limit", new ApiError({ status: 429, type: "rate_limit_error", message: "spend limit reached", details: { error_code: "enforced_spend_limit_reached" } }), 1, []],
    ["400 no credit", new ApiError({ status: 400, type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." }), 1, []],
    ["401 key refused", new ApiError({ status: 401, type: "authentication_error", message: "invalid x-api-key" }), 1, []],
    ["404 model refused", new ApiError({ status: 404, type: "not_found_error", message: "model" }), 1, []]
  ];
  for (const [name, err, calls, w] of cases) {
    const r = await attempt(err);
    check(r.calls === calls && JSON.stringify(r.waits) === JSON.stringify(w), `${name}: ${calls === 1 ? "not tried again" : `tried again twice, after ${w.map((x) => `${x / 1000} s`).join(" and ")}`} (${r.calls} calls, waits ${r.waits.join(", ") || "none"})`);
  }
  globalThis.setTimeout = realTimeout;
}

// ---- budget --------------------------------------------------------------------------------------------
{
  const w = worstCaseEur({ modelId: "claude-haiku-5-5", inputTokens: 3000, maxTokens: 8000 });
  const wS = worstCaseEur({ modelId: "claude-sonnet-5-5", inputTokens: 3000, maxTokens: 8000, searches: 5 });
  check(near(w, ((3600 * 0.1 + 8000 * 0.5) / 1e6) * RATE) && near(wS, (((3600 + 5 * 12000) * 2 + 8000 * 10) / 1e6 + 5 * 0.01) * RATE), `a request's worst case: its input and a fifth more for the estimate's error, with 12,000 tokens of pages a search, times the input price, plus max_tokens times the output price, plus $0.01 a search, at ${RATE} (Haiku €${w.toFixed(6)}, Sonnet with five searches €${wS.toFixed(6)})`);
  const full = planRequest({ modelId: "claude-sonnet-5-5", step: "challenge", inputTokens: 3000, spentEur: 0, capEur: 0.5 });
  const lowered = planRequest({ modelId: "claude-sonnet-5-5", step: "challenge", inputTokens: 3000, spentEur: 0, capEur: 0.05 });
  const stopped = planRequest({ modelId: "claude-sonnet-5-5", step: "challenge", inputTokens: 3000, spentEur: 0.03, capEur: 0.05 });
  check(full.ok && full.maxTokens === 8000 && !full.lowered && lowered.ok && lowered.lowered && lowered.maxTokens === 3000 && !stopped.ok && stopped.reason === "cap", "a request that fits the cap goes with 8,000 tokens; one that fits only with fewer goes with the step's minimum; one that fits not even then does not start");
  const long = planRequest({ modelId: "claude-haiku-5-5", step: "assess", inputTokens: 83334, spentEur: 0, capEur: 3 });
  const atLine = planRequest({ modelId: "claude-haiku-5-5", step: "assess", inputTokens: 83333, spentEur: 0, capEur: 3 });
  const sonnetLong = planRequest({ modelId: "claude-sonnet-5-5", step: "assess", inputTokens: 100001, spentEur: 0, capEur: 3 });
  check(!long.ok && long.reason === "long" && atLine.ok && sonnetLong.ok, "Haiku 5.5 refuses a request that, a fifth above its estimate, could pass 100,000 input tokens, where its prices rise fivefold (83,334 estimated); 83,333 goes, and Sonnet has no such line");
  // Search results come back as input: five searches' pages can carry a Haiku request past the line, four not.
  const paged5 = planRequest({ modelId: "claude-haiku-5-5", step: "research", inputTokens: 35000, spentEur: 0, capEur: 3, searches: 5 });
  const paged4 = planRequest({ modelId: "claude-haiku-5-5", step: "research", inputTokens: 35000, spentEur: 0, capEur: 3, searches: 4 });
  check(!paged5.ok && paged5.reason === "long" && paged4.ok, "with research, the pages each search may return count toward Haiku's 100,000-token line: 35,000 tokens and five searches are refused, four searches go");
  // With €0.09 left of a €0.10 cap on Sonnet 5.5, two searches' worst case does not fit, one does: the Scout searches once.
  const two = planRequest({ modelId: "claude-sonnet-5-5", step: "research", inputTokens: 4000, spentEur: 0.01, capEur: 0.1, searches: 2 });
  const one = planRequest({ modelId: "claude-sonnet-5-5", step: "research", inputTokens: 4000, spentEur: 0.01, capEur: 0.1, searches: 1 });
  check(!two.ok && two.reason === "cap" && one.ok && one.lowered, `with €0.09 left of a €0.10 cap on Sonnet 5.5, two searches' worst case (€${two.worstEur.toFixed(4)}) does not fit and one (€${one.worstEur.toFixed(4)}, at the step's minimum) does`);
  check(tokensIn("abcdefgh") === 2 && tokensIn({ a: "bc" }) === 3, "the budget counts about four characters a token, as the estimate does");
}

// ---- meter ---------------------------------------------------------------------------------------------
{
  const usages = [
    { input_tokens: 2811, output_tokens: 1733 },
    { input_tokens: 9120, output_tokens: 1407, server_tool_use: { web_search_requests: 3 } },
    { input_tokens: 1200, cache_creation_input_tokens: 400, cache_read_input_tokens: 900, output_tokens: 610 }
  ];
  const tracker = createCostTracker("claude-haiku-5-5");
  for (const u of usages) tracker.add(u);
  const byHand = ((2811 * 0.1 + 1733 * 0.5) + (9120 * 0.1 + 1407 * 0.5) + (1200 * 0.1 + 400 * 0.125 + 900 * 0.01 + 610 * 0.5)) / 1e6 + 3 * 0.01;
  check(near(tracker.snapshot().usd, byHand) && near(tracker.snapshot().eur, byHand * RATE), `the meter of three answers, one with three searches and one with cache tokens: $${byHand.toFixed(9)}, €${(byHand * RATE).toFixed(9)}, within 1e-9`);
  const long = usageCostUsd("claude-haiku-5-5", { input_tokens: 100001, output_tokens: 1000 });
  check(near(long, (100001 * 0.5 + 1000 * 2.5) / 1e6), "above 100,000 prompt tokens Haiku 5.5 costs $0.50 and $2.50 a million");
}

// ---- privacy -------------------------------------------------------------------------------------------
{
  const at = ["anna.berg", "example.com"].join("@");
  const found = [
    [`Contact ${at} for the plan`, "email"], ["+49 30 12345678", "phone"], ["Call 030 1234567 now", "phone"], ["(030) 1234 5678", "phone"],
    ["IBAN DE89 3704 0044 0532 0130 00", "iban"], ["DE89370400440532013000", "iban"], ["This plan is confidential", "label"],
    ["For internal use only", "label"], ["Streng vertraulich: Zahlen", "label"], ["Nur intern: Zahlen", "label"], ["[Intern] Zahlen", "label"],
    ["Classification: internal", "label"], ["Nicht zur Weitergabe", "label"], ["Our key is sk-ant-api03-abcdefghijklmnop", "key"]
  ];
  const clean = ["Internal processes are slow", "interne Prozesse sind langsam", "Wissen wird intern nicht geteilt", "Intern hires grow", "Revenue of 2,000,000 in 2026", "ISO 14083 and EN 50160", "Ships over 5,000 GT", "Order 1234567 shipped", "A 24/7 service desk", "DE89 3704 0044 0532 0130 01", "Market share 30 %"];
  const missed = found.filter(([text, kind]) => !privateKinds(text).includes(kind));
  const wrong = clean.filter((text) => privateKinds(text).length);
  check(!missed.length && !wrong.length, `the private-data scan finds all ${found.length} planted samples and nothing in ${clean.length} clean texts${missed.length || wrong.length ? `: missed ${missed.map((x) => x[0]).join("; ")}; wrongly ${wrong.join("; ")}` : ""}`);
  const findings = privacyFindings({ company: { name: "Beispiel GmbH", description: "Call 030 1234567" }, entered: { strengths: [`Mail ${at}`], weaknesses: [], opportunities: ["Internal processes are slow"], threats: [{ text: "Strictly confidential" }] } });
  check(JSON.stringify(findings) === JSON.stringify([{ kind: "phone", where: "description" }, { kind: "email", where: "strengths" }, { kind: "label", where: "threats" }]), "each finding names its kind and its field, once");
}

// ---- api errors -----------------------------------------------------------------------------------------
{
  const errors = [
    [{ name: "AbortError" }, "api.aborted"],
    [{ status: 0, type: "network_error", message: "interrupted" }, "api.network"],
    [{ status: 0, type: "timeout_error", message: "No response" }, "api.timeout"],
    [{ status: 401, type: "authentication_error", message: "invalid x-api-key" }, "api.unauthorized"],
    [{ status: 403, type: "permission_error", message: "no permission" }, "api.model"],
    [{ status: 404, type: "not_found_error", message: "model" }, "api.model"],
    [{ status: 400, type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." }, "api.credit"],
    [{ status: 402, type: "billing_error", message: "Payment required" }, "api.credit"],
    [{ status: 400, type: "invalid_request_error", message: "You have reached your specified workspace API usage limits." }, "api.spendLimit"],
    [{ status: 429, type: "rate_limit_error", message: "x", details: { error_code: "enforced_spend_limit_reached" } }, "api.spendLimit"],
    [{ status: 429, type: "rate_limit_error", message: "rate limit" }, "api.busy"],
    [{ status: 529, type: "overloaded_error", message: "Overloaded" }, "api.busy"],
    [{ status: 500, type: "api_error", message: "Internal" }, "api.server"],
    [{ status: 413, type: "request_too_large", message: "Request too large" }, "api.other"],
    [{ ok: false, status: 401, error: { type: "authentication_error", message: "invalid x-api-key" } }, "api.unauthorized"]
  ];
  const bad = [];
  for (const [err, want] of errors) {
    const m = apiMessage(err);
    if (m.key !== want) bad.push(`${JSON.stringify(err).slice(0, 50)} gives ${m.key}, not ${want}`);
    for (const d of [EN, DE]) if (!d[m.key] || !d[m.next] || /\{(?!status|message)/.test(d[m.key])) bad.push(`${m.key} or ${m.next} has no words`);
  }
  check(!bad.length, `all ${errors.length} kinds of API error read as words and one next step, in English and German${bad.length ? `: ${bad.join("; ")}` : ""}`);
  check(webSearchOff({ status: 400, message: "Web search is disabled for this organization." }) && !webSearchOff({ status: 400, message: "Your credit balance is too low" }), "the 400 for web search switched off is told apart from other 400s");
}

// ---- the Analyst's last resort (1.0.1) ----------------------------------------------------------------------
{
  const STEP_OF = new Map(["complete", "challenge", "assess", "strategise", "summary"].map((s) => [systemFor(s), s]));
  /** S2 run live through js/pipeline.js on a scripted transport; fault(step, n, answers) may replace an answer. */
  async function liveRun(lang, fault = () => null) {
    const scen = scenarios.s2;
    const a = JSON.parse(JSON.stringify(scen.answers[lang]));
    for (const issue of a.challenge.issues) issue.evidence = [];
    const count = {};
    const sent = [];
    const transport = async ({ body }) => {
      const step = STEP_OF.get(body.system);
      count[step] = (count[step] || 0) + 1;
      sent.push(step);
      const answer = fault(step, count[step], a) ?? a[step];
      return { message: { content: [{ type: "text", text: JSON.stringify(answer) }], stop_reason: "end_turn", usage: { input_tokens: 3000, output_tokens: 1500 } } };
    };
    const items = Object.fromEntries(Object.entries(scen.entered).map(([q, list]) => [q, list.map((i) => i.text[lang])]));
    const company = { name: scen.company.name, sector: scen.company.sector, country: scen.company.country, description: scen.company.description[lang] };
    const run = createLiveRun({ recording: newRecording({ company, items, lang, today: scen.as_of, fictional: true }), settings: resolveSettings({ preset: "fast" }), capEur: 1, transport, retry: (fn) => fn(), key: () => `sk-ant-api03-${"x".repeat(40)}` });
    await run.complete();
    if (run.snapshot().status === "check") { run.applyCheck({}); await run.challenge(); }
    if (run.snapshot().status === "decide") await run.summarise({ chosen: a.strategise.strategies.filter((x) => x.recommended).map((x) => x.id), zoneName });
    return { run, snap: run.snapshot(), sent: sent.join(","), a };
  }
  const victimOf = (a) => [...a.assess.impacts].reverse().find((x) => x.monetisable).issue;
  const noKpi = (a) => { const x = JSON.parse(JSON.stringify(a.assess)); x.impacts.find((im) => im.issue === victimOf(a)).kpis = []; return x; };
  const today = new Date().toISOString().slice(0, 10);
  for (const lang of ["en", "de"]) {
    // Victor's run of 25 November 2026: the Analyst prices an issue without a KPI, and again in the repair.
    const r = await liveRun(lang, (step, n, a) => (step === "assess" ? noKpi(a) : null));
    const victim = victimOf(r.a);
    const im = r.run.rec.answers[lang].assess.impacts.find((x) => x.issue === victim);
    const audits = r.snap.audit.filter((x) => x.step === "assess");
    const saved = scenarioProblems(r.run.toRecording(), { today });
    check(r.snap.status === "done" && r.sent === "complete,challenge,assess,assess,strategise,summary" && r.snap.repairs === 1 && JSON.stringify(r.snap.setAside) === JSON.stringify([victim])
      && im.monetisable === false && im.kpis.length === 0 && im.eur_year_high === 0 && im.reason === t("s.assess.setaside", null, lang)
      && audits.length === 2 && audits.every((x) => x.problems.some((p) => p.startsWith(`${victim} is priced but moves no KPI`))) && !saved.length,
    `${lang}: a priced issue without a KPI, twice, is set aside after the repair and the run goes on to the summary; ${victim} reads "${im.reason}", the audit keeps both problems, and the saved run passes the scenario checker${saved.length ? ` (it does not: ${saved.slice(0, 2).join("; ")})` : ""}`);
  }
  {
    // A fault only the contract in code catches, inside one assessment: negative euros, in the answer and the repair.
    const r = await liveRun("en", (step, n, a) => { if (step !== "assess") return null; const x = JSON.parse(JSON.stringify(a.assess)); x.impacts.find((im) => im.issue === victimOf(a)).eur_year_low = -200000; return x; });
    check(r.snap.status === "done" && r.sent === "complete,challenge,assess,assess,strategise,summary" && JSON.stringify(r.snap.setAside) === JSON.stringify([victimOf(r.a)]) && r.snap.audit.filter((x) => x.step === "assess").every((x) => x.problems.some((p) => /Assessment contract: impacts\[\d\]\.eur_year_low/.test(p))), `negative euros, twice, are set aside too, and the run goes on to the summary (${r.sent})`);
  }
  {
    // No repair left: the Completer and the Red team each needed one, so the Analyst's figure goes at once.
    const r = await liveRun("en", (step, n, a) => {
      if (step === "complete" && n === 1) return { ...a.complete, sector: "banking" };
      if (step === "challenge" && n === 1) return { issues: a.challenge.issues.map((x, i) => (i === 1 ? { ...x, items: ["s9"] } : x)) };
      return step === "assess" ? noKpi(a) : null;
    });
    check(r.snap.status === "done" && r.sent === "complete,complete,challenge,challenge,assess,strategise,summary" && r.snap.repairs === 2 && r.snap.setAside.length === 1, `with both repairs spent, a figure that breaks a pricing rule is set aside without a third repair, and the run goes on (${r.sent})`);
  }
  {
    // The negative control: a rating that breaks David's scale is no figure's fault; the run stops as in 1.0.0.
    const r = await liveRun("en", (step, n, a) => (step === "assess" ? { ...a.assess, factors: a.assess.factors.map((f) => (f.item === "s1" ? { ...f, rating: 2 } : f)) } : null));
    check(r.snap.status === "stopped" && r.snap.stop?.reason === "invalid" && r.snap.stop.step === "assess" && r.snap.stop.problems.some((p) => /a strength is 3 or 4/.test(p)) && r.sent === "complete,challenge,assess,assess" && !r.snap.setAside.length,
      `a strength rated 2 in the answer and the repair still stops the run at the Analyst (${r.sent}; "${r.snap.stop?.problems?.[0]}")`);
  }
}

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} unit checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} unit checks passed.\nUNIT OK`);

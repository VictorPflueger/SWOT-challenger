// The live run as a person starts it, against the scripted stand-in for the Claude API
// (tests/lib/fake-claude.mjs), for the suites that need a live run in Chromium: tests/live.mjs and
// tests/report.mjs. A scenario's recorded answers feed the stand-in, so the live guards pass; a script can
// plant a fault in any request. Nothing here calls the real API or spends anything.
import { createFakeClaude, json, thinking, tool, CORS, MODELS_LIST } from "./fake-claude.mjs";
import { NETWORK_NOISE, MOCK_KEY } from "./harness.mjs";

const clone = (x) => JSON.parse(JSON.stringify(x));

export const SCEN = {};
for (const id of ["s1", "s2", "s3"]) SCEN[id] = (await import(`../../data/scenarios/${id}.js`)).default;

/** What every request of the Balanced preset carries: Haiku 5.5 at medium effort. */
export const HAIKU = { model: "claude-haiku-5-5", effort: "medium", thinking: undefined };

/**
 * A scenario's recorded answers for the stand-in. evidence: the URLs the Red team may cite (others are
 * dropped); removed: AI items the person removed, whose factors and mentions are taken out again.
 */
export function answers(id, lang, { evidence = [], removed = [] } = {}) {
  const a = clone(SCEN[id].answers[lang]);
  const allowed = new Set(evidence);
  for (const issue of a.challenge.issues) issue.evidence = issue.evidence.filter((e) => allowed.has(e.url));
  if (removed.length) {
    const gone = new Set(removed);
    const kept = a.challenge.issues.filter((i) => !i.items.some((x) => gone.has(x)));
    const id = new Map(kept.map((i, n) => [i.id, `I${n + 1}`]));
    a.challenge.issues = kept.map((i) => ({ ...i, id: id.get(i.id) }));
    a.assess.impacts = a.assess.impacts.filter((x) => id.has(x.issue)).map((x) => ({ ...x, issue: id.get(x.issue) }));
    a.strategise.strategies = a.strategise.strategies.filter((x) => id.has(x.issue) && !x.items.some((i) => gone.has(i))).map((x, n) => ({ ...x, id: `R${n + 1}`, issue: id.get(x.issue) }));
    a.assess.factors = a.assess.factors.filter((f) => !gone.has(f.item));
    for (const side of [/^[sw]/, /^[ot]/]) {
      const own = a.assess.factors.filter((f) => side.test(f.item));
      const sum = own.reduce((s, f) => s + f.weight, 0);
      own.forEach((f) => { f.weight = Math.round((f.weight / sum) * 1e6) / 1e6; });
      const drift = 1 - own.reduce((s, f) => s + f.weight, 0);
      own[0].weight = Math.round((own[0].weight + drift) * 1e6) / 1e6;
    }
  }
  return a;
}

/** A script that answers each step from a scenario's answers, with an optional fault per request. */
export function scripted(a, { usage = { input_tokens: 3000, output_tokens: 1500 }, fault = () => null, scout = null, think = false } = {}) {
  return (n, req, step) => {
    const f = fault(n, req, step);
    if (f) return f;
    if (step === "research") return scout ? scout(n, req) : { blocks: [tool("submit_signals", { signals: [] })], stop: "tool_use", usage };
    // Ids follow the run: the challenge's issues renumbered, the Strategist's answers to issues that exist.
    return { blocks: [...(think ? [thinking()] : []), json(a[step])], stop: "end_turn", usage };
  };
}

/**
 * A page in a new context at `url` (the served app, with ?guide=0) whose requests to api.anthropic.com the
 * stand-in answers; any other host is blocked and recorded. hold(n, step) may return a promise that holds
 * the n-th request. Returns { page, context, fake, external, errors, consoles, times }.
 */
export async function openLivePage(browser, url, { script, expect = HAIKU, lang = "en", viewport = { width: 1280, height: 720 }, models = MODELS_LIST, hold = null } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`.trim()));
  });
  const fake = createFakeClaude(script, { expect, key: MOCK_KEY });
  const external = [];
  const errors = [];
  const consoles = [];
  const times = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host !== "api.anthropic.com") { external.push(`${req.method()} ${u.host}${u.pathname}`); return route.abort("blockedbyclient"); }
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/v1/models") {
      const ok = req.headers()["x-api-key"] === MOCK_KEY;
      return route.fulfill({ status: ok ? 200 : 401, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(ok ? models : { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
    }
    times.push(Date.now());
    const r = fake.handle(req.postData(), req.headers());
    const n = fake.requests.length;
    if (hold) await hold(n, fake.requests[n - 1].step);
    try {
      if (r.abort) await route.abort("failed");
      else await route.fulfill({ status: r.status, headers: { ...CORS, ...r.headers }, body: r.body });
    } catch { /* the page aborted the request while it was held */ }
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => { consoles.push(m.text()); if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.goto(`${url}&lang=${lang}`);
  await page.waitForSelector('html[data-boot="ready"]');
  return { page, context, fake, external, errors, consoles, times };
}

/** Closes the page's context after one check: no page error, policy violation, foreign host or protocol violation. */
export async function closeLivePage(p, label, check) {
  const csp = await p.page.evaluate(() => window.__csp).catch(() => []);
  const all = [...p.errors, ...csp, ...p.external, ...p.fake.violations];
  check(!all.length, `${label}: no page error, policy violation, foreign host or protocol violation${all.length ? `: ${all.slice(0, 4).join(" | ")}` : ""}`);
  await p.context.close();
}

/** The page's state, as its test hook reports it. */
export const state = (page) => page.evaluate(() => window.__swot.state());

/** Waits until the live run's status is one of `statuses`, and returns the state. */
export async function until(page, statuses, timeout = 30000) {
  await page.waitForFunction((s) => s.includes(window.__swot.state().live?.status), statuses, { timeout });
  return state(page);
}

/** Run it live, fill in a fictional company, open the dialog. */
export async function toDialog(page, { fill = "s2" } = {}) {
  await page.click("#btn-live");
  await page.waitForSelector("#live-fill");
  if (fill) {
    await page.selectOption("#live-fill", fill);
    await page.waitForFunction((name) => document.getElementById("live-name")?.value === name, SCEN[fill].company.name);
  }
  await page.click("#btn-cta");
  await page.waitForSelector("#live-dialog[open]");
}

/** The dialog's settings, the key and the box; then Start the live run. */
export async function startRun(page, { preset = "balanced", research = false, cap = null, model = null, effort = null, key = MOCK_KEY } = {}) {
  await page.evaluate(({ preset, research, cap, model, effort }) => {
    const set = (el, prop, v, type = "change") => { el[prop] = v; el.dispatchEvent(new Event(type, { bubbles: true })); };
    set(document.querySelector(`input[name="live-preset"][value="${preset}"]`), "checked", true);
    set(document.getElementById("live-research"), "checked", research);
    if (cap !== null) set(document.getElementById("live-cap"), "value", String(cap), "input");
    if (model) set(document.getElementById("live-model"), "value", model);
    if (effort) set(document.getElementById("live-effort"), "value", effort);
  }, { preset, research, cap, model, effort });
  if (key) await page.fill("#live-key", key);
  await page.check("#live-ack");
  await page.click("#live-start");
}

/** A whole run from the dialog to the Summary, choosing the recommended strategies. */
export async function wholeRun(page, opts = {}) {
  await toDialog(page, opts);
  await startRun(page, opts);
  await until(page, ["check"]);
  await page.click("#btn-cta");
  await until(page, ["decide"]);
  await page.click("#btn-cta");
  return until(page, ["done"]);
}

/** An element's text, its white space folded; "" when it is not there. */
export const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => "");

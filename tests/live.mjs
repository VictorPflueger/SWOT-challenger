// The live run in Chromium against a scripted stand-in for the Claude API (tests/lib/fake-claude.mjs): no
// test calls the real API or spends anything. Each run starts the way a person starts it: Run it live on
// Start, Fill in a fictional company, Start the agents, the key and the acknowledgement in the dialog,
// Start the live run. The stand-in answers with the scenario's recorded answers, so the live guards pass,
// and with planted faults where a group needs them. Groups, each printing its line when every check holds:
//   ac08     every request carries the setting's model, effort and thinking, the step's schema and both
//            headers, for Fast, Balanced, Thorough and Advanced; a failing answer gets exactly one repair
//            that lists its problems; Abort stops the request in flight and keeps what is done   AC-08 OK
//   ac09     a request whose worst case passes the cap gets fewer tokens or does not start, and the screens
//            say so; the meter equals usage times price plus $0.01 a search at 0.894, within 1e-9  AC-09 OK
//   ac10     401, 403, 404, 400 and 402 for credit, 400 and 429 for a spend limit, 429, 529 and a network
//            failure each show their words and one next step, in English and German; 429 and 529 and the
//            network are tried twice more after the waits of brief 5.8, credit and spend never   AC-10 OK
//   ac11     the dialog: start disabled until the key looks right and the box is ticked, the box unticked at
//            every opening, Vici's liveDialogProblems, the refusal inside a frame, the private-data warning
//            on planted samples and not on clean text, the key in no element after the start      AC-11 OK
//   ac12     research: pause_turn sent back unchanged, refused URLs answered with is_error, at most three
//            Scout requests, the Red team given only accepted signals, web search switched off    AC-12 OK
//   ac18     the person's items reach the challenge unchanged; every AI item says AI, its basis and its
//            confidence; Edit, Remove and Undo before the challenge; the challenge gets the SWOT as left
//            AC-18 OK
//   ac19     a second failure stops the run with what is done and offers Thorough or a simulation AC-19 OK
//   ac02     after a whole run, storage holds only the theme, the language and the guide's note; IndexedDB,
//            the Cache API and cookies are empty; the key is in no download, address, element or console
//            message, and in no request but its header to api.anthropic.com                        AC-02 OK
//   screens  the wait, the tiles' waits, the empty field, research found nothing, switched off and every
//            URL refused, a failed repair, a stop at the cap and an unchecked summary, in both languages
//            SCREENS OK
//   save     "Save run as simulation" downloads a recording the scenario rules accept for its language,
//            without key or thinking, and the player plays it                                       SAVE RUN OK
// Every case fails on a page error, an unexpected console error, a policy violation, a request to a host
// other than the stand-in, or a protocol violation the stand-in found. Usage: node tests/live.mjs [group…]
import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { APP_ROOT, ONLY, launchBrowser, serveStatic, MOCK_KEY, viciDir, REQUIRE_VICI } from "./lib/harness.mjs";
import { json, thinking, tool, search, MODELS_LIST, toolResults } from "./lib/fake-claude.mjs";
import { SCEN, HAIKU, answers, scripted, openLivePage, closeLivePage, state, until, toDialog, startRun, wholeRun, text } from "./lib/live-page.mjs";
import { MODELS, FX_USD_EUR, BUDGET } from "../js/config.js";
import { usageCostUsd } from "../js/cost.js";
import { scenarioProblems } from "../js/scenario_check.js";
import { assemble, figuresFor } from "../js/scenario.js";
import { privateKinds } from "../js/privacy.js";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";

const DICT = { en: EN, de: DE };
const T = (lang, key, vars = {}) => DICT[lang][key].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const GROUPS = ["ac08", "ac09", "ac10", "ac11", "ac12", "ac18", "ac19", "ac02", "screens", "save"];
const LINES = { ac08: "AC-08 OK", ac09: "AC-09 OK", ac10: "AC-10 OK", ac11: "AC-11 OK", ac12: "AC-12 OK", ac18: "AC-18 OK", ac19: "AC-19 OK", ac02: "AC-02 OK", screens: "SCREENS OK", save: "SAVE RUN OK" };
const run = ONLY.length ? GROUPS.filter((g) => ONLY.includes(g)) : GROUPS;
const unknownGroups = ONLY.filter((g) => !GROUPS.includes(g));
if (unknownGroups.length) { console.log(`FAIL  unknown group ${unknownGroups.join(", ")}; the groups are ${GROUPS.join(", ")}`); process.exit(1); }

const results = Object.fromEntries(GROUPS.map((g) => [g, []]));
let group = "";
const check = (ok, what) => results[group].push([!!ok, what]);
const clone = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b) => Math.abs(a - b) <= 1e-9;

const PRESET_EXPECT = {
  fast: { model: "claude-haiku-5-5", effort: "low", thinking: { type: "disabled" } },
  balanced: HAIKU,
  thorough: { model: "claude-sonnet-5-5", effort: "medium", thinking: undefined }
};

// ---- the page ------------------------------------------------------------------------------------------
const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 8800 + Math.floor(Math.random() * 300));
const BASE = `${server.base}?guide=0`;

const livePage = (opts = {}) => openLivePage(browser, BASE, opts);
const closePage = (p, label) => closeLivePage(p, label, check);

const story = async (page) => `${await text(page, "#step-title")} ${await text(page, "#step-lead")} ${await text(page, "#step-body")} ${await text(page, "#step-bar")}`;

// ---- AC-08 ---------------------------------------------------------------------------------------------
async function ac08() {
  for (const [preset, expect] of Object.entries(PRESET_EXPECT)) {
    const p = await livePage({ script: scripted(answers("s2", "en"), { think: preset !== "fast" }), expect });
    const s = await wholeRun(p.page, { preset });
    const steps = p.fake.requests.map((r) => r.step).join(",");
    check(s.live.status === "done" && steps === "complete,challenge,assess,strategise,summary", `${preset}: five requests, one a step (${steps}), each with ${expect.model}, effort ${expect.effort} and thinking ${JSON.stringify(expect.thinking) ?? "left out"}, its schema and both headers`);
    await closePage(p, preset);
  }
  // Advanced: Sonnet at high effort on Balanced; Sonnet never gets thinking switched off.
  {
    const p = await livePage({ script: scripted(answers("s2", "en")), expect: { model: "claude-sonnet-5-5", effort: "high", thinking: undefined } });
    await toDialog(p.page);
    await startRun(p.page, { preset: "fast", model: "claude-sonnet-5-5", effort: "high" });
    await until(p.page, ["check"]);
    check(p.fake.requests.length === 1, "Advanced: Fast with Sonnet 5.5 at high effort sends Sonnet, high effort and no thinking field, which Sonnet would refuse switched off");
    await closePage(p, "advanced");
  }
  // One repair: the Completer changes the sector the person chose, then answers rightly.
  {
    const a = answers("s2", "en");
    const bad = { ...clone(a.complete), sector: "banking" };
    const p = await livePage({ script: scripted(a, { fault: (n) => (n === 1 ? { blocks: [json(bad)], stop: "end_turn", usage: { input_tokens: 3000, output_tokens: 1500 } } : null) }) });
    await toDialog(p.page);
    await startRun(p.page);
    const s = await until(p.page, ["check", "stopped"]);
    const second = p.fake.requests[1]?.req.messages[0].content || "";
    check(s.live.status === "check" && p.fake.requests.length === 2 && p.fake.requests.every((r) => r.step === "complete"), "a failing answer gets exactly one repair, and the run goes on");
    check(/broke these rules/.test(second) && /chose the sector industrial_manufacturing/.test(second) && second.includes('"sector":"banking"'), "the repair request lists the problems and holds the answer that failed");
    await closePage(p, "repair");
  }
  // Abort keeps what is done: the challenge is held, Abort, the Completer's items stay; Try again goes on.
  {
    let release = null;
    const held = new Promise((r) => { release = r; });
    const p = await livePage({ script: scripted(answers("s2", "en")), hold: (n, step) => (step === "challenge" && n === 2 ? held : null) });
    await toDialog(p.page);
    await startRun(p.page);
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    await until(p.page, ["working"]);
    await p.page.waitForSelector("#btn-abort");
    await p.page.click("#btn-abort");
    const s = await until(p.page, ["stopped"]);
    release();
    await p.page.click('.vc-step[data-step="complete"] .vc-step__button');
    const aiItems = await p.page.$$eval(".ai-item", (els) => els.length);
    check(s.live.stop?.reason === "aborted" && s.live.stop.step === "challenge" && aiItems === 4, `Abort stops the challenge and keeps the Completer's ${aiItems} items`);
    await p.page.click('.vc-step[data-step="challenge"] .vc-step__button');
    const words = await story(p.page);
    check(words.includes(EN["api.aborted"]) && words.includes(EN["x.again"]), "the stop says what was kept and offers to run the step again");
    await p.page.click("#btn-cta");
    const after = await until(p.page, ["decide", "stopped"]);
    check(after.live.status === "decide", "Try this step again runs the challenge and goes on to the decision");
    await closePage(p, "abort");
  }
}

// ---- AC-09 ---------------------------------------------------------------------------------------------
async function ac09() {
  // Thorough at the smallest cap: the Completer's worst case does not fit at 8,000 tokens, so it gets the
  // step's minimum; the challenge's does not fit at all, so the run stops before it.
  {
    const usage = { input_tokens: 3000, output_tokens: 2500 };
    const p = await livePage({ script: scripted(answers("s2", "en"), { usage }), expect: PRESET_EXPECT.thorough });
    await toDialog(p.page);
    await startRun(p.page, { preset: "thorough", cap: BUDGET.minEur });
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    const s = await until(p.page, ["stopped"]);
    const first = p.fake.requests[0].req;
    check(first.max_tokens === 3000 && p.fake.requests.length === 1, `the first request's worst case passes €${BUDGET.minEur} at 8,000 tokens, so it goes with the step's minimum (${first.max_tokens}), and no second request starts`);
    check(s.live.stop?.reason === "cap" && s.live.stop.step === "challenge", "the run stops at the cap before the Red team");
    const words = await story(p.page);
    check(words.includes(EN["x.cap.title"]) && words.includes(T("en", "x.cap.text", { agent: "the Red team" })), "the screen where it stopped says so");
    for (const step of ["start", "complete"]) {
      await p.page.click(`.vc-step[data-step="${step}"] .vc-step__button`);
      check((await text(p.page, ".cap-note")).includes(EN["x.cap.title"]), `the ${step} screen of the stopped run says so too`);
    }
    const spent = (await state(p.page)).live.spentEur;
    check(spent <= BUDGET.minEur, `what was spent (€${spent.toFixed(4)}) stays within the cap`);
    await closePage(p, "cap");
  }
  // Research at a tight cap, on Thorough and on Balanced: search results come back as input, so the Scout
  // searches only as often as its worst case fits, pages included. Here each search brings 12,000 tokens
  // back; with €0.15 on Sonnet 5.5, or the lowest cap of €0.05 on Haiku 5.5, where the $0.01 a search
  // counts most, the Scout may search a few times but not five, and the run stays within the cap.
  for (const [preset, cap] of [["thorough", 0.15], ["balanced", BUDGET.minEur]]) {
    const usage = { input_tokens: 3000, output_tokens: 2500 };
    const usesOf = (req) => req.tools?.find((t) => t.name === "web_search")?.max_uses ?? 0;
    // The Scout is billed for its own request, counted as the budget counts it, and 12,000 tokens a search.
    const own = (req) => Math.ceil((JSON.stringify(req.system ?? "").length + JSON.stringify(req.messages).length + JSON.stringify(req.tools).length) / 4);
    const scout = (n, req) => ({ blocks: [...search("Arvento Drives news", [{ url: SCEN.s2.sources[0].url, title: "Source" }]), tool("submit_signals", { signals: [] })], stop: "tool_use", usage: { input_tokens: own(req) + 12000 * usesOf(req), output_tokens: 3000, web_search_requests: usesOf(req) } });
    const p = await livePage({ script: scripted(answers("s2", "en"), { usage, scout }), expect: PRESET_EXPECT[preset] });
    await toDialog(p.page);
    await startRun(p.page, { preset, research: true, cap });
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    const s = await until(p.page, ["decide", "stopped", "done"]);
    const scoutReq = p.fake.requests.find((r) => r.step === "research")?.req;
    check(scoutReq && usesOf(scoutReq) >= 1 && usesOf(scoutReq) < 5, `${preset}, at €${cap} the Scout asks for ${scoutReq ? usesOf(scoutReq) : "no"} searches, not five: more could pass the cap once their pages are counted`);
    check(s.live.spentEur <= cap, `${preset}, with research on, what was spent (€${s.live.spentEur.toFixed(4)}) stays within the €${cap} cap (${s.live.status}${s.live.stop ? `, stopped by the ${s.live.stop.reason} before ${s.live.stop.step}` : ""})`);
    await closePage(p, `${preset}, research at the cap`);
  }
  // The meter: usage times price, plus $0.01 a search, at 0.894.
  {
    const usages = [
      { input_tokens: 2811, output_tokens: 1733 },
      { input_tokens: 9120, output_tokens: 1407, web_search_requests: 3 },
      { input_tokens: 3517, output_tokens: 2291 },
      { input_tokens: 4102, output_tokens: 3360 },
      { input_tokens: 4875, output_tokens: 2846 },
      { input_tokens: 5230, output_tokens: 1190 }
    ];
    const urls = SCEN.s2.sources.map((s) => s.url);
    const a = answers("s2", "en", { evidence: urls });
    const scout = () => ({ blocks: [...search("Arvento Drives news", urls.map((url) => ({ url, title: "Source" }))), tool("submit_signals", { signals: urls.map((url) => ({ title: "A recent source", summary: "It matters. It is recent.", url, published: "", quadrants: ["threats"] })) })], stop: "tool_use", usage: usages[1] });
    const script = (n, req, step) => (step === "research" ? scout() : { blocks: [json(a[step])], stop: "end_turn", usage: usages[n - 1] });
    const p = await livePage({ script });
    const s = await wholeRun(p.page, { research: true });
    const want = usages.reduce((sum, u) => sum + usageCostUsd("claude-haiku-5-5", { input_tokens: u.input_tokens, output_tokens: u.output_tokens, server_tool_use: { web_search_requests: u.web_search_requests || 0 } }), 0) * FX_USD_EUR;
    const byHand = usages.reduce((sum, u) => sum + (u.input_tokens * 0.1 + u.output_tokens * 0.5) / 1e6 + (u.web_search_requests || 0) * 0.01, 0) * 0.894;
    check(s.live.status === "done" && near(s.live.spentEur, want) && near(want, byHand), `the meter shows €${s.live.spentEur.toFixed(9)}: the usage times Haiku 5.5's price plus $0.01 a search, at 0.894, as counted by hand (€${byHand.toFixed(9)}), within 1e-9`);
    const tile = await text(p.page, "#kpi-cost .kpi-main");
    check(tile === `€${s.live.spentEur.toFixed(3)}`, `the Session cost tile shows it (${tile})`);
    await closePage(p, "meter");
  }
}

// ---- AC-10 ---------------------------------------------------------------------------------------------
const ERRORS = [
  { name: "401", error: { status: 401, type: "authentication_error", message: "invalid x-api-key" }, key: "api.unauthorized", tries: 1, action: "x.key" },
  { name: "403", error: { status: 403, type: "permission_error", message: "Your API key does not have permission to use the specified resource." }, key: "api.model", tries: 1, action: "x.again" },
  { name: "404", error: { status: 404, type: "not_found_error", message: "model: claude-haiku-5-5" }, key: "api.model", tries: 1, action: "x.again" },
  { name: "400 credit", error: { status: 400, type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits." }, key: "api.credit", tries: 1, action: null },
  { name: "402", error: { status: 402, type: "billing_error", message: "Payment required" }, key: "api.credit", tries: 1, action: null },
  { name: "400 spend limit", error: { status: 400, type: "invalid_request_error", message: "You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC." }, key: "api.spendLimit", tries: 1, action: null },
  { name: "429 spend limit", error: { status: 429, type: "rate_limit_error", message: "This request would exceed your organization's spend limit.", details: { error_code: "enforced_spend_limit_reached" } }, key: "api.spendLimit", tries: 1, action: null },
  // 429 waits as long as retry-after says (one second here), 529 and a lost connection 1.5 and 4 seconds.
  { name: "429", error: { status: 429, type: "rate_limit_error", message: "Number of requests has exceeded your rate limit.", headers: { "retry-after": "1" } }, key: "api.busy", tries: 3, action: "x.again", gaps: [[900, 1500], [900, 1500]] },
  { name: "529", error: { status: 529, type: "overloaded_error", message: "Overloaded" }, key: "api.busy", tries: 3, action: "x.again", gaps: [[1400, 2500], [3900, 5500]] },
  { name: "network", network: true, key: "api.network", tries: 3, action: "x.again", gaps: [[1400, 2500], [3900, 5500]] }
];
async function ac10() {
  for (const lang of ["en", "de"]) {
    for (const e of ERRORS) {
      const p = await livePage({ lang, script: (n) => (e.network ? { network: true } : { error: e.error }) });
      await toDialog(p.page);
      await startRun(p.page);
      const s = await until(p.page, ["stopped"], 40000);
      const words = await story(p.page);
      const tries = p.fake.requests.length;
      const gaps = p.times.slice(1).map((t, i) => t - p.times[i]);
      const timed = !e.gaps || (gaps.length === 2 && gaps.every((g, i) => g >= e.gaps[i][0] && g <= e.gaps[i][1]));
      check(s.live.stop?.reason === "error" && words.includes(DICT[lang][e.key].replace(/\{status\}/, "")) && words.includes(DICT[lang][`${e.key}.next`]), `${lang} ${e.name}: "${DICT[lang][e.key]}" and "${DICT[lang][`${e.key}.next`]}"`);
      check(tries === e.tries && timed, `${lang} ${e.name}: ${tries === 1 ? "not tried again" : `tried again twice, after ${gaps.map((g) => `${(g / 1000).toFixed(1)} s`).join(" and ")}`}`);
      check(e.action ? words.includes(DICT[lang][e.action]) : !(await p.page.$("#btn-cta")), `${lang} ${e.name}: ${e.action ? `offers "${DICT[lang][e.action]}"` : "offers no retry that could not work"}, and a simulation`);
      await closePage(p, `${lang} ${e.name}`);
    }
    // The key check in the dialog: a rejected key is refused there, before any run.
    const p = await livePage({ lang, script: () => null });
    await toDialog(p.page);
    await startRun(p.page, { key: "sk-ant-api03-WRONGKEY-0123456789abcdefghijklmnop" });
    await p.page.waitForFunction(() => document.getElementById("live-key-status").dataset.tone === "danger");
    const status = await text(p.page, "#live-key-status");
    check(status.includes(DICT[lang]["api.unauthorized"]) && status.includes(DICT[lang]["api.unauthorized.next"]) && p.fake.requests.length === 0 && (await p.page.$("#live-dialog[open]")), `${lang}: a key the model list rejects is refused in the dialog, in words, and nothing runs`);
    await closePage(p, `${lang} key check`);
  }
}

// ---- AC-11 ---------------------------------------------------------------------------------------------
async function ac11() {
  const html = await readFile(path.join(APP_ROOT, "index.html"), "utf8");
  const dir = viciDir();
  if (dir) {
    const { liveDialogProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "live.mjs")).href);
    const problems = liveDialogProblems(html);
    check(!problems.length, `Vici's liveDialogProblems finds nothing in index.html${problems.length ? `: ${problems.join("; ")}` : ""}`);
  } else check(!REQUIRE_VICI, "Vici's liveDialogProblems: no ViciDesign checkout");
  const p = await livePage({ script: scripted(answers("s2", "en")) });
  await toDialog(p.page);
  const disabled = () => p.page.$eval("#live-start", (b) => b.disabled);
  check(await disabled(), "Start the live run is disabled when the dialog opens");
  await p.page.fill("#live-key", "not-a-key");
  await p.page.check("#live-ack");
  check(await disabled() && (await text(p.page, "#live-key-status")).includes(EN["d.key.shape"]), "a key of the wrong shape keeps it disabled and says why");
  await p.page.fill("#live-key", MOCK_KEY);
  check(!(await disabled()), "a key of the right shape and the ticked box enable it");
  await p.page.uncheck("#live-ack");
  check(await disabled(), "unticking the box disables it again");
  await p.page.click("#live-dialog [data-vc-close]");
  await p.page.click("#btn-cta");
  await p.page.waitForSelector("#live-dialog[open]");
  check(!(await p.page.$eval("#live-ack", (b) => b.checked)) && (await p.page.$eval("#live-key", (k) => k.value)) === "", "the box is unticked and the field empty at every opening");
  const field = await p.page.$eval("#live-key", (k) => ({ form: !!k.closest("form"), ac: k.getAttribute("autocomplete"), sp: k.getAttribute("spellcheck"), op: k.hasAttribute("data-1p-ignore"), lp: k.getAttribute("data-lpignore"), type: k.type }));
  check(!field.form && field.ac === "off" && field.sp === "false" && field.op && field.lp === "true" && field.type === "password", "the key field is a password field in no form, with autocomplete and spellcheck off and the password managers' ignore marks");
  // The warning: none for the fictional company's clean SWOT.
  check(await p.page.$eval("#live-warning", (w) => w.hidden), "no private-data warning for a clean SWOT");
  await p.page.fill("#live-key", MOCK_KEY);
  await p.page.check("#live-ack");
  await p.page.click("#live-start");
  await until(p.page, ["check"]);
  const dom = await p.page.evaluate(() => document.documentElement.outerHTML + [...document.querySelectorAll("input")].map((i) => i.value).join(" "));
  check(!dom.includes(MOCK_KEY) && (await p.page.$eval("#live-key", (k) => k.value)) === "", "after the start the key is in no element and no field of the page");
  await closePage(p, "dialog");

  // Planted private data in the form: each found and named with its field; clean texts left alone.
  {
    const q = await livePage({ script: () => null });
    await q.page.click("#btn-live");
    await q.page.waitForSelector("#live-name");
    await q.page.fill("#live-name", "Beispiel GmbH");
    await q.page.fill("#live-line", "Call 030 1234567 for the plan");
    // The address is put together here, so no file of the repository carries one (tests/hygiene.mjs).
    const address = ["anna.berg", "example.com"].join("@");
    for (const [quad, value] of [["strengths", `Contact ${address}`], ["weaknesses", "IBAN DE89 3704 0044 0532 0130 00"], ["threats", "Strictly confidential: pricing"], ["opportunities", "Internal processes are slow"]]) {
      await q.page.fill(`#add-${quad}`, value);
      await q.page.press(`#add-${quad}`, "Enter");
    }
    await q.page.click("#btn-cta");
    await q.page.waitForSelector("#live-dialog[open]");
    const items = await q.page.$$eval("#live-warning-list li", (li) => li.map((x) => x.textContent));
    const where = (q) => T("en", "d.warn.in.quadrant", { quadrant: q });
    const want = [T("en", "d.warn.email", { where: where("Strengths") }), T("en", "d.warn.iban", { where: where("Weaknesses") }), T("en", "d.warn.label", { where: where("Threats") }), T("en", "d.warn.phone", { where: EN["d.warn.in.description"] })];
    check(!(await q.page.$eval("#live-warning", (w) => w.hidden)) && want.every((w) => items.includes(w)) && items.length === 4, `the warning lists the e-mail address, the IBAN, the classification and the phone number with their fields, and not "Internal processes are slow" (${items.length} found)`);
    await q.page.fill("#live-key", MOCK_KEY);
    await q.page.check("#live-ack");
    check(!(await q.page.$eval("#live-start", (b) => b.disabled)), "it warns and does not block");
    await q.page.click("#live-warning-edit");
    await q.page.waitForTimeout(100);
    check(!(await q.page.$("#live-dialog[open]")) && (await q.page.evaluate(() => document.activeElement?.id)) === "live-line", "Edit the SWOT closes the dialog and goes to the first finding, the line about the company");
    await closePage(q, "warning");
  }
  check(privateKinds("Intern hires grow").length === 0 && privateKinds("interne Prozesse sind langsam").length === 0 && privateKinds("Nur intern: Zahlen").includes("label"), "an internal factor is no classification; a label is");

  // Inside another site's frame the dialog refuses to work.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort("blockedbyclient"));
    const host = await ctx.newPage();
    await host.route("**/frame-host.html", (r) => r.fulfill({ status: 200, headers: { "content-type": "text/html" }, body: `<!doctype html><title>host</title><iframe src="/${BASE.split("/").pop()}" width="1280" height="700"></iframe>` }));
    await host.goto(`${server.base}frame-host.html`);
    const frame = host.frames().find((f) => f !== host.mainFrame());
    await frame.waitForSelector('html[data-boot="ready"]', { state: "attached" });
    await frame.click("#btn-live");
    await frame.fill("#live-name", "Framed Example Ltd");
    await frame.click("#btn-cta");
    await frame.waitForSelector("#live-dialog[open]");
    const refused = await frame.evaluate(() => !document.getElementById("live-frame").hidden && document.getElementById("live-start").disabled && document.getElementById("live-key").disabled);
    check(refused, "inside another site's frame the dialog says so and its fields and start button stay disabled");
    await ctx.close();
  }
}

// ---- AC-12 ---------------------------------------------------------------------------------------------
async function ac12() {
  const urls = SCEN.s2.sources.map((s) => s.url);
  const [A, B] = urls;
  const FAKE = "https://example.org/remembered-not-searched";
  const signal = (url) => ({ title: "A recent source", summary: "It changed. It matters here.", url, published: "2026-10-01", quadrants: ["threats"] });
  // pause_turn, then a submission with one URL found and one not, then the round after the refusal.
  {
    const a = answers("s2", "en", { evidence: [A] });
    const scout = (n, req) => {
      const k = req.messages.length;
      if (k === 1) return { blocks: search("Arvento Drives news", [{ url: A, title: "Source A" }]), stop: "pause_turn", usage: { input_tokens: 4000, output_tokens: 300, web_search_requests: 1 } };
      if (k === 2) return { blocks: [...search("drive data rules", [{ url: B, title: "Source B" }]), tool("submit_signals", { signals: [signal(A), signal(FAKE)] })], stop: "tool_use", usage: { input_tokens: 6000, output_tokens: 500, web_search_requests: 1 } };
      return { blocks: [tool("submit_signals", { signals: [signal(A)] })], stop: "tool_use", usage: { input_tokens: 7000, output_tokens: 300 } };
    };
    const p = await livePage({ script: scripted(a, { scout }) });
    await toDialog(p.page);
    await startRun(p.page, { research: true });
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    const s = await until(p.page, ["decide", "stopped"]);
    const scoutReqs = p.fake.requests.filter((r) => r.step === "research");
    const refusal = toolResults(scoutReqs[2]?.req || {})[0];
    check(scoutReqs.length === 3, `three Scout requests: the first, the resend after pause_turn and one round after the refusal (${scoutReqs.length})`);
    check(refusal?.is_error === true && refusal.content.includes(FAKE) && !refusal.content.includes(A), "the URL the searches did not return is refused with is_error, by name");
    const challengeInput = JSON.parse(p.fake.requests.find((r) => r.step === "challenge").req.messages[0].content);
    check(s.live.status === "decide" && challengeInput.signals.length === 1 && challengeInput.signals[0].url === A, "the Red team gets only the accepted signal");
    await p.page.click('.vc-step[data-step="challenge"] .vc-step__button');
    check((await text(p.page, ".research-note")).includes(T("en", "r.found.one", { n: 1 })), "Challenge says what research found");
    await closePage(p, "research");
  }
  // A Scout that keeps pausing stops at three requests, and the run goes on without signals.
  {
    const scout = () => ({ blocks: search("more news", [{ url: A, title: "Source A" }]), stop: "pause_turn", usage: { input_tokens: 4000, output_tokens: 200, web_search_requests: 1 } });
    const p = await livePage({ script: scripted(answers("s2", "en"), { scout }) });
    await toDialog(p.page);
    await startRun(p.page, { research: true });
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    const s = await until(p.page, ["decide", "stopped"]);
    check(p.fake.requests.filter((r) => r.step === "research").length === 3 && s.live.status === "decide", "a Scout that keeps pausing gets no fourth request, and the run goes on");
    await closePage(p, "three requests");
  }
  // Web search switched off for the organisation: the run goes on and says so.
  for (const lang of ["en", "de"]) {
    const off = { error: { status: 400, type: "invalid_request_error", message: "Web search is disabled for this organization." } };
    const p = await livePage({ lang, script: scripted(answers("s2", lang), { fault: (n, req, step) => (step === "research" ? off : null) }) });
    await toDialog(p.page);
    await startRun(p.page, { research: true });
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    const s = await until(p.page, ["decide", "stopped"]);
    await p.page.click('.vc-step[data-step="challenge"] .vc-step__button');
    check(s.live.status === "decide" && (await text(p.page, ".research-note")).includes(DICT[lang]["r.off"]), `${lang}: with web search switched off the run goes on, and Challenge says so`);
    await closePage(p, `${lang} search off`);
  }
}

// ---- AC-18 ---------------------------------------------------------------------------------------------
async function ac18() {
  const base = answers("s2", "en");
  // The AI items as the Completer returns them: s4, o3, t3, t4. The person removes o3, undoes it, removes
  // t3 and edits t4.
  const a = answers("s2", "en", { removed: ["t3"] });
  const p = await livePage({ script: scripted(a) });
  await toDialog(p.page);
  await startRun(p.page);
  await until(p.page, ["check"]);
  const cards = await p.page.$$eval(".ai-item", (els) => els.map((e) => ({ id: e.dataset.id, ai: e.querySelector(".ai-item__head .vc-tag")?.textContent.trim(), basis: e.querySelector(".ai-item__basis")?.textContent, conf: e.querySelector(".ai-item__conf")?.textContent })));
  check(cards.length === base.complete.items.length && cards.every((c) => c.ai === "AI" && /^Basis: .+/.test(c.basis) && /^Confidence: (high|medium|low)$/.test(c.conf)), `each of the ${cards.length} AI items says AI, what it rests on and how sure it is`);
  const gridAi = await p.page.$$eval('.swot .vc-item[data-source="ai"]', (els) => els.map((e) => e.querySelector(".vc-item__state--source")?.textContent.trim()));
  check(gridAi.length === cards.length && gridAi.every((x) => x === "AI"), "in the grid too, every AI item carries the word AI");
  check((await text(p.page, ".check-public")) === "Public information only: never enter confidential, personal or otherwise protected data.", "where the person can edit the AI's items, the panel says: public information only");
  // An edit goes to the agents that follow: it gets the Start form's look for private data, as a warning.
  await p.page.click("#edit-s4");
  // The address is put together here, so no file of the repository carries one (tests/hygiene.mjs).
  await p.page.fill("#edit-input-s4", `Service desk at ${["service", "arvento.example"].join("@")} answers within the hour`);
  await p.page.press("#edit-input-s4", "Enter");
  const warn = await text(p.page, "#warn-s4");
  check(warn === "Usually private: an e-mail address in your edit. Edit it again, or keep it only if it is public.", `an edit with an e-mail address gets a warning under the item ("${warn}")`);
  await p.page.click("#edit-s4");
  await p.page.press("#edit-input-s4", "Escape");
  check(!!(await p.page.$("#warn-s4")), "Cancel keeps the warning while the edit stays");
  await p.page.click("#edit-s4");
  await p.page.fill("#edit-input-s4", base.complete.items.find((i) => i.quadrant === "strengths").text);
  await p.page.press("#edit-input-s4", "Enter");
  check(!(await p.page.$("#warn-s4")) && !(await p.page.$('.ai-item[data-id="s4"] .check__edited')), "back to the AI's words, the warning and the edit are gone");
  await p.page.click("#remove-o3");
  check(await p.page.$('.swot .vc-item[data-id="o3"][data-status="removed"]') && (await text(p.page, ".check-count")).includes("3 kept, 1 removed"), "Remove strikes the item through, marked Removed");
  await p.page.click("#undo-o3");
  check(!(await p.page.$('.swot .vc-item[data-status="removed"]')), "Undo brings it back");
  await p.page.click("#remove-t3");
  await p.page.click("#edit-t4");
  await p.page.fill("#edit-input-t4", "Security reporting duties for drives with software");
  await p.page.press("#edit-input-t4", "Enter");
  check((await text(p.page, '.swot .vc-item[data-id="t4"] .vc-item__text')) === "Security reporting duties for drives with software", "an edited item shows the person's words in the grid");
  await p.page.click("#btn-cta");
  const s = await until(p.page, ["decide", "stopped"]);
  const input = JSON.parse(p.fake.requests.find((r) => r.step === "challenge").req.messages[0].content);
  const sent = new Map(input.swot.map((i) => [i.id, i]));
  const mine = Object.entries(SCEN.s2.entered).flatMap(([q, l]) => l.map((i) => ({ id: i.id, text: i.text.en })));
  check(mine.every((i) => sent.get(i.id)?.text === i.text && sent.get(i.id).by === "person"), "the challenge gets every item the person entered, unchanged");
  check(!sent.has("t3") && sent.get("t4")?.text === "Security reporting duties for drives with software" && sent.has("o3") && sent.has("s4"), "and the AI's items as the person left them: t3 removed, t4 edited, o3 and s4 kept");
  check(s.live.status === "decide", "the run goes on with that SWOT");
  await closePage(p, "check");
  // The last item of a side stays at the check: the factor tables need one inside and one outside the
  // company (review finding 12). The person enters nothing outside; the Completer adds three items to each
  // external field; removing them all keeps the last, with a sentence that says why.
  {
    const a = answers("s2", "en");
    const extra = (quadrant, texts) => texts.map((text) => ({ quadrant, text, basis: "Assumption: a test item", confidence: "low" }));
    a.complete = { ...a.complete, items: [a.complete.items[0], ...extra("opportunities", ["Export to Nordic food plants", "Retrofit kits for older lines", "Leasing for small machine builders"]), ...extra("threats", ["Steel prices swing with tariffs", "A rival buys a sensor maker", "Customers delay new lines"])] };
    const q = await livePage({ script: scripted(a) });
    await q.page.click("#btn-live");
    await q.page.selectOption("#live-fill", "s2");
    await q.page.click("#live-fill-go");
    await q.page.waitForFunction(() => document.getElementById("live-name")?.value);
    for (const quad of ["opportunities", "threats"]) {
      while (await q.page.$(`.vc-framework__area[data-quad="${quad}"] .live-item__remove`)) await q.page.click(`.vc-framework__area[data-quad="${quad}"] .live-item__remove`);
    }
    await q.page.click("#btn-cta");
    await q.page.waitForSelector("#live-dialog[open]");
    await startRun(q.page);
    await until(q.page, ["check", "stopped"]);
    const external = await q.page.$$eval(".ai-item", (els) => els.filter((e) => /Opportunit|Threat/.test(e.querySelector(".ai-item__quad")?.textContent || "")).map((e) => e.dataset.id));
    for (const id of external) await q.page.click(`#remove-${id}`);
    const last = external[external.length - 1];
    const note = await text(q.page, `#keep-${last}`);
    const removed = await q.page.$$eval(".ai-item.is-removed", (els) => els.map((e) => e.dataset.id));
    check(external.length === 6 && removed.length === 5 && !removed.includes(last) && note === "This is the last item outside the company, so it stays: the factor tables need one item on each side.", `removing every item outside the company keeps the last one with a sentence (${removed.length} of ${external.length} removed; "${note}")`);
    await closePage(q, "last item of a side");
  }
  // A Completer that repeats a person's item is refused and repaired; it never changes one.
  {
    const bad = clone(base.complete);
    bad.items.push({ quadrant: "strengths", text: SCEN.s2.entered.strengths[0].text.en, basis: "Assumption: the team says so", confidence: "low" });
    const q = await livePage({ script: scripted(base, { fault: (n) => (n === 1 ? { blocks: [json(bad)], stop: "end_turn" } : null) }) });
    await toDialog(q.page);
    await startRun(q.page);
    await until(q.page, ["check", "stopped"]);
    check(q.fake.requests.length === 2 && /repeats an item the person entered/.test(q.fake.requests[1].req.messages[0].content), "a Completer that repeats the person's item is refused and asked once more");
    await closePage(q, "repeat");
  }
}

// ---- AC-19 ---------------------------------------------------------------------------------------------
async function ac19() {
  for (const lang of ["en", "de"]) {
    const a = answers("s2", lang);
    const bad = { issues: [{ ...clone(a.challenge.issues[1]), items: ["s9"] }] };
    const p = await livePage({ lang, script: scripted(a, { fault: (n, req, step) => (step === "challenge" ? { blocks: [json(bad)], stop: "end_turn" } : null) }) });
    await toDialog(p.page);
    await startRun(p.page);
    await until(p.page, ["check"]);
    await p.page.click("#btn-cta");
    const s = await until(p.page, ["stopped"]);
    const challenges = p.fake.requests.filter((r) => r.step === "challenge");
    check(challenges.length === 2 && /names s9, which is not an item/.test(challenges[1].req.messages[0].content), `${lang}: the failing answer gets one repair that names its problem`);
    const words = await story(p.page);
    check(s.live.stop?.reason === "invalid" && words.includes(DICT[lang]["x.invalid.title"]) && words.includes(DICT[lang]["x.thorough"]) && words.includes(DICT[lang]["p.live.again.sim"]), `${lang}: the second failure stops the run and offers Thorough or a simulation`);
    await p.page.click('.vc-step[data-step="complete"] .vc-step__button');
    check((await p.page.$$(".ai-item")).length === 4, `${lang}: what is done stays: the Completer's items`);
    await closePage(p, `${lang} repair fails`);
  }
}

// ---- AC-02 ---------------------------------------------------------------------------------------------
async function ac02() {
  const urls = SCEN.s2.sources.map((s) => s.url);
  const a = answers("s2", "en", { evidence: urls });
  const scout = () => ({ blocks: [...search("news", urls.map((url) => ({ url, title: "Source" }))), tool("submit_signals", { signals: urls.map((url) => ({ title: "A recent source", summary: "It matters. It is recent.", url, published: "", quadrants: ["threats"] })) })], stop: "tool_use", usage: { input_tokens: 9000, output_tokens: 700, web_search_requests: 2 } });
  const p = await livePage({ script: scripted(a, { scout, think: true }) });
  await wholeRun(p.page, { research: true });
  const [download] = await Promise.all([p.page.waitForEvent("download"), p.page.click("#btn-save-run")]);
  const file = await readFile(await download.path(), "utf8");
  const stored = await p.page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    idb: (await indexedDB.databases?.())?.map((d) => d.name) || [],
    caches: await caches.keys(),
    cookie: document.cookie,
    href: location.href,
    dom: document.documentElement.outerHTML + [...document.querySelectorAll("input, textarea")].map((i) => i.value).join(" ")
  }));
  check(stored.local.every((k) => ["vc-theme", "swot.lang"].includes(k)) && stored.session.every((k) => k.startsWith("vc-guide")), `storage holds only the theme, the language and the guide's note (${[...stored.local, ...stored.session].join(", ") || "nothing"})`);
  check(!stored.idb.length && !stored.caches.length && stored.cookie === "", "IndexedDB, the Cache API and cookies are empty");
  check(!file.includes(MOCK_KEY) && !/sk-ant-/.test(file), "the key is in no download");
  check(!stored.href.includes(MOCK_KEY) && !/scenario=|company|Arvento/.test(new URL(stored.href).search), `the address carries nothing of the run (${new URL(stored.href).search})`);
  check(!stored.dom.includes(MOCK_KEY), "the key is in no element");
  check(!p.consoles.some((m) => m.includes(MOCK_KEY)), "the key is in no console message");
  check(p.fake.requests.every((r) => !JSON.stringify(r.req).includes(MOCK_KEY) && r.headers["x-api-key"] === MOCK_KEY), "the key travels only in the x-api-key header to api.anthropic.com");
  // Clear everything asks first, then forgets the key and the run and goes back to the simulation.
  await p.page.click("#btn-clear");
  await p.page.waitForSelector("#clear-dialog[open]");
  await p.page.click("#clear-confirm");
  const after = await state(p.page);
  await p.page.click("#btn-live-bar");
  await p.page.waitForSelector("#live-name");
  const form = await p.page.$eval("#live-name", (n) => n.value);
  await p.page.fill("#live-name", "Another Example Ltd");
  await p.page.click("#btn-cta");
  await p.page.waitForSelector("#live-dialog[open]");
  const held = await p.page.$eval("#live-key-current", (c) => !c.hidden);
  check(after.mode === "simulation" && after.live === null && form === "" && !held, "Clear everything, once confirmed, forgets the key, the form and the run and goes back to the simulation");
  await closePage(p, "nothing kept");
  // Clear everything while a request runs: the request ends later and changes nothing, without an error
  // (review finding 14).
  {
    let release = null;
    const held = new Promise((r) => { release = r; });
    const q = await livePage({ script: scripted(answers("s2", "en")), hold: (n) => (n === 1 ? held : null) });
    await toDialog(q.page);
    await startRun(q.page);
    await until(q.page, ["working"]);
    await q.page.click("#btn-clear");
    await q.page.waitForSelector("#clear-dialog[open]");
    await q.page.click("#clear-confirm");
    release();
    await q.page.waitForTimeout(600);
    const s = await state(q.page);
    check(s.mode === "simulation" && s.live === null, `Clear everything while the Completer works ends the run; its late answer changes nothing (${s.mode}, ${JSON.stringify(s.live)})`);
    await closePage(q, "clear while a request runs");
  }
}

// ---- SCREENS -------------------------------------------------------------------------------------------
async function screens() {
  for (const lang of ["en", "de"]) {
    const L = DICT[lang];
    // The empty field and the wait.
    {
      let release = null;
      const held = new Promise((r) => { release = r; });
      const p = await livePage({ lang, script: scripted(answers("s2", lang)), hold: (n) => (n === 1 ? held : null) });
      await p.page.click("#btn-live");
      await p.page.waitForSelector("#live-name");
      const empty = await p.page.$$eval(".swot--form .vc-framework__area", (areas) => areas.map((a) => ({ q: a.querySelector(".vc-framework__question")?.textContent, e: a.querySelector(".vc-framework__empty")?.textContent })));
      check(empty.length === 4 && empty.every((x) => x.q && x.e === L["q.live.empty"]), `${lang}: each empty field shows its question and "${L["q.live.empty"]}"`);
      await p.page.selectOption("#live-fill", "s2");
      await p.page.click("#live-fill-go");
      await p.page.waitForFunction(() => document.getElementById("live-name")?.value);
      await p.page.click("#btn-cta");
      await p.page.waitForSelector("#live-dialog[open]");
      await startRun(p.page);
      await until(p.page, ["working"]);
      await p.page.waitForSelector("#btn-abort");
      await p.page.waitForTimeout(1100);
      const title = await text(p.page, "#step-title");
      const lead = await text(p.page, "#step-lead");
      const secs = await text(p.page, "#wait-seconds");
      const cost = await text(p.page, "#wait-cost");
      const tiles = await p.page.$$eval(".kpi .kpi-note", (n) => n.map((x) => x.textContent));
      check(title === T(lang, "w.title", { agent: L["w.agent.complete"] }) && lead === L["w.doing.complete"] && /^\d+ s$/.test(secs) && Number(secs.split(" ")[0]) >= 1 && cost.length > 0 && (await text(p.page, "#btn-abort")).includes(L["w.abort"]), `${lang}: while the Completer works, its step names it, what it does, the seconds (${secs}), the cost against the cap (${cost}) and Abort`);
      check(tiles.includes(L["p.kpi.wait.red"]) && tiles.filter((x) => x === L["p.kpi.wait.analyst"]).length === 2, `${lang}: the tiles say what they wait for`);
      release();
      await until(p.page, ["check"]);
      await closePage(p, `${lang} wait`);
    }
    // Research: nothing found, every URL refused.
    for (const [kind, scout] of [["none", () => ({ blocks: [tool("submit_signals", { signals: [] })], stop: "tool_use" })], ["refused", () => ({ blocks: [tool("submit_signals", { signals: [{ title: "Made up", summary: "Not found. Not real.", url: "https://example.org/x", published: "", quadrants: ["threats"] }] })], stop: "tool_use" })]]) {
      const p = await livePage({ lang, script: scripted(answers("s2", lang), { scout }) });
      await toDialog(p.page);
      await startRun(p.page, { research: true });
      await until(p.page, ["check"]);
      await p.page.click("#btn-cta");
      await until(p.page, ["decide", "stopped"]);
      await p.page.click('.vc-step[data-step="challenge"] .vc-step__button');
      check((await text(p.page, ".research-note")).includes(L[`r.${kind}`]), `${lang}: research ${kind === "none" ? "that found nothing" : "whose every URL was refused"} says "${L[`r.${kind}`]}"`);
      await closePage(p, `${lang} research ${kind}`);
    }
    // A summary that fails the figure check twice shows unchecked.
    {
      const a = answers("s2", lang);
      const bad = { ...clone(a.summary), situation: lang === "de" ? "Es stehen 4,9 Millionen Euro auf dem Spiel." : "The issues put 4.9 million euros at stake." };
      const p = await livePage({ lang, script: scripted(a, { fault: (n, req, step) => (step === "summary" ? { blocks: [json(bad)], stop: "end_turn" } : null) }) });
      const s = await wholeRun(p.page);
      const words = await story(p.page);
      check(s.live.status === "done" && words.includes(L["s.sum.unchecked"]) && words.includes(L["s.sum.unchecked.text"]), `${lang}: a summary that fails the figure check twice shows with "${L["s.sum.unchecked"]}" and why`);
      await closePage(p, `${lang} unchecked`);
    }
  }
}

// ---- SAVE ----------------------------------------------------------------------------------------------
async function save() {
  for (const lang of ["en", "de"]) {
    const p = await livePage({ lang, script: scripted(answers("s2", lang), { think: true }) });
    await wholeRun(p.page);
    // A new choice after the summary: Adopt takes it without another request and opens the Summary with its
    // figures; the saved run holds it (review finding 8).
    {
      const sent = p.fake.requests.length;
      const first = (await state(p.page)).adopted;
      await p.page.click("#btn-back");
      await p.page.waitForFunction(() => window.__swot.state().step === 4);
      await p.page.click(".tows-card input[type=checkbox]:not(:checked)");
      await p.page.click("#btn-cta");
      await p.page.waitForFunction(() => window.__swot.state().step === 5, null, { timeout: 5000 }).catch(() => {});
      const s = await state(p.page);
      check(s.step === 5 && s.adopted.length === first.length + 1 && s.live.status === "done" && p.fake.requests.length === sent, `${lang}: after the summary, Adopt takes a new choice (${first.join(", ")} to ${s.adopted.join(", ")}) without another request and opens the Summary`);
    }
    const chosenNow = (await state(p.page)).adopted;
    // The Writer is not told the choice, so its text holds for the new one too (review, new problem A).
    const writer = p.fake.requests.find((r) => r.step === "summary")?.req;
    const writerInput = writer ? JSON.parse(writer.messages[0].content) : null;
    check(writerInput && writerInput.strategies.length > 0 && writerInput.strategies.every((s) => !("chosen" in s)) && /say neither which nor how many strategies are chosen/.test(JSON.stringify(writer.system)), `${lang}: the Writer sees the strategies without the choice and is told to write for any choice`);
    const followers = ["left", "upside", "ife.after", "efe.after", "zone.after"];
    check(writerInput && followers.every((k) => writerInput.facts[k] === "follows the choice") && writerInput.facts.at_stake && writerInput.facts.at_stake !== "follows the choice", `${lang}: the facts that follow the choice reach the Writer without their values; the others with theirs (at stake ${writerInput?.facts.at_stake})`);
    check(await p.page.$("#btn-save-run") && (await text(p.page, "#btn-save-run")).includes(DICT[lang]["s.sum.save"]), `${lang}: the Summary of a live run offers "${DICT[lang]["s.sum.save"]}"`);
    const [download] = await Promise.all([p.page.waitForEvent("download"), p.page.click("#btn-save-run")]);
    const file = await readFile(await download.path(), "utf8");
    const rec = JSON.parse(file);
    const problems = scenarioProblems(rec, { today: new Date().toISOString().slice(0, 10) });
    check(/^swot-run-arvento-drives-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()) && !problems.length && rec.language === lang && rec.source === "live", `${lang}: ${download.suggestedFilename()} holds the run in the scenario format, which the scenario rules accept for ${lang}${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
    check(!/sk-ant-/.test(file) && !/"type"\s*:\s*"thinking"|"signature"/.test(file) && rec.run.requests === 5 && rec.run.audit.length === 5, `${lang}: without key or thinking, with each request's usage for the log`);
    check([...rec.recorded_choice].sort().join() === [...chosenNow].sort().join() && [...rec.decision.chosen].sort().join() === [...chosenNow].sort().join(), `${lang}: the saved run holds the new choice (${rec.recorded_choice.join(", ")})`);
    await closePage(p, `${lang} save`);

    // The player plays the saved run, as data/scenarios/ would hold it.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort("blockedbyclient"));
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/data/scenarios/index.js", async (route) => {
      const body = (await readFile(path.join(APP_ROOT, "data/scenarios/index.js"), "utf8")).replace(`{ id: "s3", name: "Auental Energie", load: () => import("./s3.js") }`, `{ id: "s3", name: "Auental Energie", load: () => import("./s3.js") },\n  { id: "live", name: "${rec.company.name}", load: () => import("./saved-run.js") }`);
      route.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body });
    });
    await page.route("**/data/scenarios/saved-run.js", (route) => route.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: `export default ${file};` }));
    await page.goto(`${BASE}&lang=${lang}&scenario=live&step=5`);
    await page.waitForSelector('html[data-boot="ready"]');
    const head = await text(page, ".summary__headline");
    const run = assemble(rec, lang);
    const f = figuresFor(run, rec.recorded_choice);
    const st = await page.evaluate(() => window.__swot.state());
    check(st.id === "live" && st.step === 5 && head === rec.answers[lang].summary.headline && !errors.length, `${lang}: the player opens the saved run at its Summary, with the Writer's headline`);
    const efe = await text(page, "#kpi-efe .kpi-main");
    check(efe === f.efe.after.value.toFixed(2).replace(".", lang === "de" ? "," : "."), `${lang}: and the engine's figures for the recorded choice (response to the market ${efe})`);
    await ctx.close();
  }
  await keyTyped();
}

// A key typed into the form by mistake: the warning names it, and no download carries it (review finding 11).
async function keyTyped() {
  const key = ["sk-ant-api03", "TYPEDBYMISTAKE0123456789"].join("-");
  const p = await livePage({ script: scripted(answers("s2", "en")) });
  await p.page.click("#btn-live");
  await p.page.selectOption("#live-fill", "s2");
  await p.page.click("#live-fill-go");
  await p.page.waitForFunction(() => document.getElementById("live-name")?.value);
  await p.page.fill("#live-line", `Drives and gearboxes, key ${key}`);
  await p.page.fill("#item-strengths-0", `Quality, key ${key}`);
  await p.page.click("#btn-cta");
  await p.page.waitForSelector("#live-dialog[open]");
  const items = await p.page.$$eval("#live-warning-list li", (li) => li.map((x) => x.textContent));
  check(items.includes(T("en", "d.warn.key", { where: EN["d.warn.in.description"] })) && items.includes(T("en", "d.warn.key", { where: T("en", "d.warn.in.quadrant", { quadrant: "Strengths" }) })), `a key typed into the line about the company and into a strength is in the warning (${items.join("; ")})`);
  await startRun(p.page);
  await until(p.page, ["check"]);
  await p.page.click("#btn-cta");
  await until(p.page, ["decide"]);
  await p.page.click("#btn-cta");
  await until(p.page, ["done"]);
  const [download] = await Promise.all([p.page.waitForEvent("download"), p.page.click("#btn-save-run")]);
  const file = await readFile(await download.path(), "utf8");
  await p.page.click("#rp-open");
  await p.page.waitForSelector("#report-dialog[open]");
  const report = await text(p.page, "#report");
  check(!file.includes(key) && file.includes("sk-ant-[REDACTED]") && !report.includes(key) && report.includes("sk-ant-[REDACTED]"), "the saved run and the report show it redacted, so the PDF and the HTML file carry none");
  await closePage(p, "key typed");
}

// ---- run ------------------------------------------------------------------------------------------------
const FN = { ac08, ac09, ac10, ac11, ac12, ac18, ac19, ac02, screens, save };
let failedGroups = 0;
try {
  for (const g of run) {
    group = g;
    try { await FN[g](); } catch (e) { check(false, `${g} threw: ${e.message.split("\n")[0]}`); }
    for (const [ok, what] of results[g]) console.log(`${ok ? "PASS" : "FAIL"}  ${g}: ${what}`);
    const failed = results[g].filter(([ok]) => !ok).length;
    if (failed || !results[g].length) { failedGroups += 1; console.log(`${g}: ${failed} checks failed`); } else console.log(LINES[g]);
  }
} finally {
  await server.close();
  await browser.close();
}
if (failedGroups) process.exit(1);
console.log("LIVE OK");

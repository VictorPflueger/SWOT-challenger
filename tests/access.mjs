// Accessibility in Chromium, as AC-14 asks (PLAN.md, section 9, M5). No test calls the real API: the live
// runs answer from the scripted stand-in (tests/lib/fake-claude.mjs), and every other host is blocked.
//   keyboard  the keyboard alone completes a run, in English and German. The simulation runs from the
//             guide, as it opens on a first visit, through the five steps to the report, where Save as
//             PDF prints. The live run runs from Run it live through the Start form and the live-run
//             dialog to the Summary. Every element Tab reaches shows Vici's focus ring (its outline, or
//             the hexagon Vici draws around an icon button), and the focus never lands on something
//             hidden, off the screen or clipped away. With the focus rings taken out of the page's
//             styles (tests/fixtures/no-focus-ring.css), the same check fails on every stop.  KEYBOARD OK
//   motion    with reduced motion asked for, nothing moves but Vici's spinner, which keeps a slow sweep
//             as the only cue that work goes on (Vici's rule; TECH_NOTES, 13). No other CSS animation
//             or transition runs longer than an instant: on the steps Play walks, at the decision that
//             moves the tiles, while the guide, the Method dialog and the report dialog open, and in the
//             live run's wait. Play still moves from step to step. Without reduced motion, the same
//             probe finds the dialogs, the tiles and the spinner moving at full speed.       MOTION OK
// Usage: node tests/access.mjs [keyboard] [motion]   (both when none is named)
import { APP_ROOT, launchBrowser, serveStatic, NETWORK_NOISE, MOCK_KEY, wanted } from "./lib/harness.mjs";
import { createFakeClaude, CORS, MODELS_LIST } from "./lib/fake-claude.mjs";
import { openLivePage, closeLivePage, scripted, answers, until, SCEN } from "./lib/live-page.mjs";

const results = [];
const check = (group, ok, what) => results.push([group, !!ok, what]);
const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 9600 + Math.floor(Math.random() * 300));
const VIEW = { width: 1280, height: 720 };
const LANGS = ["en", "de"];
const state = (page) => page.evaluate(() => window.__swot.state());

/**
 * Waits until every finite animation on the page has run its time, so a measure sees where things come to
 * rest. Headless Chromium can leave an ended animation "running" until the next frame, so the wait reads the
 * clock rather than the animation's promise.
 */
const settle = (page, ms = 1500) => page.evaluate((limit) => new Promise((ok) => {
  const t0 = performance.now();
  const done = () => document.getAnimations().every((a) => {
    const t = a.effect?.getComputedTiming();
    // A pulse that draws the eye (Vici's vc-attention, 4.2 s of shadow) moves nothing: it is not waited for.
    return !t || !Number.isFinite(t.endTime) || t.endTime > 1500 || a.playState !== "running" || (a.currentTime ?? 0) >= t.endTime - 1;
  });
  const poll = () => (done() || performance.now() - t0 > limit ? ok() : setTimeout(poll, 30));
  poll();
}), ms);

/** A new page whose requests to other hosts are blocked; it records page errors. */
async function newPage(options = {}) {
  const context = await browser.newContext({ viewport: VIEW, ...options });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort("blockedbyclient"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(`console: ${m.text()}`); });
  return { context, page, errors };
}

// ---- keyboard ------------------------------------------------------------------------------------------

/**
 * What the focused element shows, measured in the page: its name, whether it is hidden, off the screen or
 * clipped away, and its focus ring. match: whether it is the element the walk is looking for.
 */
function focusStop(selector) {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { none: true, name: "nothing", match: false };
  const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") || el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  let hidden = null;
  if (el.closest("dialog:not([open]), [hidden], [inert], .vc-visually-hidden")) hidden = "inside something hidden";
  else if (cs.visibility === "hidden" || cs.display === "none") hidden = "not shown";
  else if (r.width < 1 || r.height < 1) hidden = "without a size";
  else if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) hidden = "off the screen";
  for (let d = el.closest("details:not([open])"); d && !hidden; d = d.parentElement?.closest("details:not([open])")) {
    const summary = d.querySelector(":scope > summary");
    if (!summary || !summary.contains(el)) hidden = "inside a closed details";
  }
  for (let p = el.parentElement; p && !hidden; p = p.parentElement) {
    const ps = getComputedStyle(p);
    if (!/hidden|clip|auto|scroll/.test(`${ps.overflowX} ${ps.overflowY}`)) continue;
    const q = p.getBoundingClientRect();
    if (Math.min(r.right, q.right) - Math.max(r.left, q.left) < 2 || Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) < 2) hidden = "clipped away by its container";
  }
  // Not behind the bar that sticks to the story's foot (WCAG 2.2, 2.4.11).
  const bar = document.getElementById("step-bar");
  if (!hidden && bar && !bar.contains(el) && !el.closest("dialog")) {
    const b = bar.getBoundingClientRect();
    if (b.height && r.top >= b.top && r.bottom <= b.bottom && r.left >= b.left && r.right <= b.right) hidden = "behind the bar under the story";
  }
  // The ring: Vici's outline, a shadow in the focus colour, or the hexagon Vici draws in the focus colour.
  const solid = (c) => !!c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c);
  const probe = document.createElement("i");
  probe.style.color = cs.getPropertyValue("--vc-focus").trim() || "Highlight";
  document.body.append(probe);
  const focus = getComputedStyle(probe).color;
  probe.remove();
  const ringOn = (node) => {
    const s = getComputedStyle(node);
    if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 1 && solid(s.outlineColor)) return "outline";
    if (s.boxShadow !== "none" && s.boxShadow.includes(focus)) return "shadow";
    for (const pseudo of ["::after", "::before"]) {
      const p = getComputedStyle(node, pseudo);
      if (p.content !== "none" && parseFloat(p.opacity) > 0.9 && p.backgroundColor === focus) return "hexagon";
    }
    return null;
  };
  let ring = ringOn(el);
  if (!ring && el.matches('input[type="radio"]') && cs.backgroundColor === focus) ring = "hexagon";
  // A switch draws its ring around the whole control, on its label.
  const label = el.closest("label");
  if (!ring && label && ringOn(label)) ring = `${ringOn(label)} on its label`;
  const modal = document.querySelector("dialog[open]:modal");
  // A slider draws its ring on the thumb, whose style Chromium does not report: the walk compares pixels there.
  return { none: false, name, hidden, ring, slider: el.matches('input[type="range"]'), outside: !!modal && !modal.contains(el), match: !!selector && el.matches(selector) };
}

/**
 * Whether the focused slider shows a ring: its thumb, around the focus and without it, pixel for pixel.
 * The focus goes back to the slider afterwards.
 */
async function sliderRing(page) {
  const clip = await page.evaluate(() => {
    const r = document.activeElement.getBoundingClientRect();
    const x = Math.max(0, r.left - 6);
    const y = Math.max(0, r.top - 6);
    return { x, y, width: Math.min(innerWidth, r.right + 6) - x, height: Math.min(innerHeight, r.bottom + 6) - y };
  });
  const shot = () => page.screenshot({ clip, animations: "disabled", caret: "hide" });
  const focused = await shot();
  await page.evaluate(() => { window.__refocus = document.activeElement; window.__refocus.blur(); });
  const blurred = await shot();
  await page.evaluate(() => { window.__refocus.focus(); delete window.__refocus; });
  return !focused.equals(blurred);
}

/** Presses Tab until the focus is on `selector`, and keeps every stop on the way. */
async function tabTo(page, selector, stops, max = 160) {
  for (let i = 0; i <= max; i++) {
    if (i) await page.keyboard.press("Tab");
    await settle(page, 800);
    const s = await page.evaluate(focusStop, selector);
    if (i && s.slider && !s.ring && !s.hidden && (await sliderRing(page))) s.ring = "on the thumb";
    if (i) stops.push(s);
    if (s.match) return true;
  }
  return false;
}

/** The stops that break the rules: no ring, hidden, or outside the open modal dialog. Each element once. */
function faults(stops) {
  const out = new Map();
  for (const s of stops) {
    if (s.none) { out.set("nothing", "the focus left the page's elements"); continue; }
    if (!s.ring) out.set(`${s.name} ring`, `${s.name} shows no focus ring`);
    if (s.hidden) out.set(`${s.name} hidden`, `${s.name} has the focus while ${s.hidden}`);
    if (s.outside) out.set(`${s.name} outside`, `${s.name} has the focus outside the open dialog`);
  }
  return [...out.values()];
}

/** Waits until the bar's button is there and can be pressed. */
const ctaReady = (page) => page.waitForFunction(() => { const b = document.getElementById("btn-cta"); return !!b && !b.disabled && b.getClientRects().length > 0; }, null, { timeout: 40000 });

/** The simulation by keyboard: the guide on a first visit, the five steps, the report, Save as PDF. */
async function simulationByKeyboard(lang) {
  const { context, page, errors } = await newPage();
  const stops = [];
  const problems = [];
  const where = lang === "en" ? "English" : "German";
  await page.goto(`${server.base}?lang=${lang}&scenario=s2`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  // The guide opens by itself. Next through its chapters; at the last, the same button says Start and closes it.
  const guide = `#guide-${lang}`;
  await page.waitForSelector(`${guide}[open]`, { timeout: 10000 }).catch(() => problems.push("the guide did not open by itself"));
  let presses = 0;
  while (presses < 8 && (await page.evaluate((g) => document.querySelector(g).open, guide))) {
    if (!(await tabTo(page, `${guide} [data-vc-guide-next]`, stops, 30))) { problems.push("Tab never reached the guide's Next"); break; }
    await page.keyboard.press("Enter");
    presses += 1;
  }
  const closed = !(await page.evaluate((g) => document.querySelector(g).open, guide));
  // Start to Summary with the bar's button: Start the agents, Challenge this SWOT, on to Strategise, Adopt these strategies, the Summary.
  const steps = [(await state(page)).step];
  for (let n = 0; n < 10 && (await state(page)).step < 5; n++) {
    await ctaReady(page);
    const before = await state(page);
    if (!(await tabTo(page, "#btn-cta", stops))) { problems.push(`Tab never reached the bar's button at step ${before.step}`); break; }
    await page.keyboard.press("Enter");
    await page.waitForFunction((b) => { const s = window.__swot.state(); return s.step !== b.step || JSON.stringify(s.adopted) !== JSON.stringify(b.adopted); }, before, { timeout: 40000 }).catch(() => problems.push(`Enter on the bar's button at step ${before.step} changed nothing`));
    const after = await state(page);
    if (after.step !== steps[steps.length - 1]) steps.push(after.step);
  }
  const adopted = (await state(page)).adopted;
  // At the Summary the bar's button opens the report; Save as PDF opens the print dialog (stood in for).
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  await ctaReady(page);
  let printed = 0;
  if (await tabTo(page, "#btn-cta", stops)) {
    await page.keyboard.press("Enter");
    await page.waitForSelector("#report-dialog[open]", { timeout: 10000 }).catch(() => problems.push("Enter on Download the report opened no report"));
    if (await tabTo(page, "#rp-pdf-dialog", stops, 60)) {
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__printed > 0, null, { timeout: 5000 }).catch(() => {});
      printed = await page.evaluate(() => window.__printed);
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    } else problems.push("Tab never reached Save as PDF in the report");
    await page.keyboard.press("Escape");
  } else problems.push("Tab never reached Download the report");
  const reportClosed = await page.waitForFunction(() => !document.getElementById("report-dialog").open, null, { timeout: 5000 }).then(() => true, () => false);
  const all = [...problems, ...faults(stops), ...errors];
  check("keyboard", closed && presses >= 2 && steps.join(" ") === "0 1 2 3 4 5" && adopted?.length > 0 && printed === 1 && reportClosed && !all.length,
    `${where}, the simulation by keyboard: the guide by Next to Start (${presses} presses), the steps ${steps.join(" ")}, ${adopted?.length || 0} strategies adopted, the report, Save as PDF printed ${printed} time(s), Escape closed it; ${stops.length} stops, each with its ring and in view${all.length ? `:\n      ${all.slice(0, 12).join("\n      ")}` : ""}`);
  await context.close();
  return stops.length;
}

/** The live run by keyboard, against the stand-in: Run it live, the Start form, the dialog, the Summary. */
async function liveByKeyboard(lang) {
  const where = lang === "en" ? "English" : "German";
  const p = await openLivePage(browser, `${server.base}?guide=0&scenario=s2`, { script: scripted(answers("s2", lang)), lang, viewport: VIEW });
  const { page } = p;
  const stops = [];
  const problems = [];
  const name = SCEN.s2.company.name;
  try {
    if (!(await tabTo(page, "#btn-live-bar", stops))) throw new Error("Tab never reached Run it live");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#live-fill", { timeout: 10000 });
    // A fictional company fills the form. The arrow keys move through the picker without filling anything
    // or moving the focus (WCAG 2.2, 3.2.2); Fill in does it and keeps the focus.
    if (!(await tabTo(page, "#live-fill", stops, 60))) throw new Error("Tab never reached the picker of a fictional company");
    const target = (await page.$$eval("#live-fill option", (os) => os.map((o) => o.textContent))).indexOf(name);
    for (let i = 0; i < target; i++) await page.keyboard.press("ArrowDown");
    const browsed = await page.evaluate(() => ({ focus: document.activeElement?.id, name: document.getElementById("live-name")?.value, choice: document.getElementById("live-fill")?.selectedOptions[0]?.textContent }));
    if (browsed.focus !== "live-fill" || browsed.name || browsed.choice !== name) problems.push(`the arrow keys on the picker should only choose: the focus is on ${browsed.focus}, the name field holds "${browsed.name}", the picker shows ${browsed.choice}`);
    if (!(await tabTo(page, "#live-fill-go", stops, 4))) throw new Error("Tab never reached Fill in");
    await page.keyboard.press("Enter");
    await page.waitForFunction((n) => document.getElementById("live-name")?.value === n, name, { timeout: 5000 }).catch(() => problems.push(`Fill in did not fill the form with ${name}`));
    if ((await page.evaluate(() => document.activeElement?.id)) !== "live-fill-go") problems.push("after Fill in the focus left the button");
    await ctaReady(page);
    if (!(await tabTo(page, "#btn-cta", stops))) throw new Error("Tab never reached the bar's button on the Start form");
    await page.keyboard.press("Enter");
    // Where the dialog stays shut, the message says where the focus was and what the form held.
    await page.waitForSelector("#live-dialog[open]", { timeout: 10000 }).catch(async (e) => {
      const at = await page.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, cta: document.getElementById("btn-cta")?.textContent.trim(), name: document.getElementById("live-name")?.value, error: document.getElementById("live-name-error")?.textContent || "" }));
      throw new Error(`Enter on the Start form's button left the dialog shut (focus ${at.focus}, button "${at.cta}", name "${at.name}"${at.error ? `, ${at.error}` : ""}): ${String(e.message).split("\n")[0]}`);
    });
    if (!(await tabTo(page, "#live-key", stops, 60))) throw new Error("Tab never reached the key field");
    await page.keyboard.type(MOCK_KEY);
    if (!(await tabTo(page, "#live-ack", stops, 60))) throw new Error("Tab never reached the box for public information");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.getElementById("live-ack").checked && !document.getElementById("live-start").disabled, null, { timeout: 10000 });
    if (!(await tabTo(page, "#live-start", stops, 60))) throw new Error("Tab never reached Start the live run");
    await page.keyboard.press("Enter");
    await until(page, ["check"]);
    await ctaReady(page);
    if (!(await tabTo(page, "#btn-cta", stops))) throw new Error("Tab never reached the bar's button at the check");
    await page.keyboard.press("Enter");
    await until(page, ["decide"]);
    await ctaReady(page);
    if (!(await tabTo(page, "#btn-cta", stops))) throw new Error("Tab never reached the bar's button at the decision");
    await page.keyboard.press("Enter");
    await until(page, ["done"]);
  } catch (e) {
    problems.push(String(e.message || e).split("\n")[0]);
  }
  const s = await state(page);
  const all = [...problems, ...faults(stops)];
  check("keyboard", s.live?.status === "done" && s.step === 5 && s.adopted?.length > 0 && !all.length,
    `${where}, a live run by keyboard against the stand-in: Run it live, a fictional company chosen with the arrow keys without filling anything, then filled in, the key typed, the box ticked with Space, Start the live run, the check and the decision, the Summary (${s.live?.status}, step ${s.step}); ${stops.length} stops, each with its ring and in view${all.length ? `:\n      ${all.slice(0, 12).join("\n      ")}` : ""}`);
  await closeLivePage(p, `${where}, the live run by keyboard`, (ok, what) => check("keyboard", ok, what));
  return stops.length;
}

/** The control: with the focus rings taken out of the page's styles, every stop fails. */
async function keyboardControl() {
  const { context, page } = await newPage();
  await page.goto(`${server.base}?lang=en&scenario=s2`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector("#guide-en[open]", { timeout: 10000 });
  await page.addStyleTag({ url: "/tests/fixtures/no-focus-ring.css" });
  const stops = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); await settle(page, 800); stops.push(await page.evaluate(focusStop, null)); }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("guide-en").open);
  for (let i = 0; i < 24; i++) { await page.keyboard.press("Tab"); await settle(page, 800); stops.push(await page.evaluate(focusStop, null)); }
  const ringed = stops.filter((s) => !s.none && s.ring).map((s) => `${s.name} (${s.ring})`);
  check("keyboard", stops.length === 30 && !ringed.length && stops.some((s) => !s.none),
    `the control: with the focus rings taken out of the page's styles, all ${stops.length} stops fail the ring check${ringed.length ? `; these still count as ringed: ${[...new Set(ringed)].slice(0, 6).join(", ")}` : ""}`);
  await context.close();
}

// ---- motion ----------------------------------------------------------------------------------------------

/** Records, in the page, every animation and transition that lasts longer than an instant. */
function recordMotion() {
  window.__motion = [];
  const seen = new WeakSet();
  const label = (el, pseudo) => (el ? `${el.tagName ? el.tagName.toLowerCase() : "?"}${el.id ? `#${el.id}` : ""}${el.classList?.length ? `.${[...el.classList].slice(0, 2).join(".")}` : ""}${pseudo || ""}` : "?");
  const note = () => {
    for (const a of document.getAnimations()) {
      if (seen.has(a)) continue;
      const t = a.effect?.getComputedTiming?.();
      if (!t) continue;
      seen.add(a);
      const d = typeof t.duration === "number" ? t.duration : 0;
      // An instant moves nothing: under reduced motion Vici turns every animation into 0.01 ms.
      if (d <= 1) continue;
      const target = a.effect.target;
      window.__motion.push({ what: a.animationName || a.transitionProperty || "script", el: label(target, a.effect.pseudoElement), d: Math.round(d), spinner: !!target?.closest?.(".vc-spinner") });
    }
  };
  const tick = () => { note(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  for (const type of ["transitionrun", "transitionstart", "animationstart"]) document.addEventListener(type, note, true);
}

/** The motion recorded since the last call; the record starts again. */
const take = (page) => page.evaluate(() => { const m = window.__motion; window.__motion = []; return m; });

/** A page with the motion recorder and a stand-in for the API that can hold a request (the wait). */
async function motionPage(reduce) {
  const context = await browser.newContext({ viewport: VIEW, reducedMotion: reduce ? "reduce" : "no-preference" });
  await context.addInitScript(recordMotion);
  let release = () => {};
  const api = { hold: false, release: () => release() };
  const s2 = SCEN.s2;
  const fake = createFakeClaude((n, req, step) => ({ blocks: [{ type: "text", text: JSON.stringify(s2.answers.en[step]) }], stop: "end_turn" }));
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host !== "api.anthropic.com") return route.abort("blockedbyclient");
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/v1/models") return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(MODELS_LIST) });
    const r = fake.handle(req.postData(), req.headers());
    if (api.hold) await new Promise((ok) => { release = () => { api.hold = false; ok(); }; });
    try { await route.fulfill({ status: r.status, headers: { ...CORS, ...r.headers }, body: r.body }); } catch { /* the page went on */ }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  return { context, page, api, errors };
}

/** The phases the gate names, each with what moved. play: whether Play walks the steps (the reduced run). */
async function motionRun(reduce) {
  const { context, page, api, errors } = await motionPage(reduce);
  const phases = [];
  const phase = async (label, act) => { await take(page); await act(); phases.push({ label, moved: await take(page) }); };
  const steps = [];
  // The guide opens by itself on a first visit; then the Method dialog.
  await phase("the guide opening", async () => {
    await page.goto(`${server.base}?lang=en&scenario=s2`);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    await page.waitForSelector("#guide-en[open]", { timeout: 10000 });
    await page.waitForTimeout(900);
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("guide-en").open);
  await phase("the Method dialog opening", async () => {
    await page.click(".method-open");
    await page.waitForSelector("#method[open]");
    await page.waitForTimeout(900);
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("method").open);
  if (reduce) {
    // Play walks the run: it starts the agents and stops at Complete, then plays Challenge and Assess and stops at the decision.
    await phase("Play from Start to Complete", async () => {
      await page.click("#btn-play");
      await page.waitForFunction(() => window.__swot.state().step === 1, null, { timeout: 30000 });
      steps.push(1);
      await page.waitForTimeout(1500);
    });
    await phase("Play through Challenge and Assess to the decision", async () => {
      await page.click("#btn-cta");
      await page.waitForFunction(() => window.__swot.state().step === 2, null, { timeout: 30000 });
      steps.push(2);
      await page.waitForFunction(() => window.__swot.state().step === 3, null, { timeout: 30000 });
      steps.push(3);
      await page.waitForFunction(() => window.__swot.state().step === 4, null, { timeout: 30000 });
      steps.push(4);
      await page.waitForTimeout(1000);
    });
  } else {
    await page.goto(`${server.base}?guide=0&lang=en&scenario=s2&step=4`);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  }
  await phase("the decision that moves the tiles", async () => {
    await page.click("#btn-cta");
    await page.waitForFunction(() => (window.__swot.state().adopted || []).length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
  });
  if (reduce) {
    await phase("Play from the decision to the Summary", async () => {
      await page.waitForFunction(() => window.__swot.state().step === 5, null, { timeout: 30000 });
      steps.push(5);
      await page.waitForTimeout(800);
    });
  } else {
    await page.goto(`${server.base}?guide=0&lang=en&scenario=s2&step=5`);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  }
  await phase("the report dialog opening", async () => {
    await page.click("#btn-cta");
    await page.waitForSelector("#report-dialog[open]");
    await page.waitForTimeout(900);
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("report-dialog").open);
  // A live run against the stand-in: the dialog, then the wait while a request is held.
  await page.goto(`${server.base}?guide=0&lang=en&scenario=s2`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.click("#btn-live");
  await page.waitForSelector("#live-fill");
  await page.selectOption("#live-fill", "s2");
  await page.click("#live-fill-go");
  await page.waitForFunction(() => document.getElementById("live-name")?.value);
  await page.click("#btn-cta");
  await page.waitForSelector("#live-dialog[open]");
  await page.fill("#live-key", MOCK_KEY);
  await page.check("#live-ack");
  await phase("the live run's wait", async () => {
    api.hold = true;
    await page.click("#live-start");
    await page.waitForFunction(() => window.__swot.state().live?.status === "working", null, { timeout: 10000 });
    await page.waitForTimeout(1500);
  });
  api.release();
  await page.waitForFunction(() => window.__swot.state().live?.status === "check", null, { timeout: 20000 }).catch(() => errors.push("the live run did not reach the check"));
  await context.close();
  return { phases, steps, errors };
}

// ---- run ---------------------------------------------------------------------------------------------------

const ran = [];
try {
  if (wanted("keyboard")) {
    ran.push("keyboard");
    for (const lang of LANGS) {
      await simulationByKeyboard(lang);
      await liveByKeyboard(lang);
    }
    await keyboardControl();
  }
  if (wanted("motion")) {
    ran.push("motion");
    const reduced = await motionRun(true);
    for (const p of reduced.phases) {
      const moving = p.moved.filter((m) => !m.spinner);
      check("motion", !moving.length, `reduced motion, ${p.label}: nothing moves${moving.length ? `, but ${moving.slice(0, 6).map((m) => `${m.el} ${m.what} ${m.d} ms`).join("; ")}` : ""}`);
    }
    const wait = reduced.phases.find((p) => p.label === "the live run's wait");
    const sweep = (wait?.moved || []).filter((m) => m.spinner);
    check("motion", sweep.length > 0 && sweep.every((m) => m.d >= 2000), `reduced motion, the live run's wait: Vici's spinner keeps its slow sweep, the only cue that work goes on (${sweep.map((m) => `${m.d} ms a turn`).join(", ") || "no spinner turned"})`);
    check("motion", reduced.steps.join(" ") === "1 2 3 4 5", `reduced motion: Play still moves from step to step (${reduced.steps.join(" ")})`);
    check("motion", !reduced.errors.length, `reduced motion: no page error${reduced.errors.length ? `: ${reduced.errors.join(" | ")}` : ""}`);
    // The control: without reduced motion the same probe finds the dialogs, the tiles and the spinner moving.
    const full = await motionRun(false);
    const moved = (label) => full.phases.find((p) => p.label === label)?.moved || [];
    const want = ["the guide opening", "the Method dialog opening", "the decision that moves the tiles", "the report dialog opening"];
    const still = want.filter((label) => !moved(label).some((m) => !m.spinner));
    const fast = moved("the live run's wait").filter((m) => m.spinner && m.d < 2000);
    check("motion", !still.length && fast.length > 0, `the control: without reduced motion the probe finds motion in ${want.length - still.length} of ${want.length} phases${still.length ? ` (still: ${still.join(", ")})` : ""}, and the spinner at full speed (${fast.map((m) => `${m.d} ms`).join(", ") || "none"})`);
  }
} finally {
  await server.close();
  await browser.close();
}

const groups = { keyboard: "KEYBOARD OK", motion: "MOTION OK" };
let failed = 0;
for (const [group, ok, what] of results) { console.log(`${ok ? "PASS" : "FAIL"}  [${group}] ${what}`); if (!ok) failed += 1; }
if (failed || !results.length) { console.log(`\n${failed} of ${results.length} access checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} access checks passed.`);
for (const g of ran) console.log(groups[g]);

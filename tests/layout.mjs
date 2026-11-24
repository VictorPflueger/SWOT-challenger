// The layout from 1920 × 1080 down to 1280 × 720 (at 1920 × 1080, 1440 × 900, 1366 × 768 and 1280 × 720),
// in both themes and both languages, on every step of every scenario (Vici's "Presenting step by step";
// PLAN.md, 5.1 and 5.2; AC-14):
//   - nothing scrolls wider than the window and nothing ends past its right edge;
//   - no text is cut to an ellipsis, and no table scrolls sideways (with every "Show the numbers" open);
//   - every target is at least 24 px in both directions (WCAG 2.2, 2.5.8): a link inside a sentence is
//     exempt, as WCAG allows, and a checkbox's target is its label; the primary actions are at least
//     40 px: the Your turn bar's button, Run it live in the step bar and in the story, and Start the live
//     run (Victor's decision of 24 November 2026);
//   - every field of the SWOT shows all its items without scrolling (at 1280 × 720 an item shows its
//     first line until it is opened, as the brief asks);
//   - the step bar's labels do not run into each other;
//   - the bar under the story is in the window, and at Strategise every strategy card shows in full above
//     it, also with six strategies in one cell and the longest titles the contract allows;
//   - the header keeps its height when the decision moves the key figures;
//   - the guide, as it opens on a first visit, and the Method dialog hold too;
//   - at the Summary the report card holds, and the report the bar opens fits the window with Save as PDF
//     in view;
//   - a live run's screens hold as well: the Start form empty and filled, the live-run dialog (at its first
//     opening every part shows without scrolling, the estimate too, as Vici's pattern has it until a warning
//     appears; then its start button and the AI notice stay in view), the wait, the check of the AI's items
//     and an error; "Run it live"
//     is in view in the step bar on every step, and with the AI notice beside it on Start and Summary,
//     where the story offers it (TECH_NOTES.md, section 11). The API is a scripted stand-in.
// The target rules fail on planted examples first: a 20 px button and a primary action 36 px high.
// Hyphenation is off (tests/fixtures/no-hyphens.css), as in a Chromium without hyphenation dictionaries,
// so a layout that fits only because the browser hyphenates German fails here as it would in CI.
// Every request to another host is blocked. Prints LAYOUT OK with what it covered.
// Usage: node tests/layout.mjs
import { APP_ROOT, launchBrowser, serveStatic, NETWORK_NOISE, MOCK_KEY } from "./lib/harness.mjs";
import { createFakeClaude, json, CORS, MODELS_LIST } from "./lib/fake-claude.mjs";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 9300 + Math.floor(Math.random() * 300));

/** The sizes, themes and languages, and the primary actions (at least 40 px). */
// LAYOUT_ONLY="1280x720,dark,de" narrows the run for a quicker look; the success line then says so.
const only = (process.env.LAYOUT_ONLY || "").split(",").filter(Boolean);
const pick = (all, key) => (only.some((o) => all.map(key).includes(o)) ? all.filter((a) => only.includes(key(a))) : all);
const SIZES = pick([[1920, 1080], [1440, 900], [1366, 768], [1280, 720]], ([w, h]) => `${w}x${h}`);
const THEMES = pick(["light", "dark"], (t) => t);
const LANGS = pick(["en", "de"], (l) => l);
const PRIMARY = ["#btn-cta", "#btn-live-bar", "#btn-live", "#live-start"];

/**
 * What a screen shows that breaks the layout rules, measured in the page. Returns the problems, the
 * header's height and the primary actions it measured.
 */
function measure(primary) {
  const out = [];
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (document.scrollingElement.scrollWidth > W + 1) out.push(`the page scrolls sideways (${document.scrollingElement.scrollWidth} px)`);
  // The page is one screen: only its panels scroll, so the header never leaves the screen (finding 15).
  if (document.scrollingElement.scrollHeight > H + 1) out.push(`the page itself is ${document.scrollingElement.scrollHeight} px high and can scroll`);
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || el.closest("dialog:not([open]), [hidden], #boot, .vc-visually-hidden, .vc-tooltip")) continue;
    if (el.closest("details:not([open])") && !el.closest("summary")) continue;
    if (el.closest(".vc-table-wrap") && !el.classList.contains("vc-table-wrap")) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.right > W + 1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} ends at ${Math.round(r.right)} px`);
    if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) out.push(`text cut to an ellipsis: "${el.textContent.trim().slice(0, 30)}"`);
  }
  for (const wrap of document.querySelectorAll(".vc-table-wrap")) {
    if (!wrap.getBoundingClientRect().width || wrap.closest("details:not([open]), dialog:not([open])")) continue;
    if (wrap.scrollWidth > wrap.clientWidth + 2) out.push(`a table scrolls sideways: "${(wrap.querySelector("caption")?.textContent || "").trim().slice(0, 30)}"`);
  }
  for (const area of document.querySelectorAll(".swot .vc-framework__area")) {
    if (!area.getBoundingClientRect().width) continue;
    if (area.scrollHeight > area.clientHeight + 1) out.push(`the field ${area.dataset.quad} hides ${area.scrollHeight - area.clientHeight} px of its items`);
  }
  const labels = [...document.querySelectorAll("#steps .vc-step__label")].map((l) => l.getBoundingClientRect());
  for (let i = 1; i < labels.length; i++) if (labels[i].left < labels[i - 1].right - 1) out.push(`the step labels ${i} and ${i + 1} run into each other`);
  const bar = document.querySelector("#step-bar .turn, #step-bar .foot");
  if (!bar) out.push("no bar under the story");
  else if (bar.getBoundingClientRect().bottom > H + 1) out.push(`the bar under the story ends below the window (${Math.round(bar.getBoundingClientRect().bottom)} px)`);
  if (document.querySelector('.workspace[data-step="strategise"]')) {
    const top = bar ? bar.getBoundingClientRect().top : H;
    for (const card of document.querySelectorAll(".tows-card")) {
      const r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > top + 1) out.push(`the strategy card "${card.querySelector(".tows-card__title").textContent.slice(0, 30)}" is not in full above the bar`);
    }
  }
  // Targets (WCAG 2.2, 2.5.8): every control a pointer can hit, at least 24 px in both directions.
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") || el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 32)}"`;
  // Hidden: in a closed dialog or popover, hidden, inert, or inside a closed details other than its summary.
  const hidden = (el) => {
    if (el.closest("dialog:not([open]), [hidden], [inert], #boot, .vc-visually-hidden, .vc-skip-link, [popover]:not(:popover-open)")) return true;
    for (let d = el.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])")) {
      const summary = d.querySelector(":scope > summary");
      if (!summary || !summary.contains(el)) return true;
    }
    const cs = getComputedStyle(el);
    return cs.display === "none" || cs.visibility === "hidden";
  };
  // A link inside a sentence: shown inline, with words of other text in the same block (WCAG's inline exception).
  const inSentence = (a) => {
    if (getComputedStyle(a).display !== "inline") return false;
    let block = a.parentElement;
    while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
    if (!block) return false;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (a.contains(n) || n.parentElement.closest("a, button, .vc-visually-hidden")) continue;
      if (/[\p{L}\p{N}]/u.test(n.textContent)) return true;
    }
    return false;
  };
  const TARGETS = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(TARGETS)) {
    if (hidden(el)) continue;
    // A checkbox or radio is hit through its label.
    const box = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el) : el;
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (el.matches("a") && inSentence(el)) continue;
    if (r.width < 23.99 || r.height < 23.99) out.push(`a target under 24 px: ${name(el)} is ${Math.round(r.width * 10) / 10} × ${Math.round(r.height * 10) / 10} px`);
  }
  // The primary actions, at least 40 px.
  const seen = [];
  for (const sel of primary) {
    const el = document.querySelector(sel);
    if (!el || hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    seen.push(sel);
    if (r.width < 39.99 || r.height < 39.99) out.push(`a primary action under 40 px: ${name(el)} is ${Math.round(r.width * 10) / 10} × ${Math.round(r.height * 10) / 10} px`);
  }
  return { problems: out, header: Math.round(document.querySelector(".app-header").getBoundingClientRect().height), seen };
}

// A scenario with six strategies in one cell, each with a title as long as the contract allows (90
// characters), served in place of S2: the worst case for the decision at 1280 × 720.
const long = {
  en: ["Data contracts that keep the company the first choice for service of every drive it sold", "A service academy with the machine builders of the region, so technicians stay in the area", "A security process for every drive with software, from the first report to the last patch", "A price for standard gearboxes that matches the low-cost rivals on the lines that buy price", "Remote monitoring sold with each new drive, so every machine in the field reports its hours", "A partner network of independent service firms that work on the company's drives under it"],
  de: ["Datenverträge, die das Unternehmen zur ersten Wahl für den Service jedes Antriebs machen", "Eine Serviceakademie mit den Maschinenbauern der Region, damit die Techniker hier bleiben", "Ein Sicherheitsprozess für jeden Antrieb mit Software, von der ersten Meldung bis zum Patch", "Ein Preis für Standardgetriebe, der günstigen Wettbewerbern auf preisgetriebenen Linien folgt", "Fernüberwachung mit jedem neuen Antrieb, damit jede Maschine im Feld ihre Stunden meldet", "Ein Netz freier Servicefirmen, die unter dem Namen des Unternehmens an seinen Antrieben arbeiten"]
};
const s2 = (await import("../data/scenarios/s2.js")).default;
const six = JSON.parse(JSON.stringify(s2));
for (const lang of ["en", "de"]) {
  six.answers[lang].strategise.strategies = long[lang].map((title, i) => ({
    id: `R${i + 1}`, type: "ST", title: title.slice(0, 90), items: ["s2", "t1"], issue: "I4", kind: "mitigate",
    ratings: [{ item: "t1", to: 2 }], residual: [{ likelihood: 2, eur_year_low: 100000, eur_year_high: 300000 }], upside: [],
    effort: "M", time_to_impact: lang === "en" ? "About a year" : "Etwa ein Jahr", first_step: lang === "en" ? "Start with one customer" : "Mit einem Kunden beginnen", owner: lang === "en" ? "Head of service" : "Leitung Service", recommended: i < 2
  }));
}
six.recorded_choice = ["R1", "R2"];
const SIX_SOURCE = `export default ${JSON.stringify(six)};\n`;

/** Whether an element lies wholly inside the window. */
function inView(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
}

/** Resolves once every finite animation on the page has run its time, or after `limit` ms. Runs in the page. */
function settled(limit) {
  return new Promise((ok) => {
    const t0 = performance.now();
    const done = () => document.getAnimations().every((a) => {
      const t = a.effect?.getComputedTiming();
      // A pulse that draws the eye (Vici's vc-attention, 4.2 s of shadow) moves nothing: it is not waited for.
      return !t || !Number.isFinite(t.endTime) || t.endTime > 1500 || a.playState !== "running" || (a.currentTime ?? 0) >= t.endTime - 1;
    });
    const poll = () => (done() || performance.now() - t0 > limit ? ok() : setTimeout(poll, 30));
    poll();
  });
}

/** The primary actions measured on some screen, so their rule cannot pass by measuring none. */
const seenPrimary = new Set();
async function measured(page) {
  // A dialog opens with a short scale and fade; the measure waits until every finite animation has run its
  // time. Headless Chromium can leave an ended animation "running" until the next frame, so the wait reads
  // the clock rather than the animation's promise.
  await page.evaluate(settled, 3000);
  const m = await page.evaluate(measure, PRIMARY);
  for (const sel of m.seen) seenPrimary.add(sel);
  return m;
}

/**
 * The live screens of one size, theme and language: Run it live in view on the simulation's Start and
 * Summary; the Start form empty and filled; the dialog; the wait; the check; an error. Returns problems.
 */
async function liveViews(page, server, lang, api) {
  const out = [];
  let header = null;
  const look = async (label) => {
    await page.addStyleTag({ url: "/tests/fixtures/no-hyphens.css" });
    const m = await measured(page);
    for (const p of m.problems) out.push(`live ${label}: ${p}`);
    // The tiles wait in one line, so the header keeps the simulation's height.
    if (header !== null && m.header !== header) out.push(`live ${label}: the header is ${m.header} px high, the simulation's ${header} px`);
    views += 1;
  };
  for (let step = 0; step <= 5; step++) {
    await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=s2&step=${step}`);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    if (!(await page.evaluate(inView, "#btn-live-bar"))) out.push(`step ${step}: "Run it live" is not in view in the step bar`);
    if (step === 0) header = (await measured(page)).header;
    if (step !== 0 && step !== 5) continue;
    // A person scrolls the story to it; at Start it is in view from the first screen.
    await page.evaluate(() => document.getElementById("btn-live")?.closest(".live-entry")?.scrollIntoView({ block: "center" }));
    if (!(await page.evaluate(inView, "#btn-live")) || !(await page.evaluate(() => { const b = document.getElementById("btn-live"); const n = b?.parentElement.querySelector(".ai-notice"); if (!n) return false; const r = n.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1 && r.width > 0; }))) out.push(`step ${step}: "Run it live" and the AI notice beside it are not in view`);
  }
  await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=s2`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.click("#btn-live");
  await page.waitForSelector("#live-name");
  await look("empty Start form");
  await page.selectOption("#live-fill", "s2");
  await page.click("#live-fill-go");
  await page.waitForFunction(() => document.getElementById("live-name")?.value);
  await look("filled Start form");
  await page.click("#btn-cta");
  await page.waitForSelector("#live-dialog[open]");
  // Vici's live-run dialog: at its first opening, with no warning, every part shows without scrolling.
  await page.waitForTimeout(300);
  const fit = await page.evaluate(() => {
    const body = document.querySelector("#live-dialog .vc-live__body");
    const box = body.getBoundingClientRect();
    const shown = (sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5 && r.bottom <= window.innerHeight + 1; };
    return { warning: !document.getElementById("live-warning").hidden, scroll: body.scrollHeight - body.clientHeight, missing: ["#live-key", ".vc-live__research", "#live-cap", "#live-ack", "#live-estimate"].filter((sel) => !shown(sel)) };
  });
  if (fit.warning) out.push("live dialog: a warning shows for the fictional company's SWOT");
  else if (fit.scroll > 1 || fit.missing.length) out.push(`live dialog: at its first opening the body scrolls by ${Math.round(fit.scroll)} px${fit.missing.length ? `; not in view: ${fit.missing.join(", ")}` : ""}`);
  await page.fill("#live-key", MOCK_KEY);
  await page.check("#live-ack");
  await look("dialog");
  if (!(await page.evaluate(inView, "#live-start")) || !(await page.evaluate(inView, "#live-dialog .vc-live__footer .ai-notice"))) out.push("live dialog: the start button or the AI notice beside it is not in view");
  api.mode = "hold";
  await page.click("#live-start");
  await page.waitForFunction(() => window.__swot.state().live?.status === "working");
  await page.waitForSelector("#btn-abort");
  await look("wait");
  api.release();
  await page.waitForFunction(() => window.__swot.state().live?.status === "check", null, { timeout: 15000 });
  await look("check of the AI's items");
  await page.click(".ai-item .check button[id^='edit-']");
  await look("an AI item in edit");
  api.mode = "error";
  await page.click("#btn-cta");
  await page.waitForFunction(() => window.__swot.state().live?.status === "stopped", null, { timeout: 15000 });
  await look("an error");
  return out;
}

let views = 0;
let controlsDone = false;
const headers = new Map();
try {
  for (const [w, h] of SIZES) {
    for (const theme of THEMES) {
      for (const lang of LANGS) {
        const context = await browser.newContext({ viewport: { width: w, height: h } });
        await context.addInitScript((t) => { try { localStorage.setItem("vc-theme", t); } catch { /* storage blocked */ } }, theme);
        // The API stand-in for the live screens: it answers from S2, holds a request while the wait is
        // measured, and refuses the key once an error is wanted.
        let release = () => {};
        const api = { mode: "answer", release: () => release() };
        const fake = createFakeClaude((n, req, step) => (api.mode === "error" ? { error: { status: 401, type: "authentication_error", message: "invalid x-api-key" } } : { blocks: [json(s2.answers[lang][step])], stop: "end_turn" }));
        await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
          const req = route.request();
          const u = new URL(req.url());
          if (u.host !== "api.anthropic.com") return route.abort("blockedbyclient");
          if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
          if (u.pathname === "/v1/models") return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(MODELS_LIST) });
          const r = fake.handle(req.postData(), req.headers());
          if (api.mode === "hold") await new Promise((ok) => { release = () => { api.mode = "answer"; ok(); }; });
          try { await route.fulfill({ status: r.status, headers: { ...CORS, ...r.headers }, body: r.body }); } catch { /* the page went on */ }
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.message || e)));
        page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
        const name = `${w} × ${h}, ${theme}, ${lang === "en" ? "English" : "German"}`;
        const problems = [];
        // The guide, as it opens by itself on a first visit, and the Method dialog.
        await page.goto(`${server.base}?lang=${lang}&scenario=s2`);
        await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
        await page.waitForSelector(`#guide-${lang}[open]`, { timeout: 10000 }).catch(() => problems.push("the guide did not open by itself"));
        await page.addStyleTag({ url: "/tests/fixtures/no-hyphens.css" });
        for (const p of (await measured(page)).problems) problems.push(`the guide: ${p}`);
        await page.keyboard.press("Escape");
        await page.waitForFunction((l) => !document.getElementById(`guide-${l}`).open, lang);
        await page.click(".method-open");
        await page.waitForSelector("#method[open]");
        for (const p of (await measured(page)).problems) problems.push(`the Method dialog: ${p}`);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.getElementById("method").open);
        views += 2;
        if (!controlsDone) {
          // The controls: a 20 px button in the story fails the target rule, and the Your turn bar's
          // button at 36 px fails the primary rule.
          await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=s2&step=1`);
          await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
          const planted = await page.evaluate(() => {
            const b = document.createElement("button");
            b.type = "button";
            b.id = "planted-small";
            b.textContent = "x";
            Object.assign(b.style, { width: "20px", height: "20px", minHeight: "0", padding: "0" });
            document.querySelector(".story-scroll").prepend(b);
            const cta = document.getElementById("btn-cta");
            cta.style.setProperty("--_h", "36px");
            Object.assign(cta.style, { height: "36px", minHeight: "0", paddingBlock: "0" });
            return { height: Math.round(cta.getBoundingClientRect().height) };
          });
          const m = await page.evaluate(measure, PRIMARY);
          const small = m.problems.some((p) => p.startsWith("a target under 24 px: button#planted-small"));
          const low = m.problems.some((p) => p.startsWith("a primary action under 40 px: button#btn-cta"));
          check(small && low && planted.height === 36, `the controls: a planted 20 px button fails the target rule${small ? "" : " (it did not)"}, and the Your turn bar's button at ${planted.height} px fails the primary rule${low ? "" : " (it did not)"}`);
          controlsDone = true;
        }
        for (const id of ["s1", "s2", "s3"]) {
          for (let step = 0; step <= 5; step++) {
            await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=${id}&step=${step}`);
            await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
            await page.addStyleTag({ url: "/tests/fixtures/no-hyphens.css" });
            const m = await measured(page);
            // Every table of numbers open too.
            await page.evaluate(() => { for (const d of document.querySelectorAll("details.numbers")) d.open = true; });
            const open = await measured(page);
            for (const p of new Set([...m.problems, ...open.problems])) problems.push(`${id} step ${step}: ${p}`);
            // At the Summary, the bar's action opens the report: its sheets fit the window, and Save as PDF is in view.
            if (step === 5) {
              await page.click("#btn-cta");
              await page.waitForSelector("#report-dialog[open]");
              const d = await measured(page);
              for (const p of d.problems) problems.push(`${id} the report: ${p}`);
              if (!(await page.evaluate(inView, "#rp-pdf-dialog"))) problems.push(`${id} the report: Save as PDF is not in view`);
              await page.keyboard.press("Escape");
              await page.waitForFunction(() => !document.getElementById("report-dialog").open);
            }
            const key = `${name}|${id}`;
            if (!headers.has(key)) headers.set(key, new Set());
            headers.get(key).add(m.header);
            views += 1;
          }
        }
        // Six strategies in one cell, the longest titles.
        await page.route("**/data/scenarios/s2.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: SIX_SOURCE }));
        await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=s2&step=4`);
        await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
        await page.addStyleTag({ url: "/tests/fixtures/no-hyphens.css" });
        const cards = await page.$$eval(".tows-cell[data-type='ST'] .tows-card", (els) => els.length);
        const six6 = await measured(page);
        for (const p of six6.problems) problems.push(`six in one cell: ${p}`);
        if (cards !== 6) problems.push(`six in one cell: ${cards} cards in the cell`);
        await page.unroute("**/data/scenarios/s2.js");
        check(!problems.length && !errors.length, `${name}: the guide and the Method dialog, all 18 steps of the three scenarios with the report, and six strategies in one cell${[...problems, ...errors].length ? `:\n      ${[...problems, ...errors].slice(0, 12).join("\n      ")}` : ""}`);
        const live = await liveViews(page, server, lang, api);
        check(!live.length && !errors.length, `${name}: the live screens, Run it live, the dialog whole at its first opening and its start button with the AI notice in view${[...live, ...errors].length ? `:\n      ${[...live, ...errors].slice(0, 12).join("\n      ")}` : ""}`);
        await context.close();
      }
    }
  }
  const moving = [...headers].filter(([, s]) => s.size > 1).map(([k, s]) => `${k} (${[...s].join(", ")} px)`);
  check(!moving.length, `the header keeps its height from Start to Summary${moving.length ? `; it moves at ${moving.join("; ")}` : ""}`);
  const unseen = PRIMARY.filter((sel) => !seenPrimary.has(sel));
  check(!unseen.length, `every primary action was measured on some screen${unseen.length ? `; never shown: ${unseen.join(", ")}` : ` (${PRIMARY.join(", ")})`}`);
} finally {
  await server.close();
  await browser.close();
}

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} layout checks failed (${views} views).`); process.exit(1); }
console.log(`\nAll ${results.length} layout checks passed on ${views} views.`);
console.log(`LAYOUT OK: ${SIZES.length} sizes, ${THEMES.length} themes, ${LANGS.length} languages; targets at least 24 px, primary actions at least 40 px`);

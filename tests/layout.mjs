// The layout at the two sizes the tool is shown at, 1920 × 1080 and 1280 × 720, in both themes and both
// languages, on every step of every scenario (Vici's "Presenting step by step"; PLAN.md, 5.1 and 5.2):
//   - nothing scrolls wider than the window and nothing ends past its right edge;
//   - no text is cut to an ellipsis, and no table scrolls sideways (with every "Show the numbers" open);
//   - every field of the SWOT shows all its items without scrolling (at 1280 × 720 an item shows its
//     first line until it is opened, as the brief asks);
//   - the step bar's labels do not run into each other;
//   - the bar under the story is in the window, and at Strategise every strategy card shows in full above
//     it, also with six strategies in one cell and the longest titles the contract allows;
//   - the header keeps its height when the decision moves the key figures;
//   - at the Summary the report card holds, and the report the bar opens fits the window with Save as PDF
//     in view;
//   - a live run's screens hold as well: the Start form empty and filled, the live-run dialog (at its first
//     opening every part shows without scrolling, the estimate too, as Vici's pattern has it until a warning
//     appears; then its start button and the AI notice stay in view), the wait, the check of the AI's items
//     and an error; "Run it live"
//     is in view in the step bar on every step, and with the AI notice beside it on Start and Summary,
//     where the story offers it (TECH_NOTES.md, section 11). The API is a scripted stand-in.
// Hyphenation is off (tests/fixtures/no-hyphens.css), as in a Chromium without hyphenation dictionaries,
// so a layout that fits only because the browser hyphenates German fails here as it would in CI.
// Every request to another host is blocked. Prints LAYOUT OK. Usage: node tests/layout.mjs
import { APP_ROOT, launchBrowser, serveStatic, NETWORK_NOISE, MOCK_KEY } from "./lib/harness.mjs";
import { createFakeClaude, json, CORS, MODELS_LIST } from "./lib/fake-claude.mjs";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 9300 + Math.floor(Math.random() * 300));

/** What a screen shows that breaks the layout rules, measured in the page. */
function measure() {
  const out = [];
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (document.scrollingElement.scrollWidth > W + 1) out.push(`the page scrolls sideways (${document.scrollingElement.scrollWidth} px)`);
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
  return { problems: out, header: Math.round(document.querySelector(".app-header").getBoundingClientRect().height) };
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

/**
 * The live screens of one size, theme and language: Run it live in view on the simulation's Start and
 * Summary; the Start form empty and filled; the dialog; the wait; the check; an error. Returns problems.
 */
async function liveViews(page, server, lang, api) {
  const out = [];
  let header = null;
  const look = async (label) => {
    await page.addStyleTag({ url: "/tests/fixtures/no-hyphens.css" });
    const m = await page.evaluate(measure);
    for (const p of m.problems) out.push(`live ${label}: ${p}`);
    // The tiles wait in one line, so the header keeps the simulation's height.
    if (header !== null && m.header !== header) out.push(`live ${label}: the header is ${m.header} px high, the simulation's ${header} px`);
    views += 1;
  };
  for (let step = 0; step <= 5; step++) {
    await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=s2&step=${step}`);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    if (!(await page.evaluate(inView, "#btn-live-bar"))) out.push(`step ${step}: "Run it live" is not in view in the step bar`);
    if (step === 0) header = (await page.evaluate(measure)).header;
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
const headers = new Map();
try {
  for (const [w, h] of [[1920, 1080], [1280, 720]]) {
    for (const theme of ["light", "dark"]) {
      for (const lang of ["en", "de"]) {
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
        for (const id of ["s1", "s2", "s3"]) {
          for (let step = 0; step <= 5; step++) {
            await page.goto(`${server.base}?guide=0&lang=${lang}&scenario=${id}&step=${step}`);
            await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
            await page.addStyleTag({ url: "/tests/fixtures/no-hyphens.css" });
            const m = await page.evaluate(measure);
            // Every table of numbers open too.
            await page.evaluate(() => { for (const d of document.querySelectorAll("details.numbers")) d.open = true; });
            const open = await page.evaluate(measure);
            for (const p of new Set([...m.problems, ...open.problems])) problems.push(`${id} step ${step}: ${p}`);
            // At the Summary, the bar's action opens the report: its sheets fit the window, and Save as PDF is in view.
            if (step === 5) {
              await page.click("#btn-cta");
              await page.waitForSelector("#report-dialog[open]");
              const d = await page.evaluate(measure);
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
        const six6 = await page.evaluate(measure);
        for (const p of six6.problems) problems.push(`six in one cell: ${p}`);
        if (cards !== 6) problems.push(`six in one cell: ${cards} cards in the cell`);
        await page.unroute("**/data/scenarios/s2.js");
        check(!problems.length && !errors.length, `${name}: all 18 steps of the three scenarios, and six strategies in one cell${[...problems, ...errors].length ? `:\n      ${[...problems, ...errors].slice(0, 12).join("\n      ")}` : ""}`);
        const live = await liveViews(page, server, lang, api);
        check(!live.length && !errors.length, `${name}: the live screens, Run it live, the dialog whole at its first opening and its start button with the AI notice in view${[...live, ...errors].length ? `:\n      ${[...live, ...errors].slice(0, 12).join("\n      ")}` : ""}`);
        await context.close();
      }
    }
  }
  const moving = [...headers].filter(([, s]) => s.size > 1).map(([k, s]) => `${k} (${[...s].join(", ")} px)`);
  check(!moving.length, `the header keeps its height from Start to Summary${moving.length ? `; it moves at ${moving.join("; ")}` : ""}`);
} finally {
  await server.close();
  await browser.close();
}

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} layout checks failed (${views} views).`); process.exit(1); }
console.log(`\nAll ${results.length} layout checks passed on ${views} views.\nLAYOUT OK`);

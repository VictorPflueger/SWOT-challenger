// The presenter in Chromium, with every request to another host blocked (AC-04 to AC-07, AC-17):
//   PRESENTER  each scenario plays from Start to Summary in English and German, by its own actions, with
//              the SIMULATION tape and the fictional-company label on every step; steps move by click,
//              by key and by address (?scenario=s2&step=4); Play stays 7 to 14 seconds on a step, holds
//              while a dialog is open and stops where the person acts (on a fake clock, so it runs in
//              seconds); and a choice other than the recorded one gives tiles equal to the engine's
//              figures for that choice;
//   TILES      the key figures answer first: before a scenario plays, each tile shows that scenario's value
//              and what it rests on; the decision strikes the old value through beside the new one, in
//              both languages;
//   GRID       four fields, internal above external; every item on every step of every scenario carries a
//              mark and a word for its state (Vici's frameworkProblems); the risk matrix keeps Vici's rule
//              (riskMatrixProblems); the risk, IE and TOWS matrices each have a table one click away;
//   METHOD     the Method dialog names David's factor tables and IE matrix and Weihrich's TOWS matrix with
//              their sources, the scales, the engine's rules with SW1 worked through, the sector's KPIs,
//              the exchange rate with its date, and that a score is a structured judgement, in both
//              languages.
// Vici's checks come from a ViciDesign checkout (VICI_DIR, or ../ViciDesign); --require-vici fails
// without one. Prints PRESENTER OK, TILES OK, GRID OK, METHOD OK and ALL PRESENTER CHECKS OK.
// Usage: node tests/presenter.mjs [--require-vici]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT, REQUIRE_VICI, viciDir, launchBrowser, serveStatic, NETWORK_NOISE } from "./lib/harness.mjs";
import { createRun, addressed } from "../js/simulation.js";
import { figuresFor } from "../js/scenario.js";
import { money, fixed } from "../js/risk.js";
import { kpisFor } from "../data/kpis.js";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";

const DICT = { en: EN, de: DE };
const sections = { PRESENTER: [], TILES: [], GRID: [], METHOD: [] };
const check = (section, ok, what) => sections[section].push([!!ok, what]);

const dir = viciDir();
let frameworkProblems = null;
let riskMatrixProblems = null;
if (dir) {
  ({ frameworkProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "framework.mjs")).href));
  ({ riskMatrixProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "risk.mjs")).href));
} else {
  check("GRID", !REQUIRE_VICI, "Vici's frameworkProblems and riskMatrixProblems: no ViciDesign checkout in VICI_DIR or next to this repository");
}

const runs = {};
for (const id of ["s1", "s2", "s3"]) runs[id] = createRun((await import(`../data/scenarios/${id}.js`)).default);
const score = (x, lang) => fixed(x, 2, lang);

const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 8900 + Math.floor(Math.random() * 300));
const foreign = [];
const errors = [];

async function newPage({ clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { foreign.push(route.request().url()); return route.abort("blockedbyclient"); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  if (clock) await page.clock.install();
  return { context, page };
}
async function open(page, query) {
  await page.goto(`${server.base}?guide=0&${query}`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
}
const state = (page) => page.evaluate(() => window.__swot.state());
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const tile = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(`kpi-${i}`);
  return {
    main: el.querySelector(".kpi-main")?.textContent.trim() || "",
    was: el.querySelector(".vc-stat__was [aria-hidden]")?.textContent.trim() || "",
    unit: el.querySelector(".vc-stat__unit")?.textContent.trim() || "",
    note: el.querySelector(".kpi-note")?.textContent.trim() || ""
  };
}, id);
const t = (lang, key, vars = {}) => DICT[lang][key].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const tn = (lang, key, n, vars = {}) => t(lang, `${key}.${new Intl.PluralRules(lang === "de" ? "de-DE" : "en-GB").select(n) === "one" ? "one" : "other"}`, { n, ...vars });

try {
  // ---- PRESENTER: every scenario from Start to Summary, by its own actions, in both languages ------------
  for (const id of ["s1", "s2", "s3"]) {
    for (const lang of ["en", "de"]) {
      const { context, page } = await newPage();
      await open(page, `lang=${lang}&scenario=${id}`);
      const seen = [];
      const labels = [];
      for (let step = 0; step <= 5; step++) {
        const s = await state(page);
        seen.push(s.step);
        const tape = await text(page, "#mode-tag");
        const fiction = await page.$eval(".scenario-pick__label", (el) => el.offsetParent !== null && el.textContent.trim()).catch(() => "");
        labels.push(tape === "SIMULATION" && fiction === t(lang, "p.scenario"));
        if (step === 4) {
          // The decision: the bar's action adopts the ticked strategies, then the step plays on.
          await page.click("#btn-cta");
        }
        if (step < 5) await page.click("#btn-cta");
      }
      const end = await state(page);
      const title = await text(page, "#step-title");
      check("PRESENTER", seen.join() === "0,1,2,3,4,5" && end.step === 5 && labels.every(Boolean) && title.length > 10, `${id} in ${lang === "en" ? "English" : "German"} plays from Start to Summary by its own actions, with the SIMULATION tape and the fictional-company label on every step (${seen.join(" ")})`);
      await context.close();
    }
  }

  // Steps by click, by key and by address.
  {
    const { context, page } = await newPage();
    await open(page, "lang=en&scenario=s2&step=4");
    const linked = await state(page);
    check("PRESENTER", linked.step === 4 && linked.started && linked.challenged && linked.adopted === null && linked.selection.join() === runs.s2.recommended.join(), "?scenario=s2&step=4 opens the decision, the run played up to it, with the recommended strategies ticked and nothing adopted");
    await page.click('#steps .vc-step__button[data-step="2"]');
    const clicked = await state(page);
    await page.keyboard.press("ArrowRight");
    const right = await state(page);
    await page.keyboard.press("PageUp");
    const up = await state(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    // Two presses reach the decision; a third finds it open and moves nothing.
    await page.keyboard.press("ArrowRight");
    const blocked = await state(page);
    const told = (await text(page, "#announce")).trim();
    const nextDisabled = await page.$eval("#btn-next", (b) => b.disabled);
    const summaryDisabled = await page.$eval('#steps .vc-step__button[data-step="5"]', (b) => b.disabled);
    check("PRESENTER", clicked.step === 2 && right.step === 3 && up.step === 2, `a click on a step, the right arrow and PageUp move between steps (${clicked.step}, ${right.step}, ${up.step})`);
    check("PRESENTER", blocked.step === 4 && nextDisabled && summaryDisabled, "Next, the arrow keys and the step bar cannot pass the open decision");
    check("PRESENTER", told === EN["p.decide.first"], `the right arrow at the open decision tells a screen reader to decide first ("${told}")`);
    const url = new URL(page.url());
    check("PRESENTER", url.searchParams.get("scenario") === "s2" && url.searchParams.get("step") === "4", `the address follows the presenter (${url.search})`);
    await open(page, "lang=en&scenario=s3&step=5");
    const five = await state(page);
    check("PRESENTER", five.step === 5 && five.adopted?.join() === runs.s3.recorded.join(), "?scenario=s3&step=5 opens the Summary along the agents' recorded choice");
    await context.close();
  }

  // Play on a fake clock: 7 to 14 seconds a step, holds under a dialog, stops where the person acts.
  {
    const { context, page } = await newPage({ clock: true });
    await open(page, "lang=en&scenario=s2");
    await page.click("#btn-play");
    await page.clock.runFor(1000);
    const started = await state(page);
    await page.clock.runFor(30000);
    const waited = await state(page);
    check("PRESENTER", started.step === 1 && started.playing && waited.step === 1, `Play starts the agents on the first screen and stops at Complete, where the person acts (${started.step}, then ${waited.step} after 30 s)`);
    await page.click("#btn-cta");
    const dwell = async (from) => {
      let ms = 0;
      while (ms < 20000) {
        await page.clock.runFor(250);
        ms += 250;
        if ((await state(page)).step !== from) return ms;
      }
      return ms;
    };
    const d2 = await dwell(2);
    const d3 = await dwell(3);
    const at4 = await state(page);
    await page.clock.runFor(30000);
    const still4 = await state(page);
    check("PRESENTER", d2 >= 7000 && d2 <= 14250 && d3 >= 7000 && d3 <= 14250, `Play stays 7 to 14 seconds on a step (Challenge ${d2 / 1000} s, Assess ${d3 / 1000} s)`);
    check("PRESENTER", at4.step === 4 && still4.step === 4 && still4.playing, "Play stops at the decision and waits there");
    await page.click("#btn-cta");
    await page.click(".method-open");
    await page.clock.runFor(20000);
    const covered = await state(page);
    await page.keyboard.press("Escape");
    const d4 = await dwell(4);
    const ended = await state(page);
    const replay = await page.$eval("#btn-play", (b) => b.dataset.state);
    check("PRESENTER", covered.step === 4 && d4 >= 7000 && d4 <= 14250, `Play holds while the Method dialog is open, then reads the adopted step (${d4 / 1000} s)`);
    check("PRESENTER", ended.step === 5 && !ended.playing && replay === "replay", "the Summary ends the story: Play stops and its button offers Replay");
    await context.close();
  }

  // Another choice than the recorded one: the tiles equal the engine's figures for that choice.
  for (const lang of ["en", "de"]) {
    const { context, page } = await newPage();
    await open(page, `lang=${lang}&scenario=s2&step=4`);
    for (const id of runs.s2.recommended) await page.click(`#pick-${id}`);
    await page.click("#pick-R3");
    await page.click("#pick-R5");
    await page.click("#btn-cta");
    const run = runs.s2.byLang[lang];
    const f0 = figuresFor(run, []);
    const f = figuresFor(run, ["R3", "R5"]);
    const stake = await tile(page, "stake");
    const efe = await tile(page, "efe");
    const ok = stake.main === money(f.left, lang) && stake.was === money(f0.stake.value, lang) && efe.main === score(f.efe.after.value, lang) && efe.was === score(f0.efe.before.value, lang);
    check("PRESENTER", ok && (await state(page)).adopted.join() === "R3,R5", `in ${lang === "en" ? "English" : "German"}, adopting R3 and R5 instead gives the engine's figures: ${stake.was} to ${stake.main}, ${efe.was} to ${efe.main}`);
    await context.close();
  }

  // ---- TILES: the scenario's figures before it plays, the old value struck through after the decision --
  for (const id of ["s1", "s2", "s3"]) {
    for (const lang of ["en", "de"]) {
      const { context, page } = await newPage();
      await open(page, `lang=${lang}&scenario=${id}`);
      const run = runs[id].byLang[lang];
      const f = figuresFor(run, []);
      const stake = await tile(page, "stake");
      const items = await tile(page, "items");
      const efe = await tile(page, "efe");
      const cost = await tile(page, "cost");
      const partial = f.stake.priced < f.stake.of;
      const before = stake.main === money(f.stake.value, lang) && stake.unit === (partial ? t(lang, "p.kpi.stake.on", { priced: f.stake.priced, of: f.stake.of }) : "") && stake.note === t(lang, "p.kpi.stake.note")
        && items.main === t(lang, "p.kpi.items.value", { n: f.items.challenged, total: f.items.total }) && items.note === tn(lang, "p.kpi.items.added", f.items.added)
        && efe.main === score(f.efe.before.value, lang) && efe.note === t(lang, "p.kpi.efe.note")
        && /€/.test(cost.main) && cost.note === t(lang, "p.kpi.cost.note.sim")
        && !stake.was && !efe.was;
      check("TILES", before, `${id} in ${lang === "en" ? "English" : "German"}: before it plays, the tiles show ${stake.main} ${stake.unit}, ${items.main}, ${efe.main} and ${cost.main}, each with what it rests on`);
      await open(page, `lang=${lang}&scenario=${id}&step=5`);
      const g = figuresFor(run, runs[id].recorded);
      const s2 = await tile(page, "stake");
      const i2 = await tile(page, "items");
      const e2 = await tile(page, "efe");
      // The note counts the challenged items the choice addresses, not every item it raises (finding 6).
      const fixedIds = new Set(addressed(run, runs[id].recorded).keys());
      const named = new Set(run.issues.flatMap((i) => i.items || []));
      const addressedCount = run.items.filter((i) => !i.added && named.has(i.id) && fixedIds.has(i.id)).length;
      const gridAddressed = await page.evaluate(() => document.querySelectorAll('.vc-item[data-status="addressed"]').length);
      const after = s2.was === money(f.stake.value, lang) && s2.main === money(g.left, lang)
        && (g.upside > 0 ? s2.note === t(lang, "p.kpi.stake.after.upside", { upside: money(g.upside, lang) }) : s2.note === t(lang, "p.kpi.stake.after"))
        && e2.was === score(f.efe.before.value, lang) && e2.main === score(g.efe.after.value, lang)
        && i2.note === tn(lang, "p.kpi.items.addressed", addressedCount, { of: f.items.challenged }) && addressedCount > 0 && gridAddressed >= addressedCount;
      check("TILES", after, `${id} in ${lang === "en" ? "English" : "German"}: after the decision, ${s2.was} is struck through beside ${s2.main}, ${e2.was} beside ${e2.main}, and ${i2.note}`);
      await context.close();
    }
  }

  // ---- GRID: four fields, every item's state with a mark and a word, the matrices' tables -------------
  {
    const { context, page } = await newPage();
    await open(page, "lang=en&scenario=s2&step=2");
    const boxes = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".swot .vc-framework__area")].map((a) => { const r = a.getBoundingClientRect(); return [a.dataset.quad, { x: r.left, y: r.top }]; })));
    const q = Object.keys(boxes);
    check("GRID", q.join() === "strengths,weaknesses,opportunities,threats" && boxes.strengths.y < boxes.opportunities.y && boxes.weaknesses.y < boxes.threats.y && boxes.strengths.x < boxes.weaknesses.x && boxes.opportunities.x < boxes.threats.x, "four fields: strengths and weaknesses inside, above opportunities and threats outside; helpful on the left");
    const problems = [];
    let items = 0;
    const states = new Set();
    for (const id of ["s1", "s2", "s3"]) {
      for (const lang of ["en", "de"]) {
        for (let step = 0; step <= 5; step++) {
          if (step === 4) continue; // the decision takes the whole width; the grid steps aside
          await open(page, `lang=${lang}&scenario=${id}&step=${step}`);
          const html = await page.$eval("#swot", (el) => el.outerHTML);
          items += await page.$$eval("#swot .vc-item", (els) => els.length);
          for (const s of await page.$$eval("#swot .vc-item", (els) => els.map((e) => `${e.dataset.source}${e.dataset.status ? `+${e.dataset.status}` : ""}`))) states.add(s);
          if (frameworkProblems) for (const p of frameworkProblems(html)) problems.push(`${id} ${lang} step ${step}: ${p}`);
          const words = await page.$$eval("#swot .vc-item", (els) => els.filter((e) => !e.querySelector(".vc-item__state")?.textContent.trim() || !e.querySelector(".vc-item__mark")).length);
          if (words) problems.push(`${id} ${lang} step ${step}: ${words} item(s) without a mark or a word`);
        }
      }
    }
    const kinds = ["entered", "ai", "added"].every((s) => [...states].some((x) => x.startsWith(s))) && [...states].some((x) => x.endsWith("+challenged")) && [...states].some((x) => x.endsWith("+addressed"));
    check("GRID", !problems.length && items > 200 && kinds, `every one of ${items} items on every step of the three scenarios carries a mark and a word for its state, entered, AI, added, challenged and addressed among them${problems.length ? `: ${problems.slice(0, 5).join("; ")}` : ""}`);

    await open(page, "lang=en&scenario=s2&step=2");
    const risk = await page.$eval(".vc-risk", (el) => el.outerHTML);
    const rp = riskMatrixProblems ? riskMatrixProblems(risk) : ["no ViciDesign checkout"];
    const markers = await page.$$eval(".vc-risk__marker", (els) => els.length);
    check("GRID", !rp.length && markers === runs.s2.byLang.en.issues.length, `the risk matrix keeps Vici's rule, one marker an issue${rp.length ? `: ${rp.join("; ")}` : ""}`);
    // A card points at its items and its marker.
    await page.click('.issue[data-issue="I1"] .issue__select');
    const lit = await page.evaluate(() => ({ items: [...document.querySelectorAll('.vc-item[aria-current="true"]')].map((e) => e.dataset.id), marker: document.querySelector('.vc-risk__marker[aria-current="true"]')?.dataset.issue }));
    check("GRID", lit.items.join() === "w1" && lit.marker === "I1", `selecting an issue lights its items and its marker (${lit.items.join(", ")}; ${lit.marker})`);
    const table = async (sel) => {
      const before = await page.$eval(`${sel} details.numbers table`, (t) => t.getBoundingClientRect().height).catch(() => -1);
      await page.click(`${sel} details.numbers > summary`);
      const after = await page.$eval(`${sel} details.numbers table`, (t) => ({ h: t.getBoundingClientRect().height, rows: t.querySelectorAll("tbody tr").length }));
      return { closed: before === 0 || before === -1 ? true : before >= 0, ...after };
    };
    const rt = await table(".vc-risk");
    await open(page, "lang=en&scenario=s2&step=3");
    const it = await table(".ie");
    await open(page, "lang=en&scenario=s2&step=4");
    const tt = await table(".tows-wrap");
    check("GRID", rt.h > 0 && rt.rows === 6 && it.h > 0 && it.rows === 4 && tt.h > 0 && tt.rows === runs.s2.byLang.en.strategies.length, `the risk, IE and TOWS matrices each open a table of their numbers with one click (${rt.rows}, ${it.rows} and ${tt.rows} rows)`);
    await context.close();
  }

  // ---- METHOD: the rules behind every figure, in both languages ---------------------------------------
  for (const lang of ["en", "de"]) {
    const { context, page } = await newPage();
    await open(page, `lang=${lang}&scenario=s1`);
    await page.click(".method-open");
    await page.waitForSelector("#method[open]");
    const m = await page.$eval("#method", (d) => ({ text: d.textContent.replace(/\s+/g, " "), links: [...d.querySelectorAll("a")].map((a) => a.href), kpiRows: d.querySelectorAll("#m-kpis ~ .vc-table-wrap tbody tr, section[aria-labelledby='m-kpis'] tbody tr").length, scaleRows: d.querySelectorAll("section[aria-labelledby='m-factors'] tbody tr").length }));
    const sector = kpisFor("transport_logistics").filter((k) => k.sector === "transport_logistics");
    const J = lang === "en" ? "a structured judgement, not a measurement" : "ein strukturiertes Urteil, keine Messung";
    const sw1 = lang === "en" ? ["2.50", "2.70", "1.90", "2.85", "VIII", "V"] : ["2,50", "2,70", "1,90", "2,85", "VIII", "V"];
    const parts = {
      david: /Fred R\. David/.test(m.text) && /Strategic Management/.test(m.text),
      weihrich: /Heinz Weihrich/.test(m.text) && m.links.some((h) => h.includes("doi.org/10.1016/0024-6301")),
      scales: m.scaleRows === 4 && m.text.includes(DICT[lang]["m.scale.ife.1"]) && m.text.includes(DICT[lang]["m.scale.efe.4"]),
      sw1: sw1.every((x) => m.text.includes(x)) && m.text.includes(DICT[lang]["m.example.h"]),
      kpis: m.kpiRows === sector.length && sector.every((k) => m.text.includes(k.name[lang])),
      rate: m.text.includes(lang === "en" ? "0.894" : "0,894") && m.text.includes(lang === "en" ? "20 November 2026" : "20. November 2026"),
      judgement: m.text.includes(J)
    };
    const missing = Object.entries(parts).filter(([, ok]) => !ok).map(([k]) => k);
    check("METHOD", !missing.length, `in ${lang === "en" ? "English" : "German"} the Method dialog names David and Weihrich with their sources, the scales, SW1 worked through, the ${sector.length} sector KPIs, the rate and its date, and that a score is ${J}${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
    await context.close();
  }

  check("PRESENTER", !errors.length, `no page error${errors.length ? `: ${errors.slice(0, 3).join("; ")}` : ""}`);
  check("PRESENTER", !foreign.length, `no request to another host${foreign.length ? `: ${foreign.slice(0, 3).join(", ")}` : ""}`);
} finally {
  await server.close();
  await browser.close();
}

let failed = 0;
const tokens = [];
for (const [name, list] of Object.entries(sections)) {
  for (const [ok, what] of list) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  const f = list.filter(([ok]) => !ok).length;
  failed += f;
  if (!f && list.length) tokens.push(`${name} OK`);
}
console.log("");
for (const tk of tokens) console.log(tk);
if (failed) { console.log(`\n${failed} presenter checks failed.`); process.exit(1); }
console.log("ALL PRESENTER CHECKS OK");

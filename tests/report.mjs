// The report and its three downloads in Chromium (brief 9 and 9.1; PLAN.md, section 7; AC-13, AC-20, AC-21).
// No test calls the real API: the live runs answer from tests/lib/fake-claude.mjs. Groups, each printing its
// line when every check holds:
//   pdf      each scenario in English and German prints through the page's own Save as PDF, and every page
//            of the PDF carries the footer the brief sets: "Created with SWOT Challenger" and the address,
//            "Built by Victor Pflüger · page x of y" (German: "Erstellt mit …", "Erstellt von … · Seite x von
//            y"), once each; the cover comes first, the management summary opens page 2, every section opens
//            a page in the order of brief 9.1, and "About this report" is on the last page. With Vici's
//            margin-box rule taken out, the same check fails                                 REPORT PDF OK
//   html     the HTML file: its policy loads nothing, no script, no event attribute, nothing that loads;
//            opened with the network shut it asks for nothing, keeps the report's light look (the bare
//            markup without its styles does not), holds every section and the figures, and printed it
//            carries the footer on every page                                               REPORT HTML OK
//   json     the file for the Prototype Ideator passes the shared schema and its references, the Ideator's
//            own reader (IDEATOR_DIR) reads it, and it holds no key, prompt or thinking      REPORT JSON OK
//   figures  with the recorded choice and with another, the report and the handoff file carry the tiles'
//            figures, and those are the engine's: at stake and left, items challenged, the response to the
//            market before and after, where the company stands                            REPORT FIGURES OK
//   ui       the Summary step: the bar's one primary action opens the report, the card's downloads and
//            hint, the preview, the Ideator link in a new tab, Save run as simulation under the downloads
//            after a live run, and no screen promising the report for a later version       REPORT UI OK
//   live     a live run's report names the mode, the model and the setting; research off gives the
//            knowledge-cutoff note, research on the sources with the dates they were read; a run stopped at
//            its cap says so on every printed page; no download holds the key, and the browser keeps only
//            the allowed keys                                                               REPORT LIVE OK
//   names    the files are swot-challenger-<company>-<YYYY-MM-DD>-<lang>, umlauts written out; the PDF
//            takes its name from the page's title while the print dialog is open           REPORT NAMES OK
// Every page fails on a page error, a console error, a policy violation or a request to another host.
// Usage: node tests/report.mjs [group…] [--require-ideator]
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { APP_ROOT, ONLY, launchBrowser, serveStatic, NETWORK_NOISE, MOCK_KEY, outDir } from "./lib/harness.mjs";
import { pdfPages } from "./lib/pdf-text.mjs";
import { SCEN, answers, scripted, openLivePage, closeLivePage, until, startRun, toDialog, wholeRun } from "./lib/live-page.mjs";
import { search, tool } from "./lib/fake-claude.mjs";
import { handoffProblems } from "../js/handoff.js";
import { assemble, figuresFor } from "../js/scenario.js";
import { addressed, issuesOf, sourceOf } from "../js/simulation.js";
import { money, score, date as fmtDate } from "../js/format.js";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";

const DICT = { en: EN, de: DE };
const T = (lang, key, vars = {}) => DICT[lang][key].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const GROUPS = ["pdf", "html", "json", "figures", "ui", "live", "names"];
const LINES = { pdf: "REPORT PDF OK", html: "REPORT HTML OK", json: "REPORT JSON OK", figures: "REPORT FIGURES OK", ui: "REPORT UI OK", live: "REPORT LIVE OK", names: "REPORT NAMES OK" };
const run = ONLY.length ? GROUPS.filter((g) => ONLY.includes(g)) : GROUPS;
const unknownGroups = ONLY.filter((g) => !GROUPS.includes(g));
if (unknownGroups.length) { console.log(`FAIL  unknown group ${unknownGroups.join(", ")}; the groups are ${GROUPS.join(", ")}`); process.exit(1); }

const results = Object.fromEntries(GROUPS.map((g) => [g, []]));
let group = "";
const check = (ok, what) => results[group].push([!!ok, what]);

// The footer as brief 9 words it, written out here rather than read from the dictionaries.
const ADDRESS = "https://victorpflueger.github.io/SWOT-challenger/";
const FOOT = {
  en: { start: `Created with SWOT Challenger\n${ADDRESS}`, end: (x, y) => `Built by Victor Pflüger · page ${x} of ${y}`, fixed: `Created with SWOT Challenger · ${ADDRESS}` },
  de: { start: `Erstellt mit SWOT Challenger\n${ADDRESS}`, end: (x, y) => `Erstellt von Victor Pflüger · Seite ${x} von ${y}`, fixed: `Erstellt mit SWOT Challenger · ${ADDRESS}` }
};
// A PDF's text compared without white space, its ligatures read back as letters ("ﬁ" as "fi").
const fold = (s) => String(s ?? "").normalize("NFKC").replace(/\s+/gu, "");
const SECTIONS = (lang) => ["rp.sum.h", "rp.swot.h", "rp.issues.h", "rp.factors.h", "rp.tows.h", "rp.method.h", "rp.about.h"].map((k) => T(lang, k));
const today = () => new Date().toISOString().slice(0, 10);

// The Prototype Ideator's reader, from the checkout at IDEATOR_DIR (or ../PrototypeIdeator).
const requireIdeator = process.argv.includes("--require-ideator");
const IDEATOR = process.env.IDEATOR_DIR || path.resolve(APP_ROOT, "..", "PrototypeIdeator");
const ideatorFile = path.join(IDEATOR, "js", "handoff.js");
const readHandoff = existsSync(ideatorFile) ? (await import(pathToFileURL(ideatorFile).href)).readHandoff : null;

const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 9100 + Math.floor(Math.random() * 300));
const BASE = `${server.base}?guide=0`;
const OUT = await outDir("report");

// ---- pages ----------------------------------------------------------------------------------------------
/** A page of the app at `query`, every foreign host blocked and recorded, errors and policy violations kept. */
async function openPage({ query, lang = "en", viewport = { width: 1280, height: 720 }, theme = null }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  await context.addInitScript((theme) => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`.trim()));
    if (theme) try { localStorage.setItem("vc-theme", theme); } catch { /* no storage */ }
  }, theme);
  const external = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { external.push(route.request().url()); route.abort("blockedbyclient"); });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.goto(`${BASE}&lang=${lang}&${query}`);
  await page.waitForSelector('html[data-boot="ready"]');
  return { page, context, errors, external };
}
async function closePage(p, label) {
  const csp = await p.page.evaluate(() => window.__csp).catch(() => []);
  const all = [...p.errors, ...csp, ...p.external];
  check(!all.length, `${label}: no page error, console error, policy violation or foreign host${all.length ? `: ${all.slice(0, 4).join(" | ")}` : ""}`);
  await p.context.close();
}
const state = (page) => page.evaluate(() => window.__swot.state());
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => "");

/**
 * Save as PDF the way a person does it: the button, with the browser's print dialog stood in for, so the test
 * sees the page as the dialog would and prints it with Chromium; then the dialog closes (afterprint).
 */
async function printVia(page, button) {
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  const titleBefore = await page.title();
  await page.click(button);
  const during = await page.evaluate(() => {
    const box = document.querySelector("body > [data-vc-print]");
    return { title: document.title, printed: window.__printed, copy: !!box?.querySelector(".vc-report"), marked: !!box?.hasAttribute("data-vc-margin-boxes") };
  });
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  const after = await page.evaluate(() => ({ title: document.title, copy: !!document.querySelector("[data-vc-print]") }));
  return { pdf, titleBefore, during, after };
}

/** What each printed page says of its footer: the start once, its own number of the count, the notice. */
function footerProblems(buf, lang, { notice = "", fixed = "" } = {}) {
  const pages = pdfPages(buf).map((p) => fold(p.text));
  const start = fold(FOOT[lang].start);
  const problems = [];
  if (pages.length < 8) problems.push(`it printed ${pages.length} page(s), fewer than the report's eight sections`);
  pages.forEach((txt, i) => {
    const count = txt.split(start).length - 1;
    if (count !== 1) problems.push(`page ${i + 1} of ${pages.length} shows the footer's start ${count} times`);
    if (!txt.includes(fold(FOOT[lang].end(i + 1, pages.length)))) problems.push(`page ${i + 1} lacks "${FOOT[lang].end(i + 1, pages.length)}"`);
    if (notice && !txt.includes(fold(notice))) problems.push(`page ${i + 1} lacks the notice`);
    if (fixed && txt.includes(fold(fixed))) problems.push(`page ${i + 1} prints the fixed footer beside the margin boxes`);
  });
  const bodies = pages.map((txt, i) => txt.replace(start, "").replace(fold(FOOT[lang].end(i + 1, pages.length)), "").replace(fold(notice), ""));
  return { pages, bodies, problems };
}

/** A download from clicking `button`: { name, text }. */
async function download(page, button) {
  const [d] = await Promise.all([page.waitForEvent("download"), page.click(button)]);
  return { name: d.suggestedFilename(), text: await readFile(await d.path(), "utf8") };
}

/** The four tiles as the header shows them. */
const tiles = (page) => page.evaluate(() => Object.fromEntries(["stake", "items", "efe", "cost"].map((id) => {
  const el = document.getElementById(`kpi-${id}`);
  return [id, {
    main: el.querySelector(".kpi-main")?.textContent.trim() || "",
    was: el.querySelector(".vc-stat__was [aria-hidden]")?.textContent.trim() || "",
    note: el.querySelector(".kpi-note")?.textContent.trim() || ""
  }];
})));
/** The four key figures on the report's second page, in the tiles' order. */
const reportFigures = (page) => page.evaluate(() => [...document.querySelectorAll("#report .report-figures > .report-figure")].map((f) => ({
  label: f.querySelector("dt")?.textContent.trim() || "",
  main: f.querySelector(".report-figure__main")?.textContent.trim() || "",
  was: f.querySelector(".report-figure__was")?.textContent.trim() || "",
  note: f.querySelector(".report-figure__note")?.textContent.trim() || ""
})));

// ---- PDF -------------------------------------------------------------------------------------------------
async function pdf() {
  for (const id of ["s1", "s2", "s3"]) {
    for (const lang of ["en", "de"]) {
      const p = await openPage({ query: `scenario=${id}&step=5`, lang });
      const company = SCEN[id].company.name;
      const r = await printVia(p.page, "#rp-pdf");
      check(r.during.printed === 1 && r.during.copy && r.during.marked, `${id} ${lang}: Save as PDF opens the print dialog once, on the report's print copy, marked for the margin boxes`);
      const { pages, bodies, problems } = footerProblems(r.pdf, lang, { fixed: FOOT[lang].fixed });
      await writeFile(path.join(OUT, `${id}-${lang}.pdf`), r.pdf);
      check(!problems.length, `${id} ${lang}: each of the ${pages.length} pages carries "${FOOT[lang].start.split("\n")[0]}", the address and "${FOOT[lang].end("x", "y")}", once${problems.length ? `: ${problems.slice(0, 4).join("; ")}` : ""}`);
      const cover = bodies[0] || "";
      check(cover.startsWith(fold("SWOT Challenger")) && cover.includes(fold(T(lang, "rp.title", { company }))) && cover.includes(fold(T(lang, "rp.ai"))) && cover.includes(fold(T(lang, "rp.fiction"))),
        `${id} ${lang}: page 1 is the cover: the tool, "${T(lang, "rp.title", { company })}", "${T(lang, "rp.ai")}" and "${T(lang, "rp.fiction")}"`);
      const headline = await text(p.page, "#report .report-headline");
      check(bodies[1]?.startsWith(fold(T(lang, "rp.sum.h"))) && bodies[1].includes(fold(headline)) && headline.length > 20, `${id} ${lang}: the management summary opens page 2, with the Writer's headline`);
      const opens = SECTIONS(lang).map((h) => bodies.findIndex((b) => b.startsWith(fold(h))));
      check(opens.every((x, i) => x > 0 && (i === 0 || x > opens[i - 1])), `${id} ${lang}: each section opens a page, in the order of brief 9.1 (pages ${opens.map((x) => x + 1).join(", ")})`);
      const last = bodies.at(-1) || "";
      check(last.startsWith(fold(T(lang, "rp.about.h"))) && last.includes(fold(T(lang, "rp.about.generated"))) && last.includes(fold(T(lang, "p.byline.label"))) && last.includes(fold("Victor Pflüger")),
        `${id} ${lang}: the last page is "${T(lang, "rp.about.h")}", with the byline and "${T(lang, "rp.about.generated").slice(0, 40)}…"`);
      check(r.after.title === r.titleBefore && !r.after.copy, `${id} ${lang}: when the print dialog closes, the page's title and the page come back`);
      await closePage(p, `${id} ${lang} PDF`);
    }
  }
  // The longest summary the contract allows (schemas/swot.js: a headline of 120 characters, a situation of
  // 600, three findings of 300, a recommendation of 400, five assumptions of 200): it opens page 2 and flows
  // on, and every page still carries the footer.
  {
    const fillTo = (max, sentence) => { let out = sentence; while (`${out} ${sentence}`.length <= max) out = `${out} ${sentence}`; return out; };
    const a = answers("s2", "en");
    a.summary = {
      headline: fillTo(120, "Arvento sells hours."),
      situation: fillTo(600, "The team names its strengths plainly and leaves the risks open."),
      findings: [1, 2, 3].map(() => fillTo(300, "The service model rests on data the company does not control.")),
      recommendation: fillTo(400, "Settle who may use the data before selling the first hour."),
      assumptions: [1, 2, 3, 4, 5].map(() => fillTo(200, "Customers use their data rights once others offer service."))
    };
    const p = await openLivePage(browser, BASE, { script: scripted(a) });
    await wholeRun(p.page);
    const sizes = await p.page.evaluate(() => [...document.querySelectorAll("#report .report-page--summary :is(.report-headline, p, li)")].reduce((n, el) => n + el.textContent.length, 0));
    const r = await printVia(p.page, "#rp-pdf");
    const { pages, bodies, problems } = footerProblems(r.pdf, "en", { fixed: FOOT.en.fixed });
    const opens = SECTIONS("en").map((h) => bodies.findIndex((b) => b.startsWith(fold(h))));
    check(!problems.length && opens[0] === 1 && opens.every((x, i) => i === 0 || x > opens[i - 1]), `the longest summary the contract allows (${sizes} characters on its page) opens page 2 and runs to page ${opens[1]}; all ${pages.length} pages carry the footer${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
    await writeFile(path.join(OUT, "longest-summary-en.pdf"), r.pdf);
    await closeLivePage(p, "longest summary", check);
  }
  // Control: without Vici's margin-box rule the footer check must fail, or it proves nothing.
  const p = await openPage({ query: "scenario=s2&step=5", lang: "en" });
  const dropped = await p.page.evaluate(() => {
    let n = 0;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (let i = rules.length - 1; i >= 0; i--) if (rules[i] instanceof CSSPageRule && rules[i].selectorText === "vc-report") { sheet.deleteRule(i); n += 1; }
    }
    return n;
  });
  const r = await printVia(p.page, "#rp-pdf");
  const control = footerProblems(r.pdf, "en");
  check(dropped >= 1 && control.problems.length > 0, `control: with Vici's @page vc-report rule taken out (${dropped} rule), the footer check fails (${control.problems[0] || "it passed"})`);
  await closePage(p, "control");
}

// ---- HTML ------------------------------------------------------------------------------------------------
async function html() {
  for (const [id, lang] of [["s2", "en"], ["s3", "de"], ["s1", "en"]]) {
    const p = await openPage({ query: `scenario=${id}&step=5`, lang });
    const figures = await reportFigures(p.page);
    const look = await p.page.evaluate(() => {
      const r = document.getElementById("report");
      const lk = (el) => { const s = getComputedStyle(el); return [s.fontSize, s.fontWeight, s.color, s.backgroundColor].join(" "); };
      return { title: lk(r.querySelector(".vc-report__title")), figure: lk(r.querySelector(".report-figure")), state: lk(r.querySelector(".report-state")), bare: r.outerHTML };
    });
    const file = await download(p.page, "#rp-html");
    await writeFile(path.join(OUT, file.name), file.text);
    const f = file.text;
    check(f.startsWith("<!DOCTYPE html>") && /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">/.test(f), `${id} ${lang}: the file's policy is exactly default-src 'none'; style-src 'unsafe-inline'; img-src data:`);
    const tags = [...f.matchAll(/<[a-z][^>]*>/gi)].map((m) => m[0]);
    const loads = [
      ...(/<script\b/i.test(f) ? ["a script"] : []),
      ...tags.filter((t) => /\son[a-z]+\s*=/i.test(t)).map((t) => `an event attribute in ${t.slice(0, 60)}`),
      ...tags.filter((t) => /^<(link|iframe|object|embed|video|audio|source|base)\b/i.test(t)).map((t) => t.slice(0, 60)),
      ...tags.filter((t) => /\s(src|srcset|poster|data)\s*=\s*"(?!data:)/i.test(t)).map((t) => t.slice(0, 80)),
      ...[...f.matchAll(/url\(\s*['"]?(?!data:)([^)'"]+)/gi)].map((m) => `url(${m[1]})`),
      ...(/@import|@font-face/i.test(f) ? ["@import or @font-face"] : [])
    ];
    check(!loads.length, `${id} ${lang}: no script, no event attribute and nothing that loads${loads.length ? `: ${loads.slice(0, 4).join("; ")}` : ""}`);
    check(/<html lang="(en-GB|de)" data-theme="light"/.test(f), `${id} ${lang}: the file is in the report's language and Vici's light theme`);
    const words = fold(f.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    const missing = [...SECTIONS(lang), T(lang, "rp.title", { company: SCEN[id].company.name })].filter((h) => !words.includes(fold(h)));
    check(!missing.length, `${id} ${lang}: the file holds every section${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
    check(figures.length === 4 && figures.every((x) => words.includes(fold(x.main))), `${id} ${lang}: and the key figures (${figures.map((x) => x.main).join(", ")})`);

    // Opened on its own, with the network shut: it asks for nothing and keeps the look.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const asked = [];
    await ctx.route("**/*", (route) => { asked.push(route.request().url()); route.abort(); });
    const open = async (markup) => {
      const q = await ctx.newPage();
      const refused = [];
      q.on("console", (m) => { if (m.type() === "error") refused.push(m.text()); });
      await q.setContent(markup, { waitUntil: "load" });
      const seen = await q.evaluate(() => {
        const r = document.querySelector(".vc-report");
        const lk = (el) => { const s = getComputedStyle(el); return [s.fontSize, s.fontWeight, s.color, s.backgroundColor].join(" "); };
        return { title: lk(r.querySelector(".vc-report__title")), figure: lk(r.querySelector(".report-figure")), state: lk(r.querySelector(".report-state")), h1: document.querySelectorAll("h1").length, sheet: getComputedStyle(r.querySelector(".vc-report__page")).backgroundColor, asks: CSS.supports("at-rule(@bottom-left)") };
      });
      return { q, seen, refused };
    };
    const opened = await open(f);
    check(!asked.length && !opened.refused.length, `${id} ${lang}: opened with the network shut it asks for nothing${asked.length || opened.refused.length ? `: ${[...asked, ...opened.refused].slice(0, 3).join(" | ")}` : ""}`);
    const same = ["title", "figure", "state"].filter((k) => opened.seen[k] !== look[k]);
    check(!same.length && opened.seen.sheet === "rgb(255, 255, 255)" && opened.seen.h1 === 1, `${id} ${lang}: it keeps the report's look, white sheets and one h1${same.length ? `; differs: ${same.map((k) => `${k} ${opened.seen[k]} instead of ${look[k]}`).join("; ")}` : ""}`);
    if (id === "s2") {
      const planted = await open(f.replace("</body>", '<img src="https://example.org/planted.png" alt="planted"></body>'));
      check(asked.length > 0 || planted.refused.length > 0, `${id} ${lang}: control: a picture from another host planted in the file is caught`);
      asked.length = 0;
    }
    const bare = await open(`<!DOCTYPE html><html lang="en-GB"><body>${look.bare}</body></html>`);
    check(["title", "figure", "state"].some((k) => bare.seen[k] !== look[k]), `${id} ${lang}: control: the bare markup without the file's styles fails the look test`);
    // Printed: the footer on every page. A file has no script, so only a browser that answers @supports
    // at-rule() keeps its fixed footer out; without margin rules in the file its fixed footer prints instead.
    const printed = await opened.q.pdf({ preferCSSPageSize: true, printBackground: true });
    const boxes = /@bottom-right/.test(f);
    if (boxes) {
      const { pages, problems } = footerProblems(printed, lang, { fixed: opened.seen.asks ? FOOT[lang].fixed : "" });
      check(!problems.length, `${id} ${lang}: printed, the file carries the footer with the page number on each of its ${pages.length} pages${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
    } else {
      const pages = pdfPages(printed).map((x) => fold(x.text));
      check(pages.length >= 8 && pages.every((x) => x.includes(fold(FOOT[lang].fixed))), `${id} ${lang}: printed, the file carries its fixed footer on each of its ${pages.length} pages`);
    }
    await ctx.close();
    await closePage(p, `${id} ${lang} HTML`);
  }
}

// ---- JSON ------------------------------------------------------------------------------------------------
async function json() {
  if (!readHandoff) check(!requireIdeator, `the Prototype Ideator's reader at ${ideatorFile} (set IDEATOR_DIR)${requireIdeator ? "" : ": not found, so its reading is skipped"}`);
  for (const id of ["s1", "s2", "s3"]) {
    for (const lang of ["en", "de"]) {
      const p = await openPage({ query: `scenario=${id}&step=5`, lang });
      const file = await download(p.page, "#rp-json");
      await writeFile(path.join(OUT, file.name), file.text);
      const j = JSON.parse(file.text);
      const problems = handoffProblems(j);
      check(!problems.length && j.schema === "strategy-challenge/1" && j.language === lang && j.company.name === SCEN[id].company.name, `${id} ${lang}: ${file.name} passes the shared schema and its references${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
      if (readHandoff) {
        const read = readHandoff(j, { file: file.name });
        check(read.ok, `${id} ${lang}: the Prototype Ideator's own reader reads it${read.ok ? "" : `: ${JSON.stringify(read.errors || read.problems || read).slice(0, 160)}`}`);
        const planted = JSON.parse(file.text);
        delete planted.figures;
        check(!readHandoff(planted, { file: "planted.json" }).ok, `${id} ${lang}: control: the Ideator refuses the same file without its figures`);
      }
      check(!/sk-ant-/.test(file.text) && !/"(thinking|signature|system|prompt|messages)"\s*:/.test(file.text), `${id} ${lang}: no key, prompt or thinking in it`);
      await closePage(p, `${id} ${lang} JSON`);
    }
  }
}

// ---- FIGURES ---------------------------------------------------------------------------------------------
/** Moves the decision's ticks to exactly `want`, adopts them and goes on to the Summary. */
async function adopt(page, want) {
  const now = new Set((await state(page)).selection);
  for (const sid of new Set([...now, ...want])) if (now.has(sid) !== want.includes(sid)) await page.click(`#pick-${sid}`);
  await page.click("#btn-cta");
  await page.waitForFunction((w) => { const a = window.__swot.state().adopted; return !!a && a.length === w.length && w.every((x) => a.includes(x)); }, want);
  for (let i = 0; i < 3 && (await state(page)).step !== 5; i++) {
    await page.click("#btn-cta");
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => window.__swot.state().step === 5);
}

async function figures() {
  for (const id of ["s1", "s2", "s3"]) {
    const ids = SCEN[id].answers.en.strategise.strategies.map((x) => x.id);
    const recorded = [...SCEN[id].recorded_choice];
    const other = ids.filter((x) => !recorded.includes(x)).slice(0, 2);
    for (const lang of ["en", "de"]) {
      for (const [label, choice] of [["the recorded choice", recorded], ["another choice", other]]) {
        const p = await openPage({ query: `scenario=${id}&step=4`, lang });
        await adopt(p.page, choice);
        const t = await tiles(p.page);
        const rf = await reportFigures(p.page);
        const file = JSON.parse((await download(p.page, "#rp-json")).text);
        const runData = assemble(SCEN[id], lang);
        const f = figuresFor(runData, choice);
        // Items challenged counts the SWOT's items an issue names, of the items entered and completed; an item
        // the Red team added is not counted, since it was not in the SWOT to challenge.
        const counted = runData.items.filter((it) => sourceOf(it) !== "added");
        const challenged = counted.filter((it) => issuesOf(runData, it.id).length);
        const fixed = addressed(runData, choice);
        const tag = `${id} ${lang}, ${label} (${choice.join(", ") || "none"})`;
        // The engine, then the tiles, then the report, then the file.
        check(t.stake.main === money(f.left, lang) && t.stake.was === money(f.stake.value, lang) && t.efe.main === score(f.efe.after.value, lang) && (t.efe.was || t.efe.main) === score(f.efe.before.value, lang),
          `${tag}: the tiles are the engine's: ${t.stake.was} to ${t.stake.main} at stake, response to the market ${t.efe.was || t.efe.main} to ${t.efe.main}`);
        const order = ["stake", "items", "efe", "cost"];
        const diff = order.filter((k, i) => !rf[i] || rf[i].main !== t[k].main || rf[i].was !== t[k].was || rf[i].note !== t[k].note);
        check(rf.length === 4 && !diff.length, `${tag}: the report's key figures are the tiles', value, old value and note${diff.length ? `; differ: ${diff.map((k) => `${k} ${JSON.stringify(rf[order.indexOf(k)])} vs ${JSON.stringify(t[k])}`).join("; ")}` : ""}`);
        check(t.items.main === T(lang, "p.kpi.items.value", { n: challenged.length, total: counted.length }) && file.figures.pressure.before === challenged.length && file.figures.pressure.of === counted.length && file.figures.pressure.after === challenged.filter((it) => !fixed.has(it.id)).length,
          `${tag}: items challenged: ${t.items.main} on the tile, ${file.figures.pressure.before} of ${file.figures.pressure.of} in the file, ${file.figures.pressure.after} left unaddressed`);
        check(file.figures.at_stake_eur_year === f.stake.value && file.figures.left_eur_year === f.left && file.figures.upside_eur_year === f.upside && file.figures.score.before === f.efe.before.value && file.figures.score.after === f.efe.after.value && money(file.figures.left_eur_year, lang) === t.stake.main,
          `${tag}: the file carries the engine's numbers, the ones the tiles show`);
        const stand = await text(p.page, "#report .report-stand");
        const moved = f.ie.after.cell !== f.ie.before.cell;
        const ieCells = await p.page.$$eval("#report .report-ie__table tbody tr:nth-child(3) td", (tds) => tds.map((td) => td.textContent.trim()));
        check(stand.includes(f.ie.before.cell) && (!moved || stand.includes(f.ie.after.cell)) && ieCells[0] === f.ie.before.cell && (!choice.length || ieCells[1] === f.ie.after.cell),
          `${tag}: where the company stands: cell ${f.ie.before.cell}${moved ? ` to ${f.ie.after.cell}` : ""}, on page 2 and beside the IE matrix`);
        await closePage(p, tag);
      }
    }
  }
}

// ---- UI --------------------------------------------------------------------------------------------------
async function ui() {
  for (const lang of ["en", "de"]) {
    const p = await openPage({ query: "scenario=s2&step=5", lang });
    const bar = await p.page.evaluate(() => {
      const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
      const primaries = [...document.querySelectorAll(".vc-button")].filter((b) => visible(b) && !b.closest("dialog") && !/vc-button--(secondary|ghost|quiet|link)/.test(b.className) && !b.matches(".vc-button--sm.vc-button--secondary"));
      return { cta: document.getElementById("btn-cta")?.textContent.replace(/\s+/g, " ").trim(), primaries: primaries.map((b) => b.id || b.textContent.trim()) };
    });
    check(bar.cta === T(lang, "rp.cta") && bar.primaries.length === 1 && bar.primaries[0] === "btn-cta", `${lang}: the bar's one primary action is "${T(lang, "rp.cta")}" (primary buttons: ${bar.primaries.join(", ")})`);
    const card = await p.page.evaluate(() => {
      const b = (id) => document.getElementById(id);
      const pdfBtn = b("rp-pdf");
      return {
        pdf: pdfBtn?.textContent.trim(), html: b("rp-html")?.textContent.trim(), json: b("rp-json")?.textContent.trim(),
        secondary: ["rp-pdf", "rp-html", "rp-json"].every((id) => b(id)?.classList.contains("vc-button--secondary")),
        hint: b(pdfBtn?.getAttribute("aria-describedby") || "")?.textContent.trim() || "",
        thumbs: document.querySelectorAll("#rp-open .report-thumb").length,
        ideator: { href: b("rp-ideator")?.getAttribute("href"), target: b("rp-ideator")?.getAttribute("target"), rel: b("rp-ideator")?.getAttribute("rel"), text: b("rp-ideator")?.textContent.trim() }
      };
    });
    check(card.pdf === T(lang, "rp.pdf") && card.html === T(lang, "rp.html.label") && card.json === T(lang, "rp.json.label") && card.secondary, `${lang}: the panel offers "${card.pdf}", "${card.html}" and "${card.json}", all three secondary beside the bar's action`);
    check(card.hint.startsWith(T(lang, "rp.pdf.hint")), `${lang}: Save as PDF is described by "${T(lang, "rp.pdf.hint")}"`);
    check(card.ideator.href === "https://victorpflueger.github.io/PrototypeIdeator/" && card.ideator.target === "_blank" && /noopener/.test(card.ideator.rel || "") && card.ideator.text === `${T(lang, "rp.ideator")}${T(lang, "p.new.tab")}`, `${lang}: "${T(lang, "rp.ideator")}" opens the Prototype Ideator in a new tab and says so`);
    check(card.thumbs === 2, `${lang}: the card shows the report's first two pages as a preview`);
    // The bar's action opens the report at full size, with the same downloads; Save as PDF is primary there.
    await p.page.click("#btn-cta");
    await p.page.waitForSelector("#report-dialog[open]");
    const dlg = await p.page.evaluate(() => ({
      pages: document.querySelectorAll("#report-dialog #report > .vc-report__page").length,
      pdfPrimary: !document.getElementById("rp-pdf-dialog")?.classList.contains("vc-button--secondary"),
      others: ["rp-html-dialog", "rp-json-dialog", "rp-ideator-dialog"].every((id) => !!document.getElementById(id)),
      sheet: getComputedStyle(document.querySelector("#report .vc-report__page")).backgroundColor
    }));
    check(dlg.pages === 8 && dlg.pdfPrimary && dlg.others && dlg.sheet === "rgb(255, 255, 255)", `${lang}: "${T(lang, "rp.cta")}" opens the report's eight sections on white sheets, Save as PDF primary above them with the other downloads`);
    await p.page.keyboard.press("Escape");
    await p.page.waitForFunction(() => !document.getElementById("report-dialog").open);
    // The thumbnails open it too.
    await p.page.click("#rp-open");
    await p.page.waitForSelector("#report-dialog[open]");
    check(true, `${lang}: the preview opens the report as well`);
    await p.page.keyboard.press("Escape");
    // The dark theme keeps the paper light.
    await closePage(p, `${lang} Summary`);

    const dark = await openPage({ query: "scenario=s1&step=5", lang, theme: "dark" });
    const sheet = await dark.page.evaluate(() => ({ theme: document.documentElement.getAttribute("data-theme"), bg: getComputedStyle(document.querySelector("#report .vc-report__page")).backgroundColor }));
    check(sheet.theme === "dark" && sheet.bg === "rgb(255, 255, 255)", `${lang}: in the dark theme the report's sheets stay white`);
    await closePage(dark, `${lang} dark`);

    // Start: the version note promises nothing for a later version.
    const s = await openPage({ query: "scenario=s2", lang });
    const start = await s.page.evaluate(() => ({ note: document.querySelector(".version-note")?.textContent.trim(), all: document.body.innerText }));
    const old = ["come with 0.4.0", "comes with version 0.4.0", "kommt mit 0.4.0", "kommt mit Version 0.4.0"];
    check(start.note === T(lang, "p.version") && start.note.includes("0.4.0") && !old.some((x) => start.all.includes(x)), `${lang}: Start says "${start.note}", and no screen says the report comes later`);
    await closePage(s, `${lang} Start`);
  }
  // After a live run, Save run as simulation stays under the downloads.
  const p = await openLivePage(browser, BASE, { script: scripted(answers("s2", "en")) });
  await toDialog(p.page);
  await startRun(p.page);
  await until(p.page, ["check"]);
  await p.page.click("#btn-cta");
  await until(p.page, ["decide"]);
  await p.page.click("#btn-cta");
  await until(p.page, ["done"]);
  const order = await p.page.evaluate(() => {
    const card = document.querySelector(".report-card");
    const save = document.getElementById("btn-save-run");
    return { card: !!card, save: !!save, after: !!(card && save && (card.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING)) };
  });
  check(order.card && order.save && order.after, "after a live run, Save run as simulation stays under the report's downloads");
  await closeLivePage(p, "live Summary", check);
}

// ---- LIVE ------------------------------------------------------------------------------------------------
async function storageAfter(page) {
  return page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    idb: (await indexedDB.databases?.())?.map((d) => d.name) || [],
    caches: await caches.keys(),
    cookie: document.cookie
  }));
}
async function live() {
  const PRESET = { thorough: { model: "claude-sonnet-5-5", effort: "medium", thinking: undefined } };
  for (const lang of ["en", "de"]) {
    // Research off: the cover names the run; the sources say what the agents knew.
    {
      const p = await openLivePage(browser, BASE, { lang, script: scripted(answers("s2", lang), { think: true }) });
      await toDialog(p.page);
      await startRun(p.page);
      await until(p.page, ["check"]);
      await p.page.click("#btn-cta");
      await until(p.page, ["decide"]);
      await p.page.click("#btn-cta");
      await until(p.page, ["done"]);
      const cover = await p.page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#report .vc-report__meta dt")].map((dt) => [dt.textContent.trim(), dt.nextElementSibling?.textContent.trim()])));
      const setting = T(lang, "rp.model.live", { model: "Haiku 5.5", setting: T(lang, "d.preset.balanced"), research: T(lang, "rp.research.off") });
      check(cover[T(lang, "rp.meta.mode")] === T(lang, "rp.mode.live") && cover[T(lang, "rp.meta.model")] === setting, `${lang}: the cover names the mode and "${setting}"`);
      const fiction = await p.page.$$eval("#report .report-tags .vc-tag", (tags) => tags.map((x) => x.textContent.trim()));
      check(fiction.includes(T(lang, "rp.ai")) && !fiction.includes(T(lang, "rp.fiction")), `${lang}: it says "${T(lang, "rp.ai")}" and does not call the company fictional`);
      const method = await text(p.page, "#report .report-page--method");
      check(method.includes(T(lang, "rp.cutoff")) && /June 2026|Juni 2026/.test(method), `${lang}: with research off the sources give the knowledge-cutoff note (June 2026)`);
      // The browser asks before the tab closes while the result has not left the page, and no longer once the
      // report has been saved.
      const armed = () => p.page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
      const asksBefore = await armed();
      const r = await printVia(p.page, "#rp-pdf");
      const asksAfter = await armed();
      check(asksBefore && !asksAfter, `${lang}: the browser asks before the tab closes while the result has not been saved, and stops asking once the report is printed`);
      const pages = pdfPages(r.pdf).map((x) => x.text).join(" ");
      const html = await download(p.page, "#rp-html");
      const jsonFile = await download(p.page, "#rp-json");
      check(![pages, html.text, jsonFile.text].some((x) => x.includes(MOCK_KEY) || /sk-ant-/.test(x)), `${lang}: the key is in none of the three files`);
      const jsonData = JSON.parse(jsonFile.text);
      check(!handoffProblems(jsonData).length && jsonData.mode === "live" && jsonData.model === "claude-haiku-5-5" && jsonData.company.fictional === false && (!readHandoff || readHandoff(jsonData, { file: jsonFile.name }).ok), `${lang}: the live file passes its checks, names the model and calls the company real${readHandoff ? ", and the Ideator reads it" : ""}`);
      const stored = await storageAfter(p.page);
      check(stored.local.every((k) => ["vc-theme", "swot.lang"].includes(k)) && stored.session.every((k) => k.startsWith("vc-guide")) && !stored.idb.length && !stored.caches.length && stored.cookie === "", `${lang}: after the downloads the browser keeps only the allowed keys (${[...stored.local, ...stored.session].join(", ") || "nothing"})`);
      await closeLivePage(p, `${lang} research off`, check);
    }
    // Research on: each source with the date it was read.
    {
      const urls = SCEN.s2.sources.map((s) => s.url);
      const a = answers("s2", lang, { evidence: urls });
      const scout = () => ({ blocks: [...search("news", urls.map((url) => ({ url, title: "Source" }))), tool("submit_signals", { signals: urls.map((url) => ({ title: "A recent source", summary: "It matters. It is recent.", url, published: "", quadrants: ["threats"] })) })], stop: "tool_use", usage: { input_tokens: 9000, output_tokens: 700, web_search_requests: 2 } });
      const p = await openLivePage(browser, BASE, { lang, script: scripted(a, { scout }) });
      await toDialog(p.page);
      await startRun(p.page, { research: true });
      await until(p.page, ["check"]);
      await p.page.click("#btn-cta");
      await until(p.page, ["decide"]);
      await p.page.click("#btn-cta");
      await until(p.page, ["done"]);
      const cited = [...new Set(a.challenge.issues.flatMap((i) => i.evidence.map((e) => e.url)))];
      const listed = await p.page.$$eval("#report .report-sources > li", (lis) => lis.map((li) => ({ href: li.querySelector("a")?.getAttribute("href"), text: li.textContent.replace(/\s+/g, " ").trim() })));
      const read = T(lang, "rp.read.on", { date: fmtDate(today(), lang) });
      check(cited.length > 0 && cited.every((u) => listed.some((x) => x.href === u && x.text.includes(read))), `${lang}: with research on, the ${cited.length} cited source(s) stand with "${read}"`);
      const titleOf = new Map(a.challenge.issues.flatMap((i) => i.evidence.map((e) => [e.url, e.title])));
      check(cited.every((u) => listed.find((x) => x.href === u)?.text.startsWith(titleOf.get(u))), `${lang}: each cited source is listed under the title its issue gives it, not the search's`);
      const cover = await text(p.page, "#report .vc-report__meta");
      check(cover.includes(T(lang, "rp.research.on")), `${lang}: and the cover says research was on`);
      await closeLivePage(p, `${lang} research on`, check);
    }
    // Stopped at the cap: every printed page says so.
    {
      const p = await openLivePage(browser, BASE, { lang, script: scripted(answers("s2", lang), { usage: { input_tokens: 3000, output_tokens: 2500 } }), expect: PRESET.thorough });
      await toDialog(p.page);
      await startRun(p.page, { preset: "thorough", cap: 0.05 });
      await until(p.page, ["check"]);
      await p.page.click("#btn-cta");
      await until(p.page, ["stopped"]);
      const offer = await text(p.page, "#btn-report-done");
      check(offer === T(lang, "rp.stopped.cta"), `${lang}: the stop screen offers "${T(lang, "rp.stopped.cta")}"`);
      await p.page.click("#btn-report-done");
      await p.page.waitForSelector("#report-dialog[open]");
      const notice = await p.page.$eval("#report", (r) => r.getAttribute("data-vc-notice"));
      const tags = await p.page.$$eval("#report .report-tags .vc-tag", (x) => x.map((t) => t.textContent.trim()));
      check(notice === T(lang, "rp.notice") && tags.includes(T(lang, "rp.stopped")), `${lang}: the report carries "${T(lang, "rp.notice")}" and its cover says "${T(lang, "rp.stopped")}"`);
      const r = await printVia(p.page, "#rp-pdf-dialog");
      const { pages, problems } = footerProblems(r.pdf, lang, { notice: T(lang, "rp.notice") });
      check(!problems.length, `${lang}: each of the ${pages.length} printed pages of the stopped run says "${T(lang, "rp.notice")}" above the footer${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
      await closeLivePage(p, `${lang} stopped`, check);
    }
  }
}

// ---- NAMES -----------------------------------------------------------------------------------------------
async function names() {
  for (const lang of ["en", "de"]) {
    const p = await openPage({ query: "scenario=s2&step=5", lang });
    const stem = `swot-challenger-arvento-drives-${today()}-${lang}`;
    const h = await download(p.page, "#rp-html");
    const j = await download(p.page, "#rp-json");
    const r = await printVia(p.page, "#rp-pdf");
    check(h.name === `${stem}.html` && j.name === `${stem}.json`, `${lang}: the HTML and JSON files are ${h.name} and ${j.name}`);
    check(r.during.title === stem && r.after.title === r.titleBefore && r.titleBefore !== stem, `${lang}: while the print dialog is open the page's title is ${r.during.title}, so the PDF is ${stem}.pdf; then the title comes back (${r.after.title})`);
    await closePage(p, `${lang} names`);
  }
  // A live run for a company with umlauts and ß: written out in every file name.
  const company = "Müller & Söhne Straßenbau";
  const p = await openLivePage(browser, BASE, { lang: "de", script: scripted(answers("s2", "de")) });
  await p.page.click("#btn-live");
  await p.page.waitForSelector("#live-fill");
  await p.page.selectOption("#live-fill", "s2");
  await p.page.waitForFunction((name) => document.getElementById("live-name")?.value === name, SCEN.s2.company.name);
  await p.page.fill("#live-name", company);
  await p.page.click("#btn-cta");
  await p.page.waitForSelector("#live-dialog[open]");
  await startRun(p.page);
  await until(p.page, ["check"]);
  await p.page.click("#btn-cta");
  await until(p.page, ["decide"]);
  await p.page.click("#btn-cta");
  await until(p.page, ["done"]);
  const stem = `swot-challenger-mueller-soehne-strassenbau-${today()}-de`;
  const h = await download(p.page, "#rp-html");
  const j = await download(p.page, "#rp-json");
  const r = await printVia(p.page, "#rp-pdf");
  check(h.name === `${stem}.html` && j.name === `${stem}.json` && r.during.title === stem, `"${company}": the files are ${h.name}, ${j.name} and ${r.during.title}.pdf, umlauts and ß written out`);
  await closeLivePage(p, "umlauts", check);
}

// ---- run -------------------------------------------------------------------------------------------------
const FN = { pdf, html, json, figures, ui, live, names };
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
console.log(`Files for reading: ${OUT}`);
if (failedGroups) process.exit(1);
console.log("REPORT OK");

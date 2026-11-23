// Vici's own rules, checked with Vici's own functions (Build a prototype, "Check it"; AC-01): the How it
// works guides and their key figures (guideProblems), the byline (bylineProblems), the writing guideline's
// checkable patterns (writingProblems), the AI notice of a page that can start a live run
// (aiNoticeProblems) and names, not record ids (recordIdProblems). They run on the page as served, on the
// page as rendered in English and in German, on the dictionaries and on the documents. ViciDesign's
// check-guide-render.mjs drives the guide over http. vici/ holds Vici's files byte for byte, at the
// commit vici/README.md and the workflow name.
//
// Each imported check first fails on a planted control. Prints VICI CONTROLS OK, VICI STANDARDS OK and
// VICI OK. The functions come from a ViciDesign checkout (VICI_DIR, or ../ViciDesign); without one the
// suite says so and passes, unless --require-vici is given or it runs on GitHub Actions. Adapted from the
// Sovereignty Assessment 2.0.0. Usage: node tests/vici.mjs [--require-vici]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT, REQUIRE_VICI, viciDir, launchBrowser, serveStatic, NETWORK_NOISE } from "./lib/harness.mjs";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";
import { SECTORS, KPIS } from "../data/kpis.js";

const dir = viciDir();
if (!dir) {
  console.log(`${REQUIRE_VICI ? "FAIL" : "SKIP"}  no ViciDesign checkout in VICI_DIR or next to this repository (../ViciDesign)`);
  process.exit(REQUIRE_VICI ? 1 : 0);
}
const lib = async (file) => import(pathToFileURL(path.join(dir, "scripts", "lib", file)).href);
const { guideProblems } = await lib("guide.mjs");
const { bylineProblems } = await lib("byline.mjs");
const { writingProblems } = await lib("writing.mjs");
const { aiNoticeProblems, canRunLive, AI_NOTICE } = await lib("ai.mjs");
const { recordIdProblems } = await lib("ids.mjs");

const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const html = read("index.html");
const page = (paragraphs, lang = "en-GB") => `<html lang="${lang}"><body>${paragraphs.map((t) => `<p>${String(t).replace(/</g, "&lt;")}</p>`).join("")}</body></html>`;
const controls = [];
const standards = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => standards.push([!!ok, what]);

// The ids of the tool's data, which no screen may show: the KPIs' and the sectors'.
const IDS = new Set([...KPIS.map((k) => k.id), ...SECTORS.map((s) => s.id).filter((id) => id.includes("_"))]);

// ---- the checks can fail ----------------------------------------------------------------------------
control(guideProblems(html.replace(/<dialog\b[^>]*vc-guide[\s\S]*?<\/dialog>/g, "")).length > 0, "control: guideProblems catches a page without its guides");
control(guideProblems(html.replace('<div class="kpis"', '<p class="vc-stat" data-vc-kpi="Strategies chosen" data-vc-kpi-de="Gewählte Strategien">2</p><div class="kpis"')).some((p) => /Strategies chosen|Gewählte Strategien/.test(p)), "control: guideProblems catches a key figure no How it works chapter explains");
control(bylineProblems(html.replace(/href="https:\/\/victorpflueger\.github\.io\/VIP\/index\.html"/, 'href="#"')).length > 0, "control: bylineProblems catches a byline without the website link");
control(writingProblems(page(["The challenge finds three issues — and prices them."])).length > 0 && writingProblems(page(["A seamless analysis."])).length > 0, "control: writingProblems catches an em dash and a stock word");
control(recordIdProblems("<p>The red team looks at transport_logistics.cost_per_teu.</p>", [...IDS]).length > 0 && !recordIdProblems("<p>Cost per container moved rises.</p>", [...IDS]).length, "control: recordIdProblems catches a KPI id on a screen, and passes its name");
control(aiNoticeProblems(html.split(AI_NOTICE.en).join("An assistant")).length > 0, "control: aiNoticeProblems catches a page that can run live but never says it is an AI");

// ---- the page as served -------------------------------------------------------------------------------
const g = guideProblems(html);
check(!g.length, `the two guides follow Vici's standard, a row in How it works for each key figure in its language included${g.length ? `: ${g.join("; ")}` : ""}`);
check(/<dialog class="vc-dialog vc-guide" id="guide-en" lang="en-GB"[\s\S]*?<h2[^>]*>How the prototype works<\/h2>/.test(html), "the English guide is titled How the prototype works, in English");
check(/<dialog class="vc-dialog vc-guide" id="guide-de" lang="de"[\s\S]*?<h2[^>]*>So funktioniert der Prototyp<\/h2>/.test(html), "the German guide is titled So funktioniert der Prototyp, in German");
const kpis = [...html.matchAll(/\bdata-vc-kpi="([^"]+)" data-vc-kpi-de="([^"]+)"/g)].map((m) => `${m[1]} / ${m[2]}`);
check(kpis.join("|") === "At stake a year / Jährlich auf dem Spiel|Items challenged / Beanstandete Punkte|Response to the market / Antwort auf den Markt|Session cost / Sitzungskosten", `the header marks four key figures, each in both languages (${kpis.join(", ")})`);
const b = bylineProblems(html);
check(!b.length, `the byline follows Vici's standard${b.length ? `: ${b.join("; ")}` : ""}`);
check((html.match(/class="vc-byline"/g) || []).length === 1 && /<div class="intro">[\s\S]*?class="vc-byline"/.test(html), "the page carries one byline, in the strip under the header");
const w = writingProblems(html);
check(!w.length, `index.html keeps Vici's writing rules${w.length ? `: ${w.join("; ")}` : ""}`);
const a = aiNoticeProblems(html);
check(canRunLive(html) && !a.length, `the page can reach the Claude API and says "${AI_NOTICE.en}"${a.length ? `: ${a.join("; ")}` : ""}`);
check(/class="vc-tag vc-tag--feature ai-notice"[\s\S]{0,200}You are interacting with an AI system/.test(html) && /data-mode="live"[\s\S]{0,400}ai-notice/.test(html), "the AI notice stands in a lilac tag beside the live mode");
check(DE["p.ai"] === AI_NOTICE.de && EN["p.ai"] === AI_NOTICE.en, `the notice uses Vici's fixed words in both languages ("${AI_NOTICE.de}")`);
const header = (html.match(/<header class="app-header"[\s\S]*?<\/header>/) || [""])[0];
check(/>SIMULATION</.test(header), "the header says SIMULATION, in capitals");
check(/<p class="intro-text"[^>]*>[^<]{40,260}<\/p>/.test(html) && /fictional companies/.test(EN["p.strip"]) && /erfundene Unternehmen/.test(DE["p.strip"]), "one sentence under the header says what the tool does and that its companies are fictional");
check(/class="vc-cell vc-cell--lilac"[^>]*><span class="vc-icon vc-icon--scale">/.test(header), "the header shows the scale icon in a lilac hexagon");

// ---- the page as rendered, in English and in German ---------------------------------------------------
const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 8600 + Math.floor(Math.random() * 300));
try {
  for (const lang of ["en", "de"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort("blockedbyclient"));
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e.message || e)));
    p.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
    await p.goto(`${server.base}?guide=0&lang=${lang}`);
    await p.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    await p.waitForTimeout(400);
    const view = await p.content();
    // The page in one language shows one guide: the other is out of its way (lang.js takes its
    // data-vc-guide-auto and its button), so Vici's guide check sees a one-language page.
    const other = lang === "en" ? "de" : "en";
    const rg = guideProblems(view.replace(new RegExp(`<dialog\\b[^>]*\\bid="guide-${other}"[\\s\\S]*?</dialog>`), "").replace(new RegExp(`<button[^>]*data-vc-guide-open="guide-${other}"[\\s\\S]*?</button>`), ""));
    const rb = bylineProblems(view);
    const rw = writingProblems(view);
    const ra = aiNoticeProblems(view);
    const all = [...rg, ...rb, ...rw, ...ra, ...errors];
    check(!all.length, `rendered in ${lang === "en" ? "English" : "German"}: the guide, the byline, the writing and the AI notice pass, with no page error${all.length ? `: ${all.join("; ")}` : ""}`);
    check(new RegExp(`<html[^>]*lang="${lang === "de" ? "de" : "en-GB"}"`).test(view) && view.includes(lang === "de" ? AI_NOTICE.de : AI_NOTICE.en), `rendered in ${lang === "en" ? "English" : "German"}: the page says its language and carries the AI notice in it`);
    const ri = recordIdProblems(view.replace(/<script[\s\S]*?<\/script>/g, ""), [...IDS]);
    check(!ri.length, `rendered in ${lang === "en" ? "English" : "German"}: names, not record ids${ri.length ? `: ${ri.join("; ")}` : ""}`);
    await context.close();
  }
  // ViciDesign's own drive of the guide, over http.
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, "scripts", "check-guide-render.mjs"), server.base], { cwd: dir, env: process.env });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 240000);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
  check(r.code === 0 && /GUIDE BEHAVIOUR OK/.test(r.out), `Vici's check-guide-render.mjs passes against the page over http${r.code === 0 ? "" : `: ${r.out.split("\n").filter((l) => l.trim()).slice(-6).join(" | ")}`}`);
} finally {
  await server.close();
  await browser.close();
}

// ---- the dictionaries and the documents ----------------------------------------------------------------
for (const [lang, D] of [["en", EN], ["de", DE]]) {
  const texts = Object.values(D);
  const p = writingProblems(page(texts, lang === "de" ? "de" : "en-GB"));
  check(!p.length, `${lang === "en" ? "English" : "German"}: the ${texts.length} texts of the dictionary keep the writing rules${p.length ? `: ${p.join("; ")}` : ""}`);
  const ids = recordIdProblems(texts.join("\n"), [...IDS]);
  check(!ids.length, `${lang === "en" ? "English" : "German"}: no dictionary text shows a record id${ids.length ? `: ${ids.join("; ")}` : ""}`);
}
for (const doc of ["README.md", "TECH_NOTES.md", "vici/README.md", "tests/README.md"]) {
  const there = existsSync(path.join(APP_ROOT, doc));
  const p = there ? writingProblems(page([read(doc).replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "")])) : ["missing"];
  check(!p.length, `${doc} keeps the writing rules${p.length ? `: ${p.join("; ")}` : ""}`);
}

// ---- vici/: Vici's files, unchanged, at the commit the README and the workflow name -------------------
const pin = (read("vici/README.md").match(/commit \*\*`([0-9a-f]{7,40})`\*\*/) || [])[1];
const ref = (read(".github/workflows/tests.yml").match(/repository: VictorPflueger\/ViciDesign\s+ref: ([0-9a-f]{7,40})/) || [])[1];
check(pin && ref && ref.startsWith(pin), `vici/README.md and the workflow name the same ViciDesign commit (${pin} and ${ref})`);
let head = null;
try { head = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
check(!head || !pin || head.startsWith(pin), `the ViciDesign checkout is at that commit (${head ? head.slice(0, 7) : "not a git checkout"})`);
const files = [];
const walk = (d) => { for (const f of readdirSync(path.join(APP_ROOT, d))) { const p = `${d}/${f}`; if (statSync(path.join(APP_ROOT, p)).isDirectory()) walk(p); else files.push(p); } };
walk("vici");
const ours = files.filter((f) => f !== "vici/README.md");
const differ = ours.filter((f) => { const there = path.join(dir, f.slice("vici/".length)); return !existsSync(there) || !readFileSync(there).equals(readFileSync(path.join(APP_ROOT, f))); });
check(ours.length >= 18 && !differ.length, `the ${ours.length} files in vici/ equal ViciDesign's byte for byte${differ.length ? `: ${differ.join(", ")} differ` : ""}`);

let failed = 0;
const report = (results, token) => {
  const f = results.filter(([ok]) => !ok).length;
  for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "VICI CONTROLS OK"), report(standards, "VICI STANDARDS OK")].filter(Boolean);
console.log(`(Vici's checks from ${dir})`);
if (failed) { console.log(`\n${failed} checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + standards.length} checks passed.\n${tokens.join("\n")}\nVICI OK`);

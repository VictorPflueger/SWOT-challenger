// How lean the tool stays: limits a change has to argue with. Node.js only.
//   shell    the presenter is at most ten modules of its own (main, app, grid, panels, live_panels,
//            matrices, tiles, report_view, method, lang) of at most 2,200 lines together; the rest of js/
//            is the engine and the run, the live client, the formats, the report and the configuration
//   app      at most 6,500 lines of JavaScript in js/ (the dictionaries in js/i18n/ apart) and two
//            stylesheets, css/app.css and css/report.css, of at most 900 lines together; vici/ is Vici's,
//            tests/ and tools/ aren't the app
//   network  only js/anthropic.js makes requests; no module, dictionary or stylesheet and not the page
//            names another host to call (the links a person follows are listed below), and the security
//            policy connects to api.anthropic.com only
//   cuts     what the design review cut stays out (PLAN.md, section 16): a console or Diagnostics, Opus 5.5
//            under Advanced, a control for output tokens, for the number of searches or for Quick and
//            Deep, a language control in the live dialog, a Keep button on the AI's items, more than six
//            strategies or eight issues, "Keep the SWOT as it is", uploads and a drop zone, and "Save run
//            as simulation" as more than a quiet link
//   docs     README.md at most 900 words, DESIGN.md at most 700, DEMO_SCRIPT.md at most 1,500 (in two
//            languages) and DATA_SOURCES.md at most 1,500, their addresses not counted
// Each rule is first tried on a planted example that must break it. Prints CUTS OK and LEAN OK.
// Adapted from the Sovereignty Assessment's and the BMC Challenger's tests/lean.mjs.
// Usage: node tests/lean.mjs
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const LIMITS = { shellModules: 10, shellLines: 2200, jsLines: 6500, cssFiles: 2, cssLines: 900, readme: 900, design: 700, script: 1500, sources: 1500, strategies: 6, issues: 8 };
const SHELL = ["main.js", "app.js", "grid.js", "panels.js", "live_panels.js", "matrices.js", "tiles.js", "report_view.js", "method.js", "lang.js"];
const CSS = ["app.css", "report.css"];
const NET = /\bfetch\s*\(|XMLHttpRequest|WebSocket|new EventSource|navigator\.sendBeacon/;
const HOSTS = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;
const CALLED = new Set(["api.anthropic.com"]);
// Links a person follows, not hosts the page calls: the byline and Vici, Anthropic's console in the key's
// messages, "Check for updates" on GitHub, and the DOI of Weihrich's paper in the Method dialog. The SVG
// namespace is a name, not an address.
const LINKS = new Set(["www.linkedin.com", "victorpflueger.github.io", "platform.claude.com", "github.com", "doi.org", "www.w3.org"]);
// What the design review cut, by the ids, classes, values and words that would bring it back.
const CUT_UI = /\b(?:id|class|name)="[^"]*\b(console|diagnostics|diag-[a-z]+|live-(?:max-tokens|tokens|searches|depth|lang)|keep-[a-z0-9]+|item-keep|ai-keep|vc-dropzone)\b|\bvalue="(?:quick|deep)"|type="file"/;
const CUT_TEXT = /Keep the SWOT as it is|SWOT so lassen, wie sie ist|Output tokens|Ausgabe-Tokens|Number of searches|Anzahl der Suchen|Diagnostics|Diagnose/;

const results = [];
const cut = [];
const check = (ok, what, list = results) => list.push([!!ok, what]);
const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const lines = (text) => text.split("\n").length;
const words = (text) => text.replace(/```[\s\S]*?```/g, " ").replace(/https?:\/\/\S+/g, " ").split(/\s+/).filter(Boolean).length;
const policy = (html) => Object.fromEntries(((html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || "")
  .split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
const policyProblems = (html) => {
  const p = policy(html);
  const out = [];
  const connect = (p["connect-src"] || []).map((s) => s.replace(/^https:\/\//, ""));
  if (connect.sort().join(" ") !== [...CALLED].sort().join(" ")) out.push(`connect-src is "${(p["connect-src"] || []).join(" ")}"`);
  for (const [k, v] of Object.entries(p)) if (k !== "connect-src" && v.some((s) => /^https?:|^\*$|^wss?:/.test(s))) out.push(`${k} loads from ${v.join(" ")}`);
  if (!p["default-src"]?.includes("'self'")) out.push("no default-src 'self'");
  return out;
};
const hostsIn = (text) => [...text.matchAll(HOSTS)].map((m) => m[1].toLowerCase()).filter((h) => !CALLED.has(h) && !LINKS.has(h));
/** The most items a list in the contracts allows: list({ $ref: "<name>.json" }, max, min). */
const most = (schema, name) => Number((schema.match(new RegExp(`list\\(\\{ \\$ref: "${name}\\.json" \\}, (\\d+)`)) || [])[1] || NaN);
/** The models Advanced offers, from config.js. */
const advanced = (config) => [...((config.match(/ADVANCED_MODELS = Object\.freeze\(\[([^\]]*)\]/) || [])[1] || "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
/** The classes of the control that saves a run as a simulation, from the module that draws it. */
const saveRun = (source) => (source.match(/class: "([^"]*)", id: "btn-save-run"/) || [])[1] || null;
const quiet = (classes) => !!classes && /\bvc-button--ghost\b/.test(classes) && /\bsave-run__link\b/.test(classes) && !/\bvc-button--(?:secondary|outline|danger|lg)\b/.test(classes);

// ---- the rules catch what they are for ----------------------------------------------------------------
check(NET.test(code('const r = await fetch("https://api.open-meteo.com/v1/forecast");')) && !NET.test(code("// reads fetch() bodies\nconst fetched = items.filter(Boolean);")), "control: the network pattern catches a request, and passes a comment and ordinary code");
check(hostsIn('const URL = "https://api.open-meteo.com/v1/forecast";').length === 1 && !hostsIn('fetch("https://api.anthropic.com/v1/messages")').length && !hostsIn('<a href="https://doi.org/10.1016/0024-6301(82)90120-0">').length, "control: a host other than the API and the links is caught, the API and a listed link are not");
check(policyProblems(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src https://api.anthropic.com https://unpkg.com">`).length > 0 && policyProblems(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://unpkg.com; connect-src https://api.anthropic.com">`).length > 0 && !policyProblems(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src https://api.anthropic.com">`).length, "control: a policy that connects or loads elsewhere is caught, the tool's own is not");
check(['<div class="console">', '<input type="file" accept=".pdf">', '<select class="vc-select" id="live-lang">', '<option value="deep">', '<button class="vc-button" id="keep-a1">', '<div class="vc-dropzone">'].every((x) => CUT_UI.test(x)) && !['<div class="kpi vc-stat" id="kpi-stake">', '<input type="checkbox" role="switch" id="live-research">', '<select class="vc-select" id="live-fill">'].some((x) => CUT_UI.test(x)), "control: a part the design review cut is caught by its id, class or value, and the tool's own parts are not");
check(CUT_TEXT.test("Keep the SWOT as it is") && CUT_TEXT.test("Number of searches") && !CUT_TEXT.test("Run it live") && !CUT_TEXT.test("Keep the two strategies ticked"), "control: a cut part's words are caught, and the tool's own words are not");
check(most('const Strategies = object({ strategies: list({ $ref: "Strategy.json" }, 8, 2) });', "Strategy") === 8 && Number.isNaN(most("const X = 1;", "Strategy")), "control: the contracts' limit on strategies is read, and a missing one is noticed");
check(advanced('export const ADVANCED_MODELS = Object.freeze(["claude-haiku-5-5", "claude-opus-5-5"]);').includes("claude-opus-5-5"), "control: Opus 5.5 under Advanced is caught");
check(!quiet(saveRun('h("button", { type: "button", class: "vc-button vc-button--secondary", id: "btn-save-run" })')) && quiet(saveRun('h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm save-run__link", id: "btn-save-run" })')), "control: \"Save run as simulation\" as a button is caught, as a quiet link it passes");
check(words("one two https://example.com/a-very-long-address three") === 3, "control: an address is not counted as words");

// ---- the app ----------------------------------------------------------------------------------------------
const js = readdirSync(path.join(APP_ROOT, "js")).filter((f) => f.endsWith(".js"));
const jsLines = js.reduce((n, f) => n + lines(read(`js/${f}`)), 0);
const shell = SHELL.filter((f) => js.includes(f));
const shellLines = shell.reduce((n, f) => n + lines(read(`js/${f}`)), 0);
check(shell.length <= LIMITS.shellModules && ["main.js", "app.js", "lang.js"].every((f) => shell.includes(f)), `shell: the presenter is ${shell.length} modules of its own, at most ${LIMITS.shellModules} (${shell.join(", ")})`);
check(shellLines <= LIMITS.shellLines, `shell: ${shellLines} lines, at most ${LIMITS.shellLines}`);
check(jsLines <= LIMITS.jsLines, `app: ${jsLines} lines of JavaScript in ${js.length} modules, at most ${LIMITS.jsLines}`);
const css = readdirSync(path.join(APP_ROOT, "css")).filter((f) => f.endsWith(".css"));
const cssLines = css.reduce((n, f) => n + lines(read(`css/${f}`)), 0);
check(css.length === LIMITS.cssFiles && CSS.every((f) => css.includes(f)) && cssLines <= LIMITS.cssLines, `app: ${cssLines} lines of CSS in ${css.length} files (${css.join(", ")}), two files of at most ${LIMITS.cssLines} lines together`);

// ---- network and policy -----------------------------------------------------------------------------------
const net = js.filter((f) => NET.test(code(read(`js/${f}`))));
check(net.join() === "anthropic.js", `network: only js/anthropic.js makes requests (found in ${net.join(", ") || "none"})`);
const sources = [...js.map((f) => `js/${f}`), ...readdirSync(path.join(APP_ROOT, "js/i18n")).map((f) => `js/i18n/${f}`), "index.html", ...css.map((f) => `css/${f}`)];
const hosts = sources.flatMap((f) => hostsIn(code(read(f))).map((h) => `${f}: ${h}`));
check(!hosts.length, `network: no module, dictionary or stylesheet and not the page names a host to call but the API (${sources.length} files)${hosts.length ? `; found ${[...new Set(hosts)].slice(0, 6).join(", ")}` : ""}`);
const p = policyProblems(read("index.html"));
check(!p.length, `policy: the page connects to api.anthropic.com only and loads everything from itself${p.length ? `; ${p.join("; ")}` : ""}`);

// ---- the cuts ---------------------------------------------------------------------------------------------------
const page = read("index.html");
const leftPage = page.match(CUT_UI) || page.match(CUT_TEXT);
check(!leftPage, `page: nothing the design review cut is in index.html${leftPage ? ` (found ${leftPage[0]})` : ""}`, cut);
const texts = [...js.map((f) => `js/${f}`), "js/i18n/en.js", "js/i18n/de.js"];
const leftCode = texts.map((f) => [f, code(read(f)).match(CUT_UI) || code(read(f)).match(CUT_TEXT)]).filter(([, m]) => m);
check(!leftCode.length, `page: no script or dictionary brings a cut part back${leftCode.length ? ` (${leftCode.map(([f, m]) => `${f}: ${m[0]}`).join("; ")})` : ""}`, cut);
const models = advanced(read("js/config.js"));
check(models.length >= 1 && !models.includes("claude-opus-5-5"), `live: Advanced offers ${models.join(" and ")}, not Opus 5.5`, cut);
const schema = read("schemas/swot.js");
check(most(schema, "Strategy") <= LIMITS.strategies && most(schema, "Issue") <= LIMITS.issues, `run: at most ${most(schema, "Strategy")} strategies and ${most(schema, "Issue")} issues in the contracts, no more than ${LIMITS.strategies} and ${LIMITS.issues}`, cut);
const save = saveRun(read("js/live_panels.js"));
check(quiet(save), `live: "Save run as simulation" stays a quiet link (${save || "not found"})`, cut);
const tiles = [...page.matchAll(/data-vc-kpi="([^"]*)"/g)].length;
check(tiles === 4, `page: four key figures, as the design review kept them (${tiles})`, cut);

// ---- docs ---------------------------------------------------------------------------------------------------------
const count = (f) => (existsSync(path.join(APP_ROOT, f)) ? words(read(f)) : Infinity);
for (const [f, max] of [["README.md", LIMITS.readme], ["DESIGN.md", LIMITS.design], ["DEMO_SCRIPT.md", LIMITS.script], ["DATA_SOURCES.md", LIMITS.sources]]) check(count(f) <= max, `docs: ${f} has ${count(f) === Infinity ? "no file and so no" : count(f)} words, at most ${max}`);

let failed = 0;
for (const [list, token] of [[results, null], [cut, "CUTS OK"]]) {
  for (const [ok, what] of list) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  const f = list.filter(([ok]) => !ok).length;
  failed += f;
  if (token && !f) console.log(token);
}
if (failed) { console.log(`\n${failed} of ${results.length + cut.length} checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length + cut.length} checks passed.\nLEAN OK`);

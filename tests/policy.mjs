// The page's security policy, what it loads and what it keeps (AC-01, AC-02's static part), checked in the
// files without a browser:
//   policy    index.html carries exactly the brief's policy in one meta tag, before any stylesheet or
//             script, and js/config.js holds the same text;
//   loads     every script, stylesheet, font, image and module comes from this site; the only host any
//             code connects to is api.anthropic.com, and only the live client may call fetch;
//   inline    no inline script or style, no style or on… attribute, no code that writes either as text;
//   storage   only Vici's vici/dist/vici-theme.js, js/lang.js and js/i18n/index.js touch browser storage,
//             the keys are Vici's "vc-theme", Vici's "vc-guide:" notes and the tool's "swot.lang", and no
//             code opens IndexedDB, the Cache API or cookies (project instructions, "Nothing is kept");
//   vici      Vici's own checks agree: policyProblems(html) on index.html and storageProblems(sources,
//             { allow }) on every script, from a ViciDesign checkout (VICI_DIR, or ../ViciDesign); without
//             one they are skipped and the result says so, unless --require-vici is given or it runs on
//             GitHub Actions.
// Each scanner first proves on planted examples that it catches what it looks for. Prints POLICY OK.
// Adapted from the Data Quality Agent 2.2.0. Usage: node tests/policy.mjs [--require-vici]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT, REQUIRE_VICI, viciDir } from "./lib/harness.mjs";
import { CSP, STORAGE } from "../js/config.js";

const POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https://api.anthropic.com; object-src 'none'; base-uri 'none'; form-action 'none'";
const failures = [];
const passes = [];
const check = (ok, what) => (ok ? passes : failures).push(what);
const read = (f) => fs.readFileSync(path.join(APP_ROOT, f), "utf8");
const walk = (dir, ext) => fs.readdirSync(path.join(APP_ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`, ext) : e.name.endsWith(ext) ? [`${dir}/${e.name}`] : []));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

// ---- the scanners ----------------------------------------------------------------------------------
const ABS = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
function htmlLoads(html) {
  const out = [];
  for (const m of html.matchAll(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*?\s(src|href|data)\s*=\s*["']([^"']+)["']/gi)) {
    const tag = m[1].toLowerCase();
    if (tag === "link" && !/rel=["'](stylesheet|icon|preload|modulepreload|manifest)["']/i.test(m[0])) continue;
    if (ABS.test(m[3])) out.push(`<${tag} ${m[2]}="${m[3]}">`);
  }
  return out;
}
function cssLoads(css) {
  const out = [];
  const plain = stripComments(css);
  for (const m of plain.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) if (ABS.test(m[1])) out.push(`@import ${m[1]}`);
  for (const m of plain.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) if (ABS.test(m[1]) && !/^data:/i.test(m[1])) out.push(`url(${m[1]})`);
  return out;
}
function jsLoads(js) {
  const out = [];
  const plain = stripComments(js);
  for (const m of plain.matchAll(/\bimport\s*(?:[\w*{}\s,]+from\s*)?\(?\s*["'`]([^"'`]+)["'`]/g)) if (ABS.test(m[1])) out.push(`import ${m[1]}`);
  for (const m of plain.matchAll(/\bimportScripts\s*\(|new\s+(?:Worker|SharedWorker|WebSocket|EventSource)\s*\(/g)) out.push(m[0]);
  return out;
}
const hostsIn = (js) => [...stripComments(js).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase());
function htmlInline(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if (!/\bsrc\s*=/.test(m[1]) && m[2].trim()) out.push("<script> without src");
  if (/<style\b/i.test(html)) out.push("<style>");
  for (const m of html.matchAll(/<[a-z][^>]*\s(style|on[a-z]+)\s*=\s*["'][^"']*["']/gi)) out.push(`${m[1]}="…"`);
  return out;
}
function jsInline(js) {
  const out = [];
  const plain = stripComments(js);
  for (const m of plain.matchAll(/setAttribute\(\s*["'`](style|on[a-z]+)["'`]/g)) out.push(`setAttribute("${m[1]}")`);
  for (const m of plain.matchAll(/\.innerHTML\s*=\s*[^;]*<(?:script|style)\b|<[a-z][^>]*\sstyle\s*=\s*\\?["']/gi)) out.push(m[0].slice(0, 50));
  for (const m of plain.matchAll(/\bnew\s+Function\s*\(|\beval\s*\(/g)) out.push(m[0]);
  return out;
}
const storageUse = (js) => /\b(?:local|session)Storage\b/.test(stripComments(js));
const storageKeys = (js) => [...stripComments(js).matchAll(/(?:local|session)Storage\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
const keptElsewhere = (js) => [...stripComments(js).matchAll(/\bindexedDB\b|\bcaches\.(?:open|put|match|keys)\b|document\.cookie\s*=|\bnew\s+Cache\b/g)].map((m) => m[0]);

{
  const planted = [
    [htmlLoads('<script src="https://cdn.example.com/x.js"></script>').length === 1, "an outside script"],
    [htmlLoads('<link rel="stylesheet" href="//fonts.example.com/a.css">').length === 1, "an outside stylesheet"],
    [htmlLoads('<script src="js/main.js"></script><link rel="stylesheet" href="css/app.css">').length === 0, "local files pass"],
    [cssLoads("@font-face { src: url(https://fonts.example.com/f.woff2); }").length === 1, "an outside font"],
    [cssLoads(".a { background: url(\"data:image/svg+xml,%3Csvg%3E\"); }").length === 0, "a data URI passes"],
    [jsLoads('import { x } from "https://esm.example.com/x.js";').length === 1, "an outside module"],
    [jsLoads('const m = await import("https://esm.example.com/x.js");').length === 1, "an outside dynamic import"],
    [htmlInline("<script>alert(1)</script>").length === 1, "an inline script"],
    [htmlInline('<div style="color:red"></div><button onclick="x()"></button>').length === 2, "an inline style and handler"],
    [jsInline('el.setAttribute("style", "color:red");').length === 1, "a style attribute from code"],
    [storageUse("sessionStorage.setItem(k, v)") && storageKeys('localStorage.setItem("swot.key", k)').join() === "swot.key", "storage and a storage key"],
    [keptElsewhere("indexedDB.open('x'); caches.open('y'); document.cookie = 'a=1';").length === 3, "IndexedDB, the Cache API and a cookie"]
  ];
  for (const [ok, what] of planted) check(ok, `self-test: catches ${what}`);
}

// ---- policy ----------------------------------------------------------------------------------------
const html = read("index.html");
const metas = [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/g)].map((m) => m[1]);
check(metas.length === 1, `index.html has exactly one policy meta tag (${metas.length})`);
check(metas[0] === POLICY, `the policy is exactly the brief's${metas[0] === POLICY ? "" : `: ${metas[0]}`}`);
check(CSP === POLICY, "js/config.js holds the same policy");
check(/<head>[\s\S]*?<meta charset="utf-8">[\s\S]*?http-equiv="Content-Security-Policy"[\s\S]*?<link rel="stylesheet"/.test(html) && html.indexOf("Content-Security-Policy") < html.indexOf("<script"), "the policy comes before any stylesheet or script");

// ---- loads -----------------------------------------------------------------------------------------
const css = walk("css", ".css");
const js = walk("js", ".js");
const data = [...walk("data", ".js"), ...walk("schemas", ".js")];
const htmlOut = htmlLoads(html);
check(!htmlOut.length, `index.html loads nothing from another site${htmlOut.length ? `: ${htmlOut.join(", ")}` : ""}`);
const cssOut = css.flatMap((f) => cssLoads(read(f)).map((x) => `${f}: ${x}`));
check(!cssOut.length, `${css.length} stylesheet(s) load nothing from another site${cssOut.length ? `: ${cssOut.join(", ")}` : ""}`);
const viciCss = cssLoads(read("vici/dist/vici.min.css"));
check(!viciCss.length, `Vici's stylesheet loads its fonts and icons from this site${viciCss.length ? `: ${viciCss.slice(0, 3).join(", ")}` : ""}`);
const jsOut = [...js, ...data, "vici/dist/vici.js"].flatMap((f) => jsLoads(read(f)).map((x) => `${f}: ${x}`));
check(!jsOut.length, `no script imports or opens anything from another site${jsOut.length ? `: ${jsOut.join(", ")}` : ""}`);
// Hosts named in code that nothing connects to: links a person opens, and the JSON Schema dialect named in
// the handoff schema's $schema, an identifier that no code fetches.
// doi.org resolves the Method dialog's citation of Weihrich's paper. A scenario's sources are links too:
// every address a scenario names is a source DATA_SOURCES.md lists with the date it was read.
const LINK_HOSTS = new Set(["platform.claude.com", "support.claude.com", "www.linkedin.com", "victorpflueger.github.io", "github.com", "www.w3.org", "json-schema.org", "doi.org"]);
const scenarios = data.filter((f) => f.startsWith("data/scenarios/"));
const listed = read("DATA_SOURCES.md");
const unlisted = scenarios.flatMap((f) => [...stripComments(read(f)).matchAll(/https:\/\/[^\s"'`)]+/g)].map((m) => m[0]).filter((u) => !listed.includes(u)).map((u) => `${u} (${f})`));
check(scenarios.length > 0 && !unlisted.length, `every address a scenario names is a source DATA_SOURCES.md lists${unlisted.length ? `; not listed: ${unlisted.join(", ")}` : ""}`);
const hosts = new Map();
for (const f of [...js, ...data].filter((x) => !scenarios.includes(x))) for (const h of hostsIn(read(f))) if (!hosts.has(h)) hosts.set(h, f);
const unknown = [...hosts].filter(([h]) => h !== "api.anthropic.com" && !LINK_HOSTS.has(h));
check(!unknown.length, `code names api.anthropic.com and links only${unknown.length ? `; also ${unknown.map(([h, f]) => `${h} (${f})`).join(", ")}` : ""}`);
const FETCHERS = new Set(["js/anthropic.js"]);
const fetches = js.filter((f) => !FETCHERS.has(f)).flatMap((f) => [...stripComments(read(f)).matchAll(/\bfetch\s*\(/g)].map(() => f));
check(!fetches.length, `only the live client calls fetch${fetches.length ? `; also ${[...new Set(fetches)].join(", ")}` : ""}`);

// ---- inline ----------------------------------------------------------------------------------------
const inl = htmlInline(html);
check(!inl.length, `index.html has no inline script, style or handler${inl.length ? `: ${inl.join(", ")}` : ""}`);
const jsInl = js.flatMap((f) => jsInline(read(f)).map((x) => `${f}: ${x}`));
check(!jsInl.length, `no code writes a style, a handler or code as text${jsInl.length ? `: ${jsInl.join("; ")}` : ""}`);

// ---- storage ---------------------------------------------------------------------------------------
// Vici's theme script, copied unchanged into vici/, reads the theme before the first paint.
const THEME = "vici/dist/vici-theme.js";
const ALLOWED = new Set([THEME, "js/lang.js", "js/i18n/index.js"]);
check(/<script src="vici\/dist\/vici-theme\.js"><\/script>/.test(html) && /<html\b[^>]*\sdata-vc-theme-default="light"/.test(html), "the theme comes from Vici's vici-theme.js, a plain script in the head, light until the visitor chooses dark");
js.push(THEME);
const users = [...js, ...data].filter((f) => storageUse(read(f)));
check(users.every((f) => ALLOWED.has(f)), `only ${[...ALLOWED].join(", ")} touch browser storage (found: ${users.join(", ") || "none"})`);
const keys = [...js, ...data].flatMap((f) => storageKeys(read(f)));
const okKey = (k) => k === "vc-theme" || k === STORAGE.lang;
check(keys.length > 0 && keys.every(okKey), `the literal storage keys are vc-theme and ${STORAGE.lang} (${[...new Set(keys)].join(", ")})`);
check(JSON.stringify(STORAGE) === JSON.stringify({ lang: "swot.lang" }), "js/config.js names one storage key of its own, swot.lang");
check(/sessionStorage\.(?:getItem|setItem)\(seen\(/.test(read("js/lang.js")) && /"vc-guide:"/.test(read("js/lang.js")), "js/lang.js keeps only Vici's vc-guide: notes in session storage");
const elsewhere = [...js, ...data].flatMap((f) => keptElsewhere(read(f)).map((x) => `${f}: ${x}`));
check(!elsewhere.length, `no code opens IndexedDB, the Cache API or a cookie${elsewhere.length ? `: ${elsewhere.join(", ")}` : ""}`);

// ---- vici ------------------------------------------------------------------------------------------
const dir = viciDir();
if (!dir) {
  check(!REQUIRE_VICI, "Vici's policyProblems and storageProblems: no ViciDesign checkout in VICI_DIR or next to this repository");
  if (!REQUIRE_VICI) console.log("SKIP  Vici's policyProblems and storageProblems: no ViciDesign checkout at hand");
} else {
  const { policyProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "policy.mjs")).href);
  const { storageProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "storage.mjs")).href);
  check(policyProblems(html.replace("<head>", "<head><style>body{}</style>")).length > 0 && policyProblems(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")).length > 0, "self-test: Vici's policyProblems catches a style element and a page without its policy");
  const pol = policyProblems(html);
  check(!pol.length, `Vici's policyProblems finds nothing in index.html${pol.length ? `: ${pol.join("; ")}` : ""}`);
  const sources = Object.fromEntries([...new Set([...js, ...data, "index.html"])].map((f) => [f, read(f)]));
  check(storageProblems({ ...sources, "js/app.js": `${sources["js/app.js"]}\nsessionStorage.setItem("swot.run", "{}");` }, { allow: [...ALLOWED] }).length > 0, "self-test: Vici's storageProblems catches session storage in a module not allowed it");
  const sto = storageProblems(sources, { allow: [...ALLOWED] });
  check(!sto.length, `Vici's storageProblems finds nothing in the ${Object.keys(sources).length} scripts and the page${sto.length ? `: ${sto.join("; ")}` : ""}`);
  console.log(`(Vici's checks from ${dir})`);
}

for (const p of passes) console.log(`PASS  ${p}`);
for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`${passes.length}/${passes.length + failures.length} policy checks passed.`);
if (failures.length) process.exit(1);
console.log("POLICY OK");

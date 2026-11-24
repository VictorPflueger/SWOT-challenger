// Both languages, statically (AC-03): en.js and de.js have the same keys, no empty value and the same
// placeholders; every text is translated, except names and codes that read the same; every key a module
// or index.html asks for exists, and every key is asked for; index.html's English defaults are exactly
// the English texts of the keys they name; no sentence a person sees is typed into the code instead of
// the dictionaries. The switch in the browser is in tests/smoke.mjs. Each check first fails on a planted
// error. Prints I18N CONTROLS OK and I18N OK. Adapted from the Sovereignty Assessment 2.0.0.
// Usage: node tests/i18n.mjs
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";
import { stringLiterals, looksLikeProse } from "./lib/strings.mjs";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";

const read = (f) => fs.readFileSync(path.join(APP_ROOT, f), "utf8");
const walk = (dir) => fs.readdirSync(path.join(APP_ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []));
const controls = [];
const checks = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => checks.push([!!ok, what]);

const placeholders = (s) => [...String(s).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort().join(",");
/** Problems of a pair of dictionaries: keys, empty values, placeholders. */
function pairProblems(en, de) {
  const out = [];
  for (const k of Object.keys(en)) if (!Object.hasOwn(de, k)) out.push(`only in en: ${k}`);
  for (const k of Object.keys(de)) if (!Object.hasOwn(en, k)) out.push(`only in de: ${k}`);
  for (const [lang, d] of [["en", en], ["de", de]]) for (const [k, v] of Object.entries(d)) if (typeof v !== "string" || !v.trim()) out.push(`empty in ${lang}: ${k}`);
  for (const k of Object.keys(en)) if (Object.hasOwn(de, k) && placeholders(en[k]) !== placeholders(de[k])) out.push(`${k}: {${placeholders(en[k])}} against {${placeholders(de[k])}}`);
  return out;
}
control(pairProblems({ a: "x", b: "y" }, { a: "x" }).length === 1, "control: a key missing in German is caught");
control(pairProblems({ a: "Hello {name}" }, { a: "Hallo {nom}" }).length === 1, "control: placeholders that differ are caught");
control(pairProblems({ a: "" }, { a: "x" }).length === 1, "control: an empty value is caught");

const pair = pairProblems(EN, DE);
check(!pair.length, `en.js and de.js: the same ${Object.keys(EN).length} keys, no empty value, the same placeholders${pair.length ? `: ${pair.join("; ")}` : ""}`);

// Texts that read the same in both languages on purpose: names and codes, and rp.model.live, which is
// three names in a row ("{model}, {setting}, {research}").
const SAME_ALLOWED = new Set(["app.name", "p.mode.simulation", "p.mode.live", "p.kpi.waiting", "p.byline.tip", "p.step.start", "p.modes.sim", "p.modes.live", "p.pause", "p.item.issue", "s.assess.score", "m.kpis.definition", "s.live.name", "d.key.placeholder", "w.time", "rp.model.live"]);
const same = Object.keys(EN).filter((k) => EN[k] === DE[k] && /\p{L}{3,}/u.test(EN[k]) && !SAME_ALLOWED.has(k));
check(!same.length, `every text is translated, the same in both only for names and codes${same.length ? `: ${same.join(", ")}` : ""}`);

// ---- every key asked for exists, and every key is asked for ---------------------------------------------
const html = read("index.html");
const scripts = walk("js").filter((f) => !/^js\/i18n\/(en|de)\.js$/.test(f));
const PREFIXES = new Set(Object.keys(EN).map((k) => k.split(".")[0]));
const KEYLIKE = /^[a-z][A-Za-z]*(\.[A-Za-z0-9_-]+)+$/;
const used = new Set();
const unknown = [];
// A key family that code builds from a template, such as `p.type.${type}`: every key the template can
// give counts as asked for. A template needs a literal part after its prefix ("p.type."), so a template
// that could name any key ("p.${x}") is not read as asking for all of them.
const familyOf = (value) => {
  const parts = value.split("${}");
  if (parts.length < 2 || !PREFIXES.has(value.split(".")[0])) return null;
  const literal = value.replace(/\$\{\}/g, "").split(".").filter(Boolean);
  if (literal.length < 2) return null;
  return new RegExp(`^${parts.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[A-Za-z0-9_]+")}$`);
};
control(familyOf("p.type.${}")?.test("p.type.misfiled") && !familyOf("p.${}"), "control: a key family is read from a template, and a template that could name any key is not");
for (const f of scripts) {
  for (const lit of stringLiterals(read(f))) {
    const family = lit.quote === "`" ? familyOf(lit.value) : null;
    if (family) { for (const k of Object.keys(EN)) if (family.test(k)) used.add(k); continue; }
    if (!KEYLIKE.test(lit.value) || !PREFIXES.has(lit.value.split(".")[0]) || /\.(js|json|html|css|mjs)$/.test(lit.value)) continue;
    if (Object.hasOwn(EN, lit.value)) used.add(lit.value);
    // tn(key, n) asks for the key's plural forms, key.one and key.other.
    else if (Object.hasOwn(EN, `${lit.value}.one`) && Object.hasOwn(EN, `${lit.value}.other`)) { used.add(`${lit.value}.one`); used.add(`${lit.value}.other`); }
    else unknown.push(`${f}:${lit.line} "${lit.value}"`);
  }
}
for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) { used.add(m[1]); if (!Object.hasOwn(EN, m[1])) unknown.push(`index.html data-i18n "${m[1]}"`); }
for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(";")) { const k = p.split(":")[1].trim(); used.add(k); if (!Object.hasOwn(EN, k)) unknown.push(`index.html data-i18n-attr "${k}"`); }
check(!unknown.length, `every key a module or the page asks for exists${unknown.length ? `: ${unknown.join(", ")}` : ""}`);
const unused = Object.keys(EN).filter((k) => !used.has(k));
check(!unused.length, `every key is asked for by a module or the page${unused.length ? `: ${unused.join(", ")} unused` : ""}`);

// ---- index.html's English defaults are the English texts ----------------------------------------------
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const defaults = [...html.matchAll(/<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>([^<]*)<\/\1>/g)];
const wrong = defaults.filter((m) => decode(m[3]) !== EN[m[2]]).map((m) => `${m[2]}: "${m[3].slice(0, 50)}"`);
check(defaults.length >= 20 && !wrong.length, `the ${defaults.length} English defaults in index.html equal en.js${wrong.length ? `: ${wrong.join("; ")}` : ""}`);
const attrs = [...html.matchAll(/<[a-z0-9]+\b([^>]*\bdata-i18n-attr="([^"]+)"[^>]*)>/g)];
const wrongAttr = [];
for (const [, all, list] of attrs) for (const p of list.split(";")) {
  const [attr, key] = p.split(":").map((s) => s.trim());
  const now = (new RegExp(`\\b${attr}="([^"]*)"`).exec(all) || [])[1];
  if (decode(now ?? "") !== EN[key]) wrongAttr.push(`${attr}=${key}`);
}
check(!wrongAttr.length, `the attributes index.html translates carry the English text as default${wrongAttr.length ? `: ${wrongAttr.join(", ")}` : ""}`);
check(/^<!doctype html>\s*<html lang="en-GB"/i.test(html), "index.html opens in British English until js/lang.js has read the choice");

// ---- no sentence typed into the code -----------------------------------------------------------------
// Messages for developers (the console, a thrown error, a JSDoc) are not on screen and stay in English.
control(looksLikeProse("The key was rejected, check it in the Console"), "control: a sentence in code is recognised as prose");
// The product's name and its author's (js/config.js), and the browser's own text for a script error that
// main.js ignores.
const NOT_PROSE = new Set(["SWOT Challenger", "Victor Pflüger", "Script error."]);
// The scenario checker's messages are for whoever edits a scenario, never on screen: English only. The
// shared live client stays the sister tools' file, unchanged: its texts are for the console and for
// js/api_messages.js, which turns every error it reports into words of the page's language.
// The guards, the prompts, the Scout's tool results and the run's stops speak to the model and to whoever
// edits a scenario, in English by design (PLAN.md 3.3); the person reads js/api_messages.js's keys instead.
const DEVELOPER_ONLY = new Set(["js/scenario_check.js", "js/anthropic.js", "js/guards.js", "js/prompts.js", "js/scout.js", "js/pipeline.js"]);
const prose = [];
for (const f of scripts.filter((s) => !DEVELOPER_ONLY.has(s))) {
  for (const lit of stringLiterals(read(f))) {
    if (!looksLikeProse(lit.value) || NOT_PROSE.has(lit.value)) continue;
    if (/console\.|throw new|new (Range|Type)?Error\(|describe/.test(lit.text)) continue;
    prose.push(`${f}:${lit.line} "${lit.value.slice(0, 60)}"`);
  }
}
check(!prose.length, `no sentence a person sees is typed into the code${prose.length ? `: ${prose.join("; ")}` : ""}`);

let failed = 0;
const report = (results, token) => {
  for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  const f = results.filter(([ok]) => !ok).length;
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "I18N CONTROLS OK"), report(checks, "I18N CHECKS OK")].filter(Boolean);
if (failed) { console.log(`\n${failed} language checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + checks.length} language checks passed.\n${tokens.join("\n")}\nI18N OK`);

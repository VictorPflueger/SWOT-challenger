// The documents of this version are complete and agree with the code:
//   - README.md has at most 600 words, its sections, the version js/config.js names, the live address,
//     the public-information sentence, the byline's two links and as many KPIs as data/kpis.js holds;
//   - TECH_NOTES.md has its sections 1 to 10, and DATA_SOURCES.md its sections 1 to 5; section 1 dates the prices it lists ("Read on <date>", not
//     after today) and lists the three models at the prices of the project instructions, read on
//     23 November 2026; section 6 names as many KPIs and sectors as data/kpis.js holds;
//   - tests/README.md has its sections and a row for every suite tests/run-all.mjs runs, and no other;
//   - vici/README.md names the ViciDesign commit (tests/vici.mjs holds it equal to the workflow's);
//   - every section a published file cites exists ("TECH_NOTES.md, section 4", "TECH_NOTES §4",
//     "PLAN.md, section 11", and a bare "section 5" inside TECH_NOTES.md), and every repository path a
//     document names, in backticks or as a relative link, exists. PLAN.md names the files of 1.0.0, so
//     only its sections count, not its paths; a path that starts with "../" points outside the document's
//     folder (a sibling checkout, or a folder seen from Vici's stylesheet) and is not checked.
//   - every workflow file parses as GitHub reads it: no plain value holds ": ".
// Each check first fails on a planted error. Prints DOCS CONTROLS OK and DOCS OK.
// Usage: node tests/docs.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { APP_ROOT } from "./lib/harness.mjs";
import { APP } from "../js/config.js";
import { SECTORS, KPIS } from "../data/kpis.js";

const LIVE_URL = APP.url;
const PUBLIC = "Public information only: never enter confidential, personal or otherwise protected data.";
const BYLINE = ["https://www.linkedin.com/in/victorpflueger", "https://victorpflueger.github.io/VIP/index.html"];
// The prices of the project instructions, read on 23 November 2026, in US dollars per million tokens:
// input, output, cache write (5 min), cache read. A new reading changes this table and TECH_NOTES.md together.
const PRICES = {
  "claude-haiku-5-5": ["$0.10", "$0.50", "$0.125", "$0.01"],
  "claude-sonnet-5-5": ["$2", "$10", "$2.50", "$0.10"],
  "claude-opus-5-5": ["$4", "$20", "$5", "$0.20"]
};
const DOCS = {
  "README.md": { max: 600, sections: ["What version", "What is real and what is simulated", "Run it", "Tests", "Author"] },
  "TECH_NOTES.md": { numbered: 10 },
  "DATA_SOURCES.md": { numbered: 5 },
  "tests/README.md": { sections: ["Setup", "Run", "What each suite proves", "The private term list"] },
  "vici/README.md": {},
  "PLAN.md": { plan: true }
};
const NUMBER = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EXT = /\.(m?js|css|html|md|json|svg|yml|txt|jpg|png|woff2)$/;
const FOLDERS = ["", "js", "js/i18n", "css", "data", "schemas", "tests", "tests/lib", "tests/fixtures", "tools", "vici", "vici/dist", ".github/workflows"];
const SUITES = [...fs.readFileSync(path.join(APP_ROOT, "tests/run-all.mjs"), "utf8").matchAll(/\{ id: "([\w-]+)", what:/g)].map((m) => m[1]);

const git = (...args) => execFileSync("git", args, { cwd: APP_ROOT, encoding: "utf8" });
const published = git("ls-files", "--cached", "--others", "--exclude-standard").split("\n").filter(Boolean)
  .filter((f) => /\.(m?js|css|html|md|yml|json)$/.test(f) && fs.existsSync(path.join(APP_ROOT, f)));
const read = (f) => fs.readFileSync(path.join(APP_ROOT, f), "utf8");

/** Headings of a document: "## 4. The engine" gives "4", "### 2.1 File tree" gives "2.1". */
const sectionIds = (t) => new Set([...t.matchAll(/^#{2,3} (\d+(?:\.\d+)?)\.?\s/gm)].map((m) => m[1]));

/**
 * A workflow file GitHub cannot parse fails without running a job. The usual slip: a plain scalar that
 * holds ": " (a job's name with a colon in it). Each such line must quote its value.
 */
function workflowProblems(files) {
  const out = [];
  for (const [f, t] of Object.entries(files)) {
    t.split("\n").forEach((line, i) => {
      const m = line.match(/^\s*(?:- )?[\w-]+: (.*)$/);
      if (!m) return;
      const value = m[1].trim();
      if (/^["'|>[{&*!]/.test(value) || value.startsWith("${{")) return;
      if (/: /.test(value.replace(/\$\{\{[^}]*\}\}/g, "")) && !/^\s*#/.test(line)) out.push(`${f}, line ${i + 1}: a plain value holds ": ", so GitHub cannot parse the file; quote it`);
    });
  }
  return out;
}

/** Every problem of the documents (docs: path to text) and of the files that cite them (code: path to text). */
function problemsOf(docs, code) {
  const out = [];
  out.push(...workflowProblems(Object.fromEntries(Object.entries(code).filter(([f]) => f.startsWith(".github/workflows/")))));
  for (const [f, rule] of Object.entries(DOCS)) {
    const t = docs[f];
    if (t === undefined) { out.push(`${f} is missing`); continue; }
    if (rule.max) {
      const words = t.split(/\s+/).filter(Boolean).length;
      if (words > rule.max) out.push(`${f} has ${words} words; at most ${rule.max}`);
    }
    const heads = [...t.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim());
    for (const s of rule.sections || []) if (!heads.some((h) => h.startsWith(s))) out.push(`${f} lacks the section "${s}"`);
    for (let n = 1; n <= (rule.numbered || 0); n++) if (!heads.some((h) => h.startsWith(`${n}. `))) out.push(`${f} lacks section ${n}`);
  }

  // README.md: version, address, the sentence on public information, the byline, the KPI count.
  const readme = docs["README.md"] || "";
  if (!readme.includes(`version ${APP.version}`)) out.push(`README.md does not name "version ${APP.version}", the version js/config.js names`);
  if (!readme.includes(LIVE_URL)) out.push(`README.md does not give the live address ${LIVE_URL}`);
  if (!readme.includes(PUBLIC)) out.push("README.md lacks the sentence on public information");
  if (!/Built by \[Victor Pflüger\]/.test(readme) || BYLINE.some((u) => !readme.includes(`(${u})`))) out.push("README.md lacks the byline with its LinkedIn and website links");
  if (!readme.includes(`${KPIS.length} sector KPIs`)) out.push(`README.md does not say "${KPIS.length} sector KPIs", as many as data/kpis.js holds`);

  // TECH_NOTES.md: the prices, dated, and the KPI library's size.
  const notes = docs["TECH_NOTES.md"] || "";
  const prices = notes.split(/^## 2\. /m)[0].split(/^## 1\. /m)[1] || "";
  const date = prices.match(new RegExp(`Read on (\\d{1,2}) (${MONTHS.join("|")}) (\\d{4})`));
  if (!date) out.push("TECH_NOTES.md, section 1, does not say when the prices were read (\"Read on <day> <month> <year>\")");
  else if (Date.UTC(+date[3], MONTHS.indexOf(date[2]), +date[1]) > Date.now() + 86400000) out.push(`TECH_NOTES.md dates the prices ${date[0].slice(8)}, after today`);
  for (const [id, want] of Object.entries(PRICES)) {
    const row = prices.split("\n").find((l) => l.startsWith("|") && l.includes(`\`${id}\``));
    const cells = row ? row.split("|").slice(1, -1).map((c) => c.trim()) : [];
    if (!row) out.push(`TECH_NOTES.md, section 1, has no row for ${id}`);
    else if (cells.slice(2).join(" ") !== want.join(" ")) out.push(`TECH_NOTES.md, section 1, prices ${id} at ${cells.slice(2).join(", ")}; the project instructions say ${want.join(", ")}`);
  }
  if (!notes.includes(`${KPIS.length} KPIs in ${NUMBER[SECTORS.length] || SECTORS.length} sectors`)) out.push(`TECH_NOTES.md does not say "${KPIS.length} KPIs in ${NUMBER[SECTORS.length]} sectors", as data/kpis.js holds`);

  // tests/README.md: one row per suite, no row for a suite that does not run.
  const rows = new Set([...(docs["tests/README.md"] || "").matchAll(/^\| `([\w-]+)` \|/gm)].map((m) => m[1]));
  for (const s of SUITES) if (!rows.has(s)) out.push(`tests/README.md has no row for the suite ${s}`);
  for (const r of rows) if (!SUITES.includes(r)) out.push(`tests/README.md has a row for ${r}, which tests/run-all.mjs does not run`);

  // vici/README.md: the commit.
  if (!/commit \*\*`[0-9a-f]{7,40}`\*\*/.test(docs["vici/README.md"] || "")) out.push("vici/README.md does not name the ViciDesign commit as **`<sha>`**");

  // Sections cited.
  const targets = { TECH_NOTES: sectionIds(notes), PLAN: sectionIds(docs["PLAN.md"] || "") };
  for (const [f, t] of Object.entries({ ...code, ...Object.fromEntries(Object.entries(docs).filter(([d]) => !DOCS[d].plan)) })) {
    for (const m of t.matchAll(/\b(TECH_NOTES|PLAN)(?:\.md)?(?:,? section |\s?§\s?)(\d+(?:\.\d+)?)/g)) {
      if (!targets[m[1]].has(m[2])) out.push(`${f} cites ${m[1]} section ${m[2]}, which does not exist`);
    }
    if (f !== "TECH_NOTES.md") continue;
    for (const m of t.matchAll(/\bsection (\d+(?:\.\d+)?)/g)) {
      const before = t.slice(Math.max(0, m.index - 16), m.index);
      if (/(PLAN|TECH_NOTES)(\.md)?,? $|brief $/.test(before) || t.startsWith(" of ", m.index + m[0].length)) continue; // another document's
      if (!targets.TECH_NOTES.has(m[1])) out.push(`TECH_NOTES.md refers to its section ${m[1]}, which does not exist`);
    }
  }

  // Paths named.
  for (const [f, t] of Object.entries(docs)) {
    if (DOCS[f]?.plan) continue;
    const base = path.dirname(path.join(APP_ROOT, f));
    const names = new Set();
    for (const m of t.matchAll(/`([^`\s]+)`/g)) names.add(m[1]);
    for (const m of t.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) if (!/^[a-z]+:/i.test(m[1])) names.add(m[1]);
    for (const n of names) {
      const clean = n.replace(/[.,;:]$/, "");
      if (/[<>*{}$]|^~|^\/|^https?:|^-|^\.\.\//.test(clean)) continue; // "../" is relative to another file or folder
      if (/^[\w-]+(\.[\w-]+)*\.(io|com|org|net|de|dev|ai|eu)(\/|$)/i.test(clean)) continue; // a web address
      if (!clean.includes("/") && !EXT.test(clean)) continue;
      if (!/^[\w./ -]+$/.test(clean) || !(EXT.test(clean) || clean.endsWith("/") || /^(js|css|data|schemas|tests|tools|vici|dist|assets)(\/|$)/.test(clean))) continue;
      const candidates = clean.includes("/") ? [path.join(APP_ROOT, clean), path.join(base, clean)] : FOLDERS.map((d) => path.join(APP_ROOT, d, clean));
      if (!candidates.some((c) => fs.existsSync(c))) out.push(`${f} names ${clean}, which does not exist`);
    }
  }
  return out;
}

const docs = Object.fromEntries(Object.keys(DOCS).filter((f) => fs.existsSync(path.join(APP_ROOT, f))).map((f) => [f, read(f)]));
// This test is left out: its controls plant citations of sections that do not exist.
const code = Object.fromEntries(published.filter((f) => !(f in DOCS) && f !== "tests/docs.mjs").map((f) => [f, read(f)]));
const real = problemsOf(docs, code);

// ---- each check can fail ----------------------------------------------------------------------------
const plant = (what, change) => {
  const d = { ...docs };
  const c = { ...code };
  change(d, c);
  const p = problemsOf(d, c);
  return [p.length > real.length, `control: a planted ${what} is caught${p.length > real.length ? "" : " (it was not)"}`];
};
const controls = [
  plant("README without its version", (d) => { d["README.md"] = d["README.md"].split(`version ${APP.version}`).join("version 9.9.9"); }),
  plant("README over 600 words", (d) => { d["README.md"] += " word".repeat(600); }),
  plant("README without the byline's website link", (d) => { d["README.md"] = d["README.md"].split(BYLINE[1]).join("https://example.org/"); }),
  plant("path that does not exist", (d) => { d["TECH_NOTES.md"] += "\nSee `js/nowhere.js`.\n"; }),
  plant("price that differs", (d) => { d["TECH_NOTES.md"] = d["TECH_NOTES.md"].replace("| `claude-haiku-5-5` | $0.10 |", "| `claude-haiku-5-5` | $0.20 |"); }),
  plant("undated price table", (d) => { d["TECH_NOTES.md"] = d["TECH_NOTES.md"].replace(/Read on \d{1,2} \w+ \d{4}/, "Read"); }),
  plant("wrong KPI count", (d) => { d["TECH_NOTES.md"] = d["TECH_NOTES.md"].replace(`${KPIS.length} KPIs`, `${KPIS.length + 1} KPIs`); }),
  plant("citation of a missing plan section", (d) => { d["TECH_NOTES.md"] += "\nPLAN.md, section 99, says so.\n"; }),
  plant("reference to a missing section of the notes", (d) => { d["TECH_NOTES.md"] += "\nAs said (section 98).\n"; }),
  plant("code comment citing a missing section", (d, c) => { c["js/config.js"] = `${c["js/config.js"]}\n// TECH_NOTES §98\n`; }),
  plant("suite with no row", (d) => { d["tests/README.md"] = d["tests/README.md"].replace(/^\| `engine` \|.*\n/m, ""); }),
  plant("workflow job name with a colon", (d, c) => { c[".github/workflows/tests.yml"] = c[".github/workflows/tests.yml"].replace(/name: Browser suites \(Playwright, Chromium,/, "name: Browser suites (Playwright, Chromium: with"); })
];

const checks = [
  [!real.length, `the documents are complete and agree with the code${real.length ? `:\n  - ${real.join("\n  - ")}` : ""}`],
  [SUITES.length >= 10, `tests/run-all.mjs lists ${SUITES.length} suites, each with a row in tests/README.md`]
];

let failed = 0;
const report = (results, token) => {
  const f = results.filter(([ok]) => !ok).length;
  for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "DOCS CONTROLS OK"), report(checks, "DOCS CHECKS OK")].filter(Boolean);
const words = (docs["README.md"] || "").split(/\s+/).filter(Boolean).length;
console.log(`(README.md ${words} words of 600; ${Object.keys(code).length} files scanned for citations)`);
if (failed) { console.log(`\n${failed} checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + checks.length} checks passed.\n${tokens.join("\n")}\nDOCS OK`);

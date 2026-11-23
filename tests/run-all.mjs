// Runs every check in order and prints a summary. The app itself needs none of this.
// Usage: node tests/run-all.mjs                  (all suites)
//        node tests/run-all.mjs engine presenter  (only the named suites)
//        node tests/run-all.mjs --require-vici  (Vici's checks must run: no ViciDesign checkout fails)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const SUITES = [
  { id: "tokens", what: "colour system on Vici's tokens, light and dark: contrast, colour-blind separation", file: "tests/tokens.mjs", browser: false },
  { id: "page-icon", what: "page icon: favicon, header and loading screen, as on the website's card", file: "tests/page-icon.mjs", browser: false },
  { id: "vici-files", what: "vici/ holds exactly the files its README lists, unchanged", file: "tests/vici-files.mjs", browser: false },
  { id: "engine", what: "golden cases SW0 to SW3 and the handoff example: risk, factor scores, IE matrix, money, fact keys", file: "tests/engine.mjs", browser: false },
  { id: "schemas", what: "data contracts, the wire form of every request schema, the shared handoff schema", file: "tests/schemas.mjs", browser: false },
  { id: "kpis", what: "the sector KPI library: thirteen sectors, every KPI in both languages, no benchmark value", file: "tests/kpis.mjs", browser: false, vici: true },
  { id: "i18n", what: "both languages: keys, placeholders, defaults, no sentence typed into the code", file: "tests/i18n.mjs", browser: false },
  { id: "policy", what: "security policy, nothing loaded from elsewhere, no inline script or style, what the browser keeps", file: "tests/policy.mjs", browser: false, vici: true },
  { id: "hygiene", what: "no client, contact or meeting named in any published file", file: "tests/hygiene.mjs", browser: false },
  { id: "docs", what: "the documents complete, their named paths real, the prices dated", file: "tests/docs.mjs", browser: false },
  { id: "parity", what: "the shared files equal the sibling tools' copies, where a sibling has them", file: "tests/parity.mjs", browser: false },
  { id: "vici", what: "Vici's own checks on the page as served and rendered in both languages, the guide render, vici/ at its commit", file: "tests/vici.mjs", browser: true, vici: true },
  { id: "smoke", what: "the page in Chromium: first visit in English, the switch without a reload, one guide per language, what the browser keeps", file: "tests/smoke.mjs", browser: true, vici: true },
  { id: "hexagon", what: "nothing round: the app's files, and the rendered page in both themes", file: "tests/hexagon.mjs", browser: true }
];

const REQUIRE = process.argv.includes("--require-vici");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const unknown = only.filter((id) => !SUITES.some((s) => s.id === id));
if (unknown.length) {
  console.error(`Unknown suite(s): ${unknown.join(", ")}. Known: ${SUITES.map((s) => s.id).join(", ")}.`);
  process.exit(1);
}
const chosen = SUITES.filter((s) => !only.length || only.includes(s.id));
const summary = [];
// In GitHub Actions a failed suite also becomes an annotation with its FAIL lines, readable in the
// run's summary and through the API without the full log.
const CI = process.env.GITHUB_ACTIONS === "true";
const annotate = (s, out) => {
  // Each FAIL line with the indented detail lines under it; otherwise the last lines of the output.
  const lines = out.split("\n").filter((l) => l.trim());
  const picked = [];
  lines.forEach((l, i) => {
    if (!/^(FAIL|Error|AssertionError|TypeError)|failed|exceeded/i.test(l.trim())) return;
    picked.push(l.trim());
    for (let j = i + 1; j < lines.length && /^\s+(-|at |\S)/.test(lines[j]) && j <= i + 8; j++) picked.push(lines[j].trim());
  });
  const text = (picked.length ? picked : lines.slice(-12).map((l) => l.trim())).join(" ⏎ ").slice(0, 6000);
  console.log(`::error title=${s.id} suite failed::${text}`);
};
for (const s of chosen) {
  console.log(`\n=== ${s.id}: ${s.what} ===`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, s.file), ...(s.args || []), ...(s.vici && REQUIRE ? ["--require-vici"] : [])], { cwd: APP_ROOT, stdio: CI ? ["inherit", "pipe", "pipe"] : "inherit", env: process.env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (CI) {
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    if (r.status !== 0) annotate(s, `${r.stdout || ""}\n${r.stderr || ""}`);
  }
  summary.push({ ...s, ok: r.status === 0, code: r.status, seconds: Math.round((Date.now() - started) / 1000) });
  if (r.status === 2 && s.browser) {
    console.log("Playwright is missing; browser suites are skipped. See tests/README.md.");
    break;
  }
}

console.log("\n=== Summary ===");
for (const s of summary) console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.id.padEnd(10)} ${String(s.seconds).padStart(4)} s  ${s.what}`);
const skipped = chosen.length - summary.length;
if (skipped) console.log(`(${skipped} suite${skipped === 1 ? "" : "s"} not run)`);
const allPassed = summary.length === chosen.length && summary.every((s) => s.ok);
// The success lines name what ran: every suite, or exactly the suites asked for.
if (allPassed && !only.length) console.log(`ALL SUITES PASSED (${summary.length} of ${SUITES.length})`);
if (allPassed && only.length) console.log(`SUITES PASSED: ${chosen.map((s) => s.id).join(" ")}`);
process.exit(allPassed ? 0 : 1);

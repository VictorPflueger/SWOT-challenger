// The shared files of the set of four (build brief 4.1) against the sibling tools: whenever a checkout of
// BMC-challenger, PESTEL-challenger or PrototypeIdeator sits next to this repository and holds one of
// these files, it must be the same byte for byte. Where no sibling has a file yet, the suite says so and
// passes: the first tool to merge a shared file is its source, and the others copy it unchanged.
// Prints PARITY OK. Usage: node tests/parity.mjs
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const SHARED = ["data/kpis.js", "schemas/strategy-challenge-1.json", "schemas/strategy-challenge-1.js", "js/risk.js"];
const SIBLINGS = ["BMC-challenger", "PESTEL-challenger", "PrototypeIdeator"];
const results = [];
const notes = [];
for (const sibling of SIBLINGS) {
  const root = path.resolve(APP_ROOT, "..", sibling);
  if (!existsSync(root)) { notes.push(`${sibling}: no checkout next to this repository`); continue; }
  for (const f of SHARED) {
    const theirs = path.join(root, f);
    if (!existsSync(theirs)) { notes.push(`${sibling} has no ${f} yet`); continue; }
    const same = readFileSync(theirs).equals(readFileSync(path.join(APP_ROOT, f)));
    results.push([same, `${f} equals ${sibling}'s copy`]);
  }
}
for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
for (const n of notes) console.log(`SKIP  ${n}`);
if (results.some(([ok]) => !ok)) { console.log("\nA shared file differs from a sibling's: copy the one merged first, unchanged."); process.exit(1); }
console.log(`\nPARITY OK (${results.length} shared file(s) compared, ${notes.length} skipped)`);

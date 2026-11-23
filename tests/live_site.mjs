// The published site (run by .github/workflows/live-site.yml after a Pages build, or by hand): Pages
// serves exactly the files of this checkout, and the page starts there in English and German with its
// guide, no page error and no request to another host. Prints LIVE SITE OK.
// Usage: node tests/live_site.mjs https://victorpflueger.github.io/SWOT-challenger/
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT, launchBrowser, NETWORK_NOISE } from "./lib/harness.mjs";

const base = process.argv[2];
if (!base || !/^https:\/\//.test(base)) { console.error("Usage: node tests/live_site.mjs <https URL of the site>"); process.exit(2); }
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const FILES = ["index.html", "css/app.css", "js/main.js", "js/app.js", "js/engine.js", "js/risk.js", "data/kpis.js", "schemas/strategy-challenge-1.js", "favicon.svg"];

// Pages can lag behind the push by a minute or two: wait for this commit's files.
let same = [];
for (let attempt = 0; attempt < 12; attempt += 1) {
  same = [];
  for (const f of FILES) {
    const r = await fetch(new URL(f, base), { cache: "no-store" });
    const body = Buffer.from(await r.arrayBuffer());
    same.push([f, r.ok && body.equals(readFileSync(path.join(APP_ROOT, f)))]);
  }
  if (same.every(([, ok]) => ok)) break;
  await new Promise((r) => setTimeout(r, 15000));
}
check(same.every(([, ok]) => ok), `Pages serves this checkout's files${same.some(([, ok]) => !ok) ? `: ${same.filter(([, ok]) => !ok).map(([f]) => f).join(", ")} differ` : ""}`);

const browser = await launchBrowser();
try {
  for (const lang of ["en", "de"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const host = new URL(base).host;
    const foreign = [];
    await context.route((url) => url.host !== host, (route) => { foreign.push(route.request().url()); return route.abort("blockedbyclient"); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
    await page.goto(`${base}?lang=${lang}`);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 30000 });
    await page.waitForSelector(`dialog#guide-${lang}[open]`, { timeout: 10000 });
    check(!errors.length && !foreign.length, `in ${lang === "en" ? "English" : "German"} the page starts with its guide open, no page error and no request to another host${[...errors, ...foreign].length ? `: ${[...errors, ...foreign].join("; ")}` : ""}`);
    await context.close();
  }
} finally {
  await browser.close();
}
for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
if (results.some(([ok]) => !ok)) process.exit(1);
console.log("LIVE SITE OK");

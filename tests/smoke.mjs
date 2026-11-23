// The page in Chromium (AC-03 in the browser, and the storage rule): a first visit under a German browser
// opens in English and opens the English guide by itself; ?lang=de opens German with the German guide;
// the switch changes every translated text without a reload, and back; each language's header button
// opens that language's guide; a reload in the same tab, in either language, does not open the guide
// again; the page is light until the visitor chooses dark, and a dark choice holds on the next visit,
// set before the body is drawn; and afterwards the browser holds nothing but vc-theme, swot.lang and
// Vici's vc-guide notes: no other key, no IndexedDB database, no cache and no cookie, which Vici's own
// storedKeyProblems confirms when a ViciDesign checkout is at hand (required with --require-vici and on
// GitHub Actions). No page error, no request to another host.
// Prints SMOKE OK. Usage: node tests/smoke.mjs [--require-vici]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT, REQUIRE_VICI, viciDir, launchBrowser, serveStatic, NETWORK_NOISE } from "./lib/harness.mjs";
import EN from "../js/i18n/en.js";
import DE from "../js/i18n/de.js";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const browser = await launchBrowser();
const server = await serveStatic(APP_ROOT, 8300 + Math.floor(Math.random() * 300));
const foreign = [];

async function open(context, query = "") {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) errors.push(m.text()); });
  await page.goto(`${server.base}${query}`);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForTimeout(300);
  return { page, errors };
}
/** The text of every element that names a key, against the dictionary of `lang`. */
async function untranslated(page, dict) {
  const pairs = await page.$$eval("[data-i18n]", (els) => els.map((el) => [el.dataset.i18n, el.textContent]));
  return pairs.filter(([k, text]) => dict[k] !== text).map(([k, text]) => `${k}: "${text.slice(0, 40)}"`);
}
const guideOpen = (page) => page.evaluate(() => [...document.querySelectorAll("dialog.vc-guide")].filter((d) => d.open).map((d) => d.id));
const visibleOpeners = (page) => page.$$eval("[data-vc-guide-open]", (els) => els.filter((e) => !e.hidden && e.offsetParent !== null).map((e) => e.dataset.vcGuideOpen));

try {
  const context = await browser.newContext({ locale: "de-DE", viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => Object.defineProperty(navigator, "languages", { get: () => ["de-DE", "de"] }));
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { foreign.push(route.request().url()); return route.abort("blockedbyclient"); });
  // The theme the page carries when the body starts: what the first paint shows.
  await context.addInitScript(() => {
    new MutationObserver((list, observer) => {
      if (!document.body) return;
      window.__themeAtBody = document.documentElement.getAttribute("data-theme");
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });

  // A first visit under a German browser: English, with the English guide open.
  const first = await open(context);
  const p = first.page;
  check(await p.evaluate(() => document.documentElement.lang) === "en-GB", "a first visit under a German browser opens in British English");
  check(await p.evaluate(() => window.__themeAtBody) === "light", "a first visit is light from the first paint");
  check(JSON.stringify(await guideOpen(p)) === '["guide-en"]', "the English guide opens by itself, the German one does not");
  const enWrong = await untranslated(p, EN);
  check(!enWrong.length, `every translated text is English${enWrong.length ? `: ${enWrong.join("; ")}` : ""}`);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  check(JSON.stringify(await visibleOpeners(p)) === '["guide-en"]', "only the English How it works button shows");

  // The switch, without a reload.
  await p.evaluate(() => { window.__sameDocument = true; });
  await p.click('.lang-option[data-lang="de"]');
  await p.waitForTimeout(200);
  const deWrong = await untranslated(p, DE);
  check(!deWrong.length && await p.evaluate(() => document.documentElement.lang) === "de", `DE switches every translated text and the page's language to German${deWrong.length ? `: ${deWrong.join("; ")}` : ""}`);
  check(await p.evaluate(() => window.__sameDocument === true), "the switch needs no reload");
  check(await p.evaluate(() => document.title) === DE["app.title"], "the window's title follows the language");
  check(JSON.stringify(await visibleOpeners(p)) === '["guide-de"]' && await p.getAttribute('.lang-option[data-lang="de"]', "aria-pressed") === "true", "the German button opens the German guide, and DE shows as chosen");
  await p.click('[data-vc-guide-open="guide-de"]');
  await p.waitForTimeout(300);
  check(JSON.stringify(await guideOpen(p)) === '["guide-de"]' && (await p.textContent("#guide-de-title")) === "So funktioniert der Prototyp", "So funktioniert's opens the German guide, titled in German");
  await p.keyboard.press("Escape");
  await p.click('.lang-option[data-lang="en"]');
  await p.waitForTimeout(200);
  const backWrong = await untranslated(p, EN);
  check(!backWrong.length && await p.evaluate(() => document.documentElement.lang) === "en-GB", "EN switches back to English");

  // Once per tab: a reload in the same tab, in either language, does not open the guide again.
  await p.reload();
  await p.waitForSelector('html[data-boot="ready"]');
  await p.waitForTimeout(300);
  check(!(await guideOpen(p)).length, "a reload in the same tab does not open the guide again");
  await p.goto(`${server.base}?lang=de`);
  await p.waitForSelector('html[data-boot="ready"]');
  await p.waitForTimeout(300);
  check(!(await guideOpen(p)).length && await p.evaluate(() => document.documentElement.lang) === "de", "?lang=de in the same tab opens German, without the guide that has already opened");

  // ?lang=de in a new tab opens German with the German guide.
  const second = await open(context, "?lang=de");
  check(await second.page.evaluate(() => document.documentElement.lang) === "de" && JSON.stringify(await guideOpen(second.page)) === '["guide-de"]', "?lang=de in a new tab opens German with the German guide open");

  // The theme toggle keeps vc-theme, as Vici does, and the next visit is dark from the first paint.
  await second.page.keyboard.press("Escape");
  await second.page.click("[data-vc-theme-toggle]");
  await second.page.waitForTimeout(200);
  check(await second.page.evaluate(() => document.documentElement.dataset.theme === "dark" && localStorage.getItem("vc-theme") === "dark"), "the toggle turns the page dark and keeps the choice under vc-theme");
  await second.page.reload();
  await second.page.waitForSelector('html[data-boot="ready"]');
  check(await second.page.evaluate(() => window.__themeAtBody) === "dark", "the next visit is dark before the body is drawn, from Vici's vici-theme.js");

  // What the browser keeps.
  const kept = await second.page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [],
    caches: typeof caches === "undefined" ? [] : await caches.keys(),
    cookie: document.cookie
  }));
  const okLocal = kept.local.every((k) => k === "vc-theme" || k === "swot.lang") && kept.local.includes("vc-theme") && kept.local.includes("swot.lang");
  check(okLocal, `local storage holds only vc-theme and swot.lang (${kept.local.join(", ")})`);
  check(kept.session.every((k) => k.startsWith("vc-guide:")), `session storage holds only Vici's guide notes (${kept.session.join(", ")})`);
  check(!kept.databases.length && !kept.caches.length && !kept.cookie, "no IndexedDB database, no cache and no cookie");
  const dir = viciDir();
  if (dir) {
    const { storedKeyProblems } = await import(pathToFileURL(path.join(dir, "scripts", "lib", "storage.mjs")).href);
    const planted = storedKeyProblems({ ...kept, local: [...kept.local, "swot.apiKey"] }, { prefix: "swot" });
    const found = storedKeyProblems(kept, { prefix: "swot" });
    check(planted.length > 0 && !found.length, `Vici's storedKeyProblems finds nothing left behind, and catches a planted swot.apiKey${found.length ? `: ${found.join("; ")}` : ""}`);
  } else {
    check(!REQUIRE_VICI, "Vici's storedKeyProblems: no ViciDesign checkout in VICI_DIR or next to this repository");
    if (!REQUIRE_VICI) console.log("SKIP  Vici's storedKeyProblems: no ViciDesign checkout at hand");
  }
  const errors = [...first.errors, ...second.errors];
  check(!errors.length, `no page error${errors.length ? `: ${errors.join("; ")}` : ""}`);
  check(!foreign.length, `no request to another host${foreign.length ? `: ${foreign.join(", ")}` : ""}`);
  await context.close();
} finally {
  await server.close();
  await browser.close();
}

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} smoke checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} smoke checks passed.\nSMOKE OK`);

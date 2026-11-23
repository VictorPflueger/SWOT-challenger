// Both languages. English opens every first visit, whatever the browser's language; German is one click
// away (brief 5.11). The choice: ?lang=de or ?lang=en in the address wins and becomes the stored choice;
// otherwise the stored choice (localStorage "swot.lang"); otherwise English. <html lang> follows. A change
// re-renders every view through onLang(), without a reload.
//
// Every user-visible string lives in en.js and de.js under the same keys. Values may hold placeholders in
// braces, "{name}", filled from t()'s second argument. index.html keeps the English texts as static
// defaults; its elements name their key in data-i18n (text) or data-i18n-attr ("attribute:key;
// attribute:key"), and applyStatic() replaces them at runtime. Taken from the Sovereignty Assessment
// 2.0.0; only the storage key, the html lang values and the comments changed.

import { STORAGE } from "../config.js";
import EN from "./en.js";
import DE from "./de.js";

export const LANGS = ["en", "de"];
const DICTS = { en: EN, de: DE };
const LOCALES = { en: "en-GB", de: "de-DE" };
const HTML_LANG = { en: "en-GB", de: "de" };

let lang = "en";
const listeners = new Set();

function readStored() {
  try { return localStorage.getItem(STORAGE.lang); } catch { return null; }
}

function store(value) {
  try { localStorage.setItem(STORAGE.lang, value); } catch { /* storage blocked: the choice lasts this page only */ }
}

function mark() {
  document.documentElement.lang = HTML_LANG[lang];
  document.documentElement.dataset.lang = lang;
}

/**
 * The language at start-up: ?lang= wins and is stored, then the stored choice, then English. The
 * browser's own language is never asked.
 */
export function initLang(search = location.search) {
  const fromUrl = new URLSearchParams(search).get("lang");
  if (LANGS.includes(fromUrl)) {
    lang = fromUrl;
    store(fromUrl);
  } else {
    const stored = readStored();
    lang = LANGS.includes(stored) ? stored : "en";
  }
  mark();
  return lang;
}

export function getLang() {
  return lang;
}

/** The Intl locale of a language: en-GB or de-DE. */
export function locale(l = lang) {
  return LOCALES[l] || LOCALES.en;
}

/** Switches the whole interface, stores the choice and tells every view. No reload. */
export function setLang(next) {
  if (!LANGS.includes(next)) return;
  store(next);
  if (next === lang) return;
  lang = next;
  mark();
  applyStatic();
  for (const fn of [...listeners]) {
    try { fn(lang); } catch (e) { console.error("[SWOT Challenger] language listener failed:", e); }
  }
}

/** Calls fn(lang) after every language change. Returns an unsubscribe function. */
export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The text of a key in the active language (or in `l`), with {placeholders} filled from vars. */
export function t(key, vars = null, l = lang) {
  const dict = DICTS[l] || EN;
  let text = dict[key];
  if (typeof text !== "string") text = key;
  if (!vars) return text;
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, name) => (Object.hasOwn(vars, name) && vars[name] !== null && vars[name] !== undefined ? String(vars[name]) : m));
}

/** The plural form of a key for n: key.one or key.other, chosen by the language's plural rules. */
export function tn(key, n, vars = {}, l = lang) {
  const form = new Intl.PluralRules(locale(l)).select(Number(n)) === "one" ? "one" : "other";
  return t(`${key}.${form}`, { n, ...vars }, l);
}

/** The dictionary of a language (read-only), for the tests. */
export function dictionary(l) {
  return DICTS[l] || null;
}

/** The values of an element's data-i18n-vars (JSON), or null. */
function varsOf(el) {
  const raw = el.dataset.i18nVars;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Re-translates every element that names its key. data-i18n="key" sets an element's text (with
 * data-i18n-vars='{"name": value}' for its placeholders, and data-i18n-n="n" for a plural form);
 * data-i18n-attr="aria-label:key; title:key" sets its attributes. The document title follows.
 */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const vars = varsOf(el);
    const n = el.dataset.i18nN;
    el.textContent = n !== undefined ? tn(el.dataset.i18n, Number(n), vars || {}) : t(el.dataset.i18n, vars);
  }
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  document.title = t("app.title");
}

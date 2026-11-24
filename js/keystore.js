// The person's Anthropic API key, held in this tab's memory only: one module variable. It is never written
// to local storage, session storage, IndexedDB, the Cache API or a cookie, never put in a URL, a log or an
// export, and it is gone when the tab closes or reloads. It shows masked ("sk-ant-…9fQx"), anything shaped
// like a key is redacted from text that leaves the page, and js/anthropic.js sends it to api.anthropic.com
// and nowhere else. The same file in the four tools of the set. Adapted from the Sovereignty Assessment
// 2.0.0 (35c0dea), whose key lived in session storage; looksLikeKey, maskKey and redactSecrets stay.

const KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,}$/;
let key = null;

/** The key, or null. */
export function getKey() {
  return key;
}

export function hasKey() {
  return key !== null;
}

/** Holds the key for this tab's life; an empty value forgets it. Returns what is held. */
export function setKey(raw) {
  const value = String(raw ?? "").trim();
  key = value || null;
  return key;
}

/** Forgets the key ("Forget key", and "Clear everything"). */
export function forgetKey() {
  key = null;
}

/** A format check only; the real check is the free GET /v1/models call. */
export function looksLikeKey(raw) {
  return KEY_PATTERN.test(String(raw ?? "").trim());
}

/** The key masked for display, such as "sk-ant-…9fQx"; empty without a key. */
export function maskKey(value = key) {
  if (!value) return "";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

/** Text with anything shaped like an Anthropic key replaced, for errors, logs and downloads. */
export function redactSecrets(text) {
  return String(text).replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "sk-ant-[REDACTED]");
}

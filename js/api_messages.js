// The shared client's errors in the page's language (PLAN.md 5.5, brief 5.8). js/anthropic.js stays the
// sister tools' file, unchanged: where the page shows one of its errors, this module maps the HTTP status
// and the error's type and words to an i18n key for what happened and one for the next step. The API's own
// message stays in English and only fills a placeholder where the page shows it as a detail. Adapted from
// the Sovereignty Assessment 2.0.0 (35c0dea), with 402, 404 and the credit and spend-limit answers added.

import { networkMessage } from "./anthropic.js";

const TIMED_OUT = networkMessage({ name: "AbortError" });

/** True for an answer that says the account has run out of credit. */
const isCredit = (status, type, message) => status === 402 || type === "billing_error" || /credit balance|insufficient credit|no credit/i.test(message);
/** True for an answer that says a spend limit was reached: a workspace's own or a tier's. */
const isSpendLimit = (status, details, message) => details?.error_code === "enforced_spend_limit_reached" || /spend limit|usage limits/i.test(message);

/**
 * The words for a failed call: an ApiError, or { status, error: { type, message, details } } as
 * checkKey() gives it. Returns { key, next, vars }: `key` names what happened, `next` the one next step,
 * both i18n keys; `vars` fills the placeholders.
 */
export function apiMessage(err = {}) {
  const status = Number(err.status) || 0;
  const type = err.type || err.error?.type || "";
  const message = String(err.error?.message ?? err.message ?? err.detail ?? "").trim();
  const details = err.details ?? err.error?.details ?? null;
  if (err.name === "AbortError") return { key: "api.aborted", next: "api.aborted.next", vars: null };
  if (!status) {
    if (type === "timeout_error" || message === TIMED_OUT) return { key: "api.timeout", next: "api.timeout.next", vars: null };
    return { key: "api.network", next: "api.network.next", vars: null };
  }
  if (status === 401) return { key: "api.unauthorized", next: "api.unauthorized.next", vars: null };
  if (status === 403 || status === 404) return { key: "api.model", next: "api.model.next", vars: null };
  if (isCredit(status, type, message)) return { key: "api.credit", next: "api.credit.next", vars: null };
  if ((status === 400 || status === 429) && isSpendLimit(status, details, message)) return { key: "api.spendLimit", next: "api.spendLimit.next", vars: null };
  if (status === 429) return { key: "api.busy", next: "api.busy.next", vars: null };
  if (status === 529 || type === "overloaded_error") return { key: "api.busy", next: "api.busy.next", vars: null };
  if (status >= 500) return { key: "api.server", next: "api.busy.next", vars: { status } };
  return { key: "api.other", next: "api.other.next", vars: { status, message: message || type || String(status) } };
}

/** True when the error is the 400 an organisation returns when its admin has switched web search off. */
export function webSearchOff(err) {
  return Number(err?.status) === 400 && /web.?search/i.test(String(err?.message ?? err?.error?.message ?? ""));
}

// The private-data warning before a live run (brief 5.10, AC-11): code looks for what is usually private
// in what the person entered, such as API keys, e-mail addresses, phone numbers, IBANs and the words of a
// classification label ("confidential", "vertraulich", "for internal use", "nur intern"), and the dialog
// asks them to remove it or confirm it is public. It warns; it does not block. A SWOT speaks of internal
// and external factors all the time ("Internal processes are slow", "Wissen wird intern nicht geteilt"),
// so "internal" or "intern" alone is no label here: only the phrases and forms that mark a document as
// internal count (TECH_NOTES.md, section 11).

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
// A phone number: a + and a country code, or a 0 and an area code, then at least six more digits in groups.
const PHONE = /(?<![\p{L}\p{N}.,])(?:\+\d{1,3}[\s./-]?(?:\(0\)[\s./-]?)?\d{1,5}|\(?0\d{1,5}\)?)(?:[\s./-]?\d{2,}){2,}(?![\p{L}\p{N}])/gu;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g;
// An Anthropic API key, as js/keystore.js's redactSecrets() finds it.
const KEY = /sk-ant-[A-Za-z0-9_-]{8,}/;
const LABELS = [
  /\b(?:strictly\s+)?confidential\b/i,
  /\bfor\s+internal\s+use\b/i,
  /\binternal\s+(?:use\s+)?only\b/i,
  /\bproprietary\b/i,
  /\bnot\s+for\s+(?:distribution|publication)\b/i,
  /\bunder\s+NDA\b/i,
  /\b(?:streng\s+)?vertraulich\w*/i,
  /\bnur\s+(?:für\s+den\s+)?intern\w*/i,
  /\bzur\s+internen\s+Verwendung\b/i,
  /\bgeheim\w*/i,
  /\bnicht\s+zur\s+Weitergabe\b/i,
  // "Internal" or "intern" as a label: at the start of a text, or in brackets, before a colon or a dash.
  /^\s*[[(]?\s*(?:internal|intern)\s*(?:[\])]|[:\u2013\u2014-])/i,
  /[[(]\s*(?:internal|intern)\s*[\])]/i,
  // A classification line: "Classification: internal", "Schutzklasse: vertraulich".
  /\b(?:classification|klassifizierung|klassifikation|schutzklasse|vertraulichkeitsstufe)\s*:\s*\S/i
];

/** True for a string that passes the IBAN check digits (ISO 13616, mod 97). */
function ibanValid(raw) {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (s.length < 15 || s.length > 34) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** What is usually private in one text: a list of kinds, each "key", "email", "phone", "iban" or "label". */
export function privateKinds(text) {
  const s = String(text ?? "");
  const kinds = new Set();
  if (KEY.test(s)) kinds.add("key");
  if (s.match(EMAIL)) kinds.add("email");
  for (const m of s.matchAll(IBAN)) if (ibanValid(m[0])) kinds.add("iban");
  const withoutIban = s.replace(IBAN, " ");
  for (const m of withoutIban.matchAll(PHONE)) if (m[0].replace(/\D/g, "").length >= 7) kinds.add("phone");
  if (LABELS.some((re) => re.test(s))) kinds.add("label");
  return [...kinds];
}

/**
 * Every finding in what the person entered: [{ kind, where }], where `where` names the field: "company",
 * "description", or a quadrant ("strengths" and so on). entered: each quadrant's items, as texts or as
 * { text }. One finding per kind and field.
 */
export function privacyFindings({ company = {}, entered = {} }) {
  const out = [];
  const seen = new Set();
  const add = (kind, where) => { const k = `${kind}|${where}`; if (!seen.has(k)) { seen.add(k); out.push({ kind, where }); } };
  for (const kind of privateKinds(company.name)) add(kind, "company");
  for (const kind of privateKinds(company.description)) add(kind, "description");
  for (const [q, items] of Object.entries(entered)) for (const it of items || []) for (const kind of privateKinds(typeof it === "string" ? it : it?.text)) add(kind, q);
  return out;
}

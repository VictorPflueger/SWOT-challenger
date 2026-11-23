// Fact keys, placeholders and the fact audit (brief 6.5 and 7). The Writer never writes a figure: it cites
// the engine's figures through {{fact:<key>}} placeholders, and code renders them in the run's language
// for whichever strategies the person chose. The audit runs on every text an agent wrote and finds every
// number or proportion written outside those placeholders. In this order, on the text with its white
// space normalised (non-breaking spaces included):
//   1. placeholders are resolved; an unknown key is an error;
//   2. quoted text that appears verbatim in the run's evidence is set aside („…“, “…”, "…", »…«, «…», ‚…‘);
//   3. ISO dates (YYYY-MM-DD) and item, issue and strategy ids (s1, w2, I3, R1) are set aside;
//   4. legal references (§ or Art. with its number) that appear in the run's evidence are set aside;
//   5. blocked words and fractions are reported, once each, as written: "%", percent, per cent, Prozent,
//      half and halves (not "half-"), a third, one third, two thirds, a quarter, one quarter, three
//      quarters, thirds, quarters, Hälfte, Drittel and Viertel with their inflected forms, and cardinal
//      number words above twelve in English and German, compounds included;
//   6. every other number token is reported, unless it is written as the run's evidence writes it: a
//      token with letters on its own ("ISO 14083" as "14083" after "ISO"), a number with the word directly
//      before it, or a four-digit year that the evidence contains.
// The run's evidence: the titles of the sources the agents cite, and their addresses, so a source can be
// linked. Adapted from the Sovereignty Assessment 2.0.0 (js/facts.js), with SWOT's fact keys and ids.

import { money, fixed } from "./risk.js";

/** A placeholder: {{fact:at_stake}}. */
export const FACT_RE = /\{\{fact:([A-Za-z0-9_.-]+)\}\}/g;

/** The fact keys of brief 6.5, without the issue keys, which depend on the run's issues. */
export const FACT_KEYS = Object.freeze(["at_stake", "left", "upside", "ife.before", "ife.after", "efe.before", "efe.after", "zone.before", "zone.after", "items.challenged", "items.total", "items.added", "issues.count"]);

/** The kind of a fact key, which decides how it renders: money, score, zone or count. */
export function factKind(key) {
  const k = String(key);
  if (/^(at_stake|left|upside)$|^issue\.I\d{1,2}\.expected$/.test(k)) return "money";
  if (/^(ife|efe)\.(before|after)$/.test(k)) return "score";
  if (/^zone\.(before|after)$/.test(k)) return "zone";
  if (/^(items\.(challenged|total|added)|issues\.count)$/.test(k)) return "count";
  return "unknown";
}

/** The text with every {{fact:key}} replaced by its value in `values` (factValues); unknown keys stay. */
export function renderFacts(text, values) {
  return String(text ?? "").replace(FACT_RE, (m, key) => (values && Object.hasOwn(values, key) ? values[key] : m));
}

/** The keys a text cites, in order, each once. */
export function factKeysIn(text) {
  return [...new Set([...String(text ?? "").matchAll(FACT_RE)].map((m) => m[1]))];
}

/** Whitespace normalised: every run of white space (non-breaking spaces included) becomes one space. */
export function normalise(text) {
  return String(text ?? "").replace(/\s+/gu, " ").trim();
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const L = "[\\p{L}\\p{N}]";
const NOT_BEFORE = `(?<!${L})`;
const NOT_AFTER = `(?!${L})`;

/** The run's evidence as the audit reads it: { titles, urls }, normalised, with helpers. */
export function evidenceCorpus(evidence = {}) {
  const strings = [...(evidence.titles || []), ...(evidence.texts || [])].map(normalise).filter(Boolean);
  const urls = (evidence.urls || []).map((u) => String(u).trim()).filter(Boolean);
  return {
    strings,
    urls,
    contains: (s) => strings.some((e) => e.includes(s)),
    containsWords: (s) => {
      const re = new RegExp(`${NOT_BEFORE}${esc(s)}${NOT_AFTER}`, "u");
      return strings.some((e) => re.test(e));
    }
  };
}

const EXCEPT = `(?![ -](?:party|parties|country|countries)${NOT_AFTER})`;
const FRACTIONS = [
  `${NOT_BEFORE}(?:two)[ -]thirds${NOT_AFTER}${EXCEPT}`,
  `${NOT_BEFORE}(?:three)[ -]quarters${NOT_AFTER}${EXCEPT}`,
  `${NOT_BEFORE}(?:a|one)[ -]third${NOT_AFTER}${EXCEPT}`,
  `${NOT_BEFORE}(?<!once )(?:a)[ -]quarter${NOT_AFTER}${EXCEPT}`,
  `${NOT_BEFORE}(?:one)[ -]quarter${NOT_AFTER}${EXCEPT}`
];
const WORDS = [
  `${NOT_BEFORE}thirds${NOT_AFTER}`,
  `${NOT_BEFORE}quarters${NOT_AFTER}`,
  `${NOT_BEFORE}half${NOT_AFTER}(?!-)`,
  `${NOT_BEFORE}halves${NOT_AFTER}`,
  `${NOT_BEFORE}(?:percent|per cent|prozent)${NOT_AFTER}`,
  `${NOT_BEFORE}(?:hälfte|hälften)${NOT_AFTER}`,
  `${NOT_BEFORE}(?:drittel|drittels|dritteln)${NOT_AFTER}`,
  `${NOT_BEFORE}(?:viertel|viertels|vierteln)${NOT_AFTER}`,
  `%`
];
const EN_BIG = `${NOT_BEFORE}(?:thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)s?(?:-(?:one|two|three|four|five|six|seven|eight|nine))?(?![\\p{L}\\p{N}-])`;
const DE_PARTS = /^(?:ein|eins|eine|zwei|drei|vier|fünf|sechs|sech|sieben|sieb|acht|neun|zehn|elf|zwölf|und|zwanzig|dreißig|dreissig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend)+$/u;
const DE_BIG = /(?:zwanzig|ßig|ssig|zig|hundert|tausend)/u;
const DE_TEEN = /(?:drei|vier|fünf|sech|sieb|acht|neun)zehn$/u;
const DE_LARGE = /^(?:millionen?|milliarden?|billionen?|mio|mrd)$/u;

/**
 * The fact audit. text: an agent's text; facts: the keys the engine returns for this run (array or
 * Set); evidence: { titles, urls }. Returns { pass, tokens, unknownFacts }: the blocked tokens once each,
 * as written, in the order they appear.
 */
export function auditText(text, { facts = [], evidence = {} } = {}) {
  const known = facts instanceof Set ? facts : new Set(facts);
  const corpus = evidenceCorpus(evidence);
  const src = normalise(text);
  let w = src;
  const hits = [];
  const unknownFacts = [];
  const mask = (start, length) => { w = w.slice(0, start) + " ".repeat(length) + w.slice(start + length); };
  const each = (re, fn) => { for (const m of [...w.matchAll(re)]) fn(m); };

  // 1. Placeholders: resolved against the run's facts; an unknown key is an error.
  each(new RegExp(FACT_RE.source, "g"), (m) => {
    if (!known.has(m[1]) && !unknownFacts.includes(m[1])) unknownFacts.push(m[1]);
    mask(m.index, m[0].length);
  });
  // Evidence addresses, so a source can be linked.
  for (const url of corpus.urls) {
    let i = w.indexOf(url);
    while (i >= 0) { mask(i, url.length); i = w.indexOf(url, i + url.length); }
  }
  // 2. Quoted text that appears verbatim in the run's evidence.
  const QUOTES = [/„([^“”„]*)[“”]/gu, /“([^”“]*)”/gu, /»([^«»]*)«/gu, /«([^«»]*)»/gu, /‚([^‘‚]*)‘/gu, /"([^"]*)"/gu];
  for (const re of QUOTES) {
    each(re, (m) => {
      const inner = normalise(m[1]);
      if (inner && corpus.contains(inner)) mask(m.index, m[0].length);
    });
  }
  // 3. ISO dates and the run's ids.
  each(new RegExp(`${NOT_BEFORE}\\d{4}-\\d{2}-\\d{2}${NOT_AFTER}`, "gu"), (m) => mask(m.index, m[0].length));
  each(new RegExp(`${NOT_BEFORE}(?:[swot]\\d{1,2}|I\\d{1,2}|R\\d{1,2})${NOT_AFTER}`, "gu"), (m) => mask(m.index, m[0].length));
  // 4. Legal references that appear in the run's evidence.
  const LEGAL = /(§§?|Art\.) ?(\d+[a-z]?(?: (?:Abs\.|Absatz|Satz|S\.|Nr\.|lit\.) ?\d+[a-z]?)*)(?![\p{L}\p{N}])/gu;
  each(LEGAL, (m) => {
    const ref = new RegExp(`${esc(m[1])} ?${m[2].split(" ").map(esc).join(" ?")}(?![\\p{L}\\p{N}])`, "u");
    if (corpus.strings.some((e) => ref.test(e))) mask(m.index, m[0].length);
  });
  // 5. Blocked words and fractions, reported as written.
  for (const source of [...FRACTIONS, ...WORDS, EN_BIG]) {
    each(new RegExp(source, "giu"), (m) => { hits.push({ index: m.index, token: m[0] }); mask(m.index, m[0].length); });
  }
  each(/\p{L}+/gu, (m) => {
    const word = m[0].toLowerCase();
    if ((DE_PARTS.test(word) && (DE_BIG.test(word) || DE_TEEN.test(word))) || DE_LARGE.test(word)) {
      hits.push({ index: m.index, token: m[0] });
      mask(m.index, m[0].length);
    }
  });
  // 6. Number tokens, unless written as the run's evidence writes them.
  const NUMBER = /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}]*\p{N})[\p{L}\p{N}]+(?:(?<=\p{N})[.,](?=\p{N})[\p{L}\p{N}]+)*/gu;
  each(NUMBER, (m) => {
    const token = m[0];
    if (/\p{L}/u.test(token)) {
      if (corpus.containsWords(token)) return;
    } else {
      if (/^(?:19|20)\d{2}$/.test(token) && corpus.containsWords(token)) return;
      const before = src.slice(0, m.index).trimEnd();
      const prev = (before.match(/(\S+)$/) || [])[1]?.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (prev && corpus.containsWords(`${prev} ${token}`)) return;
    }
    hits.push({ index: m.index, token });
  });

  hits.sort((a, b) => a.index - b.index);
  const tokens = [];
  for (const h of hits) if (!tokens.includes(h.token)) tokens.push(h.token);
  return { pass: tokens.length === 0 && unknownFacts.length === 0, tokens, unknownFacts };
}

/** A fact's value as display text, for the tests and the Method dialog: money, score, zone or count. */
export function formatFact(key, value, lang, zoneName) {
  switch (factKind(key)) {
    case "money": return money(value, lang);
    case "score": return fixed(value, 2, lang);
    case "zone": return zoneName(value, lang);
    case "count": return String(value);
    default: return String(value);
  }
}

// The fact audit on golden texts, in both languages (brief 6.5 and 7). The Writer cites the engine's
// figures through {{fact:key}} placeholders: every placeholder of the three scenarios' summaries renders
// from the engine, for the recorded choice and for no choice, and nothing of a placeholder is left. A
// number written into prose is refused, as written: a figure, a percentage, a fraction, a number word
// above twelve, a year the evidence does not name, an unknown fact key. What the evidence writes passes:
// a standard's number, a year in a source's title, a legal reference, an ISO date, an id, a quotation.
// Prints AUDIT OK. Usage: node tests/audit.mjs
import { readFileSync } from "node:fs";
import { auditText, renderFacts, factKeysIn, FACT_KEYS } from "../js/facts.js";
import { createRun } from "../js/simulation.js";
import { factsFor } from "../js/scenario.js";
import { money, fixed } from "../js/risk.js";

const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const facts = new Set([...FACT_KEYS, "issue.I1.expected"]);
const evidence = { titles: ["CountEmissionsEU: one EU method for transport emissions, based on EN ISO 14083", "Emissions trading for shipping: allowances for all reported emissions from 2027", "Bundesnetzagentur: Alle Lieferanten bieten ab 2025 dynamische Tarife an", "Dynamische Stromtarife nach § 41a EnWG"], urls: ["https://transport.ec.europa.eu/"] };
const audit = (text) => auditText(text, { facts, evidence });

// ---- golden texts that pass ----------------------------------------------------------------------------
const PASS = {
  en: [
    "The issues found put {{fact:at_stake}} a year at stake, and {{fact:left}} stays after the decision.",
    "The challenge questions {{fact:items.challenged}} of {{fact:items.total}} items; the response to the market moves from {{fact:efe.before}} to {{fact:efe.after}}.",
    "Shippers will count emissions the EU way, which follows EN ISO 14083.",
    "From 2027 allowances must cover every reported emission.",
    "Ten shippers book most of the feeder space, and three of them ask for figures.",
    "The plan was due on 2026-12-31, and items s2 and t4 carry it, as issue I1 shows.",
    "The source says \"allowances for all reported emissions from 2027\" in its title."
  ],
  de: [
    "Die gefundenen Probleme stellen jährlich {{fact:at_stake}} aufs Spiel, nach der Entscheidung bleiben {{fact:left}}.",
    "Die Antwort auf den Markt steigt von {{fact:efe.before}} auf {{fact:efe.after}}, im Feld der Strategie {{fact:zone.after}}.",
    "Seit 2025 muss jeder Lieferant einen dynamischen Tarif anbieten.",
    "Die Pflicht folgt aus § 41a EnWG.",
    "Zwölf Kunden fragen schon, und zehn davon haben einen intelligenten Zähler.",
    "Der Analyst nennt „Alle Lieferanten bieten ab 2025 dynamische Tarife an“ als Quelle."
  ]
};
for (const [lang, texts] of Object.entries(PASS)) {
  const failing = texts.map((t) => [t, audit(t)]).filter(([, a]) => !a.pass);
  check(!failing.length, `${lang === "en" ? "English" : "German"}: ${texts.length} golden texts with placeholders, a standard's number, a year and a legal reference from the evidence, ISO dates, ids, quotations and number words up to twelve pass${failing.length ? `: ${failing.map(([t, a]) => `"${t.slice(0, 40)}" (${[...a.tokens, ...a.unknownFacts].join(", ")})`).join("; ")}` : ""}`);
}

// ---- golden texts that are refused, with what each must report -----------------------------------------
const REFUSE = {
  en: [
    ["It costs €2m a year.", ["2m"]],
    ["Costs rise by 20 % next year.", ["20", "%"]],
    ["Half of the shippers book online.", ["Half"]],
    ["A third of the fleet is old, and two thirds is chartered.", ["A third", "two thirds"]],
    ["Twenty ships call at the port.", ["Twenty"]],
    ["In 2030 the rule tightens.", ["2030"]],
    ["The response moves to 2.55.", ["2.55"]],
    ["Ninety percent of the cargo moves by sea.", ["percent", "Ninety"]],
    ["What is left is {{fact:left_over}} a year.", []]
  ],
  de: [
    ["Das kostet 2 Mio. € im Jahr.", ["2"]],
    ["Die Hälfte der Kunden wechselt.", ["Hälfte"]],
    ["Zwanzig Prozent der Zähler fehlen.", ["Prozent", "Zwanzig"]],
    ["Ein Drittel der Kunden hat einen Zähler.", ["Drittel"]],
    ["Bis 2032 kommen die Zähler.", ["2032"]],
    ["Die Antwort steigt auf 2,55.", ["2,55"]],
    ["Was bleibt, sind {{fact:rest}} im Jahr.", []]
  ]
};
for (const [lang, cases] of Object.entries(REFUSE)) {
  const missed = [];
  for (const [text, want] of cases) {
    const a = audit(text);
    const unknown = /\{\{fact:/.test(text) && !text.match(/\{\{fact:([^}]+)\}\}/g).every((m) => facts.has(m.slice(7, -2)));
    if (a.pass || !want.every((w) => a.tokens.includes(w)) || (unknown && !a.unknownFacts.length)) missed.push(`"${text}" gave ${JSON.stringify(a.tokens)} ${JSON.stringify(a.unknownFacts)}`);
  }
  check(!missed.length, `${lang === "en" ? "English" : "German"}: ${cases.length} golden texts with a figure, a percentage, a fraction, a number word above twelve, a year the evidence lacks, a decimal or an unknown fact are refused, each token reported as written${missed.length ? `: ${missed.join("; ")}` : ""}`);
}

// ---- every summary of the three scenarios renders, with the figures written down by hand -----------------
// The expected figures come from tests/fixtures/scenarios.json, worked out by hand, not from the engine.
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/scenarios.json", import.meta.url), "utf8"));
for (const id of ["s1", "s2", "s3"]) {
  const run = createRun((await import(`../data/scenarios/${id}.js`)).default);
  const fx = fixtures[id];
  for (const lang of ["en", "de"]) {
    const r = run.byLang[lang];
    const s = r.summary;
    const texts = [s.headline, s.situation, ...s.findings, s.recommendation, ...s.assumptions];
    const problems = [];
    for (const [name, chosen, want] of [["recorded choice", fx.recorded.chosen, fx.recorded.figures], ["no choice", fx.none.chosen, fx.none.figures]]) {
      const values = factsFor(r, chosen, lang, (z, l) => `${z}.${l}`);
      for (const text of texts) {
        for (const key of factKeysIn(text)) if (!Object.hasOwn(values, key)) problems.push(`${key} has no value`);
        const out = renderFacts(text, values);
        if (/\{\{fact:/.test(out)) problems.push(`"${out.slice(0, 40)}" keeps a placeholder`);
      }
      const stake = want.at_stake ?? fx.recorded.figures.at_stake;
      if (values.at_stake !== money(stake, lang)) problems.push(`with the ${name}, at_stake renders ${values.at_stake}, not ${money(stake, lang)}`);
      if (values.left !== money(want.left, lang)) problems.push(`with the ${name}, left renders ${values.left}, not ${money(want.left, lang)}`);
      if (values["efe.after"] !== fixed(want.efe_after, 2, lang)) problems.push(`with the ${name}, efe.after renders ${values["efe.after"]}, not ${fixed(want.efe_after, 2, lang)}`);
    }
    check(!problems.length && texts.some((t) => factKeysIn(t).length), `${id} in ${lang === "en" ? "English" : "German"}: every placeholder of the summary renders, and at_stake, left and efe.after match the hand-worked figures for the recorded choice and for none${problems.length ? `: ${problems.slice(0, 4).join("; ")}` : ""}`);
  }
}

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.log(`\n${failed} audit checks failed.`); process.exit(1); }
console.log(`\nAll ${results.length} audit checks passed.\nAUDIT OK`);

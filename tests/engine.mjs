// The engine against the golden cases of tests/fixtures/golden.json (brief section 11, AC-16): bands
// (SW0), the factor scores and the IE cell before and after the strategies (SW1), rescaled weights and
// the IE matrix's boundaries (SW2), expected euros and what is at stake (SW3), and the handoff example of
// brief 4.3. Values within 1e-9 of the exact figures, every display string in English and German.
// Each kind of check first fails on a planted error. Prints ENGINE CONTROLS OK and ENGINE OK.
// Usage: node tests/engine.mjs
import { golden, exact, sw1Factors, sw1Strategy } from "./lib/fixtures.mjs";
import * as R from "../js/risk.js";
import * as E from "../js/engine.js";
import { rescaledNote, zoneName, score } from "../js/format.js";

const G = golden();
const close = (a, b) => Math.abs(a - b) <= 1e-9;
const controls = [];
const checks = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => checks.push([!!ok, what]);
const LANGS = ["en", "de"];

// ---- the checks can fail ----------------------------------------------------------------------------
control(!close(2.5 + 2e-9, 2.5), "control: two values 2e-9 apart do not pass as equal");
const planted = sw1Factors().map((f) => (f.id === "s1" ? { ...f, rating: 3 } : f));
control(!close(E.sideScore(planted, "internal").value, exact(G.SW1.before.ife)), "control: one rating changed moves IFE off its golden value");
control(E.ieCell(1.999999, 2).cell !== E.ieCell(2, 2).cell, "control: the IE matrix tells 1.999999 from 2.00");
control(R.band(3, 3) !== R.band(2, 5), "control: a score of 9 and a score of 10 fall in different bands");
control(R.money(3760000) !== G.SW3.at_stake_display.en, "control: €3.76m does not display as the golden €3.7m");
control(score(2.5, "de") !== "2.50", "control: the German score is not the English one");

// ---- SW0: bands ---------------------------------------------------------------------------------------
for (const r of G.SW0.rows) {
  check(R.riskScore(r.impact, r.likelihood) === r.score && R.band(r.impact, r.likelihood) === r.band, `SW0: impact ${r.impact} × likelihood ${r.likelihood} = ${r.score}, ${r.band}`);
}
let refused = 0;
for (const [i, l] of [[0, 3], [6, 1], [3, 2.5]]) { try { R.band(i, l); } catch { refused += 1; } }
check(refused === 3, "SW0: an impact or likelihood outside 1 to 5, or not whole, is refused");

// ---- SW1: factor scores and the IE cell before and after ------------------------------------------------
const before = E.factorScores(sw1Factors("before"));
const strategy = sw1Strategy();
const afterFactors = E.ratingsAfter(sw1Factors("before"), [strategy]);
const after = E.factorScores(afterFactors);
check(close(before.ife.value, exact(G.SW1.before.ife)) && close(before.efe.value, exact(G.SW1.before.efe)), `SW1 before: IFE ${before.ife.value} and EFE ${before.efe.value}, within 1e-9 of 5/2 and 19/10`);
check(!before.ife.rescaled && !before.efe.rescaled, "SW1 before: both sides' weights add up to 1, nothing is rescaled");
check(close(after.ife.value, exact(G.SW1.after.ife)) && close(after.efe.value, exact(G.SW1.after.efe)), `SW1 after: IFE ${after.ife.value} and EFE ${after.efe.value}, within 1e-9 of 27/10 and 57/20`);
check(JSON.stringify(afterFactors.map((f) => f.rating)) === JSON.stringify(sw1Factors("after").map((f) => f.rating)), "SW1: the chosen strategy sets exactly the ratings of the After column");
const cb = E.ieCell(before.ife.value, before.efe.value);
const ca = E.ieCell(after.ife.value, after.efe.value);
check(cb.cell === G.SW1.before.cell && cb.zone === G.SW1.before.zone, `SW1 before: cell ${cb.cell}, ${cb.zone}`);
check(ca.cell === G.SW1.after.cell && ca.zone === G.SW1.after.zone, `SW1 after: cell ${ca.cell}, ${ca.zone}`);
const fig = E.figures({ factors: sw1Factors("before"), strategies: [strategy] });
for (const lang of LANGS) {
  const v = E.factValues(fig, lang, zoneName);
  const want = G.SW1.display[lang];
  const got = Object.fromEntries(Object.keys(want).map((k) => [k, v[k]]));
  check(JSON.stringify(got) === JSON.stringify(want), `SW1 in ${lang === "en" ? "English" : "German"}: ${Object.values(got).join(", ")}`);
}
// Where two chosen strategies touch one item, the higher rating counts; one not chosen counts for nothing.
const two = E.ratingsAfter(sw1Factors("before"), [
  { chosen: true, changes: [{ action: "rate", item: "t2", from: 1, to: 2 }] },
  { chosen: true, changes: [{ action: "rate", item: "t2", from: 1, to: 3 }] },
  { chosen: false, changes: [{ action: "rate", item: "o1", from: 2, to: 4 }] }
]);
check(two.find((f) => f.id === "t2").rating === 3 && two.find((f) => f.id === "o1").rating === 2, "SW1: of two strategies on one item the higher rating counts; an unchosen strategy changes nothing");
const none = E.figures({ factors: sw1Factors("before"), strategies: [{ ...strategy, chosen: false }] });
check(none.ife.after.value === none.ife.before.value && none.efe.after.value === none.efe.before.value && none.ie.after.cell === none.ie.before.cell, "SW1: choosing no strategy keeps every figure");

// ---- SW2: rescaled weights and the boundaries -----------------------------------------------------------
const sw2 = sw1Factors("before").map((f) => (f.id === "w3" ? { ...f, weight: exact(G.SW2.w3_weight) } : f));
const s2 = E.sideScore(sw2, "internal");
check(close(s2.weightSum, exact(G.SW2.weight_sum)) && close(s2.raw, exact(G.SW2.raw_ife)) && s2.rescaled, `SW2: weights ${s2.weightSum}, raw IFE ${s2.raw}, rescaled`);
check(close(s2.value, exact(G.SW2.ife)), `SW2: the rescaled IFE ${s2.value} is within 1e-9 of 48/19`);
for (const lang of LANGS) {
  check(score(s2.value, lang) === G.SW2.display[lang] && rescaledNote(s2.weightSum, lang) === G.SW2.note[lang], `SW2 in ${lang === "en" ? "English" : "German"}: ${score(s2.value, lang)}, "${rescaledNote(s2.weightSum, lang)}"`);
}
const nearly = sw1Factors("before").map((f) => (f.id === "w3" ? { ...f, weight: 0.0995 } : f));
check(!E.sideScore(nearly, "internal").rescaled, "SW2: weights that miss 1 by 0.0005 stay as they are");
for (const b of G.SW2.boundaries) {
  const c = E.ieCell(exact(b.ife), exact(b.efe));
  check(c.cell === b.cell && c.zone === b.zone, `SW2: IFE ${b.ife} and EFE ${b.efe} give cell ${c.cell}, ${c.zone}`);
}
check(E.ieCell(2.9999999999, 3).cell === "I" && E.ieCell(2.999999, 3).cell === "II", "SW2: binary noise below 3.00 still counts as 3.00; a real 2.999999 does not");
const cells = [];
for (const efe of [3, 2, 1]) for (const ife of [3, 2, 1]) cells.push(E.ieCell(ife, efe).cell);
check(cells.join(" ") === "I II III IV V VI VII VIII IX", `SW2: the cells run row by row from high and strong (${cells.join(" ")})`);
const zones = Object.fromEntries(E.CELLS.map((c) => [c, E.ZONE[c]]));
check(["I", "II", "IV"].every((c) => zones[c] === "grow") && ["III", "V", "VII"].every((c) => zones[c] === "hold") && ["VI", "VIII", "IX"].every((c) => zones[c] === "harvest"), "SW2: grow and build I, II, IV; hold and maintain III, V, VII; harvest or divest VI, VIII, IX");

// ---- SW3: expected euros and what is at stake ---------------------------------------------------------
for (const i of G.SW3.issues) {
  const e = R.issueExpected(i);
  check(R.band(i.impact, i.likelihood) === i.band && close(e, exact(i.expected)), `SW3 ${i.id}: ${i.band}, expected ${e}`);
  for (const lang of LANGS) check(R.money(e, lang) === i.display[lang], `SW3 ${i.id} in ${lang === "en" ? "English" : "German"}: ${R.money(e, lang)}`);
}
const stake = R.atStake(G.SW3.issues);
check(stake.value === exact(G.SW3.at_stake) && stake.priced === 3 && stake.of === 3, `SW3: at stake exactly ${stake.value}, on ${stake.priced} of ${stake.of} issues`);
for (const lang of LANGS) check(R.money(stake.value, lang) === G.SW3.at_stake_display[lang], `SW3 in ${lang === "en" ? "English" : "German"}: at stake ${R.money(stake.value, lang)}`);
const part = R.atStake([...G.SW3.issues, { id: "J4", impact: 2, likelihood: 3, monetisable: false }]);
check(part.value === stake.value && part.priced === 3 && part.of === 4, "SW3: an issue that is not monetisable adds nothing and is counted apart (3 of 4)");

// ---- the handoff example of brief 4.3 ------------------------------------------------------------------
const H = G.handoff_example;
const hi = { id: "I1", ...H.issue };
check(R.band(hi.impact, hi.likelihood) === H.issue.band && close(R.issueExpected(hi), exact(H.issue.expected)), "4.3: I1 is critical, expected €2.8m a year");
check(R.band(H.residual.impact, H.residual.likelihood) === H.residual.band && close(R.expected(H.residual.eur_year_low, H.residual.eur_year_high, H.residual.likelihood), exact(H.residual.expected)), "4.3: its residual is medium, €0.6m a year");
const r1 = { issue: "I1", chosen: true, residual: H.residual };
check(close(R.left([hi], [r1]), exact(H.residual.expected)) && close(R.left([hi], [{ ...r1, chosen: false }]), exact(H.issue.expected)), "4.3: what is left is the residual once R1 is chosen, the issue's own value otherwise");
check(close(R.left([hi], [r1, { issue: "I1", chosen: true, residual: { eur_year_low: 0, eur_year_high: 1000000, likelihood: 1 } }]), 50000), "4.3: of two chosen responses to one issue, the lower residual counts");
check(close(R.upside([{ chosen: true, upside: { eur_year_low: 1000000, eur_year_high: 2000000, likelihood: 4 } }, { chosen: false, upside: { eur_year_low: 5000000, eur_year_high: 5000000, likelihood: 5 } }]), 1050000), "4.3: the upside adds the chosen advantages only");

// ---- rounding and the money format --------------------------------------------------------------------
check(R.roundHalfAway(2.525, 2) === 2.53 && R.roundHalfAway(-2.525, 2) === -2.53 && R.fixed(-2.525, 2) === "−2.53", "rounding: halves away from zero (2.525 to 2.53, -2.525 to −2.53)");
check(R.round9(0.1 + 0.2) === 0.3 && R.round9(1399999.9999999998) === 1400000, "rounding: to 1e-9 first, for small sums and for millions");
const edges = [[999500, "€1.0m", "1,0 Mio. €"], [999499, "€999k", "999 Tsd. €"], [999.5, "€1k", "1 Tsd. €"], [999.4, "€999", "999 €"], [2250000, "€2.3m", "2,3 Mio. €"], [0, "€0", "0 €"]];
for (const [v, en, de] of edges) check(R.money(v, "en") === en && R.money(v, "de") === de, `money: ${v} reads ${en} and ${de.replace(/ /g, " ")}`);

// ---- items challenged and the fact keys --------------------------------------------------------------
const items = [...G.SW1.items.map((i) => ({ id: i.id, added: false })), { id: "t4", added: true }, { id: "o3", added: true }];
const issues = [{ items: ["s1", "w1"] }, { items: ["w1"] }, { items: ["o2", "t4"] }];
const ic = E.itemsChallenged(items, issues);
check(ic.challenged === 3 && ic.total === 11 && ic.added === 2, `items challenged: ${ic.challenged} of ${ic.total}, ${ic.added} added, each item counted once`);
const all = E.factValues(E.figures({ factors: sw1Factors("before"), strategies: [strategy], issues: G.SW3.issues, items }), "en", zoneName);
const KEYS = ["at_stake", "left", "upside", "ife.before", "ife.after", "efe.before", "efe.after", "zone.before", "zone.after", "items.challenged", "items.total", "items.added", "issues.count", "issue.J1.expected", "issue.J2.expected", "issue.J3.expected"];
const missing = KEYS.filter((k) => typeof all[k] !== "string" || !all[k]);
check(!missing.length, `the fact keys of brief 6.5 all have a value${missing.length ? `: ${missing.join(", ")} missing` : ""}`);

let failed = 0;
const report = (results, token) => {
  for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  const f = results.filter(([ok]) => !ok).length;
  failed += f;
  return f ? null : token;
};
const tokens = [report(controls, "ENGINE CONTROLS OK"), report(checks, "ENGINE CHECKS OK")].filter(Boolean);
if (failed) { console.log(`\n${failed} engine checks failed.`); process.exit(1); }
console.log(`\nAll ${controls.length + checks.length} engine checks passed.\n${tokens.join("\n")}\nENGINE OK`);

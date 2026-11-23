// Risk bands, likelihood to probability, expected euros, what is at stake, what is left, the upside and
// the money format: the shared part of the three challengers (brief 4.1). Pure functions at full
// precision; the display rounds once, after rounding to 1e-9, half away from zero (brief 6.5).
// The same file in the Business Model Canvas, SWOT and PESTEL Challengers; the Prototype Ideator imports
// its money format. tests/parity.mjs compares it with any sibling checkout beside this repository.

/** Bands of impact × likelihood (1 to 25). */
export const BANDS = Object.freeze([
  { id: "low", min: 1, max: 4 },
  { id: "medium", min: 5, max: 9 },
  { id: "high", min: 10, max: 15 },
  { id: "critical", min: 16, max: 25 }
]);

/** Likelihood 1 (rare) to 5 (almost certain within the horizon), counted as a probability. */
export const PROBABILITY = Object.freeze({ 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7, 5: 0.9 });

const isScale = (n) => Number.isInteger(n) && n >= 1 && n <= 5;

/**
 * A number rounded to 1e-9, so that 0.1 + 0.2 counts as 0.3 before any comparison or display.
 * toFixed works on the double's exact decimal value, which keeps it right for millions of euros too.
 */
export function round9(x) {
  if (!Number.isFinite(x)) throw new TypeError(`not a finite number: ${x}`);
  return Number(x.toFixed(9)) || 0;
}

/** |x| rounded to 1e-9, then to `d` places with halves away from zero, as a whole number of 10^-d. */
function units(x, d) {
  if (!Number.isFinite(x)) throw new TypeError(`not a finite number: ${x}`);
  const nine = BigInt(Math.abs(x).toFixed(9).replace(".", ""));
  if (d >= 9) return nine * 10n ** BigInt(d - 9);
  const div = 10n ** BigInt(9 - d);
  return nine / div + ((nine % div) * 2n >= div ? 1n : 0n);
}

/** x rounded to 1e-9, then to `decimals` places, halves away from zero (2.525 to 2.53, -2.525 to -2.53). */
export function roundHalfAway(x, decimals = 0) {
  const n = Number(units(x, decimals)) / 10 ** decimals;
  return x < 0 ? -n || 0 : n;
}

/**
 * x as text with `decimals` places, rounded once as roundHalfAway does: "2.53" in English, "2,53" in
 * German. A negative value takes the minus sign (U+2212).
 */
export function fixed(x, decimals, lang = "en") {
  const q = units(x, decimals).toString().padStart(decimals + 1, "0");
  const whole = decimals ? q.slice(0, -decimals) : q;
  const text = decimals ? `${whole}${lang === "de" ? "," : "."}${q.slice(-decimals)}` : whole;
  return x < 0 && /[1-9]/.test(q) ? `\u2212${text}` : text;
}

/** Impact × likelihood, both 1 to 5. */
export function riskScore(impact, likelihood) {
  if (!isScale(impact) || !isScale(likelihood)) throw new RangeError(`impact and likelihood run from 1 to 5, got ${impact} and ${likelihood}`);
  return impact * likelihood;
}

/** The band of impact × likelihood: "low", "medium", "high" or "critical". */
export function band(impact, likelihood) {
  const s = riskScore(impact, likelihood);
  return BANDS.find((b) => s >= b.min && s <= b.max).id;
}

/** The probability a likelihood stands for. */
export function probability(likelihood) {
  if (!isScale(likelihood)) throw new RangeError(`likelihood runs from 1 to 5, got ${likelihood}`);
  return PROBABILITY[likelihood];
}

/** Expected euros a year: the range's midpoint times the probability of the likelihood. */
export function expected(low, high, likelihood) {
  if (!(Number.isFinite(low) && Number.isFinite(high)) || low < 0 || high < low) throw new RangeError(`a euro range needs 0 <= low <= high, got ${low} and ${high}`);
  return ((low + high) / 2) * probability(likelihood);
}

/** An issue's expected euros a year, or null when it is not monetisable. */
export function issueExpected(issue) {
  if (issue.monetisable === false || issue.eur_year_low == null || issue.eur_year_high == null) return null;
  return expected(issue.eur_year_low, issue.eur_year_high, issue.likelihood);
}

/**
 * What the issues put at stake a year: the sum of the monetisable issues' expected euros.
 * Returns { value, priced, of }: priced issues of all issues, so a figure on part of them can say so.
 */
export function atStake(issues) {
  let value = 0;
  let priced = 0;
  for (const issue of issues) {
    const e = issueExpected(issue);
    if (e === null) continue;
    value += e;
    priced += 1;
  }
  return { value: round9(value), priced, of: issues.length };
}

/**
 * What is left a year after the chosen responses: for each monetisable issue, the lowest residual of
 * the chosen responses that answer it, else its own expected value. A response is
 * { issue, chosen, residual: { eur_year_low, eur_year_high, likelihood } | null }.
 */
export function left(issues, responses) {
  let value = 0;
  for (const issue of issues) {
    const own = issueExpected(issue);
    if (own === null) continue;
    const residuals = responses
      .filter((r) => r.chosen && r.issue === issue.id && r.residual)
      .map((r) => expected(r.residual.eur_year_low, r.residual.eur_year_high, r.residual.likelihood));
    value += residuals.length ? Math.min(own, ...residuals) : own;
  }
  return round9(value);
}

/** The upside a year of the chosen responses that turn an issue into an advantage: their sum. */
export function upside(responses) {
  let value = 0;
  for (const r of responses) {
    if (!r.chosen || !r.upside) continue;
    value += expected(r.upside.eur_year_low, r.upside.eur_year_high, r.upside.likelihood);
  }
  return round9(value);
}

const NBSP = "\u00a0";
const decimal = (x, places, lang) => {
  const s = roundHalfAway(x, places).toFixed(places);
  return lang === "de" ? s.replace(".", ",") : s;
};

/**
 * Euros for the screen and the report, English or German: from about €1m with one decimal ("€3.7m",
 * "3,7 Mio. €"), from about €1,000 in whole thousands ("€300k", "300 Tsd. €"), below in whole euros
 * ("€850", "850 €"). The unit follows the rounded value, so €999,500 reads €1.0m, never €1000k.
 */
export function money(eur, lang = "en") {
  const v = round9(eur);
  const sign = v < 0 ? "\u2212" : "";
  const a = Math.abs(v);
  let n;
  let unit;
  if (a >= 999500) { n = fixed(a / 1e6, 1, lang); unit = "m"; }
  else if (a >= 999.5) { n = fixed(a / 1e3, 0, lang); unit = "k"; }
  else { n = fixed(a, 0, lang); unit = ""; }
  if (lang === "de") {
    const word = unit === "m" ? `${NBSP}Mio.` : unit === "k" ? `${NBSP}Tsd.` : "";
    return `${sign}${n}${word}${NBSP}€`;
  }
  return `${sign}€${n}${unit}`;
}

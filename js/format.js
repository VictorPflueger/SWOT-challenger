// Numbers and words for the screen in the page's language: scores with two decimals, money as the
// shared js/risk.js writes it, counts and dates through Intl in en-GB and de-DE, and the names of the IE
// matrix's zones. Adapted from the Sovereignty Assessment 2.0.0, whose money moved to js/risk.js.

import { fixed, money } from "./risk.js";
import { t, locale } from "./i18n/index.js";

export { money, fixed };

/** A factor score with two decimals: "2.50", "2,50". */
export function score(x, lang) {
  return fixed(x, 2, lang);
}

/** A whole number with the language's grouping: "1,200", "1.200". */
export function count(n, lang) {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(n);
}

/** A date written YYYY-MM-DD, as people read it: "23 November 2026", "23. November 2026". */
export function date(iso, lang) {
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** The keys of the zones' names: grow and build, hold and maintain, harvest or divest. */
export const ZONE_KEYS = Object.freeze({ grow: "p.zone.grow", hold: "p.zone.hold", harvest: "p.zone.harvest" });

/** A zone of the IE matrix in words. */
export function zoneName(zone, lang) {
  return t(ZONE_KEYS[zone], null, lang);
}

/** The note beside rescaled weights: "weights rescaled from 0.95". */
export function rescaledNote(weightSum, lang) {
  return t("p.note.rescaled", { sum: fixed(weightSum, 2, lang) }, lang);
}

/** A weight with two decimals: "0.15", "0,15". */
export function weight(x, lang) {
  return fixed(x, 2, lang);
}

/**
 * A session's cost in euros with cents: "≈ €0.05", "≈ 0,05 €"; below half a cent "< €0.01", "< 0,01 €",
 * so an estimate never reads as free.
 */
export function sessionCost(eur, lang) {
  const below = eur < 0.005;
  const n = fixed(below ? 0.01 : eur, 2, lang);
  const amount = lang === "de" ? `${n} €` : `€${n}`;
  return `${below ? "<" : "≈"} ${amount}`;
}

/** A country's name from its two-letter code, in the page's language: "Germany", "Deutschland". */
export function countryName(code, lang) {
  try {
    return new Intl.DisplayNames([locale(lang)], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

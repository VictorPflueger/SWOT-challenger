// Numbers and words for the screen in the page's language: scores with two decimals, money as the
// shared js/risk.js writes it, counts and dates through Intl in en-GB and de-DE, and the names of the IE
// matrix's zones. Adapted from the Sovereignty Assessment 2.0.0, whose money moved to js/risk.js.

import { fixed, money } from "./risk.js";
import { t, locale } from "./i18n/index.js";

export { money };

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

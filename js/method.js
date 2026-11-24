// The Method dialog (PLAN.md, 5.3): the SWOT, Fred R. David's factor tables and IE matrix, Heinz
// Weihrich's TOWS matrix, the scales, the engine's rules with the golden case SW1 worked through by the
// engine itself, the sector's KPIs, the prices and the exchange rate with their dates, and what a score
// is not. It is drawn from the dictionaries in the page's language, so one dialog serves both.

import { t } from "./i18n/index.js";
import { h } from "./dom.js";
import { score, weight as fmtWeight, zoneName, date } from "./format.js";
import { factorScores, ieCell } from "./engine.js";
import { kpisFor, SECTORS } from "../data/kpis.js";
import { FX_USD_EUR, ECB_REFERENCE, PRICES_READ_ON, MODELS, DEFAULT_MODEL } from "./config.js";
import { ESTIMATE } from "./estimate.js";
import { fixed } from "./risk.js";

/**
 * The golden case SW1 of the brief's section 11 (tests/fixtures/golden.json holds the same): eleven
 * items with their weights, their ratings and the ratings after two strategies. tests/presenter.mjs holds
 * the two equal.
 */
export const SW1 = Object.freeze([
  ["s1", "strengths", 0.2, 4, 4], ["s2", "strengths", 0.15, 3, 3], ["s3", "strengths", 0.15, 3, 3],
  ["w1", "weaknesses", 0.2, 1, 2], ["w2", "weaknesses", 0.2, 2, 2], ["w3", "weaknesses", 0.1, 2, 2],
  ["o1", "opportunities", 0.25, 2, 3], ["o2", "opportunities", 0.1, 3, 3],
  ["t1", "threats", 0.3, 2, 3], ["t2", "threats", 0.2, 1, 3], ["t3", "threats", 0.15, 2, 2]
].map(([id, quadrant, weight, rating, after]) => Object.freeze({ id, quadrant, weight, rating, after })));

/** SW1 through the engine: { before, after } scores and cells. */
export function sw1Figures() {
  const before = factorScores(SW1.map((f) => ({ ...f })));
  const after = factorScores(SW1.map((f) => ({ ...f, rating: f.after })));
  return {
    before: { ife: before.ife.value, efe: before.efe.value, ie: ieCell(before.ife.value, before.efe.value) },
    after: { ife: after.ife.value, efe: after.efe.value, ie: ieCell(after.ife.value, after.efe.value) }
  };
}

const th = (text, attrs = {}) => h("th", { scope: "col", ...attrs }, text);
const num = (text) => h("td", { class: "vc-num" }, text);
const section = (id, ...children) => h("section", { class: "method__section", "aria-labelledby": `m-${id}` }, ...children);
const head = (id, key) => h("h3", { id: `m-${id}` }, t(key));
const p = (key, vars) => h("p", {}, t(key, vars));
const source = (key, url) => h("p", { class: "method__source" }, t(key), url ? [" ", h("a", { href: url, target: "_blank", rel: "noopener" }, url, h("span", { class: "vc-visually-hidden" }, t("p.new.tab")))] : null);

/** The dialog's body for a sector, in the page's language. */
export function methodNodes({ sector, lang }) {
  const f = sw1Figures();
  const sectorName = SECTORS.find((s) => s.id === sector)?.name[lang] || sector;
  const model = MODELS.find((m) => m.id === DEFAULT_MODEL);
  const kpis = kpisFor(sector).filter((k) => k.sector === sector);
  return [
    h("p", { class: "method__lead" }, t("m.lead")),
    section("swot", head("swot", "m.swot.h"), p("m.swot.p")),
    section("factors", head("factors", "m.factors.h"), p("m.factors.p"),
      h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact" },
        h("caption", {}, t("m.scale.caption")),
        h("thead", {}, h("tr", {}, th(t("p.th.rating"), { class: "vc-num" }), th(t("m.scale.ife")), th(t("m.scale.efe")))),
        h("tbody", {}, [1, 2, 3, 4].map((r) => h("tr", {}, num(String(r)), h("td", {}, t(`m.scale.ife.${r}`)), h("td", {}, t(`m.scale.efe.${r}`))))))),
      source("m.src.david")),
    section("ie", head("ie", "m.ie.h"), p("m.ie.p"), source("m.src.david")),
    section("tows", head("tows", "m.tows.h"), p("m.tows.p"), source("m.src.weihrich", "https://doi.org/10.1016/0024-6301(82)90120-0")),
    section("risk", head("risk", "m.risk.h"), p("m.risk.p"), p("m.risk.money")),
    section("example", head("example", "m.example.h"), p("m.example.p"),
      h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact" },
        h("caption", {}, t("m.example.caption")),
        h("thead", {}, h("tr", {}, th(t("p.th.item")), th(t("p.th.weight"), { class: "vc-num" }), th(t("p.th.rating"), { class: "vc-num" }), th(t("m.example.after"), { class: "vc-num" }))),
        h("tbody", {}, SW1.map((x) => h("tr", {}, h("th", { scope: "row" }, `${t(`q.${x.quadrant}`)} ${x.id.slice(1)}`), num(fmtWeight(x.weight, lang)), num(String(x.rating)), num(x.after === x.rating ? String(x.after) : `${x.after} ↑`)))))),
      h("p", { class: "method__result" }, t("m.example.result", {
        ife: score(f.before.ife, lang), ife2: score(f.after.ife, lang),
        efe: score(f.before.efe, lang), efe2: score(f.after.efe, lang),
        cell: f.before.ie.cell, cell2: f.after.ie.cell,
        zone: zoneName(f.before.ie.zone, lang), zone2: zoneName(f.after.ie.zone, lang)
      }))),
    section("kpis", head("kpis", "m.kpis.h"), p("m.kpis.p", { sector: sectorName }),
      h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact" },
        h("caption", {}, t("m.kpis.caption", { sector: sectorName })),
        h("thead", {}, h("tr", {}, th(t("p.th.figure")), th(t("m.kpis.unit")), th(t("m.kpis.better")), th(t("m.kpis.definition")))),
        h("tbody", {}, kpis.map((k) => h("tr", {}, h("th", { scope: "row" }, k.name[lang]), h("td", {}, k.unit), h("td", {}, t(`m.kpis.better.${k.better}`)), h("td", {}, k.definition[lang]))))))),
    section("money", head("money", "m.money.h"),
      p("m.money.p", { date: date(PRICES_READ_ON, lang), rate: fixed(FX_USD_EUR, 3, lang), ecb: fixed(ECB_REFERENCE.usdPerEur, 4, lang), ecbDate: date(ECB_REFERENCE.date, lang) }),
      p("m.money.estimate", { chars: ESTIMATE.charsPerToken, system: new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB").format(ESTIMATE.systemTokens), thinking: ESTIMATE.thinkingTokens, model: model.label }),
      source("m.src.prices", "https://platform.claude.com/docs/en/about-claude/pricing")),
    section("not", head("not", "m.not.h"), p("m.not.p"))
  ];
}

/** Fills the Method dialog for the scenario's sector. */
export function renderMethod(dialog, { sector, lang }) {
  const body = dialog.querySelector(".vc-dialog__body");
  body.replaceChildren(...methodNodes({ sector, lang }));
}

// The run's charts, each with a table of its numbers one click away (AC-17): the risk matrix of the
// issues (Vici's risk matrix, components/data.html#risk-matrix), the two factor tables after Fred R. David
// (IFE inside the company, EFE outside it), the IE matrix that places the company by both scores, and the
// TOWS matrix after Heinz Weihrich, whose strategy cards the person chooses from. Every number comes
// from the engine; the charts only draw it.

import { t } from "./i18n/index.js";
import { h, icon } from "./dom.js";
import { money, score, weight as fmtWeight, zoneName } from "./format.js";
import { band, riskScore, fixed, PROBABILITY } from "./risk.js";
import { CELLS, ZONE, SIDE } from "./engine.js";
import { strategyEffect } from "./scenario.js";
import { TOWS, strategiesByType } from "./simulation.js";
import { STRATEGY_KINDS as KIND } from "../schemas/swot.js";
import { kpiById } from "../data/kpis.js";

/** The SWOT's letters, the same in both languages. */
const LETTER = Object.freeze({ strengths: "S", weaknesses: "W", opportunities: "O", threats: "T" });
const numbers = (table) => h("details", { class: "vc-risk__numbers numbers" }, h("summary", {}, t("p.numbers")), h("div", { class: "vc-table-wrap" }, table));
const th = (text, attrs = {}) => h("th", { scope: "col", ...attrs }, text);
const num = (text) => h("td", { class: "vc-num" }, text);

/** An issue's number on markers and cards: "1" for I1. */
export const issueNo = (issue) => String(issue.id).replace(/^I/, "");

// ---- risk matrix ------------------------------------------------------------------------------------

/**
 * The issues by impact and likelihood. opts: { issues, lang, lit (an issue id or null), expected (show the
 * euros a year in the table), id (for the caption) }.
 */
export function riskMatrix({ issues, lang, lit = null, expected = false, id = "risk" }) {
  const rows = [];
  for (let impact = 5; impact >= 1; impact--) {
    rows.push(h("span", { class: "vc-risk__tick" }, String(impact)));
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const here = issues.filter((i) => i.impact === impact && i.likelihood === likelihood);
      rows.push(h("div", { class: "vc-risk__cell", dataset: { impact, likelihood, band: band(impact, likelihood) } },
        h("span", { class: "vc-risk__score" }, String(riskScore(impact, likelihood))),
        here.map((i) => h("span", {
          class: "vc-risk__marker",
          role: "img",
          dataset: { impact, likelihood, issue: i.id },
          "aria-label": t("s.challenge.marker", { n: issueNo(i), title: i.title, impact, likelihood, band: t(`p.band.${band(impact, likelihood)}`) }),
          "aria-current": lit === i.id ? "true" : undefined
        }, issueNo(i)))));
    }
  }
  rows.push(h("span", { class: "vc-risk__tick", "aria-hidden": "true" }));
  for (let likelihood = 1; likelihood <= 5; likelihood++) rows.push(h("span", { class: "vc-risk__tick" }, String(likelihood)));

  const table = h("table", { class: "vc-table vc-table--compact" },
    h("caption", { class: "vc-visually-hidden" }, t("s.challenge.matrix")),
    h("thead", {}, h("tr", {}, th(t("p.th.issue")), th(t("p.th.impact"), { class: "vc-num" }), th(t("p.th.likelihood"), { class: "vc-num" }), th(t("p.th.score"), { class: "vc-num" }), th(t("p.th.band")), expected ? th(t("p.th.expected"), { class: "vc-num" }) : null)),
    h("tbody", {}, issues.map((i) => h("tr", {},
      h("th", { scope: "row" }, `${issueNo(i)}. ${i.title}`),
      num(String(i.impact)), num(String(i.likelihood)), num(String(riskScore(i.impact, i.likelihood))),
      h("td", {}, t(`p.band.${band(i.impact, i.likelihood)}`)),
      expected ? num(i.expected === null ? t("p.not.priced") : money(i.expected, lang)) : null))));

  return h("figure", { class: "vc-risk", "aria-labelledby": `${id}-title` },
    h("figcaption", {}, h("p", { class: "vc-chart__title", id: `${id}-title` }, t("s.challenge.matrix")), h("p", { class: "vc-chart__subtitle" }, t("s.challenge.matrix.sub"))),
    h("div", { class: "vc-risk__plot" },
      h("p", { class: "vc-risk__axis vc-risk__axis--impact" }, t("s.challenge.impact")),
      h("div", { class: "vc-risk__grid" }, rows),
      h("p", { class: "vc-risk__axis vc-risk__axis--likelihood" }, t("s.challenge.likelihood"))),
    h("ul", { class: "vc-risk__key" }, ["low", "medium", "high", "critical"].map((b) => h("li", { dataset: { band: b } }, t(`p.band.key.${b}`)))),
    numbers(table));
}

// ---- factor tables ----------------------------------------------------------------------------------

/**
 * One side's factor table: each item's weight, rating and weighted score, and the total, which is the
 * engine's score. side: internal or external. figures: the engine's figures before the decision.
 */
export function factorTable({ run, side, lang, figures }) {
  const rows = run.factors.filter((f) => SIDE[f.quadrant] === side);
  const text = new Map(run.items.map((it) => [it.id, it.text]));
  const s = side === "internal" ? figures.ife.before : figures.efe.before;
  const total = rows.reduce((sum, f) => sum + f.weight, 0);
  const name = side === "internal" ? t("s.assess.ife") : t("s.assess.efe");
  return h("div", { class: "vc-table-wrap factor-table" }, h("table", { class: "vc-table vc-table--compact" },
    h("caption", {}, h("span", { class: "factor-side" }, side === "internal" ? t("s.assess.inside") : t("s.assess.outside")), " ", h("span", { class: "factor-score" }, t("s.assess.score", { name, score: score(s.value, lang) }))),
    h("thead", {}, h("tr", {}, th(t("p.th.item")), th(t("p.th.weight"), { class: "vc-num" }), th(t("p.th.rating"), { class: "vc-num" }), th(t("p.th.weighted"), { class: "vc-num" }))),
    h("tbody", {}, rows.map((f) => h("tr", { dataset: { quad: f.quadrant } },
      h("th", { scope: "row" }, h("span", { class: "factor-quad", "aria-hidden": "true" }, LETTER[f.quadrant]), h("span", { class: "vc-visually-hidden" }, `${t(`q.${f.quadrant}`)}: `), text.get(f.id)),
      num(fmtWeight(f.weight, lang)), num(String(f.rating)), num(fixed(f.weight * f.rating, 2, lang))))),
    h("tfoot", {}, h("tr", {}, h("th", { scope: "row" }, t("p.total")), num(fmtWeight(total, lang)), h("td", {}), num(score(s.value, lang))))));
}

// ---- IE matrix --------------------------------------------------------------------------------------

const ROW_KEYS = ["s.assess.high", "s.assess.medium", "s.assess.low"];
const COL_KEYS = ["s.assess.strong", "s.assess.average", "s.assess.weak"];
const RANGES = ["3.00", "2.00", "1.00"];

/**
 * Where the company stands, after David: internal strength across (strong to weak), response to the
 * market up (high to low), nine cells in three zones. figures: the engine's; after: show the place after
 * the strategies beside the place before.
 */
export function ieMatrix({ figures, lang, after = false, id = "ie" }) {
  const now = figures.ie.before;
  const then = figures.ie.after;
  const moved = after && then.cell !== now.cell;
  const marker = (kind, label) => h("span", { class: ["ie-marker", `ie-marker--${kind}`], role: "img", "aria-label": label }, h("span", { "aria-hidden": "true" }, kind === "after" ? t("s.assess.after") : t("s.assess.now")));
  const cells = [];
  for (let row = 0; row < 3; row++) {
    cells.push(h("span", { class: "ie-tick ie-tick--row" }, h("span", {}, t(ROW_KEYS[row])), h("span", { class: "ie-range" }, rangeText(row, lang))));
    for (let col = 0; col < 3; col++) {
      const cell = CELLS[row * 3 + col];
      const marks = [];
      if (cell === now.cell) marks.push(marker(moved ? "before" : "now", t("s.assess.marker.now", { cell })));
      if (moved && cell === then.cell) marks.push(marker("after", t("s.assess.marker.after", { cell })));
      cells.push(h("div", { class: "ie-cell", dataset: { cell, zone: ZONE[cell], here: marks.length ? "true" : undefined } },
        h("span", { class: "ie-cell__name" }, cell), marks));
    }
  }
  cells.push(h("span", { class: "ie-tick", "aria-hidden": "true" }));
  for (let col = 0; col < 3; col++) cells.push(h("span", { class: "ie-tick ie-tick--col" }, h("span", {}, t(COL_KEYS[col])), h("span", { class: "ie-range" }, rangeText(col, lang))));

  const row = (label, a, b) => h("tr", {}, h("th", { scope: "row" }, label), num(a), after ? num(b) : null);
  const table = h("table", { class: "vc-table vc-table--compact" },
    h("caption", { class: "vc-visually-hidden" }, t("s.assess.ie")),
    h("thead", {}, h("tr", {}, th(t("p.th.figure")), th(t("p.th.now"), { class: "vc-num" }), after ? th(t("p.th.after"), { class: "vc-num" }) : null)),
    h("tbody", {},
      row(t("s.assess.ife"), score(figures.ife.before.value, lang), score(figures.ife.after.value, lang)),
      row(t("s.assess.efe"), score(figures.efe.before.value, lang), score(figures.efe.after.value, lang)),
      row(t("s.assess.cell"), now.cell, then.cell),
      row(t("s.assess.zone"), zoneName(now.zone, lang), zoneName(then.zone, lang))));

  return h("figure", { class: "ie", "aria-labelledby": `${id}-title` },
    h("figcaption", {}, h("p", { class: "vc-chart__title", id: `${id}-title` }, t("s.assess.ie")), h("p", { class: "vc-chart__subtitle" }, t("s.assess.ie.sub"))),
    h("div", { class: "ie-plot" },
      h("p", { class: "ie-axis ie-axis--y" }, t("s.assess.efe")),
      h("div", { class: "ie-grid" }, cells),
      h("p", { class: "ie-axis ie-axis--x" }, t("s.assess.ife"))),
    h("ul", { class: "ie-key" }, ["grow", "hold", "harvest"].map((z) => h("li", { dataset: { zone: z } }, t(`s.assess.key.${z}`)))),
    numbers(table));
}

/** "3.00 to 4.00", "2.00 to 2.99", "1.00 to 1.99" for a row or column, in the page's language. */
function rangeText(i, lang) {
  const lo = Number(RANGES[i]);
  const hi = i === 0 ? 4 : lo + 0.99;
  return t("s.assess.range", { from: fixed(lo, 2, lang), to: fixed(hi, 2, lang) });
}

// ---- TOWS matrix ------------------------------------------------------------------------------------

/** A strategy's effect a year in words: what is left (mitigate) or the upside (advantage). */
export function effectText(s, lang) {
  const eur = strategyEffect(s);
  if (eur === null) return "";
  return s.kind === "advantage" ? t("s.strat.upside", { eur: money(eur, lang) }) : t("s.strat.left", { eur: money(eur, lang) });
}

/**
 * What a strategy's figure rests on, in words: the Strategist's euro range a year and likelihood after the
 * strategy (what is left, or the upside), and how code turns them into the figure. "" without a figure.
 */
export function effectBasis(s, lang, tr = t) {
  const r = s.residual || s.upside;
  if (!r) return "";
  return tr(s.kind === "advantage" ? "s.strat.basis.upside" : "s.strat.basis.left", {
    low: money(r.eur_year_low, lang), high: money(r.eur_year_high, lang), likelihood: r.likelihood,
    p: Math.round(PROBABILITY[r.likelihood] * 100), eur: money(strategyEffect(s), lang)
  });
}

/** A strategy's figure as the AI's estimate: lilac, with the AI mark, and said as an estimate to a screen reader. */
export function effectMark(s, lang, cls = "tows-effect") {
  const text = effectText(s, lang);
  if (!text) return null;
  return h("span", { class: [cls, "ai-text"] }, icon("sparkle"), h("span", { class: "vc-visually-hidden" }, `${t("p.estimate")}: `), text);
}

/**
 * The TOWS matrix: strengths and weaknesses across, opportunities and threats down, each cell with its
 * strategies as cards to tick. opts: { run, lang, selection (a Set of ids), onToggle(id, on), open }.
 */
export function towsMatrix({ run, lang, selection, onToggle, open }) {
  const byType = strategiesByType(run);
  const text = new Map(run.items.map((it) => [it.id, it.text]));
  const card = (s) => {
    const box = h("input", { type: "checkbox", id: `pick-${s.id}`, checked: selection.has(s.id) || undefined, dataset: { strategy: s.id } });
    box.addEventListener("change", () => onToggle(s.id, box.checked));
    const shown = !!open?.has(`more-${s.id}`);
    const more = h("dl", { class: "tows-card__more", id: `more-${s.id}`, hidden: !shown || undefined },
        h("dt", {}, t("s.strat.first.label")), h("dd", {}, s.first_step),
        h("dt", {}, t("s.strat.owner.label")), h("dd", {}, s.owner),
        h("dt", {}, t("s.strat.time.label")), h("dd", {}, s.time_to_impact),
        h("dt", {}, t("s.strat.effort.label")), h("dd", {}, t(`p.effort.${s.effort}`)),
        h("dt", {}, t("s.strat.pairs")), h("dd", {}, s.items.map((id) => text.get(id)).filter(Boolean).join("; ")),
        h("dt", {}, t("s.strat.ratings.label")), h("dd", {}, s.changes.map((c) => t("s.strat.rating", { item: text.get(c.item) || c.item, from: c.from, to: c.to })).join("; ")),
        effectBasis(s, lang) ? [h("dt", {}, t("p.estimate")), h("dd", {}, effectBasis(s, lang))] : null);
    // The first step, the owner and the new ratings open under the card, from a small button beside its title.
    const info = h("button", { type: "button", class: "vc-icon-button vc-icon-button--sm tows-card__info", id: `info-${s.id}`, "aria-expanded": String(shown), "aria-controls": `more-${s.id}`, "aria-label": t("s.strat.more.label", { title: s.title }) }, icon(shown ? "chevron-up" : "chevron-down"));
    info.addEventListener("click", () => {
      const now = more.hidden;
      more.hidden = !now;
      info.setAttribute("aria-expanded", String(now));
      info.replaceChildren(icon(now ? "chevron-up" : "chevron-down"));
      if (now) open?.add(`more-${s.id}`); else open?.delete(`more-${s.id}`);
    });
    return h("li", { class: "tows-card", dataset: { kind: s.kind, checked: selection.has(s.id) ? "true" : "false", strategy: s.id } },
      h("div", { class: "tows-card__top" }, h("label", { class: "vc-checkbox tows-card__choose" }, box, h("span", { class: "tows-card__title" }, s.title)), info),
      h("p", { class: "tows-card__meta" },
        effectMark(s, lang),
        s.recommended ? h("span", { class: "vc-tag vc-tag--sm vc-tag--feature tows-rec" }, icon("sparkle"), t("s.strat.recommended")) : null),
      more);
  };
  // A cell's type decides its strategies' kind (brief 6.2): SO and WO turn an issue into an advantage, ST
  // and WT mitigate one. The cell says so once, so the cards stay short.
  const cell = (type) => h("section", { class: "tows-cell", dataset: { type }, "aria-labelledby": `tows-${type}` },
    h("div", { class: "tows-cell__head" },
      h("h3", { class: "tows-cell__title", id: `tows-${type}` }, h("span", { class: "tows-cell__code" }, type), " ", h("span", { class: "tows-cell__name" }, t(`s.strat.${type}`))),
      h("span", { class: "vc-tag vc-tag--sm tows-kind", dataset: { kind: KIND[type] } }, icon(KIND[type] === "advantage" ? "trend-up" : "shield"), t(`p.kind.${KIND[type]}`))),
    byType[type].length ? h("ul", { class: "tows-cards" }, byType[type].map(card)) : h("p", { class: "tows-empty" }, t("s.strat.empty")));
  const table = h("table", { class: "vc-table vc-table--compact" },
    h("caption", { class: "vc-visually-hidden" }, t("s.strat.matrix")),
    h("thead", {}, h("tr", {}, th(t("p.th.strategy")), th(t("p.th.type")), th(t("p.th.kind")), th(t("p.th.effect.ai"), { class: "vc-num" }), th(t("p.th.chosen")))),
    h("tbody", {}, TOWS.flatMap((type) => byType[type]).map((s) => h("tr", {},
      h("th", { scope: "row" }, s.title), h("td", {}, s.type), h("td", {}, t(`p.kind.${s.kind}`)), num(effectText(s, lang)), h("td", {}, selection.has(s.id) ? t("p.yes") : t("p.no"))))));
  // The column with more strategies gets more room, up to three times the other's, so a crowded cell
  // lays its cards side by side instead of stacking them past the bar.
  const many = (a, b) => Math.max(byType[a].length, byType[b].length, 1);
  const s = many("SO", "ST");
  const w = many("WO", "WT");
  const ratio = (x, y) => `${Math.min(3, Math.max(1, x / y)).toFixed(2)}fr`;
  return h("div", { class: "tows-wrap" },
    h("div", { class: "tows", role: "group", "aria-label": t("s.strat.matrix"), vars: { "--tows-s": ratio(s, w), "--tows-w": ratio(w, s) } },
      h("p", { class: "tows-head tows-head--col", dataset: { head: "s" }, "aria-hidden": "true" }, t("q.strengths")),
      h("p", { class: "tows-head tows-head--col", dataset: { head: "w" }, "aria-hidden": "true" }, t("q.weaknesses")),
      h("p", { class: "tows-head tows-head--row", dataset: { head: "o" }, "aria-hidden": "true" }, t("q.opportunities")),
      cell("SO"), cell("WO"),
      h("p", { class: "tows-head tows-head--row", dataset: { head: "t" }, "aria-hidden": "true" }, t("q.threats")),
      cell("ST"), cell("WT")),
    numbers(table));
}

// ---- KPI effects -------------------------------------------------------------------------------------

/** A KPI effect as the Analyst estimated it: "Share of service revenue: −2 to −1 %". */
export function kpiText(k, lang) {
  const lib = kpiById(k.id);
  const name = lib ? lib.name[lang] : k.name;
  const n = (x) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(x).replace("-", "−");
  const unit = k.unit === "€" ? "" : ` ${k.unit}`;
  const range = k.unit === "€"
    ? t("s.assess.kpi.range", { low: signedMoney(k.change_low, lang), high: signedMoney(k.change_high, lang), unit: "" }, lang)
    : t("s.assess.kpi.range", { low: n(k.change_low), high: n(k.change_high), unit }, lang);
  return `${name}: ${range}`;
}
const signedMoney = (x, lang) => (x < 0 ? "−" : x > 0 ? "+" : "") + money(Math.abs(x), lang);

// The report (brief 9 and 9.1; PLAN.md, section 7; AC-13, AC-20): the run as a document, assembled by code
// from the run's state, on Vici's report pattern (components/report.html). Eight sections, each opening a
// page: the cover; the management summary on page two, with the key figures as the tiles show them; the
// SWOT with every item's state in words; the issues, with the risk matrix and one block each; the IE matrix
// and the factor tables before and after; the TOWS matrix, every strategy in its cell and the chosen ones
// in full; method, assumptions and sources; and About this report with the byline. The model writes no layout and no figure: the Writer's text comes
// with its {{fact:key}} placeholders filled from the engine, and every other figure is the engine's, in the
// report's own language (a scenario's follows the page, a live run's its own). The footer's words live on
// the report's root, where Vici's script puts them in the margin boxes of every printed page.

import { t } from "./i18n/index.js";
import { h } from "./dom.js";
import { APP, AUTHOR, QUADRANTS, MODELS } from "./config.js";
import { money, score, weight as fmtWeight, zoneName, countryName, date as fmtDate } from "./format.js";
import { band, riskScore, fixed } from "./risk.js";
import { CELLS, ZONE, SIDE } from "./engine.js";
import { figuresFor, factsFor, strategyEffect } from "./scenario.js";
import { addressed, issuesOf, sourceOf, strategiesByType } from "./simulation.js";
import { renderFacts } from "./facts.js";
import { issueNo, kpiText } from "./matrices.js";
import { sourcesOf } from "./handoff.js";
import { SECTORS } from "../data/kpis.js";
import { STRATEGY_KINDS as KIND } from "../schemas/swot.js";

const SVG = "http://www.w3.org/2000/svg";
const PORTRAIT = "vici/assets/brand/portrait-96.jpg";
const LETTER = Object.freeze({ strengths: "S", weaknesses: "W", opportunities: "O", threats: "T" });

/** The tool's scale icon (Vici's sprite, vc-scale), drawn inline so a file of its own keeps it. */
function scaleIcon() {
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "report-mark" })) svg.setAttribute(k, v);
  for (const d of ["M3 9 H21 M5 9 V11 M19 9 V11", "M12 9 V14.5", "M4.5 14.5 H19.5 L21 16 V20 H3 V16 Z", "M9.5 17.25 H14.5"]) {
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

const sectorName = (id, lang) => SECTORS.find((s) => s.id === id)?.name[lang] || id;
const isoDay = (d) => d.toISOString().slice(0, 10);

/**
 * The report's context, gathered by the page: { run (assembled in the report's language), scenario (a
 * recorded run, for its sources) or null, chosen (strategy ids), lang, mode ("simulation" | "live"), tiles
 * (js/tiles.js's tileTexts in the report's language), created (a Date), live (a live run's snapshot: settings,
 * research outcome, stop, unchecked) or null, estimateModel (the model a recorded run's cost is estimated
 * for), level (the title's heading level: 3 inside the page's dialog), id (a prefix for ids) }.
 */
export function reportNodes(ctx) {
  const { run, lang, mode, live = null } = ctx;
  const id = ctx.id || "report";
  const level = ctx.level || 3;
  const H = (n, attrs, ...children) => h(`h${Math.min(6, level + n)}`, attrs, ...children);
  const tr = (key, vars = null) => t(key, vars, lang);
  const stopped = mode === "live" && !!live?.stop;
  const scored = run.factors.length > 0;
  const chosen = ctx.chosen || [];
  const f = scored ? figuresFor(run, chosen) : null;
  const facts = scored ? factsFor(run, chosen, lang, zoneName) : {};
  const fixedRatings = scored ? addressed(run, chosen) : new Map();
  const text = new Map(run.items.map((it) => [it.id, it.text]));
  const page = (key, ...children) => h("section", { class: ["vc-report__page", `report-page report-page--${key}`], "aria-labelledby": `${id}-${key}` }, ...children);
  const heading = (key, words) => H(1, { id: `${id}-${key}` }, words);
  const note = (words) => h("p", { class: "report-note" }, words);

  // ---- 1 cover ----------------------------------------------------------------------------------------
  const s = run.summary;
  const headline = s ? renderFacts(s.headline, facts) : tr("rp.sub.none");
  const setting = live ? tr("rp.model.live", {
    model: MODELS.find((m) => m.id === live.settings.model)?.label || live.settings.model,
    setting: tr(`d.preset.${live.settings.preset}`),
    research: tr(live.settings.research ? "rp.research.on" : "rp.research.off")
  }) : tr("rp.model.sim", { model: MODELS.find((m) => m.id === ctx.estimateModel)?.label || MODELS[1].label });
  const meta = [
    [tr("rp.meta.date"), fmtDate(isoDay(ctx.created), lang)],
    [tr("rp.meta.mode"), tr(mode === "live" ? "rp.mode.live" : "rp.mode.sim")],
    [tr("rp.meta.model"), setting],
    run.sector || run.company.sector ? [tr("rp.meta.sector"), sectorName(run.sector || run.company.sector, lang)] : null,
    run.company.country ? [tr("rp.meta.country"), /^[A-Za-z]{2}$/.test(run.company.country) ? countryName(run.company.country.toUpperCase(), lang) : run.company.country] : null,
    [tr("rp.meta.lang"), tr(`rp.lang.${lang}`)]
  ].filter(Boolean);
  const cover = h("section", { class: "vc-report__page vc-report__cover report-page--cover", "aria-labelledby": `${id}-title` },
    h("p", { class: "vc-report__brand" }, h("span", { class: "vc-cell vc-cell--sm vc-cell--lilac", "aria-hidden": "true" }, scaleIcon()), APP.name),
    h("div", { class: "vc-report__heading" },
      H(0, { class: "vc-report__title", id: `${id}-title` }, tr("rp.title", { company: run.company.name })),
      h("p", { class: "vc-report__subtitle" }, headline),
      h("p", { class: "report-tags" },
        h("span", { class: "vc-tag vc-tag--feature" }, tr("rp.ai")),
        mode !== "live" ? h("span", { class: "vc-tag" }, tr("rp.fiction")) : null,
        stopped ? h("span", { class: "vc-tag vc-tag--danger" }, tr("rp.stopped")) : null)),
    h("dl", { class: "vc-report__meta" }, meta.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));

  // ---- 2 management summary ---------------------------------------------------------------------------
  const tiles = ctx.tiles;
  const figure = (key, label) => {
    const x = tiles?.[key];
    if (!x || x.state === "waiting") return null;
    return h("div", { class: "report-figure" },
      h("dt", {}, label),
      h("dd", { class: "report-figure__value" }, h("span", { class: "report-figure__main" }, x.main), x.was && x.was !== x.main ? h("s", { class: "report-figure__was" }, x.was) : null, x.unit ? h("span", { class: "report-figure__unit" }, ` ${x.unit}`) : null),
      h("dd", { class: "report-figure__note" }, x.note));
  };
  const picked = run.strategies.filter((x) => chosen.includes(x.id));
  const summaryPage = page("summary",
    heading("summary", tr("rp.sum.h")),
    s ? h("p", { class: "report-headline" }, headline) : note(tr("rp.sum.none")),
    h("dl", { class: "report-figures" }, [
      figure("stake", tr("p.kpi.stake.label")), figure("items", tr("p.kpi.items.label")),
      figure("efe", tr("p.kpi.efe.label")), figure("cost", tr("p.kpi.cost.label"))
    ]),
    f ? h("p", { class: "report-stand" }, f.ie.after.cell !== f.ie.before.cell
      ? tr("rp.stand.moved", { cell: f.ie.before.cell, zone: zoneName(f.ie.before.zone, lang), cell2: f.ie.after.cell, zone2: zoneName(f.ie.after.zone, lang) })
      : tr("rp.stand", { cell: f.ie.before.cell, zone: zoneName(f.ie.before.zone, lang) })) : null,
    s ? h("div", { class: "report-cols" },
      h("div", {},
        h("p", { class: "report-by" }, h("span", { class: "vc-tag vc-tag--sm vc-tag--feature" }, tr("s.sum.by")), " ", tr("rp.sum.by")),
        live?.unchecked ? h("p", { class: "report-warn" }, h("strong", {}, tr("s.sum.unchecked")), " ", tr("s.sum.unchecked.text")) : null,
        h("p", {}, renderFacts(s.situation, facts)),
        H(2, {}, tr("s.sum.findings")),
        h("ol", { class: "report-list" }, s.findings.map((x) => h("li", {}, renderFacts(x, facts)))),
        H(2, {}, tr("s.sum.recommendation")),
        h("p", {}, renderFacts(s.recommendation, facts))),
      h("div", {},
        H(2, {}, tr("rp.next.h")),
        picked.length ? h("ol", { class: "report-next" }, picked.map((x) => h("li", { class: "vc-report__keep" },
          h("p", { class: "report-next__title" }, h("span", { class: "report-code" }, x.type), " ", x.title),
          h("dl", { class: "report-facts" },
            h("dt", {}, tr("s.strat.first.label")), h("dd", {}, x.first_step),
            h("dt", {}, tr("s.strat.owner.label")), h("dd", {}, x.owner),
            h("dt", {}, tr("s.strat.time.label")), h("dd", {}, x.time_to_impact))))) : note(tr("s.sum.none")),
        H(2, {}, tr("s.sum.assumptions")),
        h("ul", { class: "report-list" }, s.assumptions.map((x) => h("li", {}, renderFacts(x, facts)))))) : null);

  // ---- 3 the SWOT -------------------------------------------------------------------------------------
  const stateWords = (item) => {
    const words = [];
    const source = sourceOf(item);
    if (source !== "entered") words.push(h("span", { class: ["report-state", `report-state--${source}`] }, tr(`p.item.${source}`)));
    const fix = fixedRatings.get(item.id);
    if (fix) words.push(h("span", { class: "report-state report-state--addressed" }, tr("rp.rated", { from: fix.from, to: fix.to })));
    else for (const type of [...new Set(issuesOf(run, item.id).map((i) => i.type))]) words.push(h("span", { class: "report-state report-state--challenged" }, tr(`p.type.${type}`)));
    return words;
  };
  const swotPage = page("swot",
    heading("swot", tr("rp.swot.h")),
    h("p", { class: "report-lead" }, tr("rp.swot.lead")),
    h("div", { class: "report-swot" }, QUADRANTS.map(({ id: q }) => {
      const items = run.items.filter((it) => it.quadrant === q);
      return h("section", { class: "report-quad", dataset: { quad: q }, "aria-labelledby": `${id}-q-${q}` },
        H(2, { class: "report-quad__title", id: `${id}-q-${q}` }, h("span", { class: "report-quad__letter", "aria-hidden": "true" }, LETTER[q]), tr(`q.${q}`)),
        items.length ? h("ul", { class: "report-items" }, items.map((it) => h("li", { class: "report-item", dataset: { source: sourceOf(it), status: fixedRatings.has(it.id) ? "addressed" : issuesOf(run, it.id).length ? "challenged" : undefined } },
          h("span", { class: "report-item__text" }, it.text), " ", stateWords(it)))) : note(tr("rp.quad.empty")));
    })));

  // ---- 4 the issues -----------------------------------------------------------------------------------
  const impacts = new Map((run.impacts || []).map((x) => [x.issue, x]));
  const sources = sourcesOf({ run, scenario: ctx.scenario, today: isoDay(ctx.created) });
  const readOn = new Map(sources.map((x) => [x.url, x.read_on]));
  const aiTag = () => h("span", { class: "report-state report-state--ai" }, tr("p.estimate"));
  const readOnText = (day) => ["(", tr("rp.read.on", { date: fmtDate(day, lang) }), ")"].join("");
  const issueBlock = (i) => {
    const a = impacts.get(i.id);
    const items = [...(i.items || []), ...(i.added || [])];
    const bandText = [tr(`p.band.${band(i.impact, i.likelihood)}`), tr("s.challenge.facts", { impact: i.impact, likelihood: i.likelihood, horizon: tr(`p.horizon.${i.horizon}`) })].join(": ");
    return h("li", { class: "vc-report__keep report-issue", dataset: { issue: i.id } },
      h("p", { class: "report-issue__head" },
        h("span", { class: "report-issue__no", "aria-hidden": "true" }, issueNo(i)),
        h("span", { class: "report-issue__title" }, h("span", { class: "vc-visually-hidden" }, [tr("p.th.issue"), " ", issueNo(i), ": "].join("")), i.title),
        " ", h("span", { class: "report-state report-state--challenged" }, tr(`p.type.${i.type}`))),
      h("p", { class: "report-issue__desc" }, i.description),
      h("dl", { class: "report-facts report-facts--aligned" },
        h("dt", {}, tr("rp.issue.items")), h("dd", {}, items.map((x) => text.get(x)).filter(Boolean).join(" · ")),
        h("dt", {}, tr("p.th.band")), h("dd", {}, bandText),
        h("dt", {}, tr("rp.issue.money")), h("dd", {}, i.expected === null
          ? tr("s.assess.unpriced", { reason: a?.reason || tr("h.not.priced.none") })
          : [h("strong", {}, tr("s.assess.expected.value", { eur: money(i.expected, lang) })), ": ", tr("rp.issue.range", { low: money(i.eur_year_low, lang), high: money(i.eur_year_high, lang), likelihood: i.likelihood }), " ", aiTag()]),
        i.expected !== null && a?.basis ? [h("dt", {}, tr("rp.issue.basis")), h("dd", {}, a.basis)] : null,
        a?.kpis?.length ? [h("dt", {}, tr("rp.issue.kpis")), h("dd", {}, h("ul", { class: "report-list report-list--tight" }, a.kpis.map((k) => h("li", {}, kpiText(k, lang)))))] : null,
        i.evidence?.length ? [h("dt", {}, tr("rp.issue.evidence")), h("dd", {}, h("ul", { class: "report-list report-list--tight" }, i.evidence.map((e) => h("li", {}, h("a", { href: e.url }, e.title), " ", readOnText(readOn.get(e.url) || isoDay(ctx.created))))))] : null,
        h("dt", {}, tr("rp.issue.confidence")), h("dd", {}, tr(`p.conf.${i.confidence}`))));
  };
  const issuesPage = page("issues",
    heading("issues", tr("rp.issues.h")),
    run.issues.length ? [
      h("p", { class: "report-lead" }, run.issues.length === 1 ? tr("rp.issues.lead.one") : tr("rp.issues.lead.other", { n: run.issues.length })),
      riskFigure(run.issues, lang, `${id}-risk`),
      h("ol", { class: "report-issues" }, run.issues.map(issueBlock))
    ] : note(tr("rp.issues.none")));

  // ---- 5 the factor tables and the IE matrix ----------------------------------------------------------
  // Where the company stands opens the page; the two tables it rests on follow. With a strategy chosen,
  // the matrix marks both places and each table shows the ratings and weighted scores after it as well.
  const after = picked.length > 0;
  const factorsPage = page("factors",
    heading("factors", tr("rp.factors.h")),
    scored ? [
      h("p", { class: "report-lead" }, tr(after ? "rp.factors.lead.after" : "rp.factors.lead")),
      ieFigure(f, lang, `${id}-ie`, after),
      factorTable(run, "internal", f, fixedRatings, lang, after),
      factorTable(run, "external", f, fixedRatings, lang, after)
    ] : note(tr("rp.factors.none")));

  // ---- 6 the TOWS matrix ------------------------------------------------------------------------------
  // Every strategy in its cell, one line each, the chosen ones marked; then the chosen ones in full.
  const byType = strategiesByType(run);
  const effectOf = (x) => {
    const eur = strategyEffect(x);
    if (eur === null) return "";
    return x.kind === "advantage" ? tr("s.strat.upside", { eur: money(eur, lang) }) : tr("s.strat.left", { eur: money(eur, lang) });
  };
  const strategyFull = (x) => h("div", { class: "vc-report__keep report-strat", dataset: { chosen: "true", strategy: x.id } },
    h("p", { class: "report-strat__title" }, h("span", { class: "report-code" }, x.type), " ", x.title, " ", h("span", { class: "report-strat__kind" }, tr(`p.kind.${x.kind}`))),
    h("dl", { class: "report-facts report-facts--aligned" },
      h("dt", {}, tr("s.strat.first.label")), h("dd", {}, x.first_step),
      h("dt", {}, tr("s.strat.owner.label")), h("dd", {}, x.owner),
      h("dt", {}, tr("s.strat.time.label")), h("dd", {}, x.time_to_impact),
      h("dt", {}, tr("s.strat.effort.label")), h("dd", {}, tr(`p.effort.${x.effort}`)),
      h("dt", {}, tr(x.kind === "advantage" ? "s.strat.effect.upside" : "s.strat.effect.left")), h("dd", {}, strategyEffect(x) === null ? "" : [money(strategyEffect(x), lang), " ", aiTag()]),
      h("dt", {}, tr("s.strat.pairs")), h("dd", {}, x.items.map((i) => text.get(i)).filter(Boolean).join(" · ")),
      h("dt", {}, tr("s.strat.ratings.label")), h("dd", {}, x.changes.map((c) => tr("s.strat.rating", { item: text.get(c.item) || c.item, from: c.from, to: c.to })).join("; "))));
  const towsCell = (type) => h("section", { class: "report-tows__cell", dataset: { type }, "aria-labelledby": `${id}-tows-${type}` },
    H(2, { class: "report-tows__title", id: `${id}-tows-${type}` }, h("span", { class: "report-code" }, type), " ", tr(`s.strat.${type}`)),
    h("p", { class: "report-tows__kind" }, tr(`p.kind.${KIND[type]}`)),
    byType[type].length
      ? h("ul", { class: "report-tows__list" }, byType[type].map((x) => h("li", { dataset: { chosen: chosen.includes(x.id) ? "true" : undefined, strategy: x.id } },
        h("span", { class: "report-tows__name" }, x.title),
        chosen.includes(x.id) ? [" ", h("span", { class: "report-state report-state--addressed" }, tr("rp.chosen"))] : null,
        effectOf(x) ? h("span", { class: "report-tows__effect" }, effectOf(x)) : null)))
      : note(tr("s.strat.empty")));
  const towsGrid = h("div", { class: "vc-report__keep report-tows" },
    h("p", { class: "report-tows__head", dataset: { head: "s" }, "aria-hidden": "true" }, tr("q.strengths")),
    h("p", { class: "report-tows__head", dataset: { head: "w" }, "aria-hidden": "true" }, tr("q.weaknesses")),
    h("p", { class: "report-tows__head report-tows__head--row", dataset: { head: "o" }, "aria-hidden": "true" }, tr("q.opportunities")),
    towsCell("SO"), towsCell("WO"),
    h("p", { class: "report-tows__head report-tows__head--row", dataset: { head: "t" }, "aria-hidden": "true" }, tr("q.threats")),
    towsCell("ST"), towsCell("WT"));
  const towsPage = page("tows",
    heading("tows", tr("rp.tows.h")),
    run.strategies.length ? [
      h("p", { class: "report-lead" }, tr("rp.tows.lead")),
      towsGrid,
      H(2, { class: "report-subhead" }, tr("rp.tows.chosen")),
      picked.length ? picked.map(strategyFull) : note(tr("s.sum.none"))
    ] : note(tr("rp.tows.none")));

  // ---- 7 method, assumptions and sources --------------------------------------------------------------
  const para = (key) => h("p", {}, tr(key));
  const researchNotes = [];
  if (mode === "live") {
    if (!live?.settings.research) researchNotes.push(tr("rp.cutoff"));
    else if (live.research === "off") researchNotes.push(tr("r.off"));
    else if (live.research === "refused") researchNotes.push(tr("r.refused"));
    else if (live.research === "none") researchNotes.push(tr("r.none"));
  }
  const methodPage = page("method",
    heading("method", tr("rp.method.h")),
    H(2, {}, tr("m.factors.h")), para("m.factors.p"), h("p", { class: "report-note" }, tr("m.src.david")),
    H(2, {}, tr("m.ie.h")), para("m.ie.p"),
    H(2, {}, tr("m.tows.h")), para("m.tows.p"), h("p", { class: "report-note" }, tr("m.src.weihrich")),
    H(2, {}, tr("m.risk.h")), para("m.risk.p"), para("m.risk.money"),
    H(2, {}, tr("m.not.h")), para("m.not.p"),
    H(2, {}, tr("rp.sources.h")),
    researchNotes.map((x) => h("p", { class: "report-warn" }, x)),
    sources.length ? h("ul", { class: "report-list report-sources" }, sources.map((x) => h("li", {}, h("a", { href: x.url }, x.title), h("br"), h("span", { class: "report-url" }, x.url), " ", readOnText(x.read_on)))) : note(tr("rp.sources.none")));

  // ---- 8 about this report ----------------------------------------------------------------------------
  // The byline as Vici's profile links set it out, both links rel="author". Paper shows no link, so the two
  // addresses stand beside the name in small type; the website's is the link, LinkedIn's is the name's.
  const bare = (url) => url.replace(/^https:\/\/(www\.)?/, "").replace(/\/index\.html$/, "").replace(/\/$/, "");
  const aboutPage = page("about",
    heading("about", tr("rp.about.h")),
    h("p", {}, tr("rp.about.tool"), " ", h("a", { href: APP.url }, APP.url)),
    para("rp.about.made"),
    mode !== "live" ? para("rp.about.fiction") : null,
    h("p", { class: "report-public" }, tr("s.live.public")),
    para("rp.about.generated"),
    h("p", { class: "vc-byline report-byline" },
      h("span", { class: "vc-byline__label" }, tr("p.byline.label")),
      h("a", { class: "vc-byline__person", href: AUTHOR.linkedin, rel: "author" },
        h("span", { class: "vc-avatar vc-avatar--xs" }, h("img", { src: PORTRAIT, alt: "", width: "96", height: "96" })),
        h("span", { class: "vc-byline__name" }, AUTHOR.name)),
      h("span", { class: "report-byline__where" },
        h("span", { "aria-hidden": "true" }, bare(AUTHOR.linkedin)), " · ",
        h("a", { href: AUTHOR.website, rel: "author", "aria-label": tr("rp.byline.website.name") }, bare(AUTHOR.website)))));

  const root = h("article", {
    class: "vc-report report",
    id,
    lang: lang === "de" ? "de" : "en-GB",
    "data-theme": "light",
    dataset: { mode, vcFooterStart: [tr("rp.foot.created"), APP.url].join("\n"), vcFooterEnd: tr("rp.foot.end"), vcFooterOf: tr("rp.foot.of"), vcNotice: stopped ? tr("rp.notice") : undefined },
    "aria-label": tr("rp.label", { company: run.company.name })
  },
  cover, summaryPage, swotPage, issuesPage, factorsPage, towsPage, methodPage, aboutPage,
  h("footer", { class: "vc-report__footer" }, h("span", {}, [tr("rp.foot.created"), APP.url].join(" · ")), h("span", {}, tr("rp.foot.by"))));
  return root;
}

/**
 * The risk matrix of the issues, Vici's markup, with the issues listed beside it: number and title, band
 * and expected euros a year. The matrix is a picture for the eye; the table and the blocks below it
 * carry every figure in words, so a screen reader and a grey printout lose nothing.
 */
function riskFigure(issues, lang, id) {
  const tr = (key, vars = null) => t(key, vars, lang);
  const cells = [];
  for (let impact = 5; impact >= 1; impact--) {
    cells.push(h("span", { class: "vc-risk__tick" }, String(impact)));
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const here = issues.filter((i) => i.impact === impact && i.likelihood === likelihood);
      cells.push(h("div", { class: "vc-risk__cell", dataset: { impact, likelihood, band: band(impact, likelihood) } },
        h("span", { class: "vc-risk__score" }, String(riskScore(impact, likelihood))),
        here.map((i) => h("span", { class: "vc-risk__marker", dataset: { impact, likelihood, issue: i.id } }, issueNo(i)))));
    }
  }
  cells.push(h("span", { class: "vc-risk__tick", "aria-hidden": "true" }));
  for (let likelihood = 1; likelihood <= 5; likelihood++) cells.push(h("span", { class: "vc-risk__tick" }, String(likelihood)));
  const th = (words, attrs = {}) => h("th", { scope: "col", ...attrs }, words);
  const num = (words) => h("td", { class: "vc-num" }, words);
  return h("figure", { class: "vc-report__keep report-risk", "aria-labelledby": `${id}-title` },
    h("div", { class: "vc-risk", "aria-hidden": "true" },
      h("div", { class: "vc-risk__plot" },
        h("p", { class: "vc-risk__axis vc-risk__axis--impact" }, tr("s.challenge.impact")),
        h("div", { class: "vc-risk__grid" }, cells),
        h("p", { class: "vc-risk__axis vc-risk__axis--likelihood" }, tr("s.challenge.likelihood"))),
      h("ul", { class: "vc-risk__key" }, ["low", "medium", "high", "critical"].map((b) => h("li", { dataset: { band: b } }, tr(`p.band.key.${b}`))))),
    h("table", { class: "vc-table vc-table--compact report-risk__table" },
      h("caption", { id: `${id}-title` }, tr("s.challenge.matrix")),
      h("colgroup", {}, h("col", {}), h("col", { class: "report-col--band" }), h("col", { class: "report-col--eur" })),
      h("thead", {}, h("tr", {}, th(tr("p.th.issue")), th(tr("p.th.band")), th(tr("p.th.expected"), { class: "vc-num" }))),
      h("tbody", {}, issues.map((i) => h("tr", { dataset: { issue: i.id } },
        h("th", { scope: "row" }, h("span", { class: "report-risk__no" }, issueNo(i)), " ", i.title),
        h("td", {}, tr(`p.band.${band(i.impact, i.likelihood)}`)),
        i.expected === null ? h("td", { class: "vc-num report-wrap" }, tr("p.not.priced")) : num(money(i.expected, lang)))))));
}

/**
 * One side's factor table, as the Assess step shows it: weight, rating and weighted score, and the total,
 * which is the engine's score. With a strategy chosen (after), two more columns give the rating and the
 * weighted score after it, a changed rating in bold, and the totals before and after.
 */
function factorTable(run, side, f, fixedRatings, lang, after) {
  const tr = (key, vars = null) => t(key, vars, lang);
  const rows = run.factors.filter((x) => SIDE[x.quadrant] === side);
  const text = new Map(run.items.map((it) => [it.id, it.text]));
  const now = side === "internal" ? f.ife.before : f.efe.before;
  const then = side === "internal" ? f.ife.after : f.efe.after;
  const name = side === "internal" ? tr("s.assess.ife") : tr("s.assess.efe");
  const th = (words, attrs = {}) => h("th", { scope: "col", ...attrs }, words);
  const num = (words, attrs = {}) => h("td", { ...attrs, class: ["vc-num", attrs.class] }, words);
  const rated = (x) => fixedRatings.get(x.id)?.to ?? x.rating;
  const caption = [side === "internal" ? tr("s.assess.inside") : tr("s.assess.outside"), tr("s.assess.score", { name, score: score(now.value, lang) })].join(": ");
  const head = after
    ? [h("tr", {}, th(tr("p.th.item"), { rowspan: "2" }), th(tr("p.th.weight"), { rowspan: "2", class: "vc-num" }),
        th(tr("p.th.now"), { colspan: "2", scope: "colgroup", class: "report-factors__group" }),
        th(tr("p.th.after"), { colspan: "2", scope: "colgroup", class: "report-factors__group report-factors__after" })),
      h("tr", {}, th(tr("p.th.rating"), { class: "vc-num" }), th(tr("p.th.weighted"), { class: "vc-num" }),
        th(tr("p.th.rating"), { class: "vc-num report-factors__after" }), th(tr("p.th.weighted"), { class: "vc-num" }))]
    : h("tr", {}, th(tr("p.th.item")), th(tr("p.th.weight"), { class: "vc-num" }), th(tr("p.th.rating"), { class: "vc-num" }), th(tr("p.th.weighted"), { class: "vc-num" }));
  const cols = after ? 5 : 3;
  return h("table", { class: ["vc-table vc-table--compact report-factors", after ? "report-factors--after" : ""], dataset: { side } },
    h("caption", {}, caption),
    h("colgroup", {}, h("col", {}), Array.from({ length: cols }, () => h("col", { class: "report-col--num" }))),
    h("thead", {}, head),
    h("tbody", {}, rows.map((x) => {
      const changed = rated(x) !== x.rating;
      return h("tr", { dataset: { quad: x.quadrant, changed: changed ? "true" : undefined } },
        h("th", { scope: "row" }, h("span", { class: "report-quad__letter", "aria-hidden": "true" }, LETTER[x.quadrant]), " ", text.get(x.id)),
        num(fmtWeight(x.weight, lang)), num(String(x.rating)), num(fixed(x.weight * x.rating, 2, lang)),
        after ? [num(changed ? h("strong", {}, String(rated(x))) : String(rated(x)), { class: "report-factors__after" }), num(changed ? h("strong", {}, fixed(x.weight * rated(x), 2, lang)) : fixed(x.weight * rated(x), 2, lang))] : null);
    })),
    h("tfoot", {}, h("tr", {}, h("th", { scope: "row" }, tr("p.total")), num(fmtWeight(rows.reduce((n, x) => n + x.weight, 0), lang)), h("td", {}), num(score(now.value, lang)),
      after ? [h("td", { class: "report-factors__after" }), num(score(then.value, lang))] : null)));
}

/**
 * The IE matrix, the app's markup, and its numbers beside it. With a strategy chosen (after), it marks the
 * place now and the place after, and the table has both columns; without one, the place now alone.
 */
function ieFigure(f, lang, id, after) {
  const tr = (key, vars = null) => t(key, vars, lang);
  const now = f.ie.before;
  const then = f.ie.after;
  const moved = after && then.cell !== now.cell;
  const marker = (kind) => h("span", { class: ["ie-marker", `ie-marker--${kind}`] }, h("span", {}, kind === "after" ? tr("s.assess.after") : tr("s.assess.now")));
  const ROWS = ["s.assess.high", "s.assess.medium", "s.assess.low"];
  const COLS = ["s.assess.strong", "s.assess.average", "s.assess.weak"];
  const range = (i) => { const lo = [3, 2, 1][i]; return tr("s.assess.range", { from: fixed(lo, 2, lang), to: fixed(i === 0 ? 4 : lo + 0.99, 2, lang) }); };
  const cells = [];
  for (let row = 0; row < 3; row++) {
    cells.push(h("span", { class: "ie-tick ie-tick--row" }, h("span", {}, tr(ROWS[row])), h("span", { class: "ie-range" }, range(row))));
    for (let col = 0; col < 3; col++) {
      const cell = CELLS[row * 3 + col];
      cells.push(h("div", { class: "ie-cell", dataset: { cell, zone: ZONE[cell], here: cell === now.cell || (moved && cell === then.cell) ? "true" : undefined } },
        h("span", { class: "ie-cell__name" }, cell),
        cell === now.cell ? marker(moved ? "before" : "now") : null,
        moved && cell === then.cell ? marker("after") : null));
    }
  }
  cells.push(h("span", { class: "ie-tick", "aria-hidden": "true" }));
  for (let col = 0; col < 3; col++) cells.push(h("span", { class: "ie-tick ie-tick--col" }, h("span", {}, tr(COLS[col])), h("span", { class: "ie-range" }, range(col))));
  const th = (words, attrs = {}) => h("th", { scope: "col", ...attrs }, words);
  const num = (words) => h("td", { class: "vc-num" }, words);
  const row = (label, a, b) => h("tr", {}, h("th", { scope: "row" }, label), num(a), after ? num(b) : null);
  const words = (label, a, b) => h("tr", {}, h("th", { scope: "row" }, label), h("td", { class: "report-ie__words" }, a), after ? h("td", { class: "report-ie__words" }, b) : null);
  return h("figure", { class: "vc-report__keep report-ie", "aria-labelledby": `${id}-title` },
    h("div", { class: "ie report-ie__plot", "aria-hidden": "true" },
      h("div", { class: "ie-plot" },
        h("p", { class: "ie-axis ie-axis--y" }, tr("s.assess.efe")),
        h("div", { class: "ie-grid" }, cells),
        h("p", { class: "ie-axis ie-axis--x" }, tr("s.assess.ife")))),
    h("table", { class: "vc-table vc-table--compact report-ie__table" },
      h("caption", { id: `${id}-title` }, tr("rp.ie.caption")),
      h("colgroup", {}, h("col", { class: "report-col--label" }), h("col", {}), after ? h("col", {}) : null),
      h("thead", {}, h("tr", {}, th(tr("p.th.figure")), th(tr("p.th.now"), { class: "vc-num" }), after ? th(tr("p.th.after"), { class: "vc-num" }) : null)),
      h("tbody", {},
        row(tr("s.assess.ife"), score(f.ife.before.value, lang), score(f.ife.after.value, lang)),
        row(tr("s.assess.efe"), score(f.efe.before.value, lang), score(f.efe.after.value, lang)),
        row(tr("s.assess.cell"), now.cell, then.cell),
        words(tr("s.assess.zone"), zoneName(now.zone, lang), zoneName(then.zone, lang)))),
    h("ul", { class: "ie-key report-ie__key", "aria-hidden": "true" }, ["grow", "hold", "harvest"].map((z) => h("li", { dataset: { zone: z } }, tr(`s.assess.key.${z}`)))));
}

/** A small copy of the report's first pages for the Summary panel: decorative, hidden from screen readers. */
export function thumbNodes(report) {
  const pages = [...report.querySelectorAll(":scope > .vc-report__page")].slice(0, 2);
  return pages.map((p) => {
    const copy = p.cloneNode(true);
    copy.removeAttribute("aria-labelledby");
    for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
    for (const el of copy.querySelectorAll("[aria-labelledby]")) el.removeAttribute("aria-labelledby");
    const sheet = h("div", { class: "vc-report report report--thumb", "data-theme": "light", lang: report.getAttribute("lang") }, copy);
    return h("span", { class: "report-thumb", "aria-hidden": "true" }, sheet);
  });
}

/** swot-challenger-<company>-<YYYY-MM-DD>-<lang>.<ext>, with umlauts written out (ä as ae, ß as ss). */
export function fileName(company, day, lang, ext) {
  const map = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "ae", Ö: "oe", Ü: "ue" };
  const slug = String(company || "").replace(/[äöüßÄÖÜ]/g, (c) => map[c]).normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "") || "company";
  return `swot-challenger-${slug}-${day}-${lang}${ext ? `.${ext}` : ""}`;
}

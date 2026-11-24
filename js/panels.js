// The story on the right: one screen a step, as Vici's "Presenting step by step" sets it out. Each step
// has a title that states its figure (and, once the person has decided, the result), a lead that Play
// reads for its timing, the step's evidence, and under it a bar that says what happens next and holds the
// step's one primary action. Where the person acts (Start, Complete, the decision), the bar is Vici's
// merlot "Your turn" callout and its action draws the eye. Everything the AI wrote or estimated carries
// lilac; every figure comes from the engine (js/simulation.js, js/scenario.js) and is formatted here.

import { t, tn } from "./i18n/index.js";
import { h, icon } from "./dom.js";
import { money, score, zoneName, countryName, date } from "./format.js";
import { STEP, itemsAt, sameChoice } from "./simulation.js";
import { renderFacts } from "./facts.js";
import { factsFor } from "./scenario.js";
import { SECTORS } from "../data/kpis.js";
import { riskMatrix, factorTable, ieMatrix, towsMatrix, issueNo, effectMark, estimateRows, kpiText } from "./matrices.js";

/** A description list's flat rows (dt, dd, dt, dd; nested lists and nulls allowed) as [dt, dd] pairs. */
const pairs = (rows) => { const flat = [rows].flat(Infinity).filter(Boolean); const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]); return out; };
import { itemsChallenged } from "./engine.js";
import { liveStartStory, waitStory, stopStory, checkControls, checkCount, researchNote, liveSummaryExtras, liveEntry, yourTurnLive } from "./live_panels.js";

const sectorName = (id, lang) => SECTORS.find((s) => s.id === id)?.name[lang] || id;
const ai = (...children) => h("span", { class: "vc-tag vc-tag--sm vc-tag--feature" }, icon("sparkle"), ...children);

// ---- the bar under the story ------------------------------------------------------------------------

/** The step's one primary action. It names where it leads. */
function cta(label, onClick, attention) {
  return h("button", { type: "button", class: ["vc-button", "cta", attention ? "vc-attention" : ""], id: "btn-cta", on: { click: onClick } }, h("span", {}, label), icon("chevron-right"));
}

/** Vici's merlot callout: whose turn it is, in one sentence what pressing the action changes, and the action. */
function yourTurn(title, sentence, action) {
  return h("div", { class: "vc-callout turn", role: "status" },
    h("span", { class: "vc-callout__cell", "aria-hidden": "true" }, icon("hand")),
    h("div", { class: "vc-callout__body" }, h("p", { class: "vc-callout__title" }, title), h("p", { class: "turn__text" }, sentence)),
    action);
}

/** The bar of a step that plays on: when Play moves on ("Plays on in 8 s") or "Your move", and Next. */
function playsOn(label, onClick, ctx) {
  return h("div", { class: "foot" },
    h("p", { class: "foot-note", id: "foot-note", dataset: { tone: ctx.play.on ? "" : "move" } }, ctx.play.on ? "" : t("p.your.move")),
    cta(label, onClick, ctx.play.attention));
}

// ---- steps ------------------------------------------------------------------------------------------

function start(ctx) {
  const { run, lang, scenario } = ctx;
  const entered = itemsAt(run, STEP.start).length;
  const agents = ["complete", "challenge", "assess", "strategise", "summary"];
  if (ctx.live) return liveStarted(ctx, entered);
  return {
    title: t("s.start.title", { company: run.company.name }),
    lead: t("s.start.lead", { n: entered }),
    body: [
      h("section", { class: "company", "aria-labelledby": "company-title" },
        h("h2", { class: "panel-h vc-visually-hidden", id: "company-title" }, run.company.name),
        h("p", { class: "company__desc" }, run.company.description),
        h("dl", { class: "company__facts" },
          h("div", {}, h("dt", {}, t("s.start.sector")), h("dd", {}, sectorName(run.company.sector, lang))),
          h("div", {}, h("dt", {}, t("s.start.country")), h("dd", {}, countryName(run.company.country, lang))),
          h("div", {}, h("dt", {}, t("s.start.asof")), h("dd", {}, date(scenario.as_of, lang)))),
        h("p", { class: "company__fiction" }, t("s.start.fiction"))),
      h("section", { class: "agents", "aria-labelledby": "agents-title" },
        h("h2", { class: "panel-h", id: "agents-title" }, t("s.start.agents")),
        h("ol", { class: "agent-steps" }, agents.map((s) => h("li", { dataset: { step: s } }, h("span", { class: "agent-steps__name" }, t(`p.step.${s}`)), " ", h("span", { class: "agent-steps__line" }, t(`p.step.${s}.line`)))))),
      h("dl", { class: "modes" },
        h("div", { class: "mode", dataset: { mode: "simulation" } }, h("dt", {}, t("p.modes.sim")), h("dd", {}, t("p.modes.sim.text"))),
        h("div", { class: "mode", dataset: { mode: "live" } }, h("dt", {}, h("span", {}, t("p.modes.live"))), h("dd", {}, t("p.modes.live.text")), h("dd", { class: "mode__act" }, liveEntry(ctx.handlers.enterLive, { sub: false })))),
      h("p", { class: "version-note" }, t("p.version"))
    ],
    bar: yourTurn(t("p.your.turn"), t("s.start.turn"), cta(t("s.start.cta"), ctx.handlers.start, true))
  };
}

function complete(ctx) {
  const { run, lang } = ctx;
  // In a live run the person checks the AI's items before the challenge; afterwards the removed ones stay
  // listed, struck through, so the panel shows what the challenge received.
  const checking = !!ctx.live && ctx.live.stepState(STEP.complete) === "check";
  const removed = ctx.live && !checking ? run.removed || [] : [];
  const added = [...run.items.filter((it) => it.source === "ai" && !it.added), ...removed.map((it) => ({ ...it, gone: true }))];
  const text = new Map(run.items.map((it) => [it.id, it.text]));
  const waiting = ctx.waits;
  const shown = (it) => (checking ? ctx.live.check.edited.get(it.id) ?? it.text : it.text);
  const isRemoved = (it) => it.gone || (checking && ctx.live.check.removed.has(it.id));
  const isEdited = (it) => it.edited || (checking && ctx.live.check.edited.has(it.id));
  return {
    title: tn("s.complete.title", added.length),
    lead: t("s.complete.lead"),
    body: [
      h("section", { "aria-labelledby": "ai-items-title" },
        h("h2", { class: "panel-h", id: "ai-items-title" }, t("s.complete.ai")),
        checking ? h("p", { class: "check-public", role: "note" }, icon("warning"), h("span", {}, t("s.live.public"))) : null,
        checking ? h("p", { class: "check-count", "aria-live": "polite" }, checkCount(ctx, added.length)) : null,
        h("ul", { class: "ai-items" }, added.map((it) => h("li", { class: ["ai-item", isRemoved(it) ? "is-removed" : ""], dataset: { id: it.id } },
          h("p", { class: "ai-item__head" }, ai(t("p.item.ai")), h("span", { class: "ai-item__quad" }, t(`q.${it.quadrant}`))),
          h("p", { class: "ai-item__text" }, isRemoved(it) ? h("s", {}, shown(it)) : shown(it)),
          isEdited(it) && !checking ? h("p", { class: "ai-item__edited" }, t("p.item.edited", { text: it.original || "" })) : null,
          h("p", { class: "ai-item__basis" }, t("p.item.basis", { text: it.basis })),
          h("p", { class: "ai-item__conf" }, t("p.item.confidence", { level: t(`p.conf.${it.confidence}`) })),
          checking ? checkControls(it, ctx) : it.gone ? h("p", { class: "check" }, h("span", { class: "vc-tag vc-tag--sm check__removed" }, icon("minus"), t("s.check.removed"))) : null)))),
      run.misfiled.length ? h("section", { "aria-labelledby": "misfiled-title" },
        h("h2", { class: "panel-h", id: "misfiled-title" }, t("s.complete.misfiled")),
        h("ul", { class: "misfiled" }, run.misfiled.map((m) => h("li", { class: "misfiled__note" },
          h("p", { class: "misfiled__item" }, h("span", { class: "misfiled__text" }, text.get(m.item)), " ", h("span", { class: "misfiled__to" }, t("s.complete.belongs", { quadrant: t(`q.${m.belongs_in}`) }))),
          h("p", { class: "misfiled__why" }, m.reason))))) : null
    ],
    bar: checking
      ? yourTurnLive(t("p.your.turn"), t("s.check.turn"), cta(t("s.complete.cta"), ctx.handlers.challenge, true))
      : waiting
        ? yourTurn(t("p.your.turn"), t("s.complete.turn"), cta(t("s.complete.cta"), ctx.handlers.challenge, true))
        : playsOn(ctx.live ? t("s.challenge.cta.live") : t("s.complete.cta"), ctx.live ? ctx.handlers.next : ctx.handlers.challenge, ctx)
  };
}

/** An issue's card: its number, its type in words, its title and what it rests on. */
function issueCard(issue, ctx, { priced }) {
  const { lang } = ctx;
  const text = new Map(ctx.run.items.map((it) => [it.id, it.text]));
  const lit = ctx.litIssue === issue.id;
  const select = h("button", { type: "button", class: "issue__select", "aria-pressed": String(lit), on: { click: () => ctx.handlers.lightIssue(issue.id) } },
    h("span", { class: "issue__no", "aria-hidden": "true" }, issueNo(issue)),
    h("span", { class: "issue__title" }, h("span", { class: "vc-visually-hidden" }, `${t("p.th.issue")} ${issueNo(issue)}: `), issue.title));
  const parts = [
    h("p", { class: "issue__head" }, h("span", { class: "vc-tag vc-tag--sm vc-tag--danger issue__type" }, icon("warning"), t(`p.type.${issue.type}`)), h("span", { class: "issue__facts" }, t("s.challenge.facts", { impact: issue.impact, likelihood: issue.likelihood, horizon: t(`p.horizon.${issue.horizon}`) }))),
    select
  ];
  // At Challenge the card says what is wrong; at Assess, what it costs.
  if (!priced) {
    parts.push(h("p", { class: "issue__desc" }, issue.description));
    for (const id of issue.added) parts.push(h("p", { class: "issue__added" }, h("span", { class: "vc-tag vc-tag--sm vc-tag--feature" }, icon("plus"), t("p.item.added")), " ", text.get(id)));
  }
  if (priced) {
    if (issue.expected === null) {
      const impact = ctx.run.impacts.find((x) => x.issue === issue.id);
      parts.push(h("p", { class: "issue__money issue__money--none" }, t("s.assess.unpriced", { reason: impact?.reason || "" })));
    } else {
      const impact = ctx.run.impacts.find((x) => x.issue === issue.id);
      parts.push(h("p", { class: "issue__money" },
        h("strong", { class: "issue__expected" }, t("s.assess.expected.value", { eur: money(issue.expected, lang) })), " ",
        h("span", { class: "issue__range" }, t("s.assess.range.eur", { low: money(issue.eur_year_low, lang), high: money(issue.eur_year_high, lang), likelihood: issue.likelihood }))));
      if (impact) {
        parts.push(h("ul", { class: "issue__kpis" }, impact.kpis.map((k) => h("li", {}, ai(t("p.estimate")), " ", kpiText(k, lang)))));
        if (impact.basis) parts.push(h("p", { class: "issue__basis" }, t("p.item.basis", { text: impact.basis })));
      }
    }
  }
  for (const ev of priced ? [] : issue.evidence) {
    parts.push(h("p", { class: "issue__source" }, icon("link"), " ", h("a", { href: ev.url, target: "_blank", rel: "noopener" }, ev.title, h("span", { class: "vc-visually-hidden" }, t("p.new.tab")))));
  }
  const li = h("li", { class: ["issue", lit ? "is-lit" : ""], dataset: { issue: issue.id, type: issue.type } }, parts);
  return li;
}


function challenge(ctx) {
  const { run, lang } = ctx;
  const items = itemsChallenged(run.items, run.issues);
  return {
    title: t("s.challenge.title", { n: items.challenged, total: items.total }),
    lead: t("s.challenge.lead"),
    body: [
      ctx.live ? researchNote(ctx) : null,
      h("div", { class: "challenge" },
        h("div", { class: "challenge__matrix" }, riskMatrix({ issues: run.issues, lang, lit: ctx.litIssue })),
        h("section", { class: "challenge__issues", "aria-labelledby": "issues-title" },
          h("h2", { class: "panel-h", id: "issues-title" }, tn("s.challenge.issues", run.issues.length)),
          h("ol", { class: "issues" }, run.issues.map((i) => issueCard(i, ctx, { priced: false })))))
    ],
    bar: playsOn(t("s.challenge.cta"), ctx.handlers.next, ctx)
  };
}

function assess(ctx) {
  const { run, lang } = ctx;
  const f = ctx.figures.before;
  const stake = money(f.stake.value, lang);
  const partial = f.stake.priced < f.stake.of;
  return {
    title: partial ? t("s.assess.title.part", { stake, priced: f.stake.priced, of: f.stake.of }) : t("s.assess.title", { stake }),
    lead: t("s.assess.lead"),
    body: [
      h("div", { class: "assess" },
        h("section", { class: "assess__ie", "aria-labelledby": "ie-title" },
          h("p", { class: "scores" },
            h("span", { class: "score-chip" }, h("span", { class: "score-chip__label" }, t("s.assess.ife")), " ", h("strong", {}, score(f.ife.before.value, lang))),
            h("span", { class: "score-chip vc-tooltip-anchor" }, h("span", { class: "score-chip__label" }, t("s.assess.efe")), " ", h("strong", {}, score(f.efe.before.value, lang)))),
          ieMatrix({ figures: f, lang, after: false }),
          h("p", { class: "assess__judgement" }, ai(t("p.estimate")), " ", t("s.assess.judgement"))),
        h("section", { class: "assess__costs", "aria-labelledby": "costs-title" },
          h("h2", { class: "panel-h", id: "costs-title" }, t("s.assess.costs")),
          h("ol", { class: "issues issues--priced" }, run.issues.map((i) => issueCard(i, ctx, { priced: true })))),
        h("section", { class: "assess__factors", "aria-labelledby": "factors-title" },
          h("h2", { class: "panel-h", id: "factors-title" }, t("s.assess.factors")),
          h("div", { class: "factor-tables" }, factorTable({ run, side: "internal", lang, figures: f }), factorTable({ run, side: "external", lang, figures: f }))))
    ],
    bar: playsOn(t("s.assess.cta"), ctx.handlers.next, ctx)
  };
}

/** What the ticked strategies change: what is left, the upside, both scores and the cell, in one strip. */
function effectStrip(ctx) {
  const { lang } = ctx;
  const p = ctx.preview;
  const was = (a, b) => (a === b ? [h("span", { class: "effect__now" }, b)] : [h("s", { class: "effect__was" }, h("span", { "aria-hidden": "true" }, a), h("span", { class: "vc-visually-hidden" }, t("p.was", { value: a }))), " ", h("span", { class: "effect__now" }, b)]);
  const row = (label, nodes) => h("div", { class: "effect__row" }, h("dt", {}, label), h("dd", {}, nodes));
  return h("section", { class: "effect", "aria-labelledby": "effect-title" },
    h("h2", { class: "effect__title", id: "effect-title" }, t("s.strat.effect")),
    h("dl", { class: "effect__list" },
      row(t("s.strat.effect.left"), was(money(p.stake.value, lang), money(p.left, lang))),
      row(t("s.strat.effect.upside"), [h("span", { class: "effect__now" }, money(p.upside, lang))]),
      row(t("s.assess.efe"), was(score(p.efe.before.value, lang), score(p.efe.after.value, lang))),
      row(t("s.assess.ife"), was(score(p.ife.before.value, lang), score(p.ife.after.value, lang))),
      row(t("s.strat.effect.cell"), [...was(p.ie.before.cell, p.ie.after.cell), " ", h("span", { class: "effect__zone" }, zoneName(p.ie.after.zone, lang))])));
}

/** What pressing Adopt changes, in the visitor's words: what stays at stake and the response score. */
function turnSentence(ctx) {
  const { lang } = ctx;
  const p = ctx.preview;
  if (!ctx.state.selection.size) return t("s.strat.turn.none", { stake: money(p.stake.value, lang) });
  return t("s.strat.turn", { left: money(p.left, lang), stake: money(p.stake.value, lang), efe: score(p.efe.after.value, lang) });
}

function strategise(ctx) {
  const { run, lang, state } = ctx;
  const decided = state.adopted && sameChoice(state.adopted, [...state.selection]);
  const f = ctx.figures.after;
  let title = t("s.strat.title");
  if (decided) title = state.adopted.length ? t("s.strat.title.done", { left: money(f.left, lang), efe: score(f.efe.after.value, lang) }) : t("s.strat.title.none", { left: money(f.left, lang) });
  const none = state.selection.size === 0;
  return {
    title,
    lead: t("s.strat.lead"),
    wide: true,
    body: [
      h("div", { class: "strategise" },
        towsMatrix({ run, lang, selection: state.selection, onToggle: ctx.handlers.toggle, open: ctx.open }),
        effectStrip(ctx))
    ],
    bar: decided
      ? playsOn(t("s.strat.cta.next"), ctx.handlers.next, ctx)
      : (ctx.live ? yourTurnLive : yourTurn)(t("p.your.decision"), turnSentence(ctx), cta(none ? t("s.strat.cta.none") : t("s.strat.cta"), ctx.handlers.adopt, true))
  };
}

function summary(ctx) {
  const { run, lang, state } = ctx;
  const chosen = state.adopted || [];
  const facts = factsFor(run, chosen, lang, zoneName);
  const s = run.summary;
  const r = (text) => renderFacts(text, facts);
  const f = ctx.figures.after;
  const before = money(f.stake.value, lang);
  const left = money(f.left, lang);
  const picked = run.strategies.filter((x) => chosen.includes(x.id));
  return {
    title: before === left ? t("s.sum.title.same", { stake: before }) : t("s.sum.title", { left, stake: before }),
    lead: t("s.sum.lead"),
    body: [
      ctx.report ? ctx.report.card(ctx.handlers.openReport) : null,
      h("div", { class: "summary" },
        h("article", { class: "summary__text", "aria-labelledby": "sum-head" },
          h("p", { class: "summary__by" }, ai(t("s.sum.by"))),
          h("h2", { class: "summary__headline", id: "sum-head" }, s.headline),
          h("p", {}, r(s.situation)),
          h("h3", {}, t("s.sum.findings")),
          h("ol", { class: "summary__findings" }, s.findings.map((x) => h("li", {}, r(x)))),
          h("h3", {}, t("s.sum.recommendation")),
          h("p", {}, r(s.recommendation)),
          h("h3", {}, t("s.sum.assumptions")),
          h("ul", { class: "summary__assumptions" }, s.assumptions.map((x) => h("li", {}, r(x))))),
        h("section", { class: "summary__chosen", "aria-labelledby": "chosen-title" },
          h("h2", { class: "panel-h", id: "chosen-title" }, t("s.sum.chosen")),
          picked.length
            ? h("ol", { class: "chosen" }, picked.map((x) => h("li", { class: "chosen__item" },
              h("p", { class: "chosen__title" }, h("span", { class: "tows-cell__code" }, x.type), " ", x.title),
              h("p", { class: "chosen__effect" }, effectMark(x, lang, "chosen__figure")),
              h("dl", { class: "chosen__facts" },
                h("div", {}, h("dt", {}, t("s.strat.first.label")), h("dd", {}, x.first_step)),
                h("div", {}, h("dt", {}, t("s.strat.owner.label")), h("dd", {}, x.owner)),
                h("div", {}, h("dt", {}, t("s.strat.time.label")), h("dd", {}, x.time_to_impact)),
                // The estimate, what the Strategist rests it on and how sure it is, each a line of its own.
                ...pairs(estimateRows(x, lang)).map(([dt, dd]) => h("div", {}, dt, dd))))))
            : h("p", { class: "chosen__none" }, t("s.sum.none")),
          ...(ctx.live ? liveSummaryExtras(ctx) : [
            h("div", { class: "sum-live" }, h("p", { class: "sum-live__q" }, t("s.sum.live.next")), liveEntry(ctx.handlers.enterLive, { sub: false })),
            h("p", { class: "sum-more" },
              h("button", { type: "button", class: "vc-button vc-button--secondary vc-button--sm", id: "btn-replay", on: { click: ctx.handlers.replay } }, icon("refresh"), t("p.replay")),
              h("button", { type: "button", class: "vc-button vc-button--secondary vc-button--sm", id: "btn-next-company", on: { click: ctx.handlers.nextCompany } }, t("s.sum.cta", { company: ctx.nextCompany }), icon("chevron-right")))])))
    ],
    // The run's last action: the report, as PDF, HTML or the file for the Prototype Ideator.
    bar: ctx.report ? yourTurn(t("p.your.turn"), t("rp.turn"), cta(t("rp.cta"), ctx.handlers.openReport, false)) : null
  };
}

/** Start after a live run began: the company and the SWOT as the person entered them. */
function liveStarted(ctx, entered) {
  const { run, lang } = ctx;
  return {
    title: t("s.live.started.title", { company: run.company.name }),
    lead: t("s.live.started.lead", { n: entered }),
    body: [
      h("section", { class: "company", "aria-labelledby": "company-title" },
        h("h2", { class: "panel-h vc-visually-hidden", id: "company-title" }, run.company.name),
        run.company.description ? h("p", { class: "company__desc" }, run.company.description) : null,
        h("dl", { class: "company__facts" },
          h("div", {}, h("dt", {}, t("s.start.sector")), h("dd", {}, run.sector ? sectorName(run.sector, lang) : t("s.live.sector.decide"))),
          run.company.country ? h("div", {}, h("dt", {}, t("s.live.country")), h("dd", {}, run.company.country)) : null),
        h("p", { class: "company__fiction" }, t("s.live.public")))
    ],
    bar: playsOn(t("s.live.started.cta"), ctx.handlers.next, ctx)
  };
}

const STEPS_VIEW = [start, complete, challenge, assess, strategise, summary];

/**
 * The story of a step. ctx: { run, scenario, lang, step, state: { selection, adopted }, figures: { before,
 * after }, preview, waits, play: { on, attention }, litIssue, open, nextCompany, handlers }.
 * Returns { title, lead, body, bar, wide }.
 */
export function storyFor(step, ctx) {
  if (ctx.live) {
    const state = ctx.live.stepState(step);
    if (state === "working") return waitStory(ctx);
    if (state === "stopped") return stopStory(ctx);
    if (state === "form") return liveStartStory(ctx);
    // A run stopped at its cap says so on every screen of it, not only where it stopped.
    const stop = ctx.live.snap?.stop;
    if (stop?.reason === "cap") {
      const story = STEPS_VIEW[step](ctx);
      return { ...story, body: [h("p", { class: "cap-note", role: "note" }, icon("warning"), " ", h("strong", {}, t("x.cap.title")), " ", t("x.cap.next")), ...story.body] };
    }
  }
  return STEPS_VIEW[step](ctx);
}


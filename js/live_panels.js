// The live run's own screens (PLAN.md 5.3 to 5.5): the Start form and its editable SWOT grid, the wait
// while an agent works, the stop and error screens, the person's check of the AI's items, the research
// notes and the Summary's "Save run as simulation". Everything else a live run shows is the simulation's
// own screen (js/panels.js), fed by the live recording. Every control that sends a request has the AI
// notice beside it, as Vici's rule asks.

import { t, tn } from "./i18n/index.js";
import { h, icon } from "./dom.js";
import { QUADRANTS, LIMITS, MODELS } from "./config.js";
import { SECTORS } from "../data/kpis.js";
import { SCENARIOS } from "../data/scenarios/index.js";
import { apiMessage } from "./api_messages.js";
import { euros } from "./format.js";
import { STEP } from "./simulation.js";

const LETTER = { strengths: "S", weaknesses: "W", opportunities: "O", threats: "T" };
const AGENT_OF_STEP = { [STEP.complete]: "complete", [STEP.challenge]: "challenge", [STEP.assess]: "assess", [STEP.strategise]: "strategise", [STEP.summary]: "summary" };

/** The lilac AI notice in Vici's fixed words. */
export const aiNotice = () => h("span", { class: "vc-tag vc-tag--feature ai-notice" }, icon("sparkle"), h("span", {}, t("p.ai")));

/** A step's one primary action. */
function cta(label, onClick, { attention = true, id = "btn-cta", disabled = false } = {}) {
  return h("button", { type: "button", class: ["vc-button", "cta", attention ? "vc-attention" : ""], id, disabled, on: { click: onClick } }, h("span", {}, label), icon("chevron-right"));
}

/** Vici's merlot "Your turn" callout with the AI notice beside the action that sends a request. */
export function yourTurnLive(title, sentence, action) {
  return h("div", { class: "vc-callout turn turn--live", role: "status" },
    h("span", { class: "vc-callout__cell", "aria-hidden": "true" }, icon("hand")),
    h("div", { class: "vc-callout__body" }, h("p", { class: "vc-callout__title" }, title), h("p", { class: "turn__text" }, sentence)),
    h("div", { class: "turn__act" }, action, aiNotice()));
}

/** "Run it live", with the AI notice, as the simulation's Start and Summary offer it. */
export function liveEntry(onClick, { sub = true } = {}) {
  return h("div", { class: "live-entry" },
    h("button", { type: "button", class: "vc-button vc-button--secondary live-entry__button", id: "btn-live", on: { click: onClick } }, icon("zap"), h("span", {}, t("p.live.run"))),
    aiNotice(),
    sub ? h("p", { class: "live-entry__sub" }, t("p.live.run.sub")) : null);
}

// ---- Start: the form --------------------------------------------------------------------------------

/** The Start panel of a live run: the notice, the company's fields, a fictional company to fill in. */
export function liveStartStory(ctx) {
  const { live } = ctx;
  const f = live.form;
  const a = live.formActions;
  const field = (id, key, input, hint) => h("div", { class: "vc-field live-field" }, h("label", { class: "vc-label", for: id }, t(key)), input, hint ? h("p", { class: "vc-help", id: `${id}-hint` }, hint) : null);
  const text = (id, field_, max, extra = {}) => h("input", { class: "vc-input", id, type: "text", maxlength: max, value: f.company[field_], autocomplete: "off", spellcheck: "true", ...extra, on: { input: (e) => a.company(field_, e.target.value) } });
  const nameError = live.nameError;
  return {
    title: t("s.live.title"),
    lead: t("s.live.lead"),
    body: [
      h("div", { class: "vc-alert vc-alert--warning live-public", role: "note" }, icon("warning"),
        h("div", {}, h("p", { class: "live-public__rule" }, t("s.live.public")), h("p", { class: "live-public__sends" }, t("s.live.sends")))),
      h("section", { class: "live-company", "aria-labelledby": "live-company-title" },
        h("h2", { class: "panel-h", id: "live-company-title" }, t("s.live.company")),
        h("div", { class: "live-company__grid" },
          h("div", { class: ["vc-field", "live-field", nameError ? "is-invalid" : ""] },
            h("label", { class: "vc-label", for: "live-name" }, t("s.live.name")),
            text("live-name", "name", LIMITS.companyName, { required: true, "aria-invalid": nameError ? "true" : undefined, "aria-describedby": nameError ? "live-name-error" : undefined }),
            nameError ? h("p", { class: "vc-help live-error", id: "live-name-error" }, t("s.live.name.missing")) : null),
          field("live-sector", "s.live.sector", h("select", { class: "vc-select", id: "live-sector", on: { change: (e) => a.company("sector", e.target.value) } },
            h("option", { value: "", selected: !f.company.sector }, t("s.live.sector.decide")),
            ...SECTORS.map((s) => h("option", { value: s.id, selected: f.company.sector === s.id }, s.name[ctx.lang])))),
          field("live-country", "s.live.country", text("live-country", "country", LIMITS.country)),
          h("div", { class: "vc-field live-field live-field--wide" },
            h("label", { class: "vc-label", for: "live-line" }, t("s.live.line")),
            text("live-line", "description", LIMITS.oneLine, { "aria-describedby": "live-line-hint" }),
            h("p", { class: "vc-help", id: "live-line-hint" }, t("s.live.line.hint"))))),
      h("div", { class: "live-fill" },
        h("label", { class: "vc-label", for: "live-fill" }, t("s.live.fill")),
        h("select", { class: "vc-select vc-select--sm", id: "live-fill", "aria-describedby": "live-fill-hint", on: { change: (e) => { a.fill(e.target.value); } } },
          h("option", { value: "", selected: true }, t("s.live.fill.pick")),
          ...SCENARIOS.map((s) => h("option", { value: s.id }, s.name))),
        h("p", { class: "vc-help", id: "live-fill-hint" }, t("s.live.fill.hint")))
    ],
    bar: yourTurnLive(t("p.your.turn"), t("s.live.turn"), cta(t("s.live.cta"), a.start))
  };
}

/** The SWOT grid as a form: each field's items as inputs, an "Add" field at its end, its question when empty. */
export function liveGridNodes(view) {
  const { live } = view;
  const a = live.formActions;
  const areas = QUADRANTS.map(({ id: q }) => {
    const items = live.form.items[q];
    const full = items.length >= LIMITS.itemsPerQuadrant;
    const add = full
      ? h("p", { class: "live-full" }, t("p.live.full"))
      : h("input", {
        class: "vc-input vc-input--sm live-add", id: `add-${q}`, type: "text", maxlength: LIMITS.itemText, autocomplete: "off",
        placeholder: t(`p.live.add.${q}`), "aria-label": t(`p.live.add.${q}`),
        on: {
          // The field is emptied before the item is added: adding redraws the grid, and the browser may
          // report the old field's blur as it goes, which must not add the item a second time.
          keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); const v = e.target.value; e.target.value = ""; a.add(q, v); } },
          blur: (e) => { const v = e.target.value; if (v.trim()) { e.target.value = ""; a.add(q, v); } }
        }
      });
    return h("section", { class: "vc-framework__area live-area", dataset: { quad: q }, "aria-labelledby": `q-${q}` },
      h("header", { class: "vc-framework__head" },
        h("h3", { class: "vc-framework__title", id: `q-${q}` }, h("span", { class: "vc-framework__letter", "aria-hidden": "true" }, LETTER[q]), t(`q.${q}`)),
        h("p", { class: "vc-framework__question" }, t(`q.${q}.question`))),
      items.length
        ? h("ul", { class: "vc-framework__items live-items" }, items.map((text, i) => h("li", { class: "live-item" },
          h("input", {
            class: "vc-input vc-input--sm live-item__input", id: `item-${q}-${i}`, type: "text", value: text, maxlength: LIMITS.itemText, autocomplete: "off",
            "aria-label": t(`p.live.item.${q}`, { n: i + 1 }),
            on: {
              input: (e) => { a.item(q, i, e.target.value); e.target.nextSibling?.setAttribute("aria-label", t("p.live.remove", { text: e.target.value })); },
              blur: () => a.tidy(q, i),
              keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById(`add-${q}`)?.focus(); } }
            }
          }),
          h("button", { type: "button", class: "vc-icon-button vc-icon-button--sm live-item__remove", "aria-label": t("p.live.remove", { text }), on: { click: () => a.remove(q, i) } }, icon("close")))))
        : h("p", { class: "vc-framework__empty" }, t("q.live.empty")),
      add);
  });
  const axes = [
    ["col", "helpful", "p.swot.helps"], ["col", "harmful", "p.swot.hurts"],
    ["row", "internal", "p.swot.inside", "p.swot.inside.short"], ["row", "external", "p.swot.outside", "p.swot.outside.short"]
  ].map(([kind, axis, key, short]) => h("span", { class: `swot-axis swot-axis--${kind}`, dataset: { axis }, "aria-hidden": "true" },
    short ? [h("span", { class: "axis-long" }, t(key)), h("span", { class: "axis-short" }, t(short))] : t(key)));
  return h("div", { class: "vc-framework vc-framework--compact swot swot--form", role: "group", "aria-labelledby": "swot-title", dataset: { step: 0 } }, axes, areas);
}

// ---- the wait ---------------------------------------------------------------------------------------

/** While an agent works: who, what, the seconds, the cost against the cap, Abort. */
export function waitStory(ctx) {
  const { live, lang } = ctx;
  const s = live.snap;
  const agent = s.step;
  const seconds = Math.max(0, Math.floor((Date.now() - s.stepStarted) / 1000));
  const notes = [];
  if (s.retry) notes.push(h("p", { class: "wait__note", id: "wait-retry" }, t("w.retry", { s: Math.max(1, Math.ceil((s.retry.at + s.retry.waitMs - Date.now()) / 1000)) })));
  if (s.lowered.includes(agent)) notes.push(h("p", { class: "wait__note" }, t("w.lowered")));
  const repairing = s.audit.length && s.audit[s.audit.length - 1].step === agent && s.audit[s.audit.length - 1].problems.length;
  if (repairing) notes.push(h("p", { class: "wait__note" }, t("w.repair")));
  return {
    title: t("w.title", { agent: t(`w.agent.${agent}`) }),
    lead: t(`w.doing.${agent}`),
    body: [
      h("div", { class: "wait", role: "status", "aria-live": "polite" },
        h("span", { class: "vc-spinner wait__spinner", "aria-hidden": "true" }),
        h("dl", { class: "wait__facts" },
          h("div", {}, h("dt", {}, t("w.waiting")), h("dd", { id: "wait-seconds" }, t("w.time", { s: seconds }))),
          h("div", {}, h("dt", {}, t("p.kpi.cost.label")), h("dd", { id: "wait-cost" }, t("w.cost", { spent: euros(s.spentEur, lang), cap: euros(s.capEur, lang, 2) })))),
        ...notes)
    ],
    bar: h("div", { class: "foot" },
      h("p", { class: "foot-note" }, t("w.abort.note")),
      h("button", { type: "button", class: "vc-button vc-button--secondary", id: "btn-abort", on: { click: live.abort } }, icon("stop"), t("w.abort")))
  };
}

// ---- stops and errors ---------------------------------------------------------------------------------

/** Where the run stopped: what happened, what is kept and the one next step. */
export function stopStory(ctx) {
  const { live, lang } = ctx;
  const stop = live.snap.stop;
  const agent = t(`w.agent.${stop.step}`);
  const back = h("button", { type: "button", class: "vc-button vc-button--secondary", id: "btn-sim-stop", on: { click: ctx.handlers.leaveLive } }, t("p.live.again.sim"));
  let title = t("x.error.title");
  let text = "";
  let next = "";
  let action = null;
  let details = null;
  switch (stop.reason) {
    case "cap":
      title = t("x.cap.title");
      text = t("x.cap.text", { agent: lowerFirst(agent, lang) });
      next = t("x.cap.next");
      break;
    case "long":
      title = t("x.long.title");
      text = t("x.long.text");
      next = t("x.long.next");
      action = cta(t("x.thorough"), () => live.again({ dialog: true, preset: "thorough" }), { attention: false });
      break;
    case "invalid":
      title = t("x.invalid.title");
      text = t("x.invalid.text", { agent });
      next = t("x.invalid.next");
      action = cta(t("x.thorough"), () => live.again({ dialog: true, preset: "thorough" }), { attention: false });
      details = stop.problems?.length ? h("details", { class: "stop__details" }, h("summary", {}, t("x.invalid.details")), h("ul", { lang: "en" }, stop.problems.slice(0, 8).map((p) => h("li", {}, p)))) : null;
      break;
    case "aborted":
      title = t("x.aborted.title");
      text = t("api.aborted");
      next = t("api.aborted.next");
      action = cta(t("x.again"), () => live.again(), { attention: false });
      break;
    case "requests":
      title = t("x.requests.title");
      text = t("x.requests.text");
      next = t("x.requests.next");
      break;
    default: {
      const m = apiMessage(stop.error || {});
      text = t(m.key, m.vars);
      next = t(m.next);
      const keyOrModel = [401, 403, 404].includes(stop.error?.status);
      action = cta(t(stop.error?.status === 401 ? "x.key" : "x.again"), () => live.again({ dialog: keyOrModel }), { attention: false });
      if (["api.credit", "api.spendLimit"].includes(m.key)) action = null;
    }
  }
  return {
    title,
    lead: t("x.where", { agent: lowerFirst(agent, lang) }),
    body: [
      h("div", { class: "vc-alert vc-alert--danger stop", role: "alert" }, icon("warning"),
        h("div", {}, h("p", { class: "stop__text" }, text), next ? h("p", { class: "stop__next" }, next) : null, h("p", { class: "stop__kept" }, t("x.done")))),
      details,
      h("p", { class: "stop__spent" }, t("w.cost", { spent: euros(live.snap.spentEur, lang), cap: euros(live.snap.capEur, lang, 2) }))
    ],
    bar: h("div", { class: "foot foot--end" }, back, action ? h("div", { class: "turn__act" }, action, aiNotice()) : null)
  };
}

const lowerFirst = (s, lang) => (lang === "en" ? s.replace(/^The /, "the ") : s.replace(/^(Der|Das|Die) /, (m) => m.toLowerCase()));

// ---- the check at Complete --------------------------------------------------------------------------

/** An AI item's check controls: Edit and Remove, or Undo once removed; Save and Cancel while edited. */
export function checkControls(item, ctx) {
  const { live } = ctx;
  const c = live.check;
  const act = live.checkActions;
  const text = c.edited.get(item.id) ?? item.text;
  if (c.removed.has(item.id)) {
    return h("p", { class: "check" },
      h("span", { class: "vc-tag vc-tag--sm check__removed" }, icon("minus"), t("s.check.removed")),
      h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm", id: `undo-${item.id}`, "aria-label": t("s.check.undo.label", { text }), on: { click: () => act.undo(item.id) } }, icon("refresh"), t("s.check.undo")));
  }
  if (c.editing === item.id) {
    const input = h("input", { class: "vc-input vc-input--sm", id: `edit-input-${item.id}`, type: "text", value: text, maxlength: LIMITS.itemText, "aria-label": t("s.check.label"), autocomplete: "off",
      on: { keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); act.save(item.id, e.target.value); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); act.cancel(item.id); } } } });
    return h("div", { class: "check check--edit" }, input,
      h("button", { type: "button", class: "vc-button vc-button--sm", on: { click: () => act.save(item.id, input.value) } }, t("s.check.save")),
      h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm", on: { click: () => act.cancel(item.id) } }, t("s.check.cancel")));
  }
  return h("p", { class: "check" },
    c.edited.has(item.id) ? h("span", { class: "check__edited" }, t("s.check.edited")) : null,
    h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm", id: `edit-${item.id}`, "aria-label": t("s.check.edit.label", { text }), on: { click: () => act.edit(item.id) } }, icon("edit"), t("s.check.edit")),
    h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm", id: `remove-${item.id}`, "aria-label": t("s.check.remove.label", { text }), on: { click: () => act.remove(item.id) } }, icon("trash"), t("s.check.remove")));
}

/** How many AI items the person keeps and removes. */
export function checkCount(ctx, total) {
  const removed = ctx.live.check.removed.size;
  return t("s.check.count", { kept: total - removed, removed });
}

// ---- research and the Summary -------------------------------------------------------------------------

/** What research found, at Challenge: nothing, switched off, every URL refused, or its sources. */
export function researchNote(ctx) {
  const s = ctx.live.snap;
  if (!s || !s.settings.research || !s.research) return null;
  const n = ctx.run.signals.length;
  const NOTE = { none: "r.none", off: "r.off", refused: "r.refused" };
  const text = s.research === "found" ? tn("r.found", n) : t(NOTE[s.research]);
  return h("p", { class: ["research-note", s.research === "found" ? "" : "research-note--empty"] }, icon(s.research === "found" ? "search" : "info"), " ", text);
}

/** Under the Summary of a live run: the unchecked note, and "Save run as simulation" as a quiet link. */
export function liveSummaryExtras(ctx) {
  const s = ctx.live.snap;
  return [
    s?.unchecked ? h("div", { class: "vc-alert vc-alert--warning unchecked", role: "note" }, icon("warning"), h("div", {}, h("p", {}, h("span", { class: "vc-tag vc-tag--sm vc-tag--warning" }, t("s.sum.unchecked")), " ", t("s.sum.unchecked.text")))) : null,
    h("p", { class: "live-done" }, t("s.sum.live.done")),
    h("p", { class: "save-run" },
      h("button", { type: "button", class: "vc-button vc-button--ghost vc-button--sm save-run__link", id: "btn-save-run", "aria-describedby": "save-run-hint", on: { click: ctx.live.saveRun } }, icon("download"), t("s.sum.save")),
      h("span", { class: "save-run__hint", id: "save-run-hint" }, t("s.sum.save.hint")))
  ];
}

/** The model a run used, as the cost tile names it. */
export const modelLabel = (id) => MODELS.find((m) => m.id === id)?.label || id;

export { AGENT_OF_STEP };

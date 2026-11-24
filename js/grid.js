// The SWOT grid on the left: the four fields of Vici's framework view (components/framework.html),
// internal above external, helpful on the left and harmful on the right, with the company's items in each.
// Every item carries its state with a mark and a word, never with colour alone (brief 6.1, AC-17):
// entered by the team (an ink hexagon, the word for screen readers), written by the AI ("AI"), added by
// the challenge ("Added"), challenged (the warning mark and the issue's type in words) and, once the
// person has adopted strategies, addressed ("Addressed", with the old and the new rating). An item opens
// on click and shows what it rests on. The grid shows what the step has reached: the team's items at
// Start, the Completer's from Complete, the challenge from Challenge, the factors from Assess, the
// addressed items in the Summary.

import { QUADRANTS } from "./config.js";
import { t } from "./i18n/index.js";
import { h, icon } from "./dom.js";
import { weight as fmtWeight } from "./format.js";
import { STEP, itemsAt, sourceOf, issuesOf, issueAdding, factorOf } from "./simulation.js";

const LETTER = { strengths: "S", weaknesses: "W", opportunities: "O", threats: "T" };
const MARK = { ai: "sparkle", added: "plus", challenged: "warning", addressed: "check" };

/** A translated sentence with nodes in its placeholders, such as a struck-through old rating. */
export function tNodes(key, parts) {
  const text = t(key);
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
    out.push(text.slice(last, m.index));
    out.push(Object.hasOwn(parts, m[1]) ? parts[m[1]] : m[0]);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out.filter((x) => x !== "");
}

/** What a step shows of one item: its source, its status and the words for both. */
export function itemState(run, item, { step, addressed }) {
  const source = sourceOf(item);
  const issues = step >= STEP.challenge ? issuesOf(run, item.id) : [];
  const fix = step >= STEP.summary && addressed ? addressed.get(item.id) || null : null;
  const status = fix ? "addressed" : issues.length ? "challenged" : "";
  const faults = [...new Set(issues.map((i) => i.type))];
  return { source, status, issues, faults, fix };
}

function itemNode(run, item, view) {
  const { lang, step } = view;
  const st = itemState(run, item, view);
  const mark = MARK[st.status] || MARK[st.source] || "";
  const words = [];
  if (st.source === "entered") words.push(h("span", { class: "vc-item__state vc-visually-hidden" }, t("p.item.entered")));
  else words.push(h("span", { class: "vc-tag vc-tag--sm vc-item__state vc-item__state--source" }, t(`p.item.${st.source}`)));
  if (st.status === "addressed") words.push(h("span", { class: "vc-tag vc-tag--sm vc-item__state vc-item__state--status" }, t("p.item.addressed")));
  else for (const type of st.faults) words.push(h("span", { class: "vc-tag vc-tag--sm vc-item__state vc-item__state--status" }, t(`p.type.${type}`)));

  const body = [];
  if (st.source === "entered") body.push(h("p", {}, t("p.item.by.team")));
  if (item.basis) body.push(h("p", { class: "ai-text" }, t("p.item.basis", { text: item.basis })));
  if (item.confidence) body.push(h("p", { class: "ai-text" }, t("p.item.confidence", { level: t(`p.conf.${item.confidence}`) })));
  if (st.source === "added") {
    const by = issueAdding(run, item.id);
    if (by) body.push(h("p", {}, t("p.item.added.by", { title: by.title })));
  }
  for (const issue of st.issues) body.push(h("p", { class: "item-issue" }, t("p.item.issue", { type: t(`p.type.${issue.type}`), title: issue.title })));
  const factor = step >= STEP.assess ? factorOf(run, item.id) : null;
  if (factor) body.push(h("p", { class: "ai-text" }, t("p.item.factor", { weight: fmtWeight(factor.weight, lang), rating: factor.rating, reason: factor.reason })));
  if (st.fix) {
    body.push(h("p", { class: "item-fix" }, tNodes("p.item.rated", {
      from: h("s", { class: "vc-item__was" }, String(st.fix.from)),
      to: String(st.fix.to),
      strategy: st.fix.strategy ? st.fix.strategy.title : ""
    })));
  }

  const details = h("details", {
    class: "vc-item",
    dataset: { source: st.source, status: st.status || undefined, id: item.id },
    open: view.open?.has(item.id) || undefined
  },
  h("summary", { class: "vc-item__summary" },
    h("span", { class: "vc-item__mark", "aria-hidden": "true" }, mark ? icon(mark) : null),
    h("span", { class: "vc-item__text" }, item.text),
    h("span", { class: "vc-item__states" }, words)),
  h("div", { class: "vc-item__body" }, body));
  if (view.lit?.has(item.id)) details.setAttribute("aria-current", "true");
  details.addEventListener("toggle", () => view.onToggle?.(item.id, details.open));
  return h("li", {}, details);
}

/**
 * The grid for a step. view: { run, step, lang, addressed (a map from js/simulation.js's addressed()),
 * open (ids of opened items), lit (ids a card points at), onToggle(id, open) }.
 */
export function gridNodes(view) {
  const { run, step } = view;
  const shown = itemsAt(run, step);
  const areas = QUADRANTS.map(({ id: q }) => {
    const items = shown.filter((it) => it.quadrant === q);
    return h("section", { class: "vc-framework__area", dataset: { quad: q }, "aria-labelledby": `q-${q}` },
      h("header", { class: "vc-framework__head" },
        h("h3", { class: "vc-framework__title", id: `q-${q}` }, h("span", { class: "vc-framework__letter", "aria-hidden": "true" }, LETTER[q]), t(`q.${q}`)),
        h("p", { class: "vc-framework__question" }, t(`q.${q}.question`))),
      items.length
        ? h("ul", { class: "vc-framework__items" }, items.map((it) => itemNode(run, it, view)))
        : h("p", { class: "vc-framework__empty" }, t("p.empty")),
      step === STEP.start ? h("p", { class: "quad-fault" }, t(`q.${q}.fault`)) : null);
  });
  // The row labels carry a short form too, for the side of the grid on a laptop screen.
  const axes = [
    ["col", "helpful", "p.swot.helps"], ["col", "harmful", "p.swot.hurts"],
    ["row", "internal", "p.swot.inside", "p.swot.inside.short"], ["row", "external", "p.swot.outside", "p.swot.outside.short"]
  ].map(([kind, axis, key, short]) => h("span", { class: `swot-axis swot-axis--${kind}`, dataset: { axis }, "aria-hidden": "true" },
    short ? [h("span", { class: "axis-long" }, t(key)), h("span", { class: "axis-short" }, t(short))] : t(key)));
  return h("div", { class: "vc-framework vc-framework--compact swot", role: "group", "aria-labelledby": "swot-title", dataset: { step } }, axes, areas);
}

/** The legend: the marks the grid shows at this step, each with its word. */
export function legendNodes(view) {
  const { run, step } = view;
  const marks = new Set(["entered"]);
  for (const it of itemsAt(run, step)) {
    const st = itemState(run, it, view);
    marks.add(st.source);
    if (st.status) marks.add(st.status);
  }
  const order = ["entered", "ai", "added", "challenged", "addressed"].filter((m) => marks.has(m));
  return h("ul", { class: "vc-framework__legend", "aria-label": t("p.legend") }, order.map((m) =>
    h("li", { dataset: { mark: m } }, h("span", { class: "vc-item__mark", "aria-hidden": "true" }, MARK[m] ? icon(MARK[m]) : null), t(`p.legend.${m}`))));
}

/** Points at items from a card elsewhere: aria-current on each, none when ids is empty. */
export function lightItems(root, ids) {
  for (const el of root.querySelectorAll(".vc-item[data-id]")) {
    if (ids.has(el.dataset.id)) el.setAttribute("aria-current", "true");
    else el.removeAttribute("aria-current");
  }
}

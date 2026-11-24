// The four key figures top right (brief 1.2). They answer first: a scenario shows its figures before it
// plays, because its run is recorded and the engine computes them at once. The decision moves three of
// them: At stake a year shows what is left, with the old value struck through and the upside in the note;
// Items challenged counts in its note the items the chosen strategies address; Response to the market
// shows the new score beside the old. Session cost is the estimate of the same run done live. Every value
// comes from the engine (js/engine.js, through js/simulation.js) and js/estimate.js.

import { t, tn } from "./i18n/index.js";
import { h, fill } from "./dom.js";
import { money, score, sessionCost } from "./format.js";
import { MODELS } from "./config.js";

const TILES = ["stake", "items", "efe", "cost"];

/** The tiles' elements, found once. */
export function createTiles(root = document) {
  const tiles = Object.fromEntries(TILES.map((id) => {
    const el = root.getElementById ? root.getElementById(`kpi-${id}`) : root.querySelector(`#kpi-${id}`);
    return [id, { el, value: el.querySelector(".kpi-value"), note: el.querySelector(".kpi-note") }];
  }));
  return { render: (model) => renderTiles(tiles, model) };
}

/** A value with what it was, struck through, when the decision moved it. */
function valueNodes(main, was, unit) {
  const out = [];
  if (was && was !== main) {
    out.push(h("s", { class: "vc-stat__was" }, h("span", { "aria-hidden": "true" }, was), h("span", { class: "vc-visually-hidden" }, t("p.was", { value: was }))));
  }
  out.push(h("span", { class: "kpi-main" }, main));
  if (unit) out.push(h("span", { class: "vc-stat__unit" }, unit));
  return out;
}

function set(tile, { main, was = "", unit = "", note, state = "value" }) {
  const before = tile.value.querySelector(".kpi-main")?.textContent;
  fill(tile.value, valueNodes(main, was, unit));
  tile.value.dataset.state = state;
  if (tile.note.textContent !== note) tile.note.textContent = note;
  // A value that changes turns over once, so the room sees it move.
  if (before && before !== main && state === "value") {
    tile.value.classList.remove("flip");
    void tile.value.offsetWidth;
    tile.value.classList.add("flip");
  }
}

/**
 * model: { lang, loading, figures: { before, after }, decided, addressedCount, estimate }. Before a
 * scenario has loaded, every tile shows "…" and what it waits for.
 */
export function renderTiles(tiles, model) {
  const { lang } = model;
  if (model.loading || !model.figures) {
    for (const id of TILES) set(tiles[id], { main: t("p.kpi.waiting"), note: t("p.kpi.loading"), state: "waiting" });
    return;
  }
  const { before, after } = model.figures;
  const decided = !!model.decided;
  const stake = before.stake;
  const partial = stake.priced < stake.of;
  const on = partial ? t("p.kpi.stake.on", { priced: stake.priced, of: stake.of }) : "";
  if (!decided) {
    set(tiles.stake, { main: money(stake.value, lang), unit: on, note: t("p.kpi.stake.note") });
  } else {
    const note = after.upside > 0 ? t("p.kpi.stake.after.upside", { upside: money(after.upside, lang) }) : t("p.kpi.stake.after");
    set(tiles.stake, { main: money(after.left, lang), was: money(stake.value, lang), unit: on, note });
  }

  const items = before.items;
  set(tiles.items, {
    main: t("p.kpi.items.value", { n: items.challenged, total: items.total }),
    note: decided ? tn("p.kpi.items.addressed", model.addressedCount) : tn("p.kpi.items.added", items.added)
  });

  const efeBefore = score(before.efe.before.value, lang);
  set(tiles.efe, {
    main: decided ? score(after.efe.after.value, lang) : efeBefore,
    was: decided ? efeBefore : "",
    note: t("p.kpi.efe.note")
  });

  const model0 = MODELS.find((m) => m.id === model.estimate.model);
  set(tiles.cost, { main: sessionCost(model.estimate.eur, lang), note: t("p.kpi.cost.note.sim", { model: model0 ? model0.label : model.estimate.model }) });
}

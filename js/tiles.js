// The four key figures top right (brief 1.2). They answer first: a scenario shows its figures before it
// plays, because its run is recorded and the engine computes them at once. The decision moves three of
// them: At stake a year shows what is left, with the old value struck through and the upside in the note;
// Items challenged counts in its note the items the chosen strategies address; Response to the market
// shows the new score beside the old. Session cost is the estimate of the same run done live. Every value
// comes from the engine (js/engine.js, through js/simulation.js) and js/estimate.js.

import { t, tn } from "./i18n/index.js";
import { h, fill } from "./dom.js";
import { money, score, sessionCost, euros } from "./format.js";
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
  if (unit === RESERVE) out.push(h("span", { class: "vc-stat__unit kpi-reserve", "aria-hidden": "true" }, "\u00a0"));
  else if (unit) out.push(h("span", { class: "vc-stat__unit" }, unit));
  return out;
}

/** A unit line kept free while At stake waits, so the header keeps the height it has with a figure. */
const RESERVE = Symbol("reserve");

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
  if (model.live) { renderLive(tiles, model); return; }
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

/**
 * A live run's tiles: each waits, with "…" and the agent it waits for, until that agent has answered;
 * Session cost counts what the API reports against the cap. model.live: { figures (or null before the
 * Analyst), issues (the Red team has answered), items, spentEur, capEur, model, decided, addressedCount }.
 */
function renderLive(tiles, model) {
  const { lang } = model;
  const L = model.live;
  const wait = (tile, key) => set(tile, { main: t("p.kpi.waiting"), note: t(key), state: "waiting" });
  if (L.figures) {
    const { before, after } = L.figures;
    const stake = before.stake;
    const on = stake.priced < stake.of ? t("p.kpi.stake.on", { priced: stake.priced, of: stake.of }) : "";
    if (L.decided) set(tiles.stake, { main: money(after.left, lang), was: money(stake.value, lang), unit: on, note: after.upside > 0 ? t("p.kpi.stake.after.upside", { upside: money(after.upside, lang) }) : t("p.kpi.stake.after") });
    else set(tiles.stake, { main: money(stake.value, lang), unit: on, note: t("p.kpi.stake.note") });
    const efeBefore = score(before.efe.before.value, lang);
    set(tiles.efe, { main: L.decided ? score(after.efe.after.value, lang) : efeBefore, was: L.decided ? efeBefore : "", note: t("p.kpi.efe.note") });
  } else {
    set(tiles.stake, { main: t("p.kpi.waiting"), unit: RESERVE, note: t("p.kpi.wait.analyst"), state: "waiting" });
    wait(tiles.efe, "p.kpi.wait.analyst");
  }
  if (L.issues) set(tiles.items, { main: t("p.kpi.items.value", { n: L.items.challenged, total: L.items.total }), note: L.decided ? tn("p.kpi.items.addressed", L.addressedCount) : tn("p.kpi.items.added", L.items.added) });
  else wait(tiles.items, "p.kpi.wait.red");
  const label = MODELS.find((m) => m.id === L.model)?.label || "";
  if (L.capEur === null) set(tiles.cost, { main: euros(0, lang, 2), note: t("p.kpi.cost.before") });
  else set(tiles.cost, { main: euros(L.spentEur, lang), note: L.done ? t("p.kpi.cost.live.done", { model: label }) : t("p.kpi.cost.live", { cap: euros(L.capEur, lang, 2) }) });
}


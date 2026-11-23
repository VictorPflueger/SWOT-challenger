// The presenter (Vici's "Presenting step by step", after the Data Quality Agent 2.2.0): the step bar with
// Play, Back, six steps and Next; the SWOT grid on the left; the step's story on the right with the bar
// that holds its one primary action; and the four key figures, which answer first. A scenario's run is
// recorded, so every step shows at once and every figure is known from the first screen. Play walks the
// steps, each for as long as its title and lead take to read (7 to 14 seconds), holds while a dialog is
// open and stops where the person acts: Start the agents, Challenge this SWOT and the decision. Space
// plays or pauses; a step chosen by click, arrow key, clicker (PageDown, PageUp) or address pauses Play.
// The address follows the presenter (?scenario=s2&step=4), and a link to a later step plays the run up to
// it, along the agents' recorded choice. Nothing is stored: the run lives in this tab's memory only.

import { getLang, setLang, onLang, t } from "./i18n/index.js";
import { SCENARIOS } from "../data/scenarios/index.js";
import { STEP, LAST_STEP, scenarioIdFrom, loadScenario, createRun, addressed, sameChoice } from "./simulation.js";
import { figuresFor, factsFor } from "./scenario.js";
import { createTiles } from "./tiles.js";
import { gridNodes, legendNodes } from "./grid.js";
import { storyFor } from "./panels.js";
import { estimateRun } from "./estimate.js";
import { renderMethod } from "./method.js";
import { h, fill, wordCount } from "./dom.js";
import { money, score, zoneName, sessionCost } from "./format.js";
import { APP } from "./config.js";

const STEP_KEYS = ["start", "complete", "challenge", "assess", "strategise", "summary"];
const PLAY_KEYS = Object.freeze({ play: "p.play", pause: "p.pause", replay: "p.replay" });
/** A scenario older than this asks to be checked against its sources (PLAN.md, 5.5). */
const STALE_DAYS = 90;
/** Paused, the step's action draws the eye after this long without a click, a key or a scroll. */
const QUIET_MS = 6000;

/** Starts the page: the language switch, the step bar, the first scenario and Play. */
export async function start() {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const els = {
    workspace: $("main"), grid: $("grid"), legend: $("legend"), swotTitle: $("swot-title"),
    title: $("step-title"), lead: $("step-lead"), body: $("step-body"), bar: $("step-bar"), scroll: $("story-scroll"),
    steps: $("steps"), back: $("btn-back"), next: $("btn-next"), play: $("btn-play"), playText: $("play-text"),
    picker: $("scenario"), announce: $("announce"), method: $("method"), updates: $("updates")
  };
  const tiles = createTiles(document);

  const state = {
    id: scenarioIdFrom(params.get("scenario")),
    run: null,
    step: 0,
    started: false,
    challenged: false,
    selection: new Set(),
    adopted: null,
    reached: 0,
    litIssue: null,
    open: new Set(),
    attention: false,
    estimates: new Map()
  };
  /** Play: on, the frame it asked for, the time spent reading the step, the step it timed, the last frame. */
  const P = { on: false, raf: 0, at: 0, step: -1, last: 0 };

  // ---- language ---------------------------------------------------------------------------------------
  for (const button of document.querySelectorAll(".lang-option")) button.addEventListener("click", () => setLang(button.dataset.lang));
  onLang(() => { showLanguage(getLang()); render(); renderMethodNow(); });
  showLanguage(getLang());

  // ---- the scenario picker ----------------------------------------------------------------------------
  fill(els.picker, SCENARIOS.map((s) => h("option", { value: s.id }, s.name)));
  els.picker.value = state.id;
  els.picker.addEventListener("change", () => openScenario(els.picker.value, 0));

  // ---- the step bar -----------------------------------------------------------------------------------
  const stepButtons = STEP_KEYS.map((key, n) => {
    const hint = h("span", { class: "vc-step__hint" });
    const label = h("span", { class: "vc-step__name" });
    const b = h("button", { type: "button", class: "vc-step__button", dataset: { step: n }, on: { click: () => go(n) } },
      h("span", { class: "vc-step__marker", "aria-hidden": "true" }, String(n)),
      h("span", { class: "vc-step__label" }, label, hint));
    const li = h("li", { class: "vc-step", dataset: { step: key } }, b);
    els.steps.append(li);
    return { li, b, hint, label, key };
  });

  const decided = () => !!state.adopted && sameChoice(state.adopted, [...state.selection]);
  /** The furthest step the run has reached: Start before the agents run, Summary after the decision. */
  const maxStep = () => (!state.started ? STEP.start : decided() ? LAST_STEP : STEP.strategise);
  /** The step waits for the person: the start, the challenge, the decision. */
  function waits() {
    if (state.step === STEP.start && !state.started) return true;
    if (state.step === STEP.complete && !state.challenged) return true;
    if (state.step === STEP.strategise && !decided()) return true;
    return false;
  }
  /** The story is over: the Summary is on screen and nothing is left to do. */
  const finished = () => state.step === LAST_STEP && decided();
  /** A dialog covers the page: Play holds its time until it closes. */
  const covered = () => !!document.querySelector("dialog[open]");

  function renderStepBar() {
    const max = maxStep();
    stepButtons.forEach(({ li, b, hint, label, key }, n) => {
      const current = n === state.step;
      li.classList.toggle("vc-step--current", current);
      li.classList.toggle("vc-step--done", n < state.step && n <= max);
      if (current) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.disabled = n > max;
      label.textContent = t(`p.step.${key}`);
      let turn = "";
      if (n === STEP.start && !state.started) turn = t("p.your.turn");
      if (n === STEP.complete && state.started && !state.challenged) turn = t("p.your.turn");
      if (n === STEP.strategise && state.reached >= STEP.strategise && !decided()) turn = t("p.your.decision");
      li.dataset.turn = turn ? "yours" : "";
      hint.textContent = turn;
      b.title = b.disabled ? t("p.step.locked") : "";
    });
    els.back.disabled = state.step === 0;
    const open = state.step === STEP.strategise && !decided();
    els.next.disabled = state.step >= LAST_STEP || open;
    els.next.title = open ? t("p.decide.first") : "";
    drawPlay();
  }

  // ---- rendering --------------------------------------------------------------------------------------
  function runIn(lang = getLang()) {
    return state.run.byLang[lang];
  }
  function estimate() {
    const key = `${state.id}:${getLang()}`;
    if (!state.estimates.has(key)) state.estimates.set(key, estimateRun(state.run.scenario, getLang()));
    return state.estimates.get(key);
  }

  const handlers = {
    start: () => { state.started = true; go(STEP.complete, { keep: true }); play(); },
    challenge: () => { state.challenged = true; go(STEP.challenge, { keep: true }); },
    next: () => go(state.step + 1, { keep: true }),
    adopt: () => {
      state.adopted = [...state.selection];
      calm();
      render();
      announce(els.title.textContent);
      els.title.focus({ preventScroll: true });
    },
    toggle: (id, on) => {
      if (on) state.selection.add(id); else state.selection.delete(id);
      render();
    },
    lightIssue: (id) => { state.litIssue = state.litIssue === id ? null : id; render(); },
    replay: () => replay(),
    nextCompany: () => {
      const i = SCENARIOS.findIndex((s) => s.id === state.id);
      openScenario(SCENARIOS[(i + 1) % SCENARIOS.length].id, 0);
    }
  };

  function render() {
    if (!state.run) return;
    const lang = getLang();
    const run = runIn(lang);
    renderStepBar();
    els.workspace.dataset.step = STEP_KEYS[state.step];

    // The grid shows the story at this step; the items a lit issue names are pointed at.
    const fixed = state.adopted ? addressed(run, state.adopted) : new Map();
    const lit = new Set();
    if (state.litIssue) {
      const issue = run.issues.find((i) => i.id === state.litIssue);
      if (issue) for (const id of [...issue.items, ...issue.added]) lit.add(id);
    }
    const view = { run, step: state.step, lang, addressed: fixed, open: state.open, lit, onToggle: (id, isOpen) => (isOpen ? state.open.add(id) : state.open.delete(id)) };
    els.swotTitle.textContent = t("p.swot.title", { company: run.company.name });
    fill(els.grid, gridNodes(view));
    fill(els.legend, legendNodes(view));

    // The story: keep the focus on the control that had it, by its id.
    const active = document.activeElement;
    const focusId = active && els.body.contains(active) && active.id ? active.id : active && els.bar.contains(active) && active.id ? active.id : null;
    const figures = { before: figuresFor(run, []), after: figuresFor(run, state.adopted || []) };
    const ctx = {
      run, lang, scenario: state.run.scenario, step: state.step, state,
      figures, preview: figuresFor(run, [...state.selection]),
      waits: waits(), play: { on: P.on, attention: state.attention }, litIssue: state.litIssue, open: state.open,
      nextCompany: SCENARIOS[(SCENARIOS.findIndex((s) => s.id === state.id) + 1) % SCENARIOS.length].name,
      handlers
    };
    const story = storyFor(state.step, ctx);
    if (els.title.textContent !== story.title) els.title.textContent = story.title;
    els.lead.textContent = story.lead;
    fill(els.body, story.body);
    fill(els.bar, story.bar);
    els.workspace.dataset.wide = story.wide ? "true" : "false";
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });

    tiles.render({ lang, loading: false, figures: { before: figures.before, after: figures.after }, decided: !!state.adopted, addressedCount: fixed.size, estimate: estimate() });
    fillPlay(P.on && !waits() ? P.at / readMs() : 0);
    drawFoot();
    renderUpdates();
  }

  // ---- Play -------------------------------------------------------------------------------------------
  /** How long Play stays on a step: the time to read its title and lead, between 7 and 14 seconds. */
  function readMs() {
    const words = wordCount(`${els.title.textContent} ${els.lead.textContent}`);
    return Math.min(14000, Math.max(7000, 3000 + 230 * words));
  }

  function play() {
    if (!state.run) return;
    // On the first screen Play starts the agents, as Start does. Replay: the run again from the start.
    if (finished()) { replay(); return; }
    if (state.step === STEP.start && !state.started) { state.started = true; go(STEP.complete, { keep: true, focus: false }); }
    P.on = true;
    P.last = 0;
    calm();
    render();
    if (!P.raf) P.raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (!P.on) return;
    P.on = false;
    cancelAnimationFrame(P.raf);
    P.raf = 0;
    render();
    armAttention();
  }

  function frame(now) {
    P.raf = 0;
    if (!P.on) return;
    // Time away from the tab, or a slow frame, does not count.
    const dt = P.last ? Math.min(now - P.last, 100) : 0;
    P.last = now;
    if (P.step !== state.step) Object.assign(P, { step: state.step, at: 0 });
    const total = readMs();
    if (waits()) {
      // The person's turn: Play waits; once they have acted, the step's new words get their reading time.
      P.at = 0;
    } else if (finished()) {
      fillPlay(0);
      P.on = false;
      render();
      return;
    } else if (state.step < maxStep() && !covered()) {
      P.at += dt;
      if (P.at >= total) {
        go(state.step + 1, { focus: false, keep: true });
        P.raf = requestAnimationFrame(frame);
        return;
      }
    }
    fillPlay(waits() ? 0 : P.at / total);
    drawFoot(total);
    P.raf = requestAnimationFrame(frame);
  }

  /** How far the step is read: the rail to the next step and the bar along the step's action fill with it. */
  function fillPlay(p) {
    const v = Math.max(0, Math.min(1, p)).toFixed(4);
    stepButtons.forEach(({ li }, n) => li.style.setProperty("--vc-step-fill", n === state.step ? v : "0"));
    document.getElementById("btn-cta")?.style.setProperty("--fill", v);
  }

  /** Play, Pause or Replay on the one button before the steps. */
  function drawPlay() {
    const st = P.on ? "pause" : finished() ? "replay" : "play";
    els.play.dataset.state = st;
    els.play.querySelector(".vc-icon").className = `vc-icon vc-icon--${st === "pause" ? "pause" : st === "replay" ? "refresh" : "play"}`;
    els.playText.textContent = t(PLAY_KEYS[st]);
  }

  /** Beside the step's action, in words: when Play moves on, or that the move is the person's. */
  function drawFoot(total = readMs()) {
    const note = document.getElementById("foot-note");
    if (!note) return;
    const words = P.on ? (state.step < maxStep() && !waits() ? t("p.plays.on", { s: Math.max(1, Math.ceil((total - P.at) / 1000)) }) : "") : t("p.your.move");
    if (note.textContent !== words) note.textContent = words;
    note.dataset.tone = P.on ? "" : "move";
  }

  // Paused, the step's action draws the eye (Vici's vc-attention) after a few quiet seconds; a click, a
  // key or a scroll calms it. Where the page waits for the person, the action carries it from the start.
  let quiet = 0;
  function calm() {
    state.attention = false;
    const cta = document.getElementById("btn-cta");
    if (cta && !waits()) cta.classList.remove("vc-attention");
  }
  function armAttention() {
    clearTimeout(quiet);
    calm();
    quiet = setTimeout(() => {
      const cta = document.getElementById("btn-cta");
      if (P.on || !cta || cta.disabled || covered()) return;
      state.attention = true;
      cta.classList.add("vc-attention");
    }, QUIET_MS);
  }
  for (const type of ["pointerdown", "keydown", "wheel"]) document.addEventListener(type, () => { if (!P.on) armAttention(); }, { capture: true, passive: true });
  els.play.addEventListener("click", () => (P.on ? pause() : play()));

  // ---- navigation -------------------------------------------------------------------------------------
  /** Shows step n. A step chosen by the presenter pauses Play; keep: the story's own actions and Play go on. */
  function go(n, { focus = true, keep = false } = {}) {
    if (!state.run) return;
    if (!keep) pause();
    // A later step chosen before the agents ran starts them; Complete's challenge counts as done.
    if (n > STEP.start) state.started = true;
    if (n > STEP.complete) state.challenged = true;
    const target = Math.max(0, Math.min(maxStep(), n));
    state.step = target;
    state.reached = Math.max(state.reached, target);
    if (P.step !== state.step) Object.assign(P, { step: state.step, at: 0 });
    state.litIssue = null;
    syncUrl();
    render();
    els.scroll.scrollTop = 0;
    announce(t("p.step.announce", { n: state.step, title: els.title.textContent }));
    if (!P.on) armAttention();
    if (focus) els.title.focus({ preventScroll: true });
  }
  /**
   * One step on. Where Next is off, nothing moves, and at the open decision a reader is told to decide
   * first. Next (keep) does what the step's own action does: at Start it starts the agents and Play, at
   * Complete it challenges the SWOT, and Play goes on. A key moves one step and pauses Play, so a
   * presenter with a clicker keeps the pace.
   */
  function forward({ keep }) {
    if (els.next.disabled) {
      if (state.step === STEP.strategise) announce(t("p.decide.first"));
      return;
    }
    if (keep && state.step === STEP.start && !state.started) { handlers.start(); return; }
    if (keep && state.step === STEP.complete && !state.challenged) { handlers.challenge(); return; }
    go(state.step + 1, { keep });
  }
  function backward() {
    if (!els.back.disabled) go(state.step - 1);
  }
  els.back.addEventListener("click", backward);
  els.next.addEventListener("click", () => forward({ keep: true }));
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (covered()) return;
    const target = e.target;
    if (target?.closest?.("input, textarea, select, [contenteditable]")) return;
    // Space plays or pauses, unless it presses the control that has the focus.
    if (e.key === " ") {
      if (target?.closest?.("button, a, summary, label, [role=button]")) return;
      e.preventDefault();
      if (!e.repeat) (P.on ? pause() : play());
      return;
    }
    // A presentation clicker sends the arrow keys or PageDown and PageUp: one step on or back, paused.
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); forward({ keep: false }); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); backward(); }
  });

  function syncUrl() {
    const u = new URL(location.href);
    u.searchParams.set("scenario", state.id);
    if (state.step > 0) u.searchParams.set("step", String(state.step)); else u.searchParams.delete("step");
    history.replaceState(null, "", u);
  }

  function announce(text) {
    els.announce.textContent = text;
  }

  // ---- runs -------------------------------------------------------------------------------------------
  /** Opens a scenario at a step; a later step plays the run up to it along the agents' recorded choice. */
  async function openScenario(id, step = 0) {
    pause();
    state.id = scenarioIdFrom(id);
    els.picker.value = state.id;
    state.run = createRun(await loadScenario(state.id));
    resetRun();
    if (step >= STEP.complete) state.started = true;
    if (step >= STEP.challenge) state.challenged = true;
    if (step >= LAST_STEP) {
      state.adopted = [...state.run.recorded];
      state.selection = new Set(state.run.recorded);
    }
    state.step = Math.max(0, Math.min(maxStep(), step));
    state.reached = state.step;
    renderMethodNow();
    syncUrl();
    render();
    els.scroll.scrollTop = 0;
  }

  function resetRun() {
    state.started = false;
    state.challenged = false;
    state.adopted = null;
    state.reached = 0;
    state.selection = new Set(state.run.recommended);
    state.litIssue = null;
    state.open.clear();
    state.step = 0;
    P.at = 0;
  }

  function replay() {
    pause();
    resetRun();
    syncUrl();
    render();
    play();
  }

  function renderMethodNow() {
    if (state.run && els.method) renderMethod(els.method, { sector: state.run.scenario.company.sector, lang: getLang() });
  }

  /** "Check for updates" beside SIMULATION once a scenario's facts are older than 90 days. */
  function renderUpdates() {
    if (!els.updates) return;
    const days = (Date.now() - Date.parse(`${state.run.scenario.as_of}T00:00:00Z`)) / 86400000;
    els.updates.hidden = !(days > STALE_DAYS);
  }

  // The guide's Start, on a guide opened during a run, plays on from where the page is.
  for (const g of document.querySelectorAll("dialog[data-vc-guide]")) {
    g.addEventListener("vc:guideclose", (e) => { if (e.detail?.returnValue === "done" && state.started && !finished()) play(); });
  }

  // ---- start ------------------------------------------------------------------------------------------
  tiles.render({ lang: getLang(), loading: true });
  const asked = Number(params.get("step"));
  await openScenario(state.id, Number.isInteger(asked) && asked > 0 && asked <= LAST_STEP ? asked : 0);
  await fillGuideFigures();
  window.__swot = { version: APP.version, state: () => ({ id: state.id, step: state.step, started: state.started, challenged: state.challenged, adopted: state.adopted, selection: [...state.selection], playing: P.on }) };
}

/**
 * The talk track quotes the figures on screen (Vici's guide rules): each data-fig span in the presenting
 * chapter is filled from the run its script walks through, Arvento Drives (S2) along the agents' recorded
 * choice, through the same engine as the tiles, in its guide's language.
 */
async function fillGuideFigures() {
  const run = createRun(await loadScenario("s2"));
  for (const lang of ["en", "de"]) {
    const guide = document.getElementById(`guide-${lang}`);
    if (!guide) continue;
    const r = run.byLang[lang];
    const before = figuresFor(r, []);
    const after = figuresFor(r, run.recorded);
    const facts = factsFor(r, run.recorded, lang, zoneName);
    const values = {
      company: r.company.name,
      stake: before.stake.priced < before.stake.of ? t("p.fig.stake.part", { stake: money(before.stake.value, lang), priced: before.stake.priced, of: before.stake.of }, lang) : money(before.stake.value, lang),
      challenged: t("p.kpi.items.value", { n: before.items.challenged, total: before.items.total }, lang),
      added: String(before.items.added),
      "efe.before": score(before.efe.before.value, lang),
      "efe.after": score(after.efe.after.value, lang),
      left: facts.left,
      cost: sessionCost(estimateRun(run.scenario, lang).eur, lang)
    };
    for (const span of guide.querySelectorAll("[data-fig]")) {
      const v = values[span.dataset.fig];
      if (v !== undefined) span.textContent = v;
    }
  }
}

/**
 * Marks the active language in the switch and shows the How it works button of that language's guide.
 * The other guide stays in the page, closed, for a switch back.
 */
function showLanguage(lang) {
  for (const button of document.querySelectorAll(".lang-option")) button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  for (const l of ["en", "de"]) {
    const opener = document.querySelector(`[data-vc-guide-open="guide-${l}"]`);
    if (opener) opener.hidden = l !== lang;
    const guide = document.getElementById(`guide-${l}`);
    if (guide && l !== lang && guide.open) guide.close();
  }
}


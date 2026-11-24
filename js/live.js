// The live run on the page (PLAN.md 5.4, brief 5): the Start form, the live-run dialog, the run itself and
// "Save run as simulation". "Run it live" switches the presenter to LIVE and opens Start as a form: the
// SWOT grid made editable under the public-information notice, with the company's fields in the panel.
// "Start the agents" opens Vici's live-run dialog: the key, the setting, research, Advanced, the cap, the
// acknowledgement (unticked at every opening), the private-data warning, the estimate and the start
// button with the AI notice. The key is checked with the free model list first and then held in
// js/keystore.js only; the input is emptied, so the key is in no element of the page. The run lives in
// this module's memory: back to the simulation keeps it, Clear everything drops it with the key, and
// closing or reloading the tab ends it, with the browser's warning while a result has not been saved.

import { t, getLang } from "./i18n/index.js";
import { h } from "./dom.js";
import { QUADRANTS, LIMITS, BUDGET, MODELS, DEFAULT_PRESET, FX_USD_EUR } from "./config.js";
import { SECTORS } from "../data/kpis.js";
import { SCENARIOS } from "../data/scenarios/index.js";
import { loadScenario, STEP } from "./simulation.js";
import { assemble, recommended } from "./scenario.js";
import { getKey, hasKey, setKey, forgetKey, looksLikeKey, maskKey, redactSecrets } from "./keystore.js";
import { checkKey } from "./anthropic.js";
import { apiMessage } from "./api_messages.js";
import { privacyFindings, privateKinds } from "./privacy.js";
import { checkWarning } from "./live_panels.js";
import { newRecording, createLiveRun, resolveSettings } from "./pipeline.js";
import { estimateLive, researchUsage } from "./estimate.js";
import { usageCostUsd } from "./cost.js";
import { euros, duration, countryName, zoneName } from "./format.js";

/** The presenter step each agent's work shows on. */
export const STEP_OF = Object.freeze({ complete: STEP.complete, research: STEP.challenge, challenge: STEP.challenge, assess: STEP.assess, strategise: STEP.strategise, summary: STEP.summary });
const emptyItems = () => Object.fromEntries(QUADRANTS.map(({ id }) => [id, []]));
const emptyForm = () => ({ company: { name: "", sector: "", country: "", description: "" }, items: emptyItems() });
// The person's check of the AI's items: removed ids, edited texts, the item being edited, and what in an
// edit looks private (id to kinds, as js/privacy.js names them).
const emptyCheck = () => ({ removed: new Set(), edited: new Map(), editing: null, flags: new Map(), kept: null });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The live mode. presenter: { render(), go(step, opts), announce(text), enter(), leave() } from js/app.js.
 * Returns the live mode's state for the presenter and its actions.
 */
export function createLive(presenter) {
  const L = {
    active: false,
    form: emptyForm(),
    nameError: false,
    // The fictional company chosen in the picker, and the one last filled in.
    fill: { choice: "", done: "" },
    run: null,
    snap: null,
    check: emptyCheck(),
    lastRun: null,
    saved: true,
    resume: false
  };
  let ticker = 0;
  const $ = (id) => document.getElementById(id);

  // ---- the run --------------------------------------------------------------------------------------
  function onRunEvent(e) {
    L.snap = L.run.snapshot();
    if (e.type === "done") L.lastRun = { eur: L.snap.spentEur, seconds: Math.round((L.snap.finishedAt - L.snap.startedAt) / 1000) };
    if (e.type === "decide") presenter.decide(recommended(view()));
    if (["answer", "check", "decide", "done", "stopped", "rechosen"].includes(e.type)) L.saved = false;
    if (e.type === "step") startTicker(); else if (["check", "decide", "done", "stopped"].includes(e.type)) stopTicker();
    // Back in the simulation, the run goes on in memory and the page stays where the person is.
    if (!L.active) return;
    if (e.type === "step") {
      presenter.go(STEP_OF[e.step], { keep: true, focus: true });
      return;
    }
    if (e.type === "stopped") { presenter.go(STEP_OF[e.stop.step], { keep: true, focus: true }); return; }
    presenter.render();
  }

  function startTicker() {
    stopTicker();
    ticker = setInterval(() => {
      if (!L.run) return stopTicker();
      L.snap = L.run.snapshot();
      const el = $("wait-seconds");
      if (el) el.textContent = t("w.time", { s: Math.max(0, Math.floor((Date.now() - L.snap.stepStarted) / 1000)) });
      const retry = $("wait-retry");
      if (retry && L.snap.retry) retry.textContent = t("w.retry", { s: Math.max(1, Math.ceil((L.snap.retry.at + L.snap.retry.waitMs - Date.now()) / 1000)) });
    }, 500);
  }
  function stopTicker() {
    clearInterval(ticker);
    ticker = 0;
  }

  /** A company that carries one of the scenarios' names is that fictional company, filled in for a demo. */
  const fictional = (name) => SCENARIOS.some((s) => s.name.toLowerCase() === String(name || "").trim().toLowerCase());

  /** The run as the presenter shows it: the recording assembled, or the form before a run. */
  function view() {
    if (L.run) return assemble(L.run.rec, L.run.rec.language);
    const lang = getLang();
    const rec = newRecording({ company: L.form.company, items: cleanItems(), lang, today: today(), fictional: fictional(L.form.company.name) });
    return assemble(rec, lang);
  }

  function cleanItems() {
    return Object.fromEntries(Object.entries(L.form.items).map(([q, list]) => [q, list.map((x) => String(x).trim()).filter(Boolean).slice(0, LIMITS.itemsPerQuadrant).map((x) => x.slice(0, LIMITS.itemText))]));
  }

  /** What the run has reached: the furthest step the presenter may show. */
  function maxStep() {
    if (!L.run) return STEP.start;
    const s = L.snap || L.run.snapshot();
    if (s.status === "done") return STEP.summary;
    if (s.status === "decide") return STEP.strategise;
    if (s.status === "check") return STEP.complete;
    if (s.step) return STEP_OF[s.step];
    return STEP.complete;
  }

  /** The live state of a step: "working", "stopped", "check", "decide", "done" or "" (nothing to say). */
  function stepState(step) {
    if (!L.run) return step === STEP.start ? "form" : "";
    const s = L.snap || L.run.snapshot();
    const here = s.step && STEP_OF[s.step] === step;
    if (s.status === "working" && here) return "working";
    if (s.status === "stopped" && here) return "stopped";
    if (s.status === "check" && step === STEP.complete) return "check";
    if (s.status === "decide" && step === STEP.strategise) return "decide";
    return "";
  }

  async function startRun({ settings, capEur }) {
    const lang = getLang();
    const rec = newRecording({ company: { ...L.form.company, name: L.form.company.name.trim().slice(0, LIMITS.companyName), description: L.form.company.description.trim().slice(0, LIMITS.oneLine), country: L.form.company.country.trim().slice(0, LIMITS.country) }, items: cleanItems(), lang, today: today(), fictional: fictional(L.form.company.name) });
    L.check = emptyCheck();
    presenter.reset();
    // A run's events count only while it is the page's run: after Clear everything, or once a new run has
    // started, an old request that ends late changes nothing (review finding 14).
    const run = createLiveRun({ recording: rec, settings, capEur, onEvent: (e) => { if (L.run === run) onRunEvent(e); } });
    L.run = run;
    L.snap = L.run.snapshot();
    L.saved = false;
    await L.run.complete();
  }

  async function challenge() {
    if (!L.run || L.snap?.status !== "check") return;
    L.run.applyCheck({ removed: [...L.check.removed], edited: [...L.check.edited].map(([id, text]) => ({ id, text })) });
    L.check.editing = null;
    await L.run.challenge();
  }

  async function adopt(chosen) {
    if (!L.run) return;
    // A new choice after the summary costs nothing: the summary holds for any choice (review finding 8).
    if (L.snap?.status === "done") {
      if (L.run.rechoose(chosen)) presenter.go(STEP.summary, { keep: true, focus: true });
      return;
    }
    // Stopped while writing the summary: Adopt with the new choice writes it again, as Try again would.
    const stoppedAtSummary = L.snap?.status === "stopped" && L.snap.stop?.step === "summary";
    if (L.snap?.status !== "decide" && !stoppedAtSummary) return;
    await L.run.summarise({ chosen, zoneName });
  }

  function abort() {
    L.run?.abort();
  }

  /** The next step a stop offers: run it again, or first the dialog (key, model, cap, Thorough). */
  function again({ dialog = false, preset = null } = {}) {
    if (!L.run) return;
    if (dialog) { openDialog({ resume: true, preset }); return; }
    L.run.resume({ zoneName });
  }

  /** Clear everything: at once when nothing would be lost, else after the person confirms. */
  function askClear() {
    const empty = !L.run && !L.form.company.name.trim() && !Object.values(L.form.items).flat().length && !hasKey();
    if (empty) { clearAll(); return; }
    const d = $("clear-dialog");
    if (!d.open) d.showModal();
    $("clear-cancel").focus();
  }
  $("clear-confirm").addEventListener("click", () => { $("clear-dialog").close(); clearAll(); });
  $("clear-cancel").addEventListener("click", () => $("clear-dialog").close());

  function clearAll() {
    L.run?.abort();
    stopTicker();
    forgetKey();
    Object.assign(L, { form: emptyForm(), nameError: false, fill: { choice: "", done: "" }, run: null, snap: null, check: emptyCheck(), saved: true, resume: false });
    presenter.announce(t("p.live.cleared"));
    presenter.leave();
  }

  // ---- the person's check of the AI's items ---------------------------------------------------------
  const checkActions = {
    remove(id) {
      // The factor tables need an item inside the company and one outside it: the last item of a side
      // stays, with a sentence that says why (review finding 12).
      const items = view().items;
      const side = QUADRANTS.find((q) => q.id === items.find((i) => i.id === id)?.quadrant)?.side;
      const left = items.filter((i) => i.id !== id && !L.check.removed.has(i.id) && QUADRANTS.find((q) => q.id === i.quadrant)?.side === side);
      L.check.editing = null;
      if (!left.length) {
        L.check.kept = { id, side };
        presenter.render();
        presenter.announce(t(`s.check.keep.${side}`));
        focusLater(`remove-${id}`);
        return;
      }
      L.check.kept = null;
      L.check.removed.add(id);
      presenter.render();
      focusLater(`undo-${id}`);
    },
    undo(id) { L.check.kept = null; L.check.removed.delete(id); presenter.render(); focusLater(`edit-${id}`); },
    edit(id) { L.check.kept = null; L.check.editing = id; presenter.render(); focusLater(`edit-input-${id}`); },
    save(id, text) {
      const v = String(text || "").trim().slice(0, LIMITS.itemText);
      const original = view().items.find((i) => i.id === id)?.text;
      if (v && v !== original) L.check.edited.set(id, v); else if (!v || v === original) L.check.edited.delete(id);
      // An edit goes to the agents that follow, so it gets the same look for private data as the Start form
      // (brief 5.10): a warning under the item that does not block.
      const kinds = L.check.edited.has(id) ? privateKinds(v) : [];
      if (kinds.length) L.check.flags.set(id, kinds); else L.check.flags.delete(id);
      L.check.editing = null;
      presenter.render();
      if (kinds.length) presenter.announce(checkWarning(kinds));
      focusLater(`edit-${id}`);
    },
    cancel(id) { L.check.editing = null; presenter.render(); focusLater(`edit-${id}`); }
  };

  // ---- the Start form ---------------------------------------------------------------------------------
  const formActions = {
    company(field, value) {
      L.form.company[field] = value;
      if (field === "name" && value.trim()) L.nameError = false;
    },
    item(q, i, value) { L.form.items[q][i] = value; },
    add(q, value) {
      const v = String(value || "").trim().slice(0, LIMITS.itemText);
      if (!v || L.form.items[q].length >= LIMITS.itemsPerQuadrant) return false;
      L.form.items[q].push(v);
      presenter.render();
      focusLater(L.form.items[q].length >= LIMITS.itemsPerQuadrant ? `item-${q}-${L.form.items[q].length - 1}` : `add-${q}`);
      return true;
    },
    remove(q, i) {
      L.form.items[q].splice(i, 1);
      presenter.render();
      focusLater(L.form.items[q].length ? `item-${q}-${Math.max(0, i - 1)}` : `add-${q}`);
    },
    tidy(q, i) {
      if (i < L.form.items[q].length && !String(L.form.items[q][i] ?? "").trim()) formActions.remove(q, i);
    },
    // Choosing a company changes nothing yet: arrow keys move through the list without filling the form or
    // moving the focus (WCAG 2.2, 3.2.2). Fill in does it, says so and keeps the focus on the button.
    choose(id) { L.fill.choice = id; L.fill.done = ""; },
    async fill() {
      const id = L.fill.choice;
      if (!id) { focusLater("live-fill"); return; }
      const s = await loadScenario(id);
      const lang = getLang();
      L.form = {
        company: { name: s.company.name, sector: s.company.sector, country: countryName(s.company.country, lang), description: s.company.description[lang] },
        items: Object.fromEntries(QUADRANTS.map(({ id: q }) => [q, s.entered[q].map((it) => it.text[lang])]))
      };
      L.nameError = false;
      L.fill.done = s.company.name;
      presenter.render();
      presenter.announce(t("s.live.fill.done", { company: s.company.name }));
      focusLater("live-fill-go");
    },
    start() {
      if (!L.form.company.name.trim()) {
        L.nameError = true;
        presenter.render();
        focusLater("live-name");
        return;
      }
      openDialog({ resume: false });
    }
  };

  function focusLater(id) {
    requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: false }));
  }

  // ---- the dialog -----------------------------------------------------------------------------------
  const D = {
    dialog: $("live-dialog"), key: $("live-key"), show: $("live-key-show"), current: $("live-key-current"), masked: $("live-key-masked"),
    forget: $("live-key-forget"), status: $("live-key-status"), research: $("live-research"), researchHelp: $("live-research-help"),
    advanced: $("live-advanced"), model: $("live-model"), effort: $("live-effort"), cap: $("live-cap"), capOut: $("live-cap-out"),
    ack: $("live-ack"), warning: $("live-warning"), warningList: $("live-warning-list"), warningEdit: $("live-warning-edit"),
    estimate: $("live-estimate"), start: $("live-start"), frame: $("live-frame"), why: $("live-why")
  };
  const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
  let checking = false;
  let scenariosForEstimate = null;

  function settingsNow() {
    const preset = D.dialog.querySelector('input[name="live-preset"]:checked')?.value || DEFAULT_PRESET;
    return resolveSettings({ preset, model: D.model.value || null, effort: D.effort.value || null, research: D.research.checked });
  }

  function capNow() {
    const v = Number(D.cap.value);
    return Number.isFinite(v) ? Math.min(BUDGET.maxEur, Math.max(BUDGET.minEur, v)) : BUDGET.defaultEur;
  }

  function setStatus(text, tone = "") {
    D.status.textContent = text;
    D.status.dataset.tone = tone;
  }

  function refreshDialog() {
    const lang = getLang();
    const typed = D.key.value.trim();
    const held = hasKey();
    D.current.hidden = !held;
    D.masked.textContent = held ? maskKey() : "";
    const shapeOk = typed ? looksLikeKey(typed) : held;
    if (typed && !looksLikeKey(typed) && !checking) setStatus(t("d.key.shape"), "danger");
    else if (!checking && D.status.dataset.tone === "danger" && typed && looksLikeKey(typed)) setStatus("");
    D.start.disabled = framed || checking || !shapeOk || !D.ack.checked;
    // Why the start button waits, in words beside it.
    const why = framed || checking ? "" : !shapeOk ? t("d.why.key") : !D.ack.checked ? t("d.why.ack") : "";
    if (D.why.textContent !== why) D.why.textContent = why;
    D.capOut.textContent = euros(capNow(), lang, 2);
    const s = settingsNow();
    const extra = usageCostUsd(s.model, researchUsage({ thinking: !s.thinking })) * FX_USD_EUR;
    D.researchHelp.textContent = t("d.research.help", { eur: euros(extra, lang, 2) });
    let est = "";
    if (scenariosForEstimate) {
      const e = estimateLive(scenariosForEstimate, lang, s);
      const eur = e.eurHigh < 0.005 ? `< ${euros(0.01, lang, 2)}` : `≈ ${euros(e.eurHigh, lang, 2)}`;
      est = t("d.estimate", { eur, minutes: t("d.minutes", { low: num(e.minutes[0], lang), high: num(e.minutes[1], lang) }) });
      const last = L.lastRun ? t("d.estimate.last", { eur: euros(L.lastRun.eur, lang), time: duration(L.lastRun.seconds, lang) }) : "";
      if (last) est = [est, last].join(" ");
    }
    if (D.estimate.textContent !== est) D.estimate.textContent = est;
  }

  const num = (x, lang) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 1 }).format(x);

  function showWarning() {
    const findings = privacyFindings({ company: L.form.company, entered: L.form.items });
    D.warning.hidden = !findings.length;
    D.warningList.replaceChildren(...findings.map((f) => h("li", {}, t(`d.warn.${f.kind}`, { where: whereName(f.where) }))));
    D.warningEdit.dataset.where = findings[0]?.where || "";
  }

  const whereName = (where) => (where === "company" ? t("d.warn.in.company") : where === "description" ? t("d.warn.in.description") : t("d.warn.in.quadrant", { quadrant: t(`q.${where}`) }));

  async function openDialog({ resume = false, preset = null } = {}) {
    L.resume = resume;
    D.ack.checked = false;
    D.key.value = "";
    D.key.type = "password";
    D.show.setAttribute("aria-pressed", "false");
    D.show.setAttribute("aria-label", t("d.key.show"));
    D.frame.hidden = !framed;
    for (const el of D.dialog.querySelectorAll("input, select, button:not([data-vc-close])")) el.disabled = framed;
    if (preset) {
      const radio = D.dialog.querySelector(`input[name="live-preset"][value="${preset}"]`);
      if (radio) radio.checked = true;
      D.model.value = "";
    }
    setStatus("");
    showWarning();
    refreshDialog();
    if (!D.dialog.open) D.dialog.showModal();
    (hasKey() ? D.ack : D.key).focus();
    if (!scenariosForEstimate) {
      scenariosForEstimate = await Promise.all(SCENARIOS.map((s) => loadScenario(s.id)));
      refreshDialog();
    }
  }

  D.key.addEventListener("input", refreshDialog);
  D.ack.addEventListener("change", refreshDialog);
  D.cap.addEventListener("input", refreshDialog);
  D.research.addEventListener("change", refreshDialog);
  D.model.addEventListener("change", refreshDialog);
  D.effort.addEventListener("change", refreshDialog);
  for (const r of D.dialog.querySelectorAll('input[name="live-preset"]')) r.addEventListener("change", () => { D.model.value = ""; D.effort.value = ""; refreshDialog(); });
  D.show.addEventListener("click", () => {
    const show = D.key.type === "password";
    D.key.type = show ? "text" : "password";
    D.show.setAttribute("aria-pressed", String(show));
    D.show.setAttribute("aria-label", t(show ? "d.key.hide" : "d.key.show"));
  });
  D.forget.addEventListener("click", () => {
    forgetKey();
    setStatus("");
    refreshDialog();
    D.key.focus();
  });
  D.warningEdit.addEventListener("click", () => {
    const where = D.warningEdit.dataset.where;
    D.dialog.close();
    if (L.run) return;
    presenter.go(STEP.start, { keep: true, focus: false });
    const target = where === "company" ? "live-name" : where === "description" ? "live-line" : L.form.items[where]?.length ? `item-${where}-0` : `add-${where}`;
    focusLater(target);
  });
  D.key.addEventListener("keydown", (e) => { if (e.key === "Enter" && !D.start.disabled) { e.preventDefault(); D.start.click(); } });

  D.start.addEventListener("click", async () => {
    if (D.start.disabled || framed) return;
    const typed = D.key.value.trim();
    if (typed) setKey(typed);
    D.key.value = "";
    D.key.type = "password";
    if (!hasKey()) return;
    checking = true;
    setStatus(t("d.key.checking"));
    refreshDialog();
    const settings = settingsNow();
    const cap = capNow();
    const result = await checkKey(getKey());
    checking = false;
    if (!result.ok) {
      const m = apiMessage(result);
      if (result.status === 401) forgetKey();
      setStatus([t(m.key, m.vars), t(m.next)].join(" "), "danger");
      refreshDialog();
      D.key.focus();
      return;
    }
    if ((result.missing || []).includes(settings.model)) {
      const which = MODELS.find((m) => m.id === settings.model)?.label || settings.model;
      setStatus([t("d.key.models", { models: which }), t("api.model.next")].join(" "), "danger");
      refreshDialog();
      return;
    }
    setStatus(t("d.key.ok"), "ok");
    D.dialog.close();
    if (L.resume && L.run) {
      L.run.reconfigure({ settings, capEur: cap });
      L.run.resume({ zoneName });
    } else {
      await startRun({ settings, capEur: cap });
    }
  });

  // ---- saving and leaving -----------------------------------------------------------------------------
  function saveRun() {
    if (!L.run) return;
    const rec = L.run.toRecording();
    const slug = rec.company.name.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "company";
    // Whatever is shaped like a key, typed into the form by mistake, leaves the file redacted (brief 5.3).
    const blob = new Blob([`${redactSecrets(JSON.stringify(rec, null, 2))}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: `swot-run-${slug}-${rec.as_of}.json`, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    L.saved = true;
  }

  // The browser asks before the tab closes while a live result exists that was not downloaded.
  window.addEventListener("beforeunload", (e) => {
    if (L.run && !L.saved && (L.snap?.requests || 0) > 0) { e.preventDefault(); e.returnValue = ""; }
  });

  return {
    get active() { return L.active; },
    set active(v) { L.active = !!v; },
    get form() { return L.form; },
    get nameError() { return L.nameError; },
    get fill() { return L.fill; },
    get run() { return L.run; },
    get check() { return L.check; },
    get snap() { return L.snap; },
    view,
    maxStep,
    stepState,
    formActions,
    checkActions,
    challenge,
    adopt,
    abort,
    again,
    clearAll,
    askClear,
    saveRun,
    // A report downloaded (PDF, HTML or the file for the Prototype Ideator) keeps the result as well, so the
    // browser no longer asks before the tab closes, until the run changes again.
    markSaved: () => { L.saved = true; },
    openDialog,
    refreshDialog: () => { if (D.dialog.open) { showWarning(); refreshDialog(); } },
    sectors: () => SECTORS,
    scenarios: () => SCENARIOS
  };
}

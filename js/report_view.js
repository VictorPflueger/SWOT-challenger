// The report at the end of a run (PLAN.md, sections 5.3 and 7): the card at the Summary step with two small
// pages and the three downloads, the report dialog that shows the sheets at full size with the same
// downloads above them, and the downloads themselves. Save as PDF prints the report alone through Vici's
// report pattern (Vici.report.print) with the page title set to the file's name while the print dialog is
// open, since browsers name a saved PDF after it; Ctrl+P at the Summary step prints the report too. The HTML
// file is Vici.report.html(): the report with the style rules that reach it, its pictures as data, no script
// and a policy that loads nothing. The JSON file is the handoff file (js/handoff.js), checked before the page
// offers it. Nothing is kept: each file exists only as the download.

import { t } from "./i18n/index.js";
import { h, icon, fill } from "./dom.js";
import { reportNodes, thumbNodes, fileName } from "./report.js";
import { handoffFor, handoffProblems } from "./handoff.js";

export const IDEATOR_URL = "https://victorpflueger.github.io/PrototypeIdeator/";

/** Margin boxes print the footer with page numbers in Chromium from version 131; elsewhere the fixed footer prints, without them. */
export function marginBoxes() {
  try { if (window.CSS && CSS.supports("at-rule(@bottom-left)")) return true; } catch { /* an older engine */ }
  const m = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent || "");
  return !!m && Number(m[1]) >= 131;
}

/** A file the person downloads: a Blob behind a link that is clicked once and let go. */
function download(text, type, name) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: name, hidden: true });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The report's controller. els: { dialog, tools, body }; announce(text) says a result to screen readers;
 * onSaved() is told when a file has left the page, so the warning before the tab closes can stand down.
 * build(ctx) draws the report into the dialog's body (ctx as js/report.js's reportNodes takes it); the page
 * calls it whenever the Summary step, or a stopped live run, renders.
 */
export function createReportView({ dialog, tools, body, announce, onSaved = () => {} }) {
  let current = null;
  let undoPrint = null;
  let titleBefore = null;
  let viaButton = false;

  const day = () => current.ctx.created.toISOString().slice(0, 10);
  const nameOf = (ext) => fileName(current.ctx.run.company.name, day(), current.ctx.lang, ext);

  function build(ctx) {
    const el = reportNodes({ ...ctx, level: 3, id: "report" });
    current = { ctx, el };
    fill(body, el);
    fill(tools, actions("dialog"));
    return el;
  }

  function setTitle() {
    if (titleBefore === null) titleBefore = document.title;
    document.title = nameOf("");
  }
  function restoreTitle() {
    if (titleBefore !== null) document.title = titleBefore;
    titleBefore = null;
  }

  function pdf() {
    if (!current || !window.Vici?.report) return;
    viaButton = true;
    setTitle();
    window.Vici.report.print(current.el);
  }

  function html() {
    if (!current || !window.Vici?.report) return;
    const name = nameOf("html");
    download(window.Vici.report.html(current.el, { title: current.el.querySelector(".vc-report__title")?.textContent || name }), "text/html", name);
    announce(t("rp.saved", { file: name }));
    onSaved();
  }

  function json() {
    if (!current) return;
    const c = current.ctx;
    const file = handoffFor({ run: c.run, scenario: c.scenario, chosen: c.chosen, lang: c.lang, mode: c.mode, model: c.live?.settings.model ?? null, created: new Date(), country: c.run.company.country });
    const problems = handoffProblems(file);
    // A file that fails its check is not offered; the page says why, where the button is, in words.
    const errors = ["rp-error", "rp-error-dialog"].map((x) => document.getElementById(x)).filter(Boolean);
    if (problems.length) {
      const words = t("rp.json.failed", { problem: problems[0] });
      for (const e of errors) { e.textContent = words; e.hidden = false; }
      announce(words);
      return;
    }
    for (const e of errors) { e.textContent = ""; e.hidden = true; }
    const name = nameOf("json");
    download(`${JSON.stringify(file, null, 2)}\n`, "application/json", name);
    announce(t("rp.saved", { file: name }));
    onSaved();
  }

  // Ctrl+P while a report is there prints the report, as the button does.
  window.addEventListener("beforeprint", () => {
    if (viaButton || !current || !current.el.isConnected || !window.Vici?.report || !current.ctx.printable) return;
    undoPrint = window.Vici.report.prepare(current.el);
    setTitle();
  });
  window.addEventListener("afterprint", () => {
    // The print dialog cannot say whether a file was saved; printing the report counts as keeping it.
    if (viaButton || undoPrint) onSaved();
    viaButton = false;
    if (undoPrint) { undoPrint(); undoPrint = null; }
    restoreTitle();
  });

  /** The three downloads with their hints, and the way on to the Prototype Ideator. where: panel or dialog. */
  function actions(where) {
    const id = (x) => (where === "dialog" ? `${x}-dialog` : x);
    const hint = h("p", { class: "report-hint", id: id("rp-pdf-hint") }, t("rp.pdf.hint"), marginBoxes() ? null : [" ", t("rp.pdf.numbers")]);
    // In the dialog, Save as PDF is the primary action; at the Summary step the bar's "Download the report"
    // is, so the card's three downloads are equal and secondary.
    const pdfClass = where === "dialog" ? "vc-button vc-button--sm" : "vc-button vc-button--secondary vc-button--sm";
    return [
      h("div", { class: "report-actions" },
        h("button", { type: "button", class: pdfClass, id: id("rp-pdf"), "aria-describedby": id("rp-pdf-hint"), on: { click: pdf } }, icon("download"), t("rp.pdf")),
        h("button", { type: "button", class: "vc-button vc-button--secondary vc-button--sm", id: id("rp-html"), title: t("rp.html.hint"), "aria-describedby": id("rp-html-hint"), on: { click: html } }, icon("download"), t("rp.html.label")),
        h("button", { type: "button", class: "vc-button vc-button--secondary vc-button--sm", id: id("rp-json"), title: t("rp.json.hint"), "aria-describedby": id("rp-json-hint"), on: { click: json } }, icon("download"), t("rp.json.label")),
        // What the two files are, for a keyboard or a screen reader as well as a pointer's tooltip.
        h("span", { class: "vc-visually-hidden", id: id("rp-html-hint") }, t("rp.html.hint")),
        h("span", { class: "vc-visually-hidden", id: id("rp-json-hint") }, t("rp.json.hint"))),
      hint,
      h("p", { class: "report-error", id: id("rp-error"), role: "alert", hidden: true }),
      h("p", { class: "report-hint" }, h("a", { class: "report-ideator", id: id("rp-ideator"), href: IDEATOR_URL, target: "_blank", rel: "noopener" }, t("rp.ideator"), h("span", { class: "vc-visually-hidden" }, t("p.new.tab"))))
    ];
  }

  /** The card at the Summary step: two small pages that open the dialog, what the report holds, the downloads. */
  function card(onOpen) {
    if (!current) return null;
    return h("section", { class: "report-card", "aria-labelledby": "rp-card-title" },
      h("button", { type: "button", class: "report-card__open", id: "rp-open", "aria-label": t("rp.open"), on: { click: onOpen } }, thumbNodes(current.el)),
      h("div", { class: "report-card__body" },
        h("h2", { class: "report-card__title", id: "rp-card-title" }, t("rp.card.h")),
        h("p", { class: "report-card__text" }, t("rp.card.p")),
        actions("panel")));
  }

  function open() {
    if (!current) return;
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0;
  }

  return { build, card, open, pdf, html, json, get current() { return current; } };
}

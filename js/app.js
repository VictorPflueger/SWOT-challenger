// The page in version 0.1.0: the header, the two languages and the guide that belongs to each. The steps,
// Play and the "Your turn" bar join it with the simulation (PLAN.md, M2).

import { getLang, setLang, onLang } from "./i18n/index.js";

/** Starts the page: wires the language switch and keeps the guide buttons in the page's language. */
export async function start() {
  for (const button of document.querySelectorAll(".lang-option")) {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  }
  onLang(showLanguage);
  showLanguage(getLang());
}

/**
 * Marks the active language in the switch and shows the How it works button of that language's guide.
 * The other guide stays in the page, closed, for a switch back.
 */
function showLanguage(lang) {
  for (const button of document.querySelectorAll(".lang-option")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  for (const l of ["en", "de"]) {
    const opener = document.querySelector(`[data-vc-guide-open="guide-${l}"]`);
    if (opener) opener.hidden = l !== lang;
    const guide = document.getElementById(`guide-${l}`);
    if (guide && l !== lang && guide.open) guide.close();
  }
}

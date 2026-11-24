// Small DOM helpers. Every text a person reads goes in through textContent, never as HTML, and no element
// gets a style attribute: the page's policy forbids both (brief 5.1). A custom property is set through the
// CSS object model (el.style.setProperty), which the policy allows. Adapted from the Data Quality Agent
// 2.2.0, without its SVG option.

/**
 * An element. attrs: class (a string or a list, empty entries skipped), text, dataset {}, on {event: fn},
 * vars {"--name": value} for custom properties, and any other attribute (true sets it empty, false, null
 * and undefined leave it out). children: strings, nodes, lists, and null or false, which are skipped.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = Array.isArray(v) ? v.filter(Boolean).join(" ") : v;
    else if (k === "text") el.textContent = String(v);
    else if (k === "dataset") { for (const [dk, dv] of Object.entries(v)) if (dv !== undefined && dv !== null && dv !== false) el.dataset[dk] = String(dv); }
    else if (k === "vars") { for (const [prop, val] of Object.entries(v)) el.style.setProperty(prop, String(val)); }
    else if (k === "on") { for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn); }
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** One of Vici's icons, hidden from screen readers: the words beside it carry the meaning. */
export const icon = (name, extra = "") => h("span", { class: ["vc-icon", `vc-icon--${name}`, extra], "aria-hidden": "true" });

/** Vici's small tag. tone: feature (lilac, the AI), danger (coral), success (sage), or none. */
export const tag = (text, tone = "", extra = "") => h("span", { class: ["vc-tag", "vc-tag--sm", tone ? `vc-tag--${tone}` : "", extra] }, text);

/** Empties an element and fills it with new children. */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

/** The number of words a person reads in a text, for Play's reading time. */
export const wordCount = (text) => String(text || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

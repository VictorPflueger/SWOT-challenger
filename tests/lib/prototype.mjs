// What differs between the prototypes in the shared Vici tests (tests/tokens.mjs, tests/hexagon.mjs,
// tests/page-icon.mjs and tests/vici-files.mjs). Those four files are the same in every prototype;
// this file is the one place that is not. Everything here is the SWOT Challenger's, version 0.1.0:
// the frame, the guide and the SWOT's four fields. The steps join it with version 0.2.0.

/** The prototype's name, as on its page and on its card on Victor's website. */
export const NAME = "SWOT Challenger";

/**
 * Colour pairs only this prototype draws (the shared shell's pairs are in tests/tokens.mjs):
 * [what, foreground token, background token, kind]. kind "text" needs 4.5:1, "mark" (a line, an icon,
 * a control's border, a bar) 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Tokens are Vici's, without "--vc-".
 * Decorative outlines (cards, table rules, the rule beside a row's label) carry no information and are
 * not listed, as in the shared shell's pairs.
 */
export const COLOUR_PAIRS = [
  // The header and the strip.
  ["SIMULATION (a plain tag)", "neutral-text", "neutral-bg", "text"],
  ["The active language in the switch", "on-accent", "accent", "text"],
  ["A key figure's note and the sentence under the header", "text-muted", "surface", "text"],
  // The SWOT on its sunken ground.
  ["The SWOT's title", "text", "bg-sunken", "text"],
  ["The SWOT's lead and the labels Helps, Hurts, Inside and Outside", "text-muted", "bg-sunken", "text"],
  ["A field's name and question", "text", "surface", "text"],
  ["A field's common fault", "text-muted", "surface", "text"],
  ["A field's letter and a step's number in their hexagons", "text", "bg-subtle", "text"],
  // The AI: lilac.
  ["You are interacting with an AI system", "feature-text", "feature-bg", "text"]
];

/**
 * Colours that must stay apart, beyond the shared ones in tests/tokens.mjs: [what, token, token].
 * The test reports how far apart they stay under colour-vision deficiency; it does not fail on them.
 * From version 0.2.0 an item challenged is coral and an item addressed sage.
 */
export const SEPARATIONS = [
  ["Item states: challenged (danger) vs addressed (success)", "danger-solid", "success-solid"]
];

/**
 * The hexagon test's tour of the page (tests/hexagon.mjs): the guide as it opens on a new tab, its talk
 * track, the page behind it and the page in German. visit(name, { settle }) checks the page as it is,
 * settle ms (250) after the step.
 */
export async function hexagonTour(page, visit) {
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector("dialog.vc-guide[open]", { timeout: 10000 });
  await visit("the guide as it opens");
  await page.click("dialog.vc-guide[open] .vc-guide__rail .vc-step__button >> nth=-1");
  await visit("the guide's talk track");
  await page.keyboard.press("Escape");
  await visit("the SWOT and how a run goes");
  await page.click('.lang-option[data-lang="de"]');
  await visit("the page in German");
}

/**
 * The page icon (tests/page-icon.mjs): the icon and kind of this prototype's card on Victor's website
 * (VictorPflueger/VIP, data/prototypes.js), the colour of that kind's cell (Vici's lilac for a
 * prototype), and favicon.svg exactly: the card's cell drawn for small sizes.
 */
export const PAGE_ICON = {
  icon: "scale",
  kind: "prototype",
  tone: "lilac",
  favicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 103.92">
  <!-- SWOT Challenger's page icon: Vici's scale icon in a lilac hexagon cell, the same as its card
       on Victor Pflüger's website (icon and kind: VictorPflueger/VIP, data/prototypes.js). Vici's
       lilac 100 (#f2e9fd) and lilac 900 (#372544); the icon is drawn larger and bolder
       than on the card so that it still reads at 16 px. -->
  <polygon points="120,51.96 90,103.92 30,103.92 0,51.96 30,0 90,0" fill="#f2e9fd"/>
  <g transform="translate(18 9.96) scale(3.5)" fill="none" stroke="#372544" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9 H21 M5 9 V11 M19 9 V11"/>
    <path d="M12 9 V14.5"/>
    <path d="M4.5 14.5 H19.5 L21 16 V20 H3 V16 Z"/>
    <path d="M9.5 17.25 H14.5"/>
  </g>
</svg>
`
};

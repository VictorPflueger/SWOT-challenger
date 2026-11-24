// An authored scenario is written once, with every text as { en, de } beside it and every number, id and
// choice only once. bilingual() turns that one tree into the recorded-run format of the Scenario contract
// (schemas/swot.js): answers.en and answers.de, each the agents' answers in one language, exactly as a
// live run returns them. The company's description and the team's items keep both languages side by side,
// as the contract has them.

/** A leaf with an English and a German text, and nothing else. */
const isPair = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 2 && typeof v.en === "string" && typeof v.de === "string";

/** The tree in one language: every { en, de } leaf becomes its text in `lang`. */
export function pick(tree, lang) {
  if (isPair(tree)) return tree[lang];
  if (Array.isArray(tree)) return tree.map((x) => pick(x, lang));
  if (tree && typeof tree === "object") return Object.fromEntries(Object.entries(tree).map(([k, v]) => [k, pick(v, lang)]));
  return tree;
}

/** The scenario in the recorded-run format, from its authored form with one answers tree. */
export function bilingual({ answers, ...rest }) {
  return Object.freeze({ ...rest, answers: { en: pick(answers, "en"), de: pick(answers, "de") } });
}

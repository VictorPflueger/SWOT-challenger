// The guards of brief 6.7 and PLAN.md 3.1: what code refuses in an agent's answer, beyond what its schema
// can hold. The live pipeline and the scenario checker hand every answer to the same checks, so a recorded
// run and a live run obey one set of rules. Each guard takes an answer and the run so far and returns its
// problems, each a short English sentence: they go back to the model in the one repair request, and to
// whoever edits a scenario. The person reads plain words from js/api_messages.js and the i18n files instead.

import { validate, describeErrors } from "./schema.js";
import { SCHEMAS, REQUESTS, STRATEGY_KINDS } from "../schemas/swot.js";
import { KPIS, SECTORS } from "../data/kpis.js";
import { LIMITS } from "./config.js";
import { auditText } from "./facts.js";
import { issueExpected, expected, round9 } from "./risk.js";
import { REFUSE_TOLERANCE } from "./engine.js";

const QUADRANTS = ["strengths", "weaknesses", "opportunities", "threats"];
const QUADRANT_OF = { s: "strengths", w: "weaknesses", o: "opportunities", t: "threats" };
const SIDE = { strengths: "internal", weaknesses: "internal", opportunities: "external", threats: "external" };
const quadrantOf = (id) => QUADRANT_OF[String(id)[0]];
const KPI_IDS = new Set(KPIS.map((k) => k.id));
const SECTOR_IDS = new Set(SECTORS.map((s) => s.id));

/** The answer against its step's contract, every limit included. */
export function schemaProblems(step, answer) {
  const name = REQUESTS[step];
  const r = validate(answer, SCHEMAS[name], SCHEMAS);
  return r.valid ? [] : [`The answer breaks the ${name} contract: ${describeErrors(r.errors)}`];
}

/**
 * The Completer's answer. ctx: { entered: [{ id, quadrant, text }], sector } where sector is the id the
 * person chose, or null for "let the agents decide".
 */
export function completionProblems(answer, { entered, sector = null }) {
  const out = [];
  const ids = new Set(entered.map((i) => i.id));
  const texts = new Set(entered.map((i) => norm(i.text)));
  if (sector && answer.sector !== sector) out.push(`The person chose the sector ${sector}; return it unchanged, not ${answer.sector}.`);
  if (!sector && !SECTOR_IDS.has(answer.sector)) out.push(`The sector ${answer.sector} is not one of the sectors given.`);
  for (const q of QUADRANTS) {
    const mine = entered.filter((i) => i.quadrant === q).length;
    const added = answer.items.filter((i) => i.quadrant === q).length;
    if (added > LIMITS.newPerQuadrant) out.push(`${q} gets ${added} new items; add at most ${LIMITS.newPerQuadrant}.`);
    if (mine + added > LIMITS.itemsPerQuadrant) out.push(`${q} would hold ${mine + added} items; at most ${LIMITS.itemsPerQuadrant}.`);
    if (mine + added < LIMITS.completeTo) out.push(`${q} holds ${mine + added} items; fill it to at least ${LIMITS.completeTo}.`);
  }
  for (const it of answer.items) {
    if (texts.has(norm(it.text))) out.push(`"${it.text}" repeats an item the person entered; leave the person's items as they are and add only new ones.`);
  }
  for (const m of answer.misfiled) {
    if (!ids.has(m.item)) out.push(`The note on ${m.item} names an item the person did not enter.`);
    else if (quadrantOf(m.item) === m.belongs_in) out.push(`${m.item} already sits in ${m.belongs_in}.`);
  }
  return out;
}

/**
 * The Red team's answer. ctx: { items: the SWOT as the person left it [{ id, quadrant }], urls: the URLs
 * the Scout's signals accepted (evidence may cite only these) }.
 */
export function issuesProblems(answer, { items, urls = [] }) {
  const out = [];
  const ids = new Set(items.map((i) => i.id));
  const allowed = new Set(urls);
  const issueIds = answer.issues.map((i) => i.id);
  if (answer.issues.length > LIMITS.issues) out.push(`There are ${answer.issues.length} issues; return at most ${LIMITS.issues}, the strongest first.`);
  if (new Set(issueIds).size !== issueIds.length) out.push("Issue ids repeat; number them I1, I2 and so on.");
  answer.issues.forEach((issue, n) => {
    if (issue.id !== `I${n + 1}`) out.push(`Issue ${n + 1} has the id ${issue.id}; number them I1, I2 and so on, in order.`);
    for (const id of issue.items) if (!ids.has(id)) out.push(`Issue ${issue.id} names ${id}, which is not an item of the SWOT.`);
    if (issue.type === "missing") {
      if (issue.added_items.length !== 1) out.push(`Issue ${issue.id} is "missing", so it adds the missing factor in added_items.`);
      if (issue.items.length) out.push(`Issue ${issue.id} is "missing", so it names no item of the SWOT; the factor it adds carries it.`);
    } else {
      if (issue.added_items.length) out.push(`Issue ${issue.id} adds a factor but is not of the type "missing".`);
      if (!issue.items.length) out.push(`Issue ${issue.id} names no item of the SWOT.`);
    }
    for (const q of issue.quadrants) if (!QUADRANTS.includes(q)) out.push(`Issue ${issue.id} names an unknown quadrant ${q}.`);
    for (const e of issue.evidence) if (!allowed.has(e.url)) out.push(`Issue ${issue.id} cites ${e.url}, which is not among the signals; cite only the signals' URLs, or none.`);
  });
  return out;
}

/**
 * The Analyst's answer. ctx: { items: every item after the challenge, added ones included, [{ id,
 * quadrant }], issues: [{ id }], sector }.
 */
export function assessmentProblems(answer, { items, issues, sector }) {
  const out = [];
  const ids = new Set(items.map((i) => i.id));
  const issueIds = issues.map((i) => i.id);
  for (const id of issueIds) {
    const n = answer.impacts.filter((x) => x.issue === id).length;
    if (n !== 1) out.push(`Issue ${id} has ${n} assessments; give it exactly one.`);
  }
  for (const im of answer.impacts) {
    if (!issueIds.includes(im.issue)) out.push(`An assessment names ${im.issue}, which is not an issue.`);
    out.push(...pricingProblems(im, sector));
  }
  const factorIds = answer.factors.map((f) => f.item);
  for (const it of items) {
    const n = factorIds.filter((x) => x === it.id).length;
    if (n !== 1) out.push(`Item ${it.id} has ${n} weights and ratings; give it exactly one.`);
  }
  for (const f of answer.factors) {
    if (!ids.has(f.item)) { out.push(`A weight names ${f.item}, which is not an item of the SWOT.`); continue; }
    const q = quadrantOf(f.item);
    if (q === "strengths" && f.rating < 3) out.push(`Strength ${f.item} is rated ${f.rating}; a strength is 3 or 4.`);
    if (q === "weaknesses" && f.rating > 2) out.push(`Weakness ${f.item} is rated ${f.rating}; a weakness is 1 or 2.`);
  }
  for (const side of ["internal", "external"]) {
    const sum = round9(answer.factors.filter((f) => SIDE[quadrantOf(f.item)] === side).reduce((s, f) => s + f.weight, 0));
    if (Math.abs(sum - 1) > REFUSE_TOLERANCE) out.push(`The ${side} weights add up to ${sum}; they add up to 1.`);
  }
  return out;
}

/** What is wrong with one assessment's figure: its euros and the KPIs they rest on. */
export function pricingProblems(im, sector) {
  const out = [];
  if (im.monetisable) {
    if (!(im.eur_year_low <= im.eur_year_high)) out.push(`The euro range of ${im.issue} runs backwards: low ${im.eur_year_low} is above high ${im.eur_year_high}.`);
    if (!(im.eur_year_high > 0)) out.push(`${im.issue} is priced at nothing; price it or say why it can't be.`);
    if (!im.kpis.length) out.push(`${im.issue} is priced but moves no KPI. Name one to three KPIs it moves; where none fits, set monetisable to false with a reason, no KPI and zero euros.`);
    if (im.reason) out.push(`${im.issue} is priced, so its reason for not being priced stays empty.`);
  } else if (!im.reason || im.kpis.length || im.eur_year_low !== 0 || im.eur_year_high !== 0) {
    out.push(`${im.issue} is not priced, so it gives a reason, no KPI and zero euros.`);
  }
  for (const k of im.kpis) {
    const kSector = k.id.split(".")[0];
    if (!KPI_IDS.has(k.id) && !k.definition) out.push(`${im.issue} uses ${k.id}, which the library lacks, without a full definition.`);
    if (KPI_IDS.has(k.id) && ![sector, "general"].includes(kSector)) out.push(`${im.issue} uses ${k.id} from another sector than ${sector}.`);
    if (!(k.change_low <= k.change_high)) out.push(`${im.issue}: the change of ${k.id} runs backwards.`);
    if (k.direction === "down" ? k.change_high > 0 : k.change_low < 0) out.push(`${im.issue}: ${k.id} goes ${k.direction}, but its change says otherwise.`);
  }
  return out;
}

/**
 * The last resort once the Analyst's repair is spent (1.0.1): each assessment whose figure still breaks a
 * pricing rule, or the contract inside that one assessment (negative euros, a fourth KPI, a text over its
 * limit), becomes "not priced", with no KPI and zero euros, so one bad figure no longer stops a run that is
 * otherwise sound. A figure the Analyst gave takes the tool's reason, `words.setAside`; an issue it left
 * unpriced keeps its own reason where that fits, or `words.noReason` when it gave none. Nothing else
 * changes: weights, ratings and a missing or doubled assessment stay the guards' to refuse.
 * Returns { answer, setAside: the ids of the issues whose figure was left out }.
 */
export function setAsidePricing(answer, { sector }, words) {
  const setAside = [];
  const impacts = answer.impacts.map((im) => {
    if (!impactFaulty(im, sector)) return im;
    if (im.monetisable !== false) setAside.push(im.issue);
    const own = im.monetisable === false && typeof im.reason === "string" && validate(im.reason, SCHEMAS.Impact.properties.reason).valid ? im.reason : "";
    const reason = im.monetisable === false && !im.reason ? words.noReason : own || words.setAside;
    return { issue: im.issue, monetisable: false, reason, kpis: [], eur_year_low: 0, eur_year_high: 0, basis: "", confidence: im.confidence };
  });
  return { answer: { ...answer, impacts }, setAside };
}

/** True when one assessment breaks its own contract or a pricing rule. */
function impactFaulty(im, sector) {
  if (!validate(im, SCHEMAS.Impact, SCHEMAS).valid) return true;
  return pricingProblems(im, sector).length > 0;
}

/**
 * The Strategist's answer. ctx: { items: every item [{ id, quadrant }], issues: [{ id, impact,
 * likelihood, eur_year_low, eur_year_high, monetisable }], factors: [{ item, rating }] }.
 */
export function strategiesProblems(answer, { items, issues, factors }) {
  const out = [];
  const ids = new Set(items.map((i) => i.id));
  const issueIds = issues.map((i) => i.id);
  const ratingOf = new Map(factors.map((f) => [f.item ?? f.id, f.rating]));
  const n = answer.strategies.length;
  if (n < LIMITS.strategiesMin || n > LIMITS.strategiesMax) out.push(`There are ${n} strategies; return ${LIMITS.strategiesMin} to ${LIMITS.strategiesMax}.`);
  const sIds = answer.strategies.map((s) => s.id);
  if (new Set(sIds).size !== sIds.length) out.push("Strategy ids repeat; number them R1, R2 and so on.");
  const want = { S: "strengths", W: "weaknesses", O: "opportunities", T: "threats" };
  answer.strategies.forEach((s, i) => {
    if (s.id !== `R${i + 1}`) out.push(`Strategy ${i + 1} has the id ${s.id}; number them R1, R2 and so on, in order.`);
    const [inner, outer] = s.type.split("");
    for (const id of s.items) if (!ids.has(id)) out.push(`Strategy ${s.id} names ${id}, which is not an item of the SWOT.`);
    const internal = s.items.filter((id) => SIDE[quadrantOf(id)] === "internal");
    const external = s.items.filter((id) => SIDE[quadrantOf(id)] === "external");
    if (!internal.length || !external.length) out.push(`Strategy ${s.id} pairs at least one internal item with one external item.`);
    if (!internal.every((id) => quadrantOf(id) === want[inner]) || !external.every((id) => quadrantOf(id) === want[outer])) out.push(`Strategy ${s.id} is ${s.type}, so it pairs ${want[inner]} with ${want[outer]}, not ${s.items.join(", ")}.`);
    if (s.kind !== STRATEGY_KINDS[s.type]) out.push(`Strategy ${s.id} is ${s.type}, so its kind is ${STRATEGY_KINDS[s.type]}, not ${s.kind}.`);
    const issue = issues.find((x) => x.id === s.issue);
    if (!issue) out.push(`Strategy ${s.id} answers ${s.issue}, which is not an issue.`);
    const residual = s.residual[0] || null;
    const upside = s.upside[0] || null;
    if (s.kind === "mitigate" ? !residual || upside : !upside || residual) out.push(`Strategy ${s.id} ${s.kind === "mitigate" ? "mitigates, so it gives a residual and no upside" : "turns an issue into an advantage, so it gives an upside and no residual"}.`);
    for (const x of [residual, upside].filter(Boolean)) if (!(x.eur_year_low <= x.eur_year_high)) out.push(`Strategy ${s.id}: its euro range runs backwards.`);
    if (residual && issue) {
      const own = issueExpected(issue);
      const left = expected(residual.eur_year_low, residual.eur_year_high, residual.likelihood);
      if (own !== null && left > own + 1e-9) out.push(`Strategy ${s.id} leaves more at risk than issue ${s.issue} had.`);
      // A residual risk above the original (brief 7) counts the band too: what is left is no more likely.
      if (residual.likelihood > issue.likelihood) out.push(`Strategy ${s.id} leaves issue ${s.issue} more likely than it was (${residual.likelihood} against ${issue.likelihood}); what is left is at most as likely.`);
    }
    for (const r of s.ratings) {
      if (!s.items.includes(r.item)) out.push(`Strategy ${s.id} rates ${r.item}, which it does not pair.`);
      const q = quadrantOf(r.item);
      if (q === "weaknesses" && r.to > 2) out.push(`Strategy ${s.id} rates weakness ${r.item} at ${r.to}; a weakness stays at 2 or below.`);
      if (q === "strengths" && r.to < 3) out.push(`Strategy ${s.id} rates strength ${r.item} at ${r.to}; a strength is 3 or 4.`);
      const from = ratingOf.get(r.item);
      if (from !== undefined && r.to < from) out.push(`Strategy ${s.id} lowers the rating of ${r.item} from ${from} to ${r.to}.`);
    }
  });
  return out;
}

/** The Writer's answer. ctx: { facts: the fact keys it may cite, evidence: { titles, urls } }. */
export function summaryProblems(answer, { facts, evidence = { titles: [], urls: [] } }) {
  const out = [];
  const texts = [["headline", answer.headline], ["situation", answer.situation], ...answer.findings.map((t, i) => [`finding ${i + 1}`, t]), ["recommendation", answer.recommendation], ...answer.assumptions.map((t, i) => [`assumption ${i + 1}`, t])];
  for (const [where, text] of texts) {
    const a = auditText(text, { facts, evidence });
    if (a.tokens.length) out.push(`The ${where} writes figures in prose (${a.tokens.join(", ")}); put every figure in a {{fact:key}} placeholder or leave it out.`);
    if (a.unknownFacts.length) out.push(`The ${where} cites unknown facts (${a.unknownFacts.join(", ")}); use only the keys given.`);
  }
  return out;
}

const GUARDS = { complete: completionProblems, challenge: issuesProblems, assess: assessmentProblems, strategise: strategiesProblems, summary: summaryProblems };

/** Everything wrong with one step's answer: its contract first, then the guards. */
export function answerProblems(step, answer, ctx) {
  const schema = schemaProblems(step, answer);
  if (schema.length) return schema;
  return GUARDS[step] ? GUARDS[step](answer, ctx) : [];
}

function norm(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

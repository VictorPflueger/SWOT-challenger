#!/usr/bin/env node
// Checks every scenario in data/scenarios/ against the scenario rules of js/scenario_check.js (brief 7,
// AC-06): the contracts, both languages, ids, the guards, the fact audit, the sources in DATA_SOURCES.md,
// keys and thinking blocks, and the figures against tests/fixtures/scenarios.json. Each scenario is played
// along its recorded choice, with no strategy, with the recommended ones and with all of them.
// Prints SCENARIO CHECK OK. Usage: node tools/check-scenarios.mjs [s1 s2 s3]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { SCENARIOS } = await import(pathToFileURL(path.join(ROOT, "data/scenarios/index.js")).href);
const { scenarioProblems } = await import(pathToFileURL(path.join(ROOT, "js/scenario_check.js")).href);
const { assemble, recommended } = await import(pathToFileURL(path.join(ROOT, "js/scenario.js")).href);

/** The scenario rules' inputs for one scenario: DATA_SOURCES.md, the frozen figures, the other choices. */
export function inputs(scenario) {
  const dataSources = readFileSync(path.join(ROOT, "DATA_SOURCES.md"), "utf8");
  const reference = JSON.parse(readFileSync(path.join(ROOT, "tests/fixtures/scenarios.json"), "utf8"))[scenario.id] || null;
  const run = assemble(scenario, "en");
  const choices = [[], recommended(run), run.strategies.map((s) => s.id)];
  return { dataSources, reference, choices };
}

export async function checkAll(only = []) {
  const results = [];
  for (const s of SCENARIOS.filter((x) => !only.length || only.includes(x.id))) {
    let scenario;
    try { scenario = (await s.load()).default; } catch (e) { results.push({ id: s.id, name: s.name, problems: [`${s.id}: cannot be loaded: ${e.message.split("\n")[0]}`] }); continue; }
    const inp = inputs(scenario);
    const problems = scenarioProblems(scenario, inp);
    if (!inp.reference) problems.push(`${scenario.id}: tests/fixtures/scenarios.json has no frozen figures for it`);
    results.push({ id: s.id, name: s.name, problems });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  const results = await checkAll(only);
  let failed = 0;
  for (const r of results) {
    if (r.problems.length) { failed += 1; console.log(`FAIL  ${r.id} ${r.name}`); for (const p of r.problems) console.log(`      ${p}`); }
    else console.log(`PASS  ${r.id} ${r.name}: both languages, every rule, four choices played`);
  }
  if (failed || !results.length) process.exit(1);
  console.log("SCENARIO CHECK OK");
}

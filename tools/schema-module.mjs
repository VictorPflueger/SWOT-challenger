// Writes schemas/strategy-challenge-1.js from schemas/strategy-challenge-1.json, so the page can import
// the shared handoff schema as a module (its policy blocks JSON modules). tests/schemas.mjs fails while
// the two differ. Usage: node tools/schema-module.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(path.join(root, "schemas", "strategy-challenge-1.json"), "utf8"));
const head = [
  "// The handoff schema of schemas/strategy-challenge-1.json as a module: the page cannot import a .json",
  "// module under its security policy (connect-src blocks it, PLAN.md probe 19). tests/schemas.mjs holds the",
  "// two equal; change the JSON file and run `node tools/schema-module.mjs` to write this one again.",
  ""
].join("\n");
writeFileSync(path.join(root, "schemas", "strategy-challenge-1.js"), `${head}export default ${JSON.stringify(schema, null, 2)};\n`);
console.log("schemas/strategy-challenge-1.js written");

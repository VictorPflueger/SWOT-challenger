// A schema as the API takes it in output_config.format or a strict tool's input_schema (PLAN.md probe 7):
// references inlined, every object closed with additionalProperties: false, and every keyword the API
// answers with 400 taken out: numeric and length limits, array limits beyond minItems 0 or 1, oneOf, not,
// formats outside its list and patterns with word boundaries, lookaround or back-references. refused()
// also reports an anyOf beside type or properties and an enum or const that is not a scalar. A limit
// taken out moves into the field's description, so the model still reads it; js/schema.js and the guards
// check it in code. tests/schemas.mjs proves that no refused keyword survives.

/** The keywords the API accepts in a strict schema. */
const KEPT = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "const", "anyOf", "allOf", "$defs", "definitions", "default", "description", "title", "format", "pattern", "minItems"]);
/** The string formats the API accepts. */
export const FORMATS = Object.freeze(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"]);
/** Pattern features the API refuses: word boundaries, lookahead, lookbehind, back-references. */
const BAD_PATTERN = /\\[bB]|\(\?[=!<]|\\[1-9]/;

const NOTES = {
  minimum: (v) => `at least ${v}`,
  maximum: (v) => `at most ${v}`,
  exclusiveMinimum: (v) => `more than ${v}`,
  exclusiveMaximum: (v) => `less than ${v}`,
  multipleOf: (v) => `a multiple of ${v}`,
  minLength: (v) => (v === 1 ? "not empty" : `at least ${v} characters`),
  maxLength: (v) => `at most ${v} characters`,
  minItems: (v) => `at least ${v} items`,
  maxItems: (v) => `at most ${v} items`,
  minProperties: (v) => `at least ${v} fields`,
  maxProperties: (v) => `at most ${v} fields`
};

/**
 * The wire form of `schema`. registry: { Name: schema } for "$ref": "Name.json" (as js/schema.js reads
 * it); a reference is replaced by a wire copy of the schema it names.
 */
export function toWire(schema, registry = {}) {
  return convert(schema, registry, 0);
}

function convert(s, registry, depth) {
  if (depth > 32) throw new Error("schema nested too deeply, or a reference loops");
  if (Array.isArray(s)) return s.map((x) => convert(x, registry, depth + 1));
  if (!s || typeof s !== "object") return s;
  if (s.$ref) {
    const name = String(s.$ref).replace(/^.*\//, "").replace(/\.json$/, "");
    if (!registry[name]) throw new Error(`unknown schema reference ${s.$ref}`);
    const inlined = convert(registry[name], registry, depth + 1);
    return s.description ? { ...inlined, description: s.description } : inlined;
  }
  const out = {};
  const notes = [];
  for (const [key, value] of Object.entries(s)) {
    if (key === "oneOf") { out.anyOf = convert(value, registry, depth + 1); continue; }
    if (key === "minItems" && value > 1) { notes.push(NOTES.minItems(value)); continue; }
    if (key === "format" && !FORMATS.includes(value)) continue;
    if (key === "pattern" && BAD_PATTERN.test(value)) continue;
    if (!KEPT.has(key)) { if (NOTES[key]) notes.push(NOTES[key](value)); continue; }
    if (key === "properties") { out.properties = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v, registry, depth + 1)])); continue; }
    if (key === "$defs" || key === "definitions") { out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v, registry, depth + 1)])); continue; }
    out[key] = typeof value === "object" ? convert(value, registry, depth + 1) : value;
  }
  const isObject = out.type === "object" || (Array.isArray(out.type) && out.type.includes("object")) || out.properties;
  if (isObject) {
    out.additionalProperties = false;
    if (!out.properties) out.properties = {};
  }
  if (notes.length) out.description = [out.description, `(${notes.join(", ")})`].filter(Boolean).join(" ");
  return out;
}

/** Every keyword in `schema` that the API would refuse, as "path: keyword" lines. Empty: none. */
export function refused(schema, path = "") {
  const out = [];
  if (Array.isArray(schema)) { schema.forEach((x, i) => out.push(...refused(x, `${path}[${i}]`))); return out; }
  if (!schema || typeof schema !== "object") return out;
  for (const [key, value] of Object.entries(schema)) {
    const at = `${path}/${key}`;
    if (key === "properties" || key === "$defs" || key === "definitions") {
      for (const [k, v] of Object.entries(value)) out.push(...refused(v, `${at}/${k}`));
      continue;
    }
    if (!KEPT.has(key)) out.push(`${at}: ${key}`);
    else if (key === "minItems" && value > 1) out.push(`${at}: minItems ${value}`);
    else if (key === "format" && !FORMATS.includes(value)) out.push(`${at}: format ${value}`);
    else if (key === "pattern" && BAD_PATTERN.test(value)) out.push(`${at}: pattern ${value}`);
    else if (key === "$ref") out.push(`${at}: $ref`);
    if (value && typeof value === "object") out.push(...refused(value, at));
  }
  const isObject = schema.type === "object" || schema.properties;
  if (isObject && schema.additionalProperties !== false) out.push(`${path || "/"}: additionalProperties is not false`);
  // The structured outputs page, read on 25 November 2026: anyOf never beside type or properties, and enum
  // and const hold only strings, numbers, booleans or null.
  if (schema.anyOf && (schema.type !== undefined || schema.properties)) out.push(`${path || "/"}: anyOf beside type or properties`);
  for (const key of ["enum", "const"]) {
    const values = key === "enum" ? schema.enum : [schema.const];
    if (Object.hasOwn(schema, key) && (!Array.isArray(values) || values.some((v) => v !== null && typeof v === "object"))) out.push(`${path || "/"}: ${key} with a value that is not a string, number, boolean or null`);
  }
  return out;
}

/**
 * The parameters the API counts against its limits: optional ones (a property not in its object's
 * required list) and union-typed ones (anyOf or a type array). Limits per request: 24 and 16.
 */
export function countParameters(schema) {
  let optional = 0;
  let union = 0;
  const walk = (s) => {
    if (Array.isArray(s)) { s.forEach(walk); return; }
    if (!s || typeof s !== "object") return;
    if (Array.isArray(s.type) || s.anyOf) union += 1;
    if (s.properties) {
      const req = new Set(s.required || []);
      for (const [k, v] of Object.entries(s.properties)) { if (!req.has(k)) optional += 1; walk(v); }
    }
    for (const key of ["items", "anyOf", "allOf", "$defs", "definitions"]) {
      if (!s[key]) continue;
      if (key === "$defs" || key === "definitions") Object.values(s[key]).forEach(walk);
      else walk(s[key]);
    }
  };
  walk(schema);
  return { optional, union };
}

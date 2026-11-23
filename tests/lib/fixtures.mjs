// The golden fixtures of tests/fixtures/golden.json as numbers. Exact values are written as fractions or
// decimals in strings ("48/19", "0.95", "3700000"), so a fixture never carries a binary rounding error;
// exact() turns them into the nearest double, which the tests compare within 1e-9.
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./harness.mjs";

/** "48/19", "0.20" or "3700000" as a number. */
export function exact(text) {
  const s = String(text).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`not an exact number: ${JSON.stringify(text)}`);
  return Number(s);
}

/** The golden cases, read fresh. */
export function golden() {
  return JSON.parse(readFileSync(path.join(APP_ROOT, "tests", "fixtures", "golden.json"), "utf8"));
}

/** SW1's items as engine factors: { id, quadrant, weight, rating }, before or after the strategies. */
export function sw1Factors(when = "before") {
  return golden().SW1.items.map((i) => ({ id: i.id, quadrant: i.quadrant, weight: exact(i.weight), rating: when === "after" ? i.after : i.rating }));
}

/** SW1's change of ratings as one chosen strategy's rate changes. */
export function sw1Strategy() {
  const changes = golden().SW1.items.filter((i) => i.after !== i.rating).map((i) => ({ action: "rate", item: i.id, from: i.rating, to: i.after }));
  return { id: "R1", chosen: true, changes };
}

// The three scenarios, in the order the picker shows them. Each module's default export is a recorded run
// in the format of the Scenario contract (schemas/swot.js); the page loads one when it is chosen.
export const SCENARIOS = Object.freeze([
  { id: "s1", name: "Tidewell Lines", load: () => import("./s1.js") },
  { id: "s2", name: "Arvento Drives", load: () => import("./s2.js") },
  { id: "s3", name: "Auental Energie", load: () => import("./s3.js") }
]);
/** The scenario a first visit opens: the one the talk track walks through. */
export const DEFAULT_SCENARIO = "s2";

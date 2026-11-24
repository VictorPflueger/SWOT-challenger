# Tests

The app needs none of this: it is static files. The tests use Node.js 22 and, for the browser suites, Playwright with Chromium. No test calls the real Claude API: the live run is tested against a scripted stand-in (`tests/lib/fake-claude.mjs`) that answers with the scenarios' recorded answers and with planted faults.

## Setup

Install Playwright once, globally:

```
npm install -g playwright && npx playwright install chromium
```

Vici's checks come from a checkout of ViciDesign beside this repository (`../ViciDesign`), or from the folder `VICI_DIR` names, at the commit `vici/README.md` names. The handoff and report suites read every handoff file with the Prototype Ideator's own reader (`js/handoff.js`), from a checkout beside this repository (`../PrototypeIdeator`) or the folder `IDEATOR_DIR` names; CI checks it out at the commit the workflow names.

A suite that needs Playwright finds it through `NODE_PATH`, `PLAYWRIGHT_MODULE` or `npm root -g`. `CHROME_PATH` points it at another Chromium.

## Run

```
node tests/run-all.mjs                  every suite
node tests/run-all.mjs engine schemas   only those
node tests/run-all.mjs --require-vici   Vici's checks must run
node tests/run-all.mjs --require-ideator   the Prototype Ideator's reader must run
```

Without a ViciDesign checkout, the suites that need one say so and pass, unless `--require-vici` is given or they run on GitHub Actions. Without the Prototype Ideator, the handoff and report suites skip its reader and say so, unless `--require-ideator` is given.

## What each suite proves

| Suite | What it proves |
|---|---|
| `tokens` | Vici's colours, light and dark: contrast and colour-blind separation |
| `page-icon` | The page icon in the favicon, the header and the loading screen |
| `vici-files` | `vici/` holds exactly the files its README lists, unchanged |
| `engine` | The golden cases SW0 to SW3 and the handoff example within 1e-9, every display string in both languages, the IE boundaries |
| `schemas` | Every contract accepts a valid answer and refuses a broken one; no request schema carries a keyword the API refuses; the handoff schema's JSON and module agree |
| `kpis` | The thirteen sectors, 8 to 12 KPIs each and ten in general, both languages, no benchmark value |
| `scenarios` | The three scenarios pass every scenario rule in both languages, along the recorded choice and three others; the rules catch each defect the brief lists, planted in a copy of S2 |
| `audit` | The fact audit lets placeholders, a standard's number, an evidence year, legal references, ISO dates and ids through and refuses every other figure, in golden texts of both languages; every summary's placeholders render, matching the figures worked out by hand |
| `unit` | The session-cost estimate, recounted with the prices written out; its display in both languages; the Method dialog's worked example against the golden case SW1; what each step shows and which items a choice addresses; the shared client's retries (twice, after 1.5 and 4 seconds or retry-after up to 20 seconds, never for credit, a spend limit, a key or a model); each request's worst case, the lowering, the stop and the refusal above 100,000 tokens on Haiku 5.5; the meter within 1e-9; the private-data scan on its samples; every API error in words and one next step in both languages |
| `guards` | Each refusal of the live guards, planted in a valid answer of Arvento Drives, returns its own message; the recorded answers pass |
| `i18n` | The same keys and placeholders in both languages, every key used, no sentence typed into the code |
| `policy` | The exact policy, nothing loaded from elsewhere, nothing inline, storage only where allowed; Vici's `policyProblems` and `storageProblems` agree |
| `hygiene` | No client, contact or meeting named in any published file |
| `docs` | The documents exist, name real paths and sections, and date the prices; the workflow files parse |
| `lean` | The build stays lean: the presenter in at most ten modules and 2,200 lines, `js/` in 6,500 lines and two stylesheets in 900; requests only from `js/anthropic.js`; no host named but the API and the listed links; the policy; nothing the design review cut; README, DESIGN, DEMO_SCRIPT and DATA_SOURCES within their word limits |
| `parity` | The shared files equal the sibling tools' copies, where a sibling has them; the PDF text reader (`tests/lib/pdf-text.mjs`) is the Prototype Ideator's |
| `handoff` | The handoff file of each scenario in both languages, with the recorded choice, none and all: the shared schema and its references, the engine's figures within 1e-9, strategies as responses with rate changes, no key, prompt or thinking, and the Prototype Ideator's reader; planted defects fail both checks |
| `vici` | Vici's guide, byline, writing, AI notice and record-id checks on the page as served and rendered, and Vici's guide render check |
| `smoke` | In Chromium: a first visit in English, the switch without a reload, one guide per language, the theme from the first paint, nothing kept, as Vici's `storedKeyProblems` confirms |
| `presenter` | In Chromium: every scenario from Start to Summary in both languages, by click, key and address; Play's timing on a fake clock; the tiles answering first and after the decision; every item's state on every step (Vici's `frameworkProblems`); the risk matrix (`riskMatrixProblems`); the tables behind each matrix; the Method dialog |
| `layout` | In Chromium at 1920 × 1080, 1440 × 900, 1366 × 768 and 1280 × 720, both themes and languages, every step of every scenario, the guide and the Method dialog: nothing wider than the window, no text cut, no table scrolling sideways, every target at least 24 px (a link inside a sentence apart) and the primary actions at least 40 px, every SWOT item in view, the bar in the window, every strategy card in full, a steady header, the report the Summary opens with Save as PDF in view; and the live screens: the Start form, the dialog whole at its first opening (no scrolling, the estimate in view) and its start button and the AI notice in view, the wait, the check, an error, Run it live in the step bar |
| `access` | In Chromium: the keyboard alone runs the simulation from the guide on a first visit to Save as PDF, and a live run against the stand-in from Run it live to the Summary, in both languages, with Vici's focus ring on every stop and the focus never on something hidden; with the rings taken out of the page's styles the check fails. With reduced motion nothing moves but Vici's spinner, on Play's steps, the decision, the guide, the Method and report dialogs and the live wait, and Play still moves on; without it the probe finds motion. `node tests/access.mjs keyboard` or `motion` runs one group |
| `hexagon` | Nothing round, in the files and on the rendered page in both themes |
| `live` | In Chromium against the stand-in: every request's model, effort, thinking, schema and headers for each setting; one repair, then a stop; Abort; the cap and the meter; each API error in words, with the retries of brief 5.8; the dialog (Vici's `liveDialogProblems`, the box, the frame, the private-data warning); research with pause_turn, refused URLs and web search switched off; the person's check of the AI's items; nothing kept and the key nowhere; the screens nobody demos; Save run as simulation, accepted by the scenario rules and played back. `node tests/live.mjs ac10` runs one group |
| `report` | In Chromium: Save as PDF prints each scenario in both languages with the footer on every page ("Created with SWOT Challenger", the address, "Built by Victor Pflüger · page x of y"; in German "Erstellt mit …", "Seite x von y"), the cover first, the summary on page 2, the sections in order, and with Vici's margin-box rule removed the check fails; the longest summary the contract allows flows on; the HTML file loads nothing, keeps the look and prints with the footer; the JSON file passes the schema and the Ideator's reader; the report and the handoff file carry the tiles' figures, which are the engine's; the Summary step; a live run's report (mode and model, the cutoff note, sources with their dates, a stop on every page, no key, nothing kept); the file names. `node tests/report.mjs pdf` runs one group |

Most suites first prove on planted errors that their checks can fail. Six check the files and the page as they are, without a planted control: `presenter`, `parity`, `page-icon`, `vici-files`, `hygiene` and `live_site`.

## The private term list

`tests/hygiene.mjs` reads the names that must never appear from the `HYGIENE_TERMS` environment variable (the repository secret of the same name in CI), else from the file `HYGIENE_TERMS_FILE` names, else from a file `.hygiene-terms` beside the repository folder; one entry per line. Without a list it runs the generic checks only and prints `HYGIENE GENERIC OK` instead of `HYGIENE OK`. The list itself is never committed.

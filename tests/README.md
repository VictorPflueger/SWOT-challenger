# Tests

The app needs none of this: it is static files. The tests use Node.js 22 and, for the browser suites, Playwright with Chromium. No test calls the real Claude API.

## Setup

Install Playwright once, globally:

```
npm install -g playwright && npx playwright install chromium
```

Vici's checks come from a checkout of ViciDesign beside this repository (`../ViciDesign`), or from the folder `VICI_DIR` names, at the commit `vici/README.md` names.

A suite that needs Playwright finds it through `NODE_PATH`, `PLAYWRIGHT_MODULE` or `npm root -g`. `CHROME_PATH` points it at another Chromium.

## Run

```
node tests/run-all.mjs                  every suite
node tests/run-all.mjs engine schemas   only those
node tests/run-all.mjs --require-vici   Vici's checks must run
```

Without a ViciDesign checkout, the suites that need one say so and pass, unless `--require-vici` is given or they run on GitHub Actions.

## What each suite proves

| Suite | What it proves |
|---|---|
| `tokens` | Vici's colours, light and dark: contrast and colour-blind separation |
| `page-icon` | The page icon in the favicon, the header and the loading screen |
| `vici-files` | `vici/` holds exactly the files its README lists, unchanged |
| `engine` | The golden cases SW0 to SW3 and the handoff example within 1e-9, every display string in both languages, the IE boundaries |
| `schemas` | Every contract accepts a valid answer and refuses a broken one; no request schema carries a keyword the API refuses; the handoff schema's JSON and module agree |
| `kpis` | The thirteen sectors, 8 to 12 KPIs each and ten in general, both languages, no benchmark value |
| `i18n` | The same keys and placeholders in both languages, every key used, no sentence typed into the code |
| `policy` | The exact policy, nothing loaded from elsewhere, nothing inline, storage only where allowed; Vici's `policyProblems` and `storageProblems` agree |
| `hygiene` | No client, contact or meeting named in any published file |
| `docs` | The documents exist, name real paths and sections, and date the prices |
| `parity` | The shared files equal the sibling tools' copies, where a sibling has them |
| `vici` | Vici's guide, byline, writing, AI notice and record-id checks on the page as served and rendered, and Vici's guide render check |
| `smoke` | In Chromium: a first visit in English, the switch without a reload, one guide per language, the theme from the first paint, nothing kept, as Vici's `storedKeyProblems` confirms |
| `hexagon` | Nothing round, in the files and on the rendered page in both themes |

Every suite first proves on planted errors that its checks can fail.

## The private term list

`tests/hygiene.mjs` reads the names that must never appear from the `HYGIENE_TERMS` environment variable (the repository secret of the same name in CI), else from the file `HYGIENE_TERMS_FILE` names, else from a file `.hygiene-terms` beside the repository folder; one entry per line. Without a list it runs the generic checks only and prints `HYGIENE GENERIC OK` instead of `HYGIENE OK`. The list itself is never committed.

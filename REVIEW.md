# Review

Version 1.0.0. Every file this tool took from Vici or a sister prototype, how and why, then the three reviews of the release: an agent that did not build the tool, the design review on the running tool and Vici's partner review. PLAN.md, section 2.2, is the reuse map the plan set out; this list holds what the repository carries now. The sources:

- ViciDesign at `818718c`, Victor's design system on `main` (v1.0.0)
- the Data Quality Agent 2.2.0 at `831f050` (DQ in PLAN.md): the presenter, the shared Vici tests and the workflows
- the Sovereignty Assessment 2.0.0 at `35c0dea` (SA): the bilingual build, the language and documents tests, the live client's first source
- the Prototype Ideator at `532e0f5`: the first of the set to merge the shared live client, and the PDF text reader
- the BMC Challenger at `11cb1c2`: the newest lean test

## Independent review

Reviewer: Claude Opus 5.5, an agent that did not build the tool, on 24 November 2026, of the release candidate on branch `m5-release`: the code, the documents, the tests run in full, the three scenarios played in both languages and themes, live runs against a scripted stand-in, the downloads read page by page, and the handoff file put through the Prototype Ideator's own reader. It found 4 findings of high severity, 6 of medium and 8 of low. The table gives each one and what was done; TECH_NOTES.md, section 13.5, says how.

| n | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | With research on, a run could pass its budget cap: the worst case of the Scout's request left out the search results, which the API bills as input tokens, so a run with a €0.10 cap ended at €0.1074 | Fixed: every worst case adds 20 % to its own input and 12,000 tokens a search, the Haiku check against 100,000 tokens too; the Scout asks for as many searches as fit, or skips research with a note. Tested at €0.15 on Thorough and €0.05 on Balanced |
| 2 | High | A fictional company filled in for a demo lost its fiction label in a live run: the screens, the report and the handoff file called it real | Fixed: the step bar, the report's cover and About this report, the handoff file and the saved run say it is fictional; the saved run's contract takes true or false |
| 3 | High | A strategy's euro figure, the Strategist's estimate, showed as a plain number, without the AI mark and without what it rests on | Fixed: lilac with the AI mark on the cards, the table and the Summary. Every range now carries the Strategist's basis and confidence, which the Strategy contract asks for, and the details, the Summary and the report show them with the range, the likelihood and how code turns them into the figure; the scenarios' 13 strategies have both in both languages |
| 4 | High | At the live check the person types into an AI item without the "Public information only" line, and the edit reached the Red team unscanned | Fixed: the check panel says it; an edit that looks private gets a warning under the item, which does not block |
| 5 | Medium | An issue the Analyst could not price reached the Prototype Ideator as €0, so its At stake said "on 6 of 6" where the tile said "on 5 of 6"; TECH_NOTES contradicted itself | Fixed: no euros (null) for such an issue; a test runs the Ideator's own sum against the tile for every scenario and choice; TECH_NOTES, section 12.4, corrected |
| 6 | Medium | "N addressed now" under Items challenged counted every item a choice raises, challenged or not, while the handoff file counted challenged items | Fixed: the note counts the challenged items a choice addresses, as the file does, and names their number (S2: "2 of 6 addressed now", where it said "4 addressed now"); DEMO_SCRIPT and the tests follow |
| 7 | Medium | Printed from the dark theme with background graphics, every PDF page sat in a black frame | Fixed in Vici first (pull request 46, merged): in print the page takes the light scheme; Vici's print check and `tests/report.mjs` test it |
| 8 | Medium | After a finished live run, Adopt these strategies did nothing for a new choice | Fixed: the new choice takes effect without another request, since the Writer's summary holds for any choice, and opens the Summary; the saved run holds it |
| 9 | Medium | S1 was based in Hamburg and S3 left out heat, against the brief and the sister tools, unrecorded | Fixed: Bremen, and heat and car charging, recorded in DATA_SOURCES.md |
| 10 | Medium | The documents suite failed: this file lacked its three reviews | Fixed: this section, the design review and the partner review below |
| 11 | Low | A key-shaped string typed into the form raised no warning and stayed in the saved run | Fixed: the private-data warning names an API key; the saved run, the report and so the PDF and the HTML file show it redacted |
| 12 | Low | At the check the person could remove every item outside the company, and the Analyst's answers were then refused | Fixed: the last item inside or outside the company stays, with a sentence that says why |
| 13 | Low | The residual guard compared expected euros only, so a residual more likely than its issue passed; the handoff's residual left out impact and band | Fixed: a residual more likely than its issue is refused and the Strategist is told so. Kept: impact and band stay out of the file's residual, as the shared schema allows, since the Strategist gives no impact for it |
| 14 | Low | Clear everything while a request ran logged an error when the request ended | Fixed: a run's events count only while it is the page's run; tested |
| 15 | Low | Text hidden for screen readers escaped the story column, so the page itself grew up to 3,371 px high and could scroll | Fixed: the column is positioned; `tests/layout.mjs` fails a page higher than the window |
| 16 | Low | The Session cost tile missed three details of the brief: the Thorough figure in the guide, the words "estimated, simulated run", the cap after a finished live run | Fixed, all three |
| 17 | Low | A summary that failed the figure check twice entered the handoff file unflagged | Fixed: the file's summary says so first |
| 18 | Low | Document nits: an old version in DATA_SOURCES.md, line counts in TECH_NOTES.md, a claim in tests/README.md, a key note that read as a contradiction | Fixed |

While checking these fixes, the keyboard suite learned to fail a focus behind the bar at the story's foot (WCAG 2.2, 2.4.11) and found 16 such stops; the story column's scroll padding now follows the bar's height.

The same agent then verified every fix the way it had found the problem: 17 verified, and finding 3 only partly, since the ranges still lacked a basis and a confidence of their own; they have both now, as the table says. It judged the second decision, impact and band left out of the file's residual, acceptable. It found four new problems of low severity, all fixed:

| n | Severity | Finding | Status |
|---|---|---|---|
| 19 | Low | After a finished live run, a new choice kept the Writer's text, but the Writer had been told which strategies were chosen, so its text could describe the earlier choice ("the two chosen strategies") | Fixed: the Writer sees the strategies without the choice and is told to write for any choice and to cite the figures that follow the choice only as placeholders, as the recorded summaries do |
| 20 | Low | The cap's promise with research on rests on 12,000 tokens of results a search, which no live run has measured, yet the dialog and README promised without that condition | Fixed: the research help and README say that each search counts as 12,000 tokens; TECH_NOTES, section 13.5, says the first live research runs should measure it |
| 21 | Low | "2 addressed now" counted challenged items while the grid marked four items Addressed on the same screen | Fixed: the note names its count, "2 of 6 addressed now" |
| 22 | Low | TECH_NOTES named brief 5.3 for the cost tile's words; they are in 5.5 | Fixed |

A second verification found these five fixed and two more of low severity, both fixed:

| n | Severity | Finding | Status |
|---|---|---|---|
| 23 | Low | The Writer still received the values of the facts that follow the choice, such as "Hold and maintain", and could restate them in words the fact audit cannot catch | Fixed: those five facts reach the Writer as "follows the choice", so it can cite them but not restate them; tested |
| 24 | Low | In the report, a strategy's "AI estimate" tag was followed by a row labelled "AI estimate" | Fixed: the report labels that row "How it is worked out" |

## Design review

/steve-jobs-design-review on the running tool, 24 November 2026, after the fixes of the independent review: played cold at 1280 × 720 in English from a first visit, with the guide opening by itself, through every step to the report; again at 1920 × 1080 in the dark theme in German; the live Start form empty and with a missing name, a live run that stopped for lack of credit, the live check with a warned edit, and the page opened from a file.

```
# Design Review: SWOT Challenger 1.0.0
**Verdict:** INSANELY GREAT (score 10/10)
**The One Thing:** What this SWOT gets wrong or leaves out, what that costs a year and which strategies answer it, in minutes and for cents.
**Keeps its promise?** Yes. Before anything runs, the tiles show €4.9m a year at stake on 5 of 6 issues for Arvento Drives. Three presses (Start the agents, Challenge this SWOT, Adopt these strategies) reach the decision, which leaves €3.3m and lifts the response to the market from 1.60 to 2.55, the old values struck through, and "2 of 6 addressed now" says how many of the 6 challenged items the choice reaches. Play takes 36 s in English and 35 s in German of the talk track's five minutes; a live run on Balanced is estimated at less than a cent, €0.08 on Thorough.
**Cut list:** the company picker's fill on every change (choosing now changes nothing until Fill in); the large layout at 1440 × 900, which cut the SWOT's fields; the strategy lead's second line at 1280 × 720.
**Fix list:** none open. Done this cycle: the picker, 1440 × 900, the live dialog at 1366 × 768, the targets under 24 px, the backdrop's fade under reduced motion, the focus behind the bar, and the 18 findings of the independent review.
**Back of the fence:** the page opened from a file shows the guide over the loading screen, and its advice once the guide is closed; a stopped live run says what happened, what to do and what is kept, with the spend against the cap; an edit at the check that looks private is warned above its Edit button; the HTML report loads nothing a year from now; a PDF from the dark theme with background graphics prints on white; the PDF in Firefox and Safari carries the footer without page numbers, as Victor checked.
```

## Partner review

Vici's partner review in its eight steps, on the running tool, 24 November 2026, after the independent review's fixes.

```
Partner review: SWOT Challenger
Verdict: ready
The One Thing: The agents show what a company's own SWOT gets wrong or leaves out and what that costs a year: Arvento Drives has €4.9m at stake on 5 of 6 issues, and the two strategies it adopts leave €3.3m.
Keeps its promise: yes. Opened cold at 1280 × 720, the guide opens by itself and its first chapter says what goes in, what comes out and what you decide; behind it the tiles already show the €4.9m. Each step says what the agents do, what it is worth and which figure moves: Complete adds 4 items in lilac with what each rests on, Challenge marks 6 of 14 items and adds the threat nobody listed, Assess puts the issues into the sector's own figures and prices 5 of 6 in euros, Strategise moves the tiles at the decision (4.9m to 3.3m, 1.60 to 2.55), Summary ends in the report. Every figure comes from the scenario through the engine; an issue's sources are one click away; SIMULATION and "Fictional company" stand on every step, and every AI figure is lilac and says what it rests on. Presented along the guide's script, Play takes 36 s of its five minutes.
Cut list: nothing left to cut. Each of the five steps moves the story, the tiles answer first, and the figures move at the decision, as the brief asks.
Fix list: none
Keep list: the byline (Built by, portrait, LinkedIn and the globe), the talk track (opens on start, explains the four key figures, five timed steps), the key figures (At stake a year, Items challenged, Response to the market, Session cost), the lilac AI marks with their basis, the public-information line wherever a person types, and the report's footer on every page.
```

## Copied unchanged

| File | From | Why |
|---|---|---|
| `vici/` (28 files, listed in its README) | ViciDesign | Standing requirement 1: Vici's files unchanged, at a named commit; `tests/vici-files.mjs` and `tests/vici.mjs` compare them byte for byte |
| `js/sse.js` and `js/cost.js` | DQ and SA, the same files, taken through the Prototype Ideator | The shared live client's stream reader and cost maths, the same in every tool |
| `js/anthropic.js` and `js/keystore.js` | Prototype Ideator | PLAN.md has this tool adapt them from SA and DQ: the console label from the app's name, and the key in one module variable instead of session storage. The Ideator merged exactly those changes first, so they came from it unchanged (TECH_NOTES.md, section 11.1) |
| `js/schema.js` | SA, identical in the Prototype Ideator | A JSON Schema validator without dependencies, for every answer, scenario and handoff file |
| `tests/hexagon.mjs`, `tests/tokens.mjs`, `tests/page-icon.mjs` and `tests/vici-files.mjs` | DQ | Vici's shared tests, the same files in every prototype; this tool's part is `tests/lib/prototype.mjs` |
| `tests/hygiene.mjs` | SA | No client, prospect, contact or meeting named in a published file |
| `tests/lib/strings.mjs` | SA | The string reader behind the language test |
| `tests/lib/pdf-text.mjs` | Prototype Ideator | Reads each printed page's text without a dependency, for the report's footer checks |

This tool built the set's shared data first, and the siblings copied it: `js/risk.js`, `data/kpis.js`, `schemas/strategy-challenge-1.json` and its module twin `schemas/strategy-challenge-1.js` (TECH_NOTES.md, section 7). `tests/parity.mjs` holds them equal.

## Adapted

| File | From | What changed, and why |
|---|---|---|
| `index.html` | DQ's frame with SA's two guides and language switch | This tool's header with four key figures, six steps, the SWOT grid and the story with its Your turn bar, Vici's live-run dialog, the report and Method dialogs, and a guide per language with its talk track |
| `css/app.css` | DQ's header, tiles, step bar, turn bar and stage; SA's language switch and loading screen | The SWOT grid and its item states, the panels and matrices, the live screens and the laptop layout up to 1440 × 900 |
| `js/estimate.js` | DQ | Rebuilds a run's five requests from the recorded answers, at list price, instead of a tool loop |
| `js/dom.js` | DQ | Elements with text only; without the SVG option, and custom properties through the CSS object model the policy allows |
| `js/main.js` | SA | Boots the page and reports a failed module on the loading screen; this tool's names |
| `js/lang.js` | SA | Picks the language before Vici starts; the key is `swot.lang` |
| `js/i18n/index.js` | SA | Both languages without a reload; the storage key comes from the configuration |
| `js/config.js` | SA | This tool's id, the models and prices, the three settings, the cap's range, the policy constant and `swot.lang` |
| `js/api_messages.js` | SA | Adds a model the key may not use and the credit and spend-limit refusals |
| `js/facts.js` | SA | The `{{fact:key}}` placeholders and the fact audit; the facts are money, scores and zones |
| `js/format.js` | SA | Numbers and dates in en-GB and de-DE; money moved to the shared `js/risk.js` |
| `tests/lib/prototype.mjs` | DQ | This tool's name, colour pairs, hexagon tour and page icon |
| `tests/policy.mjs` | DQ | This tool's policy, nothing inline, storage only where allowed |
| `tests/presenter.mjs` | DQ | This tool's steps by click, key and address, Play, the tiles, the grid and the matrices |
| `tests/live_site.mjs` | DQ | This tool's files, and a scenario playing on the published site |
| `tests/run-all.mjs` | DQ | This tool's 25 suites, with Vici and the Prototype Ideator required in CI |
| `tests/README.md` | DQ | This tool's suites and setup |
| `.github/workflows/tests.yml` and `.github/workflows/live-site.yml` | DQ | ViciDesign at this tool's pin, the Prototype Ideator for the handoff, the siblings for parity, this tool's suites |
| `tests/i18n.mjs` | SA | This tool's key families and the texts that read the same in German |
| `tests/unit.mjs` | SA | This tool's estimate, budget, retries, meter, private-data scan and API errors |
| `tests/vici.mjs` | SA | Vici's guide, byline, writing, AI notice and record-id checks on this page and the scenario texts |
| `tests/docs.mjs` | SA | This tool's documents, sections, named paths and dated prices |
| `tests/audit.mjs` | SA | This tool's placeholders and the guards of brief 6.7 |
| `tests/live.mjs` | SA | The pipeline's requests, repair, Abort, cap, errors, research and the person's check, against the stand-in |
| `tests/lib/fake-claude.mjs` | SA | Answers structured requests and checks `output_config` |
| `tests/lib/harness.mjs` | SA | This tool's output folder, ports and storage key |
| `tests/lib/fixtures.mjs` | SA | The golden fixtures as exact numbers |
| `tests/lean.mjs` | SA, in the BMC Challenger's newer form | This tool's limits (the presenter in ten modules and 2,200 lines, `js/` in 6,500, two stylesheets in 900) and the design review's cuts |

## Planned, and taken another way

- DQ's `js/kpis.js` became `js/tiles.js`, since `data/kpis.js` holds the sector KPIs (TECH_NOTES.md, section 10).
- DQ's `js/live_dialog.js` became Vici's live-run dialog, which this tool added to Vici in M3, driven by `js/live.js`.
- DQ's and SA's `js/theme.js` is Vici's `vici/dist/vici-theme.js` (TECH_NOTES.md, section 9).
- DQ's `tests/lib/turns.mjs` became `tests/lib/live-page.mjs`, whose stand-in answers from a scenario's steps.
- SA's `js/events.js` and `js/audit.js` were not needed: `js/pipeline.js` keeps its own record of each request.
- SA's `js/runs_check.js`, `tools/check-runs.mjs` and `tests/runs.mjs` became `js/scenario_check.js`, `tools/check-scenarios.mjs` and `tests/scenarios.mjs`.
- SA's `js/agent.js`, `js/run_common.js` and `js/evidence.js` gave the Scout's rules in `js/scout.js`: the paused turn sent back, and only URLs from its own searches.
- SA's `tests/lib/play.mjs` was not needed: the tests play a scenario with the page's own `js/scenario.js`.
- SA 1.0.0's `js/export.js` gave way to Vici's report pattern, whose `report.html()` writes the HTML file that `js/report.js` assembles (TECH_NOTES.md, section 12).

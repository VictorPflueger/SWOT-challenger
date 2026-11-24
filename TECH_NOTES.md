# Technical notes

Version 1.0.0 (M5 Release), 24 November 2026. These notes record what was checked at source, with the date, and the decisions the code rests on. PLAN.md is the plan Victor approved on 23 November 2026, with the eleven cuts of its design review. Where the code says "brief 6.4", it means section 6.4 of Victor's build brief, which is not part of this repository.

## 1. Models and prices

Read on 23 November 2026 at https://platform.claude.com/docs/en/about-claude/pricing and https://platform.claude.com/docs/en/about-claude/models/overview. US dollars per million tokens.

| Model | API id | Input | Output | Cache write (5 min) | Cache read |
|---|---|---|---|---|---|
| Haiku 5.5 | `claude-haiku-5-5` | $0.10 | $0.50 | $0.125 | $0.01 |
| Sonnet 5.5 | `claude-sonnet-5-5` | $2 | $10 | $2.50 | $0.10 |
| Opus 5.5 | `claude-opus-5-5` | $4 | $20 | $5 | $0.20 |

Haiku 5.5 prompts over 100,000 tokens cost $0.50 input and $2.50 output, so no request may come near that size. Web search costs $10 per 1,000 searches plus its tokens. The three models share a context of one million tokens, 128,000 output tokens and a reliable knowledge cutoff of June 2026.

Version 0.2.0 calls no model, but `js/config.js` already holds these prices: the simulation shows what a live run of its scenario would cost (section 10). Costs show in euros at the rate the four tools share, 1 USD = 0.894 EUR, which keeps a cost meter steady. For comparison, the European Central Bank's reference rate of 20 November 2026 was 1.0990 US dollars a euro, about 0.910 euros a dollar (read on 23 November 2026 at https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html). The live run arrives in 0.3.0; its prices are read again on that day and dated here.

## 2. The API from the browser

Probed on 23 November 2026 with curl, and with Chrome 153 on a local page under the app's exact policy. PLAN.md, section 11, holds the full table with its sources.

- The `anthropic-dangerous-direct-browser-access: true` header makes the API's answers readable in the page; without it Chrome blocks them. Preflight allows the four headers the client sends, from any origin.
- Keyless requests with `anthropic-version: 2023-06-01` get a 401 for the missing key and nothing else.
- `GET /v1/models` answers a keyless request with a 401 the page can read. With a key, it is the free key check.
- Structured outputs go in `output_config.format` as `{ "type": "json_schema" }`, with no beta header. The API accepts types, `enum`, `const`, `anyOf`, `$ref`, `required`, `additionalProperties: false`, ten string formats and `minItems` of 0 or 1, and answers 400 to every other limit. `js/wire.js` strips those before sending (section 5).
- Effort goes in `output_config.effort`. Haiku 5.5 takes `thinking: { "type": "disabled" }` up to high effort; Sonnet 5.5 refuses it. Sonnet 5.5 and Opus 5.5 also refuse forced tool use, so the Scout calls its tool with `tool_choice` auto.
- Under the policy, the browser blocks a same-origin JSON module by `connect-src`, while JavaScript modules load. Hence `schemas/strategy-challenge-1.js` beside the JSON file.
- A paid Claude plan does not include API use (support.claude.com, article 9876003). Max, Ultra and Team plans include monthly API credits.

The probes that need a key are one console snippet in PLAN.md, section 11. Victor has not run it yet; its table goes here, with the date, when he has.

## 3. The policy and what the browser keeps

The policy is the brief's, in one meta element of `index.html` and as `CSP` in `js/config.js`. `tests/policy.mjs` holds the two equal and checks that nothing loads from another host and nothing is inline, and Vici's `policyProblems` agrees. The page's styles live in `css/app.css`. The theme comes from Vici's `vici/dist/vici-theme.js`, a plain script in the head that applies the remembered choice before the first paint; `data-vc-theme-default="light"` on the `<html>` element keeps the page light until the visitor chooses dark, because the room is usually lit.

The browser keeps `vc-theme` (Vici's theme) and `swot.lang` (the language) in local storage, Vici's `vc-guide:` notes in session storage, and nothing else. Only `vici/dist/vici-theme.js`, `js/lang.js` and `js/i18n/index.js` touch storage, which `tests/policy.mjs` checks in the source with its own scan and with Vici's `storageProblems`. `tests/smoke.mjs` checks in Chromium that local storage, session storage, IndexedDB, the Cache API and cookies hold nothing more after a visit, and Vici's `storedKeyProblems` agrees.

## 4. The engine

`js/risk.js`, shared with the other challengers, and `js/engine.js` hold pure functions.

| Part | Rule |
|---|---|
| Risk band | Impact × likelihood: low 1 to 4, medium 5 to 9, high 10 to 15, critical 16 to 25 |
| Probability | Likelihood 1 to 5 counts as 0.1, 0.3, 0.5, 0.7 and 0.9 |
| Expected euros | The midpoint of the range × the probability. At stake adds up the issues that can be priced and says how many it rests on. Left takes the lowest residual of the chosen responses per issue. Upside adds up the chosen advantages |
| IFE and EFE | After Fred R. David: the sum of weight × rating on each side. Weights that miss 1 by more than 0.001 are rescaled, and the guards refuse a miss above 0.05 |
| IE matrix | IFE across, EFE up, each strong or high from 3.00 and average or medium from 2.00. Cells I to IX run row by row: grow and build in I, II and IV; hold and maintain in III, V and VII; harvest or divest in VI, VIII and IX |
| Rounding | First to 1e-9, from the exact decimal value of the double (`toFixed(9)`); then once for display, halves away from zero, on decimal digits (BigInt). So 2.525 shows as 2.53, and €1,399,999.9999999998 counts as €1.4m |
| Money | From €999,500 in millions with one decimal ("€3.7m", "3,7 Mio. €"); from €999.50 in whole thousands ("€300k", "300 Tsd. €"); below that in whole euros. The unit follows the rounded value, so no screen shows €1000k. German puts no-break spaces between number, word and sign |

`tests/engine.mjs` reproduces the golden cases SW0 to SW3 of `tests/fixtures/golden.json` within 1e-9, every display string in both languages, the IE boundaries and the handoff example of brief 4.3.

## 5. Contracts and the wire

`schemas/swot.js` holds the contracts of brief 10. Every field of an agent's answer is required and none has two types, so each request schema has 0 optional and 0 union-typed parameters, against the API's limits of 24 and 16. A value that may be absent is an array of zero or one element (a strategy's `residual` or `upside`), or a flag with a reason (`monetisable`). `js/wire.js` inlines references, closes every object and moves each limit it strips into the field's description. `tests/schemas.mjs` proves that no refused keyword survives.

One strategy answers one issue, because the handoff file's response holds one `issue` and one residual. Where two chosen strategies answer one issue, the lower residual counts.

The shared handoff schema `schemas/strategy-challenge-1.json` follows brief 4.3. `tools/schema-module.mjs` writes its module twin, and `tests/schemas.mjs` holds the two equal. The brief leaves some choices open; the sibling tools take these over unchanged:

- `horizon` is `now`, `1_to_3_years` or `over_3_years`.
- An issue that cannot be priced carries `null` in its three euro fields and its reason in `eur_basis`.
- A response's `kind` is `mitigate`, `advantage`, `accept` or `monitor`. Its `changes` take one of three shapes: a canvas change (`area`, `action` add, change or remove, `text`), a SWOT rating (`action: "rate"`, `item`, `from`, `to`) or a PESTEL watch (`action: "watch"`, `item`, `signal`, `trigger`).
- SWOT and PESTEL areas are checked against their ids. The canvas's nine block ids are the canvas tool's to fix, so for now they are checked only as lower-case words.

The brief's own example validates against it, and so does a SWOT handoff.

## 6. The KPI library

`data/kpis.js` holds 115 KPIs in thirteen sectors: ten in `general`, exactly as brief 6.4 lists them, and the brief's starting points for the three scenario sectors. Units are symbols (€, %, €/TEU, min, d, h, #, ×), so they read the same in both languages. Every source is "common practice". A definition that follows a standard names it in words: EN ISO 14083, the Capital Requirements Regulation, Solvency II, the SAIDI index. No definition holds a benchmark value; `tests/kpis.mjs` refuses a money amount, and any share but the 100 % break-even of a ratio.

## 7. Shared parts and the sibling tools

On 23 November 2026 the three siblings held their Phase 0 plans and no code (BMC f7ec7a5, PESTEL a223844, Ideator 0aefaf6). This tool builds `js/risk.js`, `data/kpis.js` and the handoff schema in M1. The first tool to merge a shared file becomes its source, and the others copy it unchanged. `tests/parity.mjs` compares the files with any sibling checkout beside this repository, and CI clones the three for it.

## 8. Tests

`node tests/run-all.mjs` runs every suite; `tests/README.md` says what each proves and how to install Playwright. The private term list of the hygiene check is the `HYGIENE_TERMS` secret. It is not set yet, so CI runs the generic checks. Until 0.1.0 every push was also checked locally against a list kept outside the repository; on 23 November 2026 Victor decided to drop that step, so until the secret is set the generic checks are the whole check.

## 9. Where 0.1.0 differs from PLAN.md

On 23 November 2026, while M1 was being built, the PESTEL Challenger added two patterns to Vici's main (commit `eaebdca`): the session-only data rule, with `storageProblems` and `storedKeyProblems`, and a blank starter that runs under the strict policy, with `vici-theme.js` and `policyProblems`. This tool takes them over rather than building its own.

- PLAN.md's file tree lists a theme script of this tool's own in js/. Vici's `vici/dist/vici-theme.js` does the same job, so there is none.
- PLAN.md has this tool add the session-only data rule to Vici in M3. Vici has it now; M3 adds only the live-run dialog.
- Vici's page on building a prototype now asks that the browser warn before the page closes while a result has not been downloaded. That comes with the report in 0.4.0.

## 10. The simulation (0.2.0)

Version 0.2.0 plays three recorded runs. `data/scenarios/s1.js` to `data/scenarios/s3.js` hold, for each fictional company, what its team entered, every agent's answer in both languages under the contracts of `schemas/swot.js`, the sources it cites and the choice the recording made. `js/scenario.js` assembles a run the way the page shows it. `js/scenario_check.js` holds the scenario rules, which `tools/check-scenarios.mjs` and the tests apply. `tests/fixtures/scenarios.json` holds every scenario's figures for the recorded choice, for no choice and for all four strategies, worked out by hand. DATA_SOURCES.md lists every fact a scenario cites, with its source and the date it was read, and where the facts differ from the Phase 0 plan.

### 10.1 Decisions

- A "missing" issue names no item of the SWOT; the factor the challenge adds carries it. The checker refuses a missing issue that names items, so no item shows as missing and as something else at once.
- An item counts as addressed when a chosen strategy raises its rating. The grid shows this from Summary on, once the choice is adopted. The note under Items challenged counts only the challenged items a choice addresses, as the handoff's `pressure` does, so it stays a part of the tile's figure: S2's recorded choice raises four items, two of them challenged, and the note says "2 of 6 addressed now" (until 1.0.0 it said "4 addressed now"; review finding 6). Naming the 6 ties the note to the tile's figure, since the grid marks all four items Addressed.
- A strategy's kind follows its TOWS type: SO and WO turn an issue into an advantage, ST and WT mitigate it. The TOWS matrix names the kind once per cell, not on every card.
- The Writer writes one summary that holds for any choice. It cites what the choice changes through `{{fact:key}}` placeholders, which code fills in for the strategies the person adopted, and the fact audit refuses every other figure (`tests/audit.mjs`).
- The key figures follow the adopted choice: the tiles strike the old value through beside the new one. Changing the choice after Adopt asks for Adopt again before Summary opens.
- Play stays on a step for 3 seconds plus 0.23 seconds a word of its title and lead, at least 7 and at most 14 seconds. It holds while a dialog is open and stops where the person acts: Start, Challenge this SWOT and the decision. This is Vici's "Presenting step by step".
- A scenario older than 90 days shows "Check for updates" on the SIMULATION tape.

### 10.2 The session cost of a simulation

A simulation calls no model, so its cost tile is an estimate of what a live run of the same scenario would cost with the defaults: Haiku 5.5, research off. `js/estimate.js` counts the run's five requests (complete, challenge, assess, strategise, summary) with these assumptions:

| Part | Assumption |
|---|---|
| Input tokens | The request's system prompt, JSON input and wire schema at 4 characters a token, plus 40 for the message frame. Until 0.3.0 wrote the prompts, 1,200 tokens stood in for each system prompt; since 0.3.0 the estimate counts the agents' own prompts and inputs (`js/prompts.js`, section 11.3) |
| Output tokens | The recorded answer at 4 characters a token, plus 800 as a margin for thinking |
| Price | Haiku 5.5's list price of section 1, $0.10 input and $0.50 output per million tokens, read on 23 November 2026 |
| Currency | 1 USD = 0.894 EUR, the four tools' shared rate (section 1) |

With the real prompts (0.3.0) a run comes to about 10,000 input and 7,000 output tokens: $0.0044 to $0.0047, or €0.0039 to €0.0042, in every scenario and both languages (0.2.0 counted 16,000 to 17,000 input tokens, €0.0045 to €0.0047). The tile shows "< €0.01" below half a cent. `tests/unit.mjs` recounts the estimate with the prices written out by hand. The live run will not estimate: from 0.3.0 its meter adds up the usage the API reports.

### 10.3 Where 0.2.0 differs from PLAN.md

- The Vici patterns came first, as planned: the framework view with its item states and the risk matrix, merged into ViciDesign on 23 November 2026 (pull requests 26 and 27). `vici/` holds Vici's main at `2759b7a`, which also carries patterns the sibling tools added since: block states, the ring, the horizon strip and the drop zone.
- There is no "Run it live" button yet. Start describes both modes, and the version note there says that live runs come with 0.3.0.
- "Fictional company" labels the scenario picker in the step bar, so the label shows on every step, the decision included.
- The legend names each state in one word: Entered, AI, Added, Challenged, Addressed.
- In German the steps are Start, Ergänzen, Prüfen, Bewerten, Strategien and Fazit, so the step bar fits at 1280 px.
- At heights up to 820 px, as on a 1280 × 720 projector, the SWOT's heading is hidden from sight but still read by screen readers, the inside and outside labels move to the side in short words, and items show their first line until opened. From 961 to 1440 px wide, the Method button shows its icon with a tooltip.
- The key figures live in `js/tiles.js`. PLAN.md calls that file js/kpis.js, but `data/kpis.js` holds the sector KPIs, and two files of one name would mislead.

## 11. The live run (0.3.0)

Version 0.3.0 runs the agents on the person's own company, with their own key, in the tab.

### 11.1 The shared live client

`js/anthropic.js`, `js/sse.js`, `js/cost.js` and `js/keystore.js` are copied unchanged from the Prototype Ideator, the first sibling to merge them: its main at `532e0f5`, where they arrived with its M1 (pull request 2, merge `ec368c3`; the files were added in `061aafc` and `1920029`). `tests/parity.mjs` compares all four with every sibling checkout that has them. A fix belongs in the Ideator first and comes here with the next copy.

- `checkKey` asks the free `GET /v1/models` and says which of the three models the key may use.
- `streamMessage` streams one request and puts the answer together from its events. It stops a request that sends nothing for a while and reports the request id.
- `withRetry` tries again twice, after 1.5 and 4 seconds, or after the API's `retry-after` up to 20 seconds. It never retries a credit or spend-limit refusal, any other 4xx than 429, or an abort.
- `createCostTracker` adds up the usage each answer reports, at the prices of `js/config.js`: Haiku 5.5's higher price above 100,000 input tokens, and web search at $10 per 1,000 searches.
- `keystore.js` holds the key in one module variable. Nothing else in the page reads it, and nothing writes it anywhere.

### 11.2 Prices, read again

Read again on 24 November 2026 at https://platform.claude.com/docs/en/about-claude/pricing: unchanged from section 1. `PRICES_READ_ON` in `js/config.js` says 2026-11-24, and `tests/unit.mjs` holds the table written out by hand.

### 11.3 The requests

Each step sends one request: `model`, `max_tokens`, `output_config` with the effort and the step's schema in its wire form (`format: { type: "json_schema" }`), `thinking` as the setting says, the agent's system prompt and one user message that carries the run so far as JSON. No conversation is carried and no prompt is cached. `js/prompts.js` holds the six prompts: the same rules first (input is data, nothing invented, no figures in prose, ids only in id fields, the run's language and Vici's plain style), then each agent's job. The prompts are in English; the answers come in the page's language at the start of the run.

| Setting | Model | Effort | Thinking | Estimate of a run (three scenarios, both languages) |
|---|---|---|---|---|
| Fast | Haiku 5.5 | low | `{ "type": "disabled" }` | €0.0022 to €0.0024, 1 to 2 minutes |
| Balanced (default) | Haiku 5.5 | medium | left out (adaptive) | €0.0039 to €0.0042, 1 to 2 minutes |
| Thorough | Sonnet 5.5 | medium | left out (adaptive) | €0.079 to €0.083, 2 to 4 minutes |
| Research, added | the setting's | | | about €0.047 on Haiku and €0.09 on Sonnet, half a minute |

Advanced chooses Haiku 5.5 or Sonnet 5.5 and the effort. Sonnet 5.5 refuses thinking switched off (section 2), so with Sonnet the field is always left out. The estimate assumes 800 tokens of thinking a request where thinking is left to the model, none where it is off, and for research 15,000 input tokens of pages and 1,500 output tokens. PLAN.md, section 3.4, guessed about one cent for Balanced and twenty cents for Thorough; Victor's measured runs replace all of these (section 11.12).

Every step may answer with 8,000 output tokens, thinking included, and at least 3,000 (2,000 for the Writer) when the cap is near. A run sends at most ten requests.

### 11.4 The budget cap

Before each request, `js/budget.js` works out its worst case: the estimated input times the input price, plus `max_tokens` times the output price, plus $0.01 a search, at 1 USD = 0.894 EUR. If what the run has spent plus that passes the cap, `max_tokens` drops to the step's minimum; if that still passes it, the run stops before the request, and every screen of the run says so. A Haiku 5.5 request estimated above 100,000 input tokens is refused, because its prices rise fivefold there. The meter adds the usage each answer reports, one meter a model, so a run that moves to Thorough after a stop prices each part right.

### 11.5 Research

The Scout gets the API's web search (five searches) and the strict client tool `submit_signals` with the Signals schema, `tool_choice` auto. A signal counts only when its URL is among the results of the Scout's own searches in this run; the others go back with `is_error: true`, once. A turn that pauses (`pause_turn`) goes back unchanged. A turn without `submit_signals` gets one reminder. At most three Scout requests. A 400 that says web search is switched off for the organisation lets the run go on without it, and Challenge says so, as it says when research found nothing or every URL was refused. The Red team may cite only the accepted signals' URLs.

### 11.6 Guards and the repair

`js/guards.js` holds the refusals of PLAN.md 3.1; the scenario checker applies the same guards to the recorded scenarios. An answer that breaks its schema or a guard gets one repair: one user message with the input, the answer that failed and its problems. At most one repair a step and two a run; a second failure stops the run with what is done and offers Thorough or a simulation. The Writer's text that fails the fact audit twice shows with an "Unchecked" tag instead. `tests/guards.mjs` plants each refusal.

### 11.7 Errors

`js/api_messages.js` turns each error into words and one next step in both languages: 401 (key), 403 and 404 (model), 400 and 402 with a credit message (credit), 400 and 429 with a spend limit (spend limit), 429 and 529 (busy), other 5xx (the API's error), a lost connection, a timeout and Abort. The shared client retries 429, 529, 5xx and a lost connection twice, after 1.5 and 4 seconds or after `retry-after` up to 20 seconds, and nothing else. The dialog checks the key with the free model list before a run and says there why it refused it.

### 11.8 The person's check

The Completer's items keep their ids when the person removes or edits one; the challenge receives the SWOT as the person left it. The run records the check in the Decision contract (`kept`, `removed`, `edited`, `chosen`), and `js/scenario.js` applies it when it puts the run together. Removed items stay listed, struck through, on Complete.

### 11.9 The private-data scan

`js/privacy.js` looks for e-mail addresses, phone numbers, IBANs (with their check digits) and classification labels: "confidential", "vertraulich", "for internal use", "nur intern", "Internal:" at the start, "[intern]", "Classification: …". PLAN.md lists "internal" and "intern" as words; a SWOT uses them all the time ("Internal processes are slow", "Wissen wird intern nicht geteilt"), so as plain words they would warn on most SWOTs. They count only in a label's form. The scan warns; it does not block.

### 11.10 Save run as simulation

The run is a recording in the scenario format, in its one language: the Recording contract in `schemas/swot.js`, with the company marked fictional only when it is one of the scenarios' companies filled in for a demo (since 1.0.0; review finding 2), the sources research accepted, the person's decision and the run's settings, cost, seconds and each request's usage, without key or thinking. The scenario rules check a recording in its language under the rules a live run obeys; the rules of an authored scenario that a live run cannot meet wait for its curation: the second language, the sources in DATA_SOURCES.md, weights that add up to exactly 1 and prose without figures outside the Writer's text.

### 11.11 Where 0.3.0 differs from PLAN.md

- The Vici pattern came first, as planned: the live-run dialog, merged into ViciDesign on 24 November 2026 (pull request 36). `vici/` holds Vici's main at `ca9c552`, which adds the Prototype Ideator's fixes from the same day: a callout keeps its text, surfaces and actions in its own ink in both themes, tables set tabular figures in number cells only, and the live-run dialog takes up to 94 % of a window under 760 px high, so at 1280 × 720 the estimate shows above the start button without scrolling. The tool already marks its number cells `vc-num`, and its Your turn callout drops the accent override it carried, since Vici's callout now sets the same values.
- Run it live stands in the step bar without the AI notice: at 1280 px the bar has no room for the notice's words (measured), and the button opens a form, not a run. The notice stands beside every control that sends a request: Start the live run in the dialog, as Vici's pattern has it, and the live run's Start the agents, Challenge this SWOT, Adopt these strategies and Try this step again. On Start and Summary of a simulation, Run it live appears again with the notice beside it.
- The live-run dialog shows every part at 1280 × 720 without scrolling, the estimate too, as Vici's pattern promises since `ca9c552`. The brief asks the key's part to carry more than Vici's demo does (the workspace advice and the plan note), so the setting's help stands beside its control and the cap's label beside its slider, the setting's and research's help fit one line each, and the German hint beside the start button is shorter, so the footer keeps one row. `tests/layout.mjs` fails when the dialog scrolls at its first opening; without these rules it scrolls 32 px and hides the estimate.
- On laptop widths (up to 1440 px) Play, Back and Next show their icons only, so the step bar holds Run it live; their names stay for screen readers.
- Play is hidden in a live run: the agents set the pace.
- Upload is cut, as approved (PLAN.md, section 16).
- The private-data scan reads "internal" and "intern" only in a label's form (section 11.9).

### 11.12 Victor's first live runs

On 24 November 2026 Victor decided to skip the first live runs for now and to assume the live run works as intended; G20 of the M3 ledger was waived on his word. The estimate keeps the assumptions of section 11.3 until a run is measured. When Victor runs each setting once on a public company and saves the run as simulation, its `run` part holds the minutes, the cents and each request's output tokens, and the table goes here with the date.

## 12. The report (0.4.0)

Version 0.4.0 ends every run in a report: eight sections on A4 that code assembles from the run, previewed at the Summary step, and three downloads. `js/report.js` builds the report as DOM in the report's own language (a scenario's follows the page, a live run's its own); `js/report_view.js` holds the card at the Summary step, the report dialog and the downloads; `js/handoff.js` writes the file for the Prototype Ideator; `css/report.css` holds this tool's part of the look.

### 12.1 The print layout and its footer

The report uses Vici's report pattern (https://victorpflueger.github.io/ViciDesign/components/report.html), which the PESTEL Challenger built first and merged into ViciDesign on 24 November 2026 (pull request 40). `vici/` holds Vici's main at `64044bd`. The report's root carries the footer's words in its own language (`data-vc-footer-start`, `-end`, `-of`, and `data-vc-notice` when a live run stopped early); `Vici.report.prepare()` copies the report into a print container and writes the words into custom properties, which the margin boxes of the named page `vc-report` read, with `counter(page)` and `counter(pages)`. Chromium prints margin boxes from version 131; from 148 CSS can ask for them (`@supports at-rule(@bottom-left)`), and for the versions between, `prepare()` marks the copy from the browser's version, so a page never prints two footers. Save as PDF sets the page's title to the file's name while the print dialog is open, since browsers name the PDF after it, and Ctrl+P at the Summary step prints the report too. `tests/report.mjs` prints every scenario in both languages with Chromium and reads each page's text with `tests/lib/pdf-text.mjs`, the Prototype Ideator's reader copied unchanged at its commit `16fa6ad` (24 November 2026), which `tests/parity.mjs` keeps equal; with Vici's page rule taken out, the check fails.

### 12.2 Firefox and Safari

Without margin boxes, Vici's fixed footer prints at the foot of every page: "Created with SWOT Challenger" with the address and "Built by Victor Pflüger", without page numbers, and the print hint adds that the browser's own headers and footers give them. On 24 November 2026, after 0.4.0 went live, Victor printed a report in Firefox and in Safari and found the footer as described; he did not note the browser versions.

### 12.3 The HTML file

`Vici.report.html()` writes the report as one file: its markup, the style rules that reach it (Vici's light theme with them), the portrait as a data URI, a policy that loads nothing (`default-src 'none'; style-src 'unsafe-inline'; img-src data:`), no script, and the title as its one h1. The page's web fonts cannot travel under that policy, so the file names them and falls back to the reader's system fonts. A file has no script, so only a browser that answers `@supports at-rule()` keeps the fixed footer out of its print; an older Chromium prints both footers there. Each scenario's file weighs about 125 KB.

### 12.4 The handoff file

The file for the Prototype Ideator is `strategy-challenge/1` (brief 4.3), checked against the shared schema and its references before the page offers it, and read in the tests by the Ideator's own `js/handoff.js` at its commit `532e0f5`, which CI checks out for the handoff and report suites. The SWOT's quadrants are its areas; each strategy is a response pointing at its issue, its new ratings `rate` changes; the score is the response to the market (EFE, 1 to 4). `pressure` is "Items challenged": before, the challenged items; after, those the chosen strategies leave unaddressed; of all items entered and completed. An issue the Analyst could not price carries null for its three euro figures, as the schema allows, with "Not priced:" and the reason as its basis, so the Ideator counts it as unpriced, as the tile does ("on 5 of 6 issues"). Until 1.0.0 it carried 0, and the Ideator counted it as priced at €0 (review finding 5). A live run's country, entered as words, becomes its two-letter code through the region names in both languages, or ZZ when unknown. A source an issue cites keeps the title the issue gives it, in the report's list of sources and in the file. The file holds no key, prompt or thinking.

### 12.5 Where 0.4.0 differs from PLAN.md

- The Vici pattern came first, as planned, but from the PESTEL Challenger: its pull request went up as this milestone began, so this tool uses it unchanged rather than adding a second one. This tool's own draft stayed unpublished, and M4 needed no change in Vici.
- PLAN.md's file tree has a module of its own for the print view and the HTML file. Vici's `report.print()` and `report.html()` do both, so `js/report.js` builds the report and `js/report_view.js` offers it.
- The Summary panel shows a card with the report's first two pages, the three downloads and the link to the Prototype Ideator; "Download the report" in the bar, the bar's one primary action, opens the whole report in a dialog, with Save as PDF as the primary action there.
- The issues open with the risk matrix and a list of the issues with their band and expected euros, before the blocks the brief lists.
- The TOWS matrix shows every strategy in its cell in one line, the chosen ones marked, and the chosen ones in full below it.
- Where the company stands opens its page with the IE matrix; the factor tables follow, with the ratings and weighted scores after the chosen strategies beside the old ones.
- The report's tables head their columns in sentence case, a plainer print style that brief 9 allows, so a number column takes its word.
- A summary at the longest the contract allows does not fit page two: it opens page two and flows on, and `tests/report.mjs` prints that case.
- The leave-page warning (section 9) stands down once the report is downloaded or printed, as after Save run as simulation.
- The live suites share the live run's helpers in `tests/lib/live-page.mjs`.


## 13. The release (1.0.0)

Version 1.0.0 closes M5, the plan's last milestone: the layout, keyboard and motion tests, the documents, three reviews and the release. The prices were read again on 24 November 2026 at https://platform.claude.com/docs/en/about-claude/pricing and are unchanged from section 1, the higher Haiku 5.5 tier above 100,000 tokens and web search at $10 per 1,000 searches included.

### 13.1 Sizes and targets

`tests/layout.mjs` measures four sizes now, 1920 × 1080, 1440 × 900, 1366 × 768 and 1280 × 720, in both themes and languages: every step of every scenario, the guide as it opens on a first visit, the Method dialog, the report and the live screens.

- **Targets.** AC-14 asks 40 px of every target. On 24 November 2026 Victor decided otherwise: every target at least 24 px, as WCAG 2.2 (2.5.8) and the Sovereignty Assessment ask, and the primary actions at least 40 px, namely the Your turn bar's button, Run it live and Start the live run. A link inside a sentence is exempt, as WCAG allows, and a checkbox's target is its label. A planted 20 px button and a primary action 36 px high must fail first.
- **What that changed.** On laptop screens the step bar's buttons, Run it live among them, keep 40 px (they had 38). "Show the numbers" was Vici's 21 px summary; Vici's pull request 47 (from the PESTEL Challenger) now makes it a 40 px target that gives the space back, as it does for a segmented option, a switch and a slider, so this tool's own 2 px padding is gone. The link of a source line, "Turn this report into prototype ideas" and a strategy's box with a one-line title are 24 px high.
- **1440 × 900.** Whole items ran longer than their fields, and at the decision a figure and the value it replaced broke onto two lines, so the header grew. Up to 1600 px wide and 960 px high the page now takes the laptop layout, and above 820 px of height an item shows its first two lines rather than one.
- **1366 × 768.** Vici's live-run dialog scrolled by 63 to 79 px at its first opening, because its short-window rule stopped at 760 px of height. This tool fixed it in Vici (pull request 41, merged on 24 November 2026): the rule holds up to 880 px, and Vici's fit check (https://github.com/VictorPflueger/ViciDesign/blob/main/scripts/check-live-fit.mjs) opens the dialog at every height from 720 to 1080 px.
- `vici/` holds Vici's main at `818718c`, which also carries the PESTEL Challenger's pull requests 42 (section 13.2), 44 and 47 (every target of Vici's own at least 40 px, section 13.1), the Prototype Ideator's 45, the BMC Challenger's 48 (the live-run dialog's acknowledgement at 40 px) and this tool's 46 (section 13.5).

### 13.2 Keyboard and reduced motion

PLAN.md, section 8, puts the keyboard and reduced motion into `tests/layout.mjs`. They are `tests/access.mjs` instead: the layout suite measures 432 views already, and walking the page by keyboard is a different test.

- **Keyboard.** The keyboard alone runs the simulation from the guide on a first visit to Save as PDF, and a live run against the stand-in from Run it live to the Summary, in both languages. Every stop must show Vici's focus ring: its outline, a shadow in the focus colour, or the hexagon Vici draws around an icon button or a switch. Chromium does not report a slider thumb's style, so the walk compares the thumb's pixels with and without the focus. With the rings taken out of the page's styles (`tests/fixtures/no-focus-ring.css`) every stop fails.
- **The company picker.** On the Start form, choosing a fictional company used to fill the form at once and move the focus to the company's name. A keyboard or screen-reader user moving through the list with the arrow keys filled the form at each step and lost the focus, which WCAG 2.2 (3.2.2, On input) rules out, and the form's own entries were overwritten without a word. Now choosing changes nothing: Fill in, beside the picker, fills the form, says so in words and to screen readers, and keeps the focus; its hint says that it replaces what the form holds.
- **Reduced motion.** AC-14 asks that reduced motion stop animation. Vici keeps its spinner turning, slowly (2.4 s a turn), as the only cue that work goes on, and on design Vici wins, so the live run's wait keeps it; everything else lasts no longer than an instant. A dialog's backdrop still faded in over 210 ms, because Vici's rule reached every element and its `::before` and `::after` but not `::backdrop`. The PESTEL Challenger fixed that in Vici (pull request 42, merged on 24 November 2026) minutes before this tool's own fix, which was closed in its favour (pull request 43).

### 13.3 The build stays lean

`tests/lean.mjs`, adapted from the Sovereignty Assessment and the BMC Challenger, holds the limits a change has to argue with: the presenter in at most ten modules and 2,200 lines (2,104 at the release), `js/` in 6,500 lines (6,391) and two stylesheets in 900 (852); requests only from `js/anthropic.js`; no host named but the API and the links a person follows; the policy; nothing the design review cut; and the documents' length.

### 13.4 Where 1.0.0 differs from PLAN.md

- AC-15 asks Victor to run each preset live within its cap before the release. On 24 November 2026 he waived that for 1.0.0, as he had for M3 (section 11): the stand-in suites cover the live run, and his own runs can follow. Until one is measured, the estimate keeps the assumptions of section 11.3.
- The plan adds the tool's card to Victor's website with a pull request on VIP's list of prototypes (https://github.com/VictorPflueger/VIP/blob/main/data/prototypes.js). This session may not push to VIP, so the change waits as a patch for Victor; the card's note says the release instead of "Work in progress".
- The independent review, the design review and Vici's partner review are in REVIEW.md, with what each found and what was done about it.

### 13.5 What the independent review changed

An agent that did not build the tool reviewed the release candidate on 24 November 2026 and found 4 high, 6 medium and 8 low findings; verifying the fixes twice, it found six more of low severity (REVIEW.md, Independent review). What they changed:

- **Research and the cap.** Search results come back as input tokens, so a run with research could pass its cap. The worst case of every request now adds 20 % to its own input (`INPUT_MARGIN`) and 12,000 tokens for each search it may run (`RESEARCH.pageTokensPerSearch`); the Haiku check against 100,000 tokens counts them too. The Scout asks for as many searches as fit, at most five, and skips research when none fits, with a note at Challenge. `tests/live.mjs` (ac09) runs research at €0.15 on Thorough and at €0.05 on Balanced. The 12,000 tokens are an allowance, not a measurement: the reviewer showed that at 15,000 tokens a search a run on Thorough can pass its cap by half a cent, and at 20,000 by five cents. So the research help and README say that each search counts as 12,000 tokens, and the first live research runs should measure the Scout's input and set the allowance from it.
- **Fiction in a live run.** A scenario's company filled in for a demo stays fictional: the step bar, the report's cover and About this report, the handoff file and the saved run say so. The Recording contract takes `fictional` as true or false.
- **AI estimates.** A strategy's euro figure is the Strategist's estimate: lilac with the AI mark on the cards, in the Summary and the table ("A year, AI estimate"). Each residual and upside now carries a basis of at most 140 characters and a confidence, as brief 5.10 asks of every AI estimate in a structured field; two required fields, so the request schemas keep no optional and no union-typed parameter. The details, the Summary and the report show the range, the likelihood, how code turns them into the figure, the basis and the confidence. The handoff file's range has no field for them in the shared schema, so they stay on the page and in the report.
- **The check.** Where the person edits the AI's items, the panel says "Public information only"; an edit that looks private gets a warning under the item, and the last item inside or outside the company stays, with a sentence, since the factor tables need one on each side.
- **Figures that agree.** An issue the Analyst could not price reaches the handoff file without euros (null), so the Ideator's At stake reads "on 5 of 6 issues" as the tile does; the note under Items challenged counts the challenged items a choice addresses; a residual is never more likely than its issue.
- **The Writer and the choice.** A new choice after the summary takes effect without another request, so the Writer's text must hold for any choice, as the recorded summaries do: it sees the strategies without the choice, and the five facts that follow the choice (left, upside, every "after" key; `CHOICE_FACTS` in `js/facts.js`) reach it as "follows the choice", so it cites them as placeholders and cannot restate them.
- **Smaller things.** A key typed into the form is in the warning and redacted in every download; an unchecked summary says so first in the handoff file; Clear everything during a request leaves no error; the story column holds what Vici hides for screen readers, so the page never grows past the window; the Session cost tile keeps the cap in its note after a live run and reads "estimated, simulated run" in a simulation, as brief 5.5 words it, and the guide adds the Thorough figure; the scenarios say Bremen and heat, as the brief does.
- **Vici.** A report printed from the dark theme with background graphics sat in a black frame, since the page's margins take the canvas colour of the root's scheme. This tool fixed it in Vici (pull request 46, merged on 24 November 2026): in print the page takes the light scheme. `tests/report.mjs` checks it here too.
- **Focus behind the bar.** While checking the fixes, the keyboard suite learned to fail a focus that lands behind the bar at the story's foot (WCAG 2.2, 2.4.11). Without the fix below it finds 16 such stops in the four walks, among them Show the numbers, the issue buttons, the company picker and the check's Edit and Remove. The story column's scroll padding now follows the bar's height, set by a `ResizeObserver`.

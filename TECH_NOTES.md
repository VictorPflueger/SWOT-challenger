# Technical notes

Version 0.3.0 (M3 Live), 24 November 2026. These notes record what was checked at source, with the date, and the decisions the code rests on. PLAN.md is the plan Victor approved on 23 November 2026, with the eleven cuts of its design review. Where the code says "brief 6.4", it means section 6.4 of Victor's build brief, which is not part of this repository.

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
- An item counts as addressed when a chosen strategy raises its rating. The grid shows this from Summary on, once the choice is adopted.
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

The run is a recording in the scenario format, in its one language: the Recording contract in `schemas/swot.js`, with the company not marked fictional, the sources research accepted, the person's decision and the run's settings, cost, seconds and each request's usage, without key or thinking. The scenario rules check a recording in its language under the rules a live run obeys; the rules of an authored scenario that a live run cannot meet wait for its curation: the second language, the sources in DATA_SOURCES.md, weights that add up to exactly 1 and prose without figures outside the Writer's text.

### 11.11 Where 0.3.0 differs from PLAN.md

- The Vici pattern came first, as planned: the live-run dialog, merged into ViciDesign on 24 November 2026 (pull request 36). `vici/` holds Vici's main at `ca9c552`, which adds the Prototype Ideator's fixes from the same day: a callout keeps its text, surfaces and actions in its own ink in both themes, tables set tabular figures in number cells only, and the live-run dialog takes up to 94 % of a window under 760 px high, so at 1280 × 720 the estimate shows above the start button without scrolling. The tool already marks its number cells `vc-num`, and its Your turn callout drops the accent override it carried, since Vici's callout now sets the same values.
- Run it live stands in the step bar without the AI notice: at 1280 px the bar has no room for the notice's words (measured), and the button opens a form, not a run. The notice stands beside every control that sends a request: Start the live run in the dialog, as Vici's pattern has it, and the live run's Start the agents, Challenge this SWOT, Adopt these strategies and Try this step again. On Start and Summary of a simulation, Run it live appears again with the notice beside it.
- The live-run dialog shows every part at 1280 × 720 without scrolling, the estimate too, as Vici's pattern promises since `ca9c552`. The brief asks the key's part to carry more than Vici's demo does (the workspace advice and the plan note), so the setting's help stands beside its control and the cap's label beside its slider, the setting's and research's help fit one line each, and the German hint beside the start button is shorter, so the footer keeps one row. `tests/layout.mjs` fails when the dialog scrolls at its first opening; without these rules it scrolls 32 px and hides the estimate.
- On laptop widths (up to 1440 px) Play, Back and Next show their icons only, so the step bar holds Run it live; their names stay for screen readers.
- Play is hidden in a live run: the agents set the pace.
- Upload is cut, as approved (PLAN.md, section 16).
- The private-data scan reads "internal" and "intern" only in a label's form (section 11.9).

### 11.12 Victor's first live runs

Pending: G20 of the M3 ledger. Victor runs each setting once on a public company, saves the run as simulation and sends the file; its `run` part holds the minutes, the cents and each request's output tokens. The table goes here with the date, and the measured figures replace the estimate's assumptions in section 11.3.


# SWOT Challenger

Strengths, weaknesses, opportunities and threats, put to the test.

A browser tool for SWOT analyses. A person names a company and enters what they know of its SWOT. AI agents complete it, challenge every item, put a figure on what is wrong or missing and turn it into strategies. The result downloads as a report.

It is published at https://victorpflueger.github.io/SWOT-challenger/, as one of four tools built as a set: the Business Model Canvas, SWOT and PESTEL challengers and the Prototype Ideator, which turns their reports into prototype ideas.

## What version 0.2.0 holds

Version 0.2.0 is the simulation. Three fictional companies play a recorded run, step by step, in English and German, with no key and at no cost:

1. Start: the company and what its team entered.
2. Complete: the Completer fills every field to three items or more, marked in lilac.
3. Challenge: the Red team marks what is misfiled, unsupported, contradictory or missing, and places each issue on a risk matrix.
4. Assess: the Analyst puts a euro range on each issue in the sector's own KPIs and scores the SWOT in factor tables after Fred R. David; the IE matrix shows where the company stands.
5. Strategise: the Strategist fills the TOWS matrix after Heinz Weihrich, and you choose the strategies to adopt.
6. Summary: the Writer's summary, with the figures of your choice.

Play runs the steps on its own and stops wherever you act. The key figures at the top answer first: what is at stake a year, how many items the challenge questions, how well the company answers its market, and what a live run would cost. The Method dialog explains every method and figure, with a worked example.

The foundations of 0.1.0 stay underneath: the engine (`js/engine.js`, `js/risk.js`), the data contracts (`schemas/`), a library of 115 sector KPIs in both languages (`data/kpis.js`), the security policy and the tests in CI.

PLAN.md says what comes next: the live run in 0.3.0, the report in 0.4.0 and the release in 1.0.0.

## What is real and what is simulated

The three companies are fictional, and so are their own figures. The laws, rules and market facts their agents cite are real: DATA_SOURCES.md lists each with its source and the date it was read. The euro ranges, weights and ratings are AI estimates in the story, structured judgements rather than measurements. Code computes every score and total from them.

A simulation sends nothing anywhere. The live run, from 0.3.0, will run the agents on your company with your own Claude API key, from your browser to Anthropic's API and nowhere else.

Nothing is kept. The browser remembers only your theme and language. Close the tab and everything else is gone.

Public information only: never enter confidential, personal or otherwise protected data.

## Run it

Serve the folder with any static server and open it, for example `python3 -m http.server` and then http://localhost:8000. There is no build step and nothing to install. An address such as `?scenario=s2&step=4` opens a scenario at a step.

## Tests

`node tests/run-all.mjs` runs every suite, and `node tools/check-scenarios.mjs` checks the three scenarios on their own. `tests/README.md` says what each suite proves and how to install Playwright for the browser suites. TECH_NOTES.md records the facts and decisions the code rests on, with the dates they were checked.

## Author

Built by [Victor Pflüger](https://www.linkedin.com/in/victorpflueger) · [victorpflueger.github.io/VIP](https://victorpflueger.github.io/VIP/index.html)

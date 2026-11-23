# SWOT Challenger

Strengths, weaknesses, opportunities and threats, put to the test.

A browser tool in the making. A person names a company and enters what they know of its SWOT analysis. AI agents complete it, challenge every item, put a figure on what is wrong or missing and turn it into strategies. The result downloads as a report.

It will be published at https://victorpflueger.github.io/SWOT-challenger/, as one of four tools built as a set: the Business Model Canvas, SWOT and PESTEL challengers and the Prototype Ideator, which turns their reports into prototype ideas.

## What version 0.1.0 holds

This is version 0.1.0, the foundations. The page opens with its header, the four key figures still waiting for a run, a short guide in English and German, and an explanation of the SWOT grid and of how a run will go. Behind it sit the parts the next versions build on:

- the engine: risk bands, expected euros, the factor scores after Fred R. David and the IE matrix, checked against four worked cases (`js/engine.js`, `js/risk.js`);
- the data contracts of every agent and the shared handoff file (`schemas/`);
- a library of 115 sector KPIs in both languages (`data/kpis.js`);
- the security policy, the rule on what the browser keeps, and the tests in CI.

PLAN.md says what each later version adds: the three scenarios in 0.2.0, the live run in 0.3.0, the report in 0.4.0 and the release in 1.0.0.

## What is real and what is simulated

Nothing runs yet. The key figures show "…" until a scenario or a live run fills them. The scenarios, from 0.2.0, will play three fictional companies with no key, and nothing will be sent anywhere. The live run, from 0.3.0, will run the agents on your company with your own Claude API key, from your browser to Anthropic's API and nowhere else.

Nothing is kept. The browser remembers only your theme and language. Close the tab and everything else is gone.

Public information only: never enter confidential, personal or otherwise protected data.

## Run it

Serve the folder with any static server and open it, for example `python3 -m http.server` and then http://localhost:8000. There is no build step and nothing to install.

## Tests

`node tests/run-all.mjs` runs every suite. `tests/README.md` says what each suite proves and how to install Playwright for the browser suites. TECH_NOTES.md records the facts the code rests on, with the dates they were checked.

## Author

Built by [Victor Pflüger](https://www.linkedin.com/in/victorpflueger) · [victorpflueger.github.io/VIP](https://victorpflueger.github.io/VIP/index.html)

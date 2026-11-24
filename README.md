# SWOT Challenger

Strengths, weaknesses, opportunities and threats, put to the test.

A browser tool for SWOT analyses. A person names a company and enters what they know of its SWOT. AI agents complete it, challenge every item, put a figure on what is wrong or missing and turn it into strategies. The result downloads as a report.

It is published at https://victorpflueger.github.io/SWOT-challenger/, as one of four tools built as a set: the Business Model Canvas, SWOT and PESTEL challengers and the Prototype Ideator, which turns their reports into prototype ideas.

## What version 0.3.0 holds

Three fictional companies play a recorded run with no key and at no cost, and Run it live puts the same agents to work on your own company with your own Claude API key. Both run six steps in English and German: Start, Complete, Challenge, Assess (factor tables and IE matrix after Fred R. David), Strategise (the TOWS matrix after Heinz Weihrich, where you choose) and Summary.

The key figures at the top answer first: what is at stake a year, the items challenged, the response to the market and the run's cost. The Method dialog explains every figure. Underneath are the engine, the data contracts and 115 sector KPIs in both languages.

## A live run

Run it live opens Start as a form for the company and what your team knows of its SWOT. Start the agents opens the dialog: your key, the setting (Fast and Balanced on Haiku 5.5, Thorough on Sonnet 5.5), research (off by default), a budget cap from €0.05 to €3, your promise to enter public information only, and an estimate: about half a cent on Balanced.

The run waits for you twice: you keep, edit or remove the Completer's items, and you choose the strategies. While an agent works, its step shows the seconds and the cost against your cap; Abort keeps what is done. Code checks every answer, gives a failing one one more try and starts no request that could pass your cap. Save run as simulation downloads the run without your key.

It sends what you enter from your browser to Anthropic's API (api.anthropic.com), under your own key and Anthropic's terms, and nowhere else. It keeps nothing: the key lives in one variable of this tab's memory, never in storage, a cookie, the address or a download, and is gone when you close or reload the tab or press Clear everything. The browser remembers only your theme and language.

Public information only: never enter confidential, personal or otherwise protected data. Before a run the page looks for e-mail addresses, phone numbers, bank account numbers and labels such as "confidential", and asks you to remove them or confirm they are public.

## What is real and what is simulated

The three companies and their own figures are fictional; the facts their agents cite are real, and DATA_SOURCES.md dates each. Euro ranges, weights and ratings are AI estimates, structured judgements rather than measurements, in a simulation and a live run alike. Code computes every score and total.

## Run it

Serve the folder with any static server, for example `python3 -m http.server`, and open http://localhost:8000. There is no build step. `?scenario=s2&step=4` opens a scenario at a step.

## Tests

`node tests/run-all.mjs` runs every suite; `tests/README.md` says what each proves. No test calls the real API. TECH_NOTES.md records the facts and decisions the code rests on, with their dates, and PLAN.md what comes next: the report in 0.4.0 and the release in 1.0.0.

## Author

Built by [Victor Pflüger](https://www.linkedin.com/in/victorpflueger) · [victorpflueger.github.io/VIP](https://victorpflueger.github.io/VIP/index.html)

# SWOT Challenger

Strengths, weaknesses, opportunities and threats, put to the test.

A browser tool for SWOT analyses. A person names a company and enters what they know of its SWOT. AI agents complete it, challenge every item, put a figure on what is wrong or missing and turn it into strategies. The result downloads as a report.

It is published at https://victorpflueger.github.io/SWOT-challenger/, as one of four tools built as a set: the Business Model Canvas, SWOT and PESTEL challengers and the Prototype Ideator, which turns their reports into prototype ideas.

## What version 1.0.0 holds

Three fictional companies play a recorded run with no key and at no cost, and Run it live puts the same agents to work on your own company with your own Claude API key. Both run six steps in English and German: Start, Complete, Challenge, Assess (factor tables and IE matrix after Fred R. David), Strategise (the TOWS matrix after Heinz Weihrich, where you choose) and Summary, which ends in the report.

The key figures at the top answer first: what is at stake a year, the items challenged, the response to the market and the run's cost; the Method dialog explains each. Underneath are the engine and 115 sector KPIs in both languages.

## The report

Code assembles it from the run: eight sections on A4, from the management summary on page two to About this report. Download the report shows it with three downloads: Save as PDF (choose Save as PDF as the printer; every page carries the footer with the tool, its address, Victor Pflüger and the page number, which Firefox and Safari leave out), an HTML file that loads nothing, and the file for the Prototype Ideator (JSON). Files are named `swot-challenger-<company>-<YYYY-MM-DD>-<lang>`, umlauts written out.

## A live run

Run it live opens Start as a form for the company and what your team knows of its SWOT. Start the agents opens the dialog: your key, the setting (Fast and Balanced on Haiku 5.5, Thorough on Sonnet 5.5), research (off by default), a budget cap from €0.05 to €3, your promise to enter public information only, and an estimate: about half a cent on Balanced.

The run waits for you twice: to keep, edit or remove the Completer's items, and to choose the strategies. Code checks every answer and starts no request that could pass your cap.

It sends what you enter only to Anthropic's API (api.anthropic.com), under your own key, and keeps nothing: the key lives in one variable of this tab's memory, never in storage, a cookie, the address or a download. The browser remembers only your theme and language.

Public information only: never enter confidential, personal or otherwise protected data. Before a run the page looks for e-mail addresses, phone numbers, account numbers and labels such as "confidential".

## What is real and what is simulated

The three companies and their own figures are fictional; the facts their agents cite are real, and DATA_SOURCES.md dates each. Euro ranges, weights and ratings are AI estimates, structured judgements rather than measurements. Code computes every score and total.

## Run it

Serve the folder with any static server, for example `python3 -m http.server`, and open http://localhost:8000. There is no build step. `?scenario=s2&step=4` opens a scenario at a step.

## Tests

`node tests/run-all.mjs` runs every suite, and `tests/README.md` says what each proves; none calls the real API. TECH_NOTES.md records the facts and decisions the code rests on, with their dates; DESIGN.md, DEMO_SCRIPT.md and REVIEW.md cover the design, the demo and what was reused.

## Author

Built by [Victor Pflüger](https://www.linkedin.com/in/victorpflueger) · [victorpflueger.github.io/VIP](https://victorpflueger.github.io/VIP/index.html)

# Design

Version 1.0.0. Built on Vici, Victor's design system, copied unchanged into `vici/` at the commit [vici/README.md](vici/README.md) names. Vici's rules win unless this file says otherwise and why.

## Who it is for

A consulting partner shows the tool to a customer, often on a projector and without Victor, and a stranger tries it alone on their own company. So the page is read from across a room: one screen, plain words, the SWOT in the middle and one thing to press.

## The screen

One screen with no page scroll, from 1280 × 720 to 1920 × 1080. `tests/layout.mjs` measures every step of the three scenarios and the live screens at 1920 × 1080, 1440 × 900, 1366 × 768 and 1280 × 720, in both themes and languages.

- The header: the scale icon in a lilac hexagon, the name, the SIMULATION tag (LIVE in a live run), How it works, Method, EN and DE, the theme switch and the four key figures; under it one sentence beside the byline.
- The step bar: Play, Back, the six steps, Next, the fictional company and Run it live.
- The work area: the SWOT on the left, internal above external; on the right the step's title, which answers one question with its figure, its panel and the Your turn bar with the one primary action.

A large screen shows each item whole. Up to 1600 px wide an item shows two lines, and below 821 px of height one line, as the brief asks for 1280 × 720; a click opens it. Play stays 7 to 14 seconds on a step and stops where the person acts.

Every target is at least 24 px and the primary actions at least 40 px. The keyboard alone runs the simulation and a live run, with Vici's focus ring on every stop (`tests/access.mjs`). With reduced motion nothing moves but Vici's spinner, whose slow sweep shows that work goes on.

## Colour

Vici's tokens only. Merlot marks the person: the active language, your turn, the one primary action. Lilac marks the AI: what it wrote or estimated, and the notice "You are interacting with an AI system" beside every control that starts a live run. Coral marks an item challenged and sage an item addressed, each with a mark and a word; ink is everything else. Every pair meets 4.5:1 for text and 3:1 for marks (`tests/tokens.mjs`), and nothing is round (`tests/hexagon.mjs`). Where Vici's tones sit close for colour-blind eyes, which the same test reports, marks, words and shapes tell the states apart.

## Words and languages

British English and German with the formal Sie, plain words, short sentences, numbers with units; `tests/vici.mjs` runs Vici's writing checks on every step and scenario text. English opens first; the switch changes every text without a reload. Vici bans "leverage", so a strategy mitigates an issue or turns it into an advantage. The German steps (Start, Ergänzen, Prüfen, Bewerten, Strategien, Fazit) fit the step bar at 1280 px.

## The figures

Four tiles, each explained in the guide: At stake a year, Items challenged, Response to the market and Session cost. They answer first: a scenario's figures stand before anything plays. A sum over part of the issues says so ("on 5 of 6 issues"). The decision moves three of them, the old value struck through beside the new one. Code computes every figure; an AI estimate says so and what it rests on.

## The report

Eight sections on A4, assembled by code from the run on Vici's report pattern, from the cover and the management summary on page two to About this report with the byline. On screen its pages are light sheets in either theme; printed, every page carries the footer with the tool, its address, "Built by Victor Pflüger" and the page number. The HTML file loads and runs nothing; the JSON file feeds the Prototype Ideator.

## What stayed and what went

The plan's design review (PLAN.md, section 16) cut eleven things, from the console to uploads, and kept "Save run as simulation" as a quiet link; `tests/lean.mjs` keeps the cuts out.

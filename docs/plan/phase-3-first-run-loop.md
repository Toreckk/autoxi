# Phase 3: First Solo Run Loop

Goal: build a local solo run loop after the card foundation works.

## Scope

Implement a minimal version of:

- start run,
- choose formation,
- choose captain,
- draft initial squad,
- play deterministic local match simulation,
- enter Scouting Window,
- buy, sell, reroll, freeze, and buy Scout XP,
- continue until 10 wins or 3 losses,
- save run history locally/server-side.
- gameplay analytics for run starts, abandonment, match results, and scouting decisions.

## Run Rules

- Choose 1 formation from 5 options.
- Choose 1 captain from 5 options.
- Draft 15 cards.
- Use 11 starters and 4 bench.
- MVP has no reserve system.
- Run ends at 10 wins or 3 losses.
- A run cannot own two versions of the same underlying player identity at the same time.

## Definition of Done

- A player can complete a solo run against generated opponents or local ghosts.
- The Scouting Window works as the main between-match economy.
- Match outcomes are deterministic and explainable enough for tuning.
- Run-loop dashboards expose abandonment, economy, reroll, win/loss, and match-simulation health metrics.

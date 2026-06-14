# Game Loop

This file documents the later full run loop. It is not part of the first implementation slice.

## Run Start

1. Choose 1 formation from 5 offered formations.
2. Choose 1 captain from 5 offered captains.
3. Draft an initial squad of 15 cards.
4. Build 11 starters plus 4 bench cards.

## Match Loop

1. Match against an opponent ghost snapshot.
2. Simulate match server-side using deterministic logic.
3. Show match result and key events.
4. Enter Scouting Window.
5. Continue until 10 wins or 3 losses.

## Duplicate Rule

A run cannot own two cards that reference the same `player_identity_id`, even if the cards are from different World Cup editions.

This should be modeled in the database early but enforced during run/scouting implementation later.

## End of Run

At run end:

- save final record,
- save squad snapshot,
- update Glory/rank,
- write run history,
- possibly unlock collection discoveries.


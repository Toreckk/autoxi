# Game Concept

Autoxi is an asynchronous football squad-builder autobattler built around collectible World Cup-inspired player cards.

The game should feel like drafting a national-tournament super squad, then testing it against other players' saved ghost squads. The long-term game is competitive, but the first implementation should be web-first and practical.

## Long-Term Core Loop

1. Start a run.
2. Choose 1 formation from 5 options.
3. Choose 1 captain from 5 options.
4. Draft an initial squad.
5. Play asynchronous matches against ghost snapshots of other players' squads.
6. After each match, enter a Scouting Window.
7. Buy, sell, reroll, freeze, or buy Scout XP.
8. Continue until 10 wins or 3 losses.
9. At run end, update Glory/rank.

## First Slice

The first slice is not the full game loop. It focuses on the card foundation and Collection page:

- card data model,
- safe fictional public names,
- database schema,
- API query surface,
- reusable card UI,
- searchable/filterable Collection screen.

## Design Pillars

- Football history without real-world public identity risk.
- UI-heavy tactical decisions instead of real-time control.
- Drafting and shop decisions are the main player agency.
- Deterministic simulation should be explainable and tunable.
- Cards are text-first collectible objects, not photo cards.


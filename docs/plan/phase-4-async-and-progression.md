# Phase 4: Async and Progression

Goal: turn the solo loop into the real asynchronous ranked structure.

## Async Matchmaking

Matches should be server-authoritative and use ghost snapshots. Defeating a ghost snapshot does not affect the opponent player's active run.

Match by:

- similar run stage,
- Glory/MMR,
- squad power,
- current record,
- snapshot recency.

## Progression

Use Glory rating with ranks:

- Qualifier III/II/I
- Group Stage III/II/I
- Round of 16 III/II/I
- Quarter-Finalist III/II/I
- Semi-Finalist III/II/I
- Finalist III/II/I
- Champion III/II/I
- World Champion

## Later Technical Work

- account model hardening,
- ranked queue and snapshot selection,
- match event storage,
- run history views,
- anti-cheat review,
- Tauri packaging,
- Steam integration.


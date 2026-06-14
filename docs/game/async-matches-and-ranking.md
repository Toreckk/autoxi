# Async Matches and Ranking

This file documents the later online shape. It is not part of the first implementation slice.

## Async Matches

Matches should be server-authoritative and use ghost snapshots of other players' squads.

Opponent ghosts are immutable snapshots. If a player defeats a ghost, it does not affect the ghost owner's active run.

## Matchmaking Inputs

Prefer ghosts with similar:

- run stage,
- Glory/MMR,
- squad power,
- record,
- snapshot recency.

## Match Simulation

The match simulator should be deterministic from:

- squad snapshots,
- formation,
- player card stats,
- tactics later,
- RNG seed.

This supports replayability, debugging, and server-authoritative results.

## Glory Ranks

Ranks:

- Qualifier III/II/I
- Group Stage III/II/I
- Round of 16 III/II/I
- Quarter-Finalist III/II/I
- Semi-Finalist III/II/I
- Finalist III/II/I
- Champion III/II/I
- World Champion


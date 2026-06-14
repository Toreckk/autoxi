# Name Fictionalization

The game should use fictional public names while preserving broad football-historical flavor through nation, year, position, role, and rating.

## Goals

- Generate plausible names based on nationality/language.
- Avoid public names that are too close to raw source names.
- Keep fan recognizability indirect, not dependent on name copying.
- Preserve audit mapping internally.

## Risk Levels

- `SAFE`: fully fictional identity.
- `EVOCATIVE`: same nation/year/position/archetype/rating, but clearly different name.
- `RISKY`: too close to the original name; avoid in commercial builds.

## Pipeline

1. Normalize raw name into comparable tokens.
2. Select nationality/language name pools.
3. Generate candidate full names.
4. Generate short display names.
5. Compare candidate to raw source name.
6. Score similarity and phonetic risk.
7. Reject risky candidates.
8. Persist alias with risk metadata.
9. Require manual approval for high-tier cards.

## Implementation Notes

Good first version:

- curated first/last name pools per country or language group,
- deterministic seeded random generation,
- string similarity checks,
- blocked-name list,
- manual override table.

Later version:

- better locale-specific naming,
- phonetic similarity checks,
- admin review UI,
- audit reports for commercial review.


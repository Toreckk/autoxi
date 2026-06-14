# Seed Data Strategy

The first slice needs enough card data to exercise the Collection UI without waiting for the full ingestion pipeline.

Phase 1 seed data is permanent local/dev/test/demo data. It is safe for offline development because public card names are fictional, but it is not the final content database. Real World Cup/source-data import is planned for [Phase 1B](../plan/phase-1b-real-data-ingestion.md).

## MVP Seed Data

Create hand-authored fictional cards with:

- multiple tiers,
- multiple nations,
- multiple World Cup years,
- all broad lines,
- several visible positions,
- varied ratings and profile-specific stats,
- varied roles,
- safe fictional public names.

Seed at least 40 cards so filters and pagination are meaningful.

Outfield cards should use only pace, shooting, passing, dribbling, defending, and physical. Goalkeeper cards should use only diving, handling, kicking, reflexes, speed, and positioning. The seed should derive `statProfile` from position, with GK mapped to `GOALKEEPER` and every other visible position mapped to `OUTFIELD`.

## Seed Safety

- Use fictional public names only.
- Treat `displayName` and `shortName` as fictional public aliases.
- Do not include real player names in public seed card fields.
- If raw source fields are included for testing, keep them in `source_players` only.
- Do not return raw source records from public endpoints.

## Suggested Seed Distribution

- 8 Squad Player
- 8 Starter
- 8 Key Player
- 6 Star
- 5 World Class
- 3 Hero
- 2 Icon

This gives the UI enough high-tier material examples without flooding the first dataset.

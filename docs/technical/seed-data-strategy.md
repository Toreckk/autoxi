# Seed Data Strategy

The first slice needs enough card data to exercise the Collection UI without waiting for the full ingestion pipeline.

## MVP Seed Data

Create hand-authored fictional cards with:

- multiple tiers,
- multiple nations,
- multiple World Cup years,
- all broad lines,
- several visible positions,
- varied ratings and stats,
- varied roles,
- safe fictional public names.

Seed at least 40 cards so filters and pagination are meaningful.

## Seed Safety

- Use fictional public names only.
- Do not include real player names in public seed card fields.
- If raw source fields are included for testing, keep them in `source_players_raw` only.
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


# Data Ingestion Pipeline

The ingestion system should turn raw historical data into public-safe fictional cards.

## Source Strategy

Use Fjelstul World Cup Database as the historical backbone for:

- tournaments,
- years,
- hosts,
- nations,
- squads,
- source player names,
- broad positions if available,
- appearances, events, goals, awards, and related historical signals if available.

Use OpenFootball/worldcup-style data only as supplemental metadata if licensing allows.

Use public EA FC/FIFA-style or Kaggle rating datasets only for prototype research until licensing is verified.

## Pipeline Steps

1. Read source data.
2. Create `source_imports` record.
3. Store raw player rows in `source_players_raw`.
4. Normalize nations and World Cup editions.
5. Create internal `player_identities`.
6. Generate public aliases.
7. Score alias risk.
8. Generate card versions by World Cup edition.
9. Assign rating and tier.
10. Assign visible position and broad line.
11. Assign stats and role.
12. Mark public-safe/approved cards.
13. Export seed data or write directly to the database.

## Rating Approach

Modern prototype cards can use research datasets for broad statistical inspiration only.

Historical cards should be generated from:

- tournament appearances,
- minutes if available,
- goals/assists if available,
- awards,
- team finish,
- clean sheets or defensive records,
- era normalization,
- manual overrides for top cards.

Star, World Class, Hero, and Icon cards should be manually curated.

## Safety Rules

- Raw source names stay server-side.
- Client receives only approved fictional aliases.
- High-tier cards require manual approval.
- Alias risk scoring should be preserved for audit.
- Do not ship research datasets unless commercial licensing is verified.


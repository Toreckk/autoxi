# Phase 2: Data Ingestion and Fictionalization

Goal: replace hand-written seed data with repeatable ingestion and fictionalization workflows.

## Scope

Implement:

- source import tracking,
- raw player import staging,
- normalized nation and tournament mapping,
- internal player identity creation,
- public alias generation,
- alias risk scoring,
- card generation,
- seed export,
- admin/manual approval workflow for high-tier aliases.
- first real observability dashboards for ingestion and Collection API health.

## Data Sources

Primary historical backbone:

- Fjelstul World Cup Database for tournaments, hosts, nations, squads, source player names, broad positions, appearances, events, awards, and related historical context where available.

Possible supplemental metadata:

- OpenFootball/worldcup-style data if licensing allows.

Prototype-only rating research:

- Public EA FC/FIFA-style or Kaggle datasets that include OVR, PAC, SHO, PAS, DRI, DEF, PHY, and GK stats.

Important: do not assume commercial rights for EA/FIFA/Kaggle-style rating datasets. Treat them as prototype/research inputs until licensing is verified.

## Pipeline

1. Import raw source files.
2. Store raw source records in `source_players`.
3. Normalize tournaments, nations, teams, and positions.
4. Create stable `player_identities`.
5. Generate fictional public aliases.
6. Score alias similarity risk.
7. Generate World Cup edition card versions.
8. Assign ratings and tiers.
9. Assign visible positions, broad lines, stats, roles, and costs.
10. Mark high-tier cards for manual approval.
11. Export seed data or write directly through an ingestion command.
12. Track import duration, imported row counts, validation failures, alias rejection counts, and approval backlog.

## Definition of Done

- Imports are reproducible.
- Raw names remain private.
- Public aliases are generated and risk-scored.
- High-tier card aliases can be reviewed before public use.
- Ingestion and card query dashboards exist for local or hosted development.

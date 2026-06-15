# Phase 1B: Real Data Ingestion

Phase 1B imports World Cup player, squad, and tournament data into the same card catalog schema, then verifies the API and Collection UI continue to work without exposing private source data.

## Goal

Import World Cup player/squad/tournament data into the card catalog schema, generate fictional public aliases, assign ratings/stats, and verify the real imported data fits the same DB/API/card UI used by Phase 1.

The Phase 1B catalog uses one canonical card per player identity per World Cup edition. Award/special editions replace the card's visual treatment through `editionKey`. They do not create duplicate cards for the same player/year.

## What Stays From Phase 1

- Curated fictional seed data remains permanent local/dev/test/demo data.
- The seed is useful for offline development and safe demos.
- The seed is not the final content database.
- Public responses continue to use `displayName` and `shortName`, never raw/source names.
- Public responses never expose raw award winner names or source award winner names.
- Local flag assets remain under `apps/web/public/flags`.

## Data Sources

- Use the Fjelstul World Cup Database as the historical World Cup backbone.
- Optionally use OpenFootball/worldcup-style data as supplemental metadata if its license allows the intended use.
- Use EA/FIFA/Kaggle-style rating datasets only for prototype/research unless license is verified.

## Import Requirements

- Preserve raw/source names internally only.
- Generate `displayName` and `shortName` public aliases.
- Never expose raw names to the frontend.
- Generate and validate `flagCode`.
- Map World Cup edition host/year.
- Assign visible position and broad line.
- Generate hidden stats using the correct stat profile: outfield cards get pace/shooting/passing/dribbling/defending/physical, while GK cards get diving/handling/kicking/reflexes/speed/positioning.
- Ratings must be 55-99; stats must be profile-specific 0-99 integers.
- Assign tier from rating using domain tier config.
- Assign cost from tier config.
- Persist base tier material on cards; use `editionKey` to derive special-edition presentation in the public API.
- Import tournament team results into `world_cup_edition_team_results` when the source data supports final rank/result metadata.
- Import normalized award metadata into `world_cup_awards` and edition winners into `world_cup_award_winners`. Award winner rows are historical metadata and can be many per award/tournament.
- Resolve one visual `editionKey` deterministically from award links. GK cards prefer Golden Glove, then Golden Ball. Outfield cards prefer Golden Ball, Golden Boot, then Best Young Player.
- Generate import reports for missing data or uncertain mappings.
- Require manual alias approval for high-tier cards.
- Manually curate Star, World Class, Hero, and Icon cards.
- Manually curate special-edition cards for Golden Boot, Golden Ball, Best Young Player, and Golden Glove when an award winner should receive a collectible card treatment.
- Keep source/import identifiers out of public DTOs; public aliases should use the SAFE/EVOCATIVE/RISKY/BLOCKED review states internally.

## Out Of Scope

- Gameplay, scouting, matches, rankings, and auth.
- External observability services.
- Tauri/Steam packaging.
- Admin UI.
- Dynamic DB-driven tier definitions.
- Card variants/prints. If multiple visual versions of the same player/year are needed later, add a separate `card_prints` or `card_variants` table linked to `player_cards`.

## Local Development Notes

During Phase 1 and Phase 1B, local CORS should include both browser origins:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

If the frontend is opened at `127.0.0.1:5173` but the API only allows `localhost:5173`, CORS will fail. In non-production mode, the API also accepts loopback fallback ports such as `5174` and `5175`.

The current baseline migration is `0001_create_player_card_catalog.sql`. Because this is still pre-real-data, development databases can be reset and migrated from that baseline before Phase 1B import work.

# Database Schema

The first schema supports card browsing and public-safe aliases. It should stay narrow for Phase 1.

## Immediate Tables

### `nations`

Purpose: normalized country/team identity for cards.

Columns:

- `id uuid primary key`
- `iso2_code text nullable`
- `iso3_code text nullable`
- `fifa_code text nullable`
- `display_name text`
- `flag_code text`
- `flag_asset_path text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- unique `flag_code`
- index `display_name`
- index `fifa_code`

### `world_cup_editions`

Purpose: World Cup host/year metadata.

Columns:

- `id uuid primary key`
- `year int unique`
- `host_name text`
- `host_country_code text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- unique `year`
- index `host_name`

### `source_imports`

Purpose: track ingestion runs and source files.

Columns:

- `id uuid primary key`
- `source_name text`
- `source_version text nullable`
- `source_url text nullable`
- `license_note text nullable`
- `imported_at timestamptz`
- `metadata jsonb`

Use JSONB for provider-specific import metadata because each source may differ.

### `source_players`

Purpose: private raw source player data and names.

Columns:

- `id uuid primary key`
- `source_import_id uuid`
- `source_provider text`
- `source_external_id text`
- `raw_name text`
- `raw_nationality text nullable`
- `raw_position text nullable`
- `raw_payload_json jsonb`
- `created_at timestamptz`

Indexes:

- unique `(source_provider, source_external_id)`
- index `raw_name`

Raw names must never be returned by public card endpoints.

### `player_identities`

Purpose: stable internal identity that can have multiple World Cup cards.

Columns:

- `id uuid primary key`
- `identity_key text unique`
- `source_player_id uuid nullable`
- `nationality_id uuid`
- `canonical_position text nullable`
- `notes text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- unique `identity_key`
- index `nationality_id`

### `player_aliases`

Purpose: generated fictional public names and approval state.

Columns:

- `id uuid primary key`
- `player_identity_id uuid`
- `display_name text`
- `short_name text`
- `locale_hint text nullable`
- `risk_level enum`
- `generation_method text`
- `is_approved boolean`
- `reviewed_by text nullable`
- `reviewed_at timestamptz nullable`
- `notes text nullable`
- `created_at timestamptz`
- `metadata jsonb`

Indexes:

- index `player_identity_id`
- index `is_approved`
- unique `(player_identity_id, display_name)`

Use JSONB for alias generation notes and risk details because scoring signals may change.

### `player_cards`

Purpose: public collectible card versions.

Columns:

- `id uuid primary key`
- `player_identity_id uuid`
- `nation_id uuid`
- `world_cup_edition_id uuid`
- `alias_id uuid`
- `rating int`
- `tier enum`
- `tier_override enum nullable`
- `position enum`
- `broad_line enum`
- `stat_profile enum`
- `role enum`
- `edition_key enum`
- `cost int`
- `material_key enum`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- index `rating`
- index `tier`
- index `edition_key`
- index `position`
- index `broad_line`
- index `nation_id`
- index `world_cup_edition_id`
- unique `(player_identity_id, world_cup_edition_id)`

The unique card constraint is intentionally canonical. A player should not have both a normal card and a special-edition card for the same World Cup edition. Award/special editions set `edition_key` on this one card instead of creating duplicate `player_cards` rows.

Constraints:

- `rating` between 55 and 99

### `player_card_outfield_stats`

Purpose: hidden outfield stat block for non-GK cards.

Columns:

- `card_id uuid primary key`
- `pace int`
- `shooting int`
- `passing int`
- `dribbling int`
- `defending int`
- `physical int`

Constraints:

- each stat between 0 and 99

### `player_card_goalkeeper_stats`

Purpose: hidden goalkeeper stat block for GK cards.

Columns:

- `card_id uuid primary key`
- `diving int`
- `handling int`
- `kicking int`
- `reflexes int`
- `speed int`
- `positioning int`

Constraints:

- each stat between 0 and 99

### `world_cup_edition_team_results`

Purpose: tournament-level team outcomes for host/champion/finalist/semifinalist-style queries.

Columns:

- `id uuid primary key`
- `world_cup_edition_id uuid`
- `nation_id uuid`
- `final_rank int nullable`
- `result_code text`
- `created_at timestamptz`

Indexes:

- index `(world_cup_edition_id, result_code)`
- unique `(world_cup_edition_id, nation_id, result_code)`

### `world_cup_awards`

Purpose: normalized award definitions for edition-specific cards and ingestion.

Columns:

- `id uuid primary key`
- `code text unique`
- `label text`
- `description text nullable`
- `created_at timestamptz`

Initial award codes:

- `GOLDEN_BOOT`
- `GOLDEN_BALL`
- `BEST_YOUNG_PLAYER`
- `GOLDEN_GLOVE`

### `world_cup_award_winners`

Purpose: link award winners to an edition, optional internal identity/card, nation, and raw source winner text.

Columns:

- `id uuid primary key`
- `world_cup_edition_id uuid`
- `award_id uuid`
- `player_identity_id uuid nullable`
- `player_card_id uuid nullable`
- `nation_id uuid nullable`
- `source_player_id uuid nullable`
- `raw_winner_name text nullable`
- `notes text nullable`
- `created_at timestamptz`

Indexes:

- index `(world_cup_edition_id, award_id)`
- index `player_identity_id`
- index `player_card_id`

Do not enforce one winner per award per tournament at the DB level. Some awards can be shared, unresolved, or ambiguous during import. Phase 1B ingestion should report duplicates/ambiguity instead of failing the schema.

`world_cup_award_winners` is historical metadata. `player_cards.edition_key` remains the chosen visual edition for public rendering.

### Optional: `card_tags`

Purpose: optional flexible labels for future filtering.

Columns:

- `id uuid primary key`
- `card_id uuid`
- `tag text`

Indexes:

- unique `(card_id, tag)`
- index `tag`

### Optional: `analytics_events`

Purpose: local analytics event sink for Phase 1 if needed.

Columns:

- `id uuid primary key`
- `event_name text`
- `event_version int`
- `anonymous_id text`
- `user_id uuid nullable`
- `session_id text`
- `route text nullable`
- `properties jsonb`
- `created_at timestamptz`

## Later Tables

Plan but do not implement yet:

- `card_prints` / `card_variants` for future multiple visual versions of the same canonical card:
  - `id`
  - `player_card_id`
  - `card_set_key`
  - `edition_key`
  - `render_profile_key`
  - `is_default`
  - `is_collection_variant`
- `users`
- `collection_discovery`
- `runs`
- `run_card_instances`
- `squad_slots`
- `scouting_windows`
- `scouting_offers`
- `team_snapshots`
- `matches`
- `match_events`
- `rankings`
- `run_history`

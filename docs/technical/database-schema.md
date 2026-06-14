# Database Schema

The first schema supports card browsing and public-safe aliases. It should stay narrow for Phase 1.

## Immediate Tables

### `nations`

Purpose: normalized country/team identity for cards.

Columns:

- `id uuid primary key`
- `code text unique`
- `name text`
- `flag_emoji text`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- unique `code`
- index `name`

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
- `role enum`
- `cost int`
- `material_key enum`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- index `rating`
- index `tier`
- index `position`
- index `broad_line`
- index `nation_id`
- index `world_cup_edition_id`
- unique `(player_identity_id, world_cup_edition_id)`

### `player_card_stats`

Purpose: hidden stat block for cards.

Columns:

- `card_id uuid primary key`
- `pace int`
- `shooting int`
- `passing int`
- `dribbling int`
- `defending int`
- `physical int`
- `goalkeeping int`

Constraints:

- each stat between 0 and 99

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

- `users`
- `collection_discovery`
- `card_tags`
- `card_tag_links`
- `data_versions`
- `balance_versions`
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

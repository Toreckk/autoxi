# Database Schema

The first schema should support card browsing now and leave room for ingestion, audit, discovery, and later run systems.

## Immediate Tables

### `users`

Purpose: dev-only user model now, real accounts later.

Columns:

- `id uuid primary key`
- `display_name text`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- primary key on `id`

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

### `source_players_raw`

Purpose: private raw source player data and names.

Columns:

- `id uuid primary key`
- `source_import_id uuid`
- `source_player_key text`
- `raw_name text`
- `raw_nation text nullable`
- `raw_position text nullable`
- `raw_payload jsonb`
- `created_at timestamptz`

Indexes:

- unique `(source_import_id, source_player_key)`
- index `raw_name`

Raw names must never be returned by public card endpoints.

### `player_identities`

Purpose: stable internal identity that can have multiple World Cup cards.

Columns:

- `id uuid primary key`
- `identity_key text unique`
- `primary_nation_id uuid`
- `source_player_raw_id uuid nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- unique `identity_key`
- index `primary_nation_id`

### `player_aliases`

Purpose: generated fictional public names and approval state.

Columns:

- `id uuid primary key`
- `player_identity_id uuid`
- `public_name text`
- `short_name text`
- `locale_hint text nullable`
- `risk_level enum`
- `risk_score numeric`
- `approval_status enum`
- `approved_at timestamptz nullable`
- `created_at timestamptz`
- `metadata jsonb`

Indexes:

- index `player_identity_id`
- index `approval_status`
- unique `(player_identity_id, public_name)`

Use JSONB for alias generation notes and risk details because scoring signals may change.

### `cards`

Purpose: public collectible card versions.

Columns:

- `id uuid primary key`
- `player_identity_id uuid`
- `nation_id uuid`
- `world_cup_edition_id uuid`
- `approved_alias_id uuid`
- `rating int`
- `tier enum`
- `tier_override enum nullable`
- `visible_position enum`
- `broad_line enum`
- `role enum`
- `cost int`
- `material_key text`
- `animation_level int`
- `is_public boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- index `rating`
- index `tier`
- index `visible_position`
- index `broad_line`
- index `nation_id`
- index `world_cup_edition_id`
- unique `(player_identity_id, world_cup_edition_id)`

### `card_stats`

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

### `card_tags`

Purpose: optional flexible labels for future filtering.

Columns:

- `id uuid primary key`
- `card_id uuid`
- `tag text`

Indexes:

- unique `(card_id, tag)`
- index `tag`

### `collection_discovery`

Purpose: future discovered-card state per user.

Columns:

- `user_id uuid`
- `card_id uuid`
- `discovered_at timestamptz`

Indexes:

- primary key `(user_id, card_id)`
- index `card_id`

Unused in the MVP Collection page.

### `balance_versions`

Purpose: track card/stat balance versions.

Columns:

- `id uuid primary key`
- `version text unique`
- `status text`
- `notes text nullable`
- `created_at timestamptz`

## Later Tables

Plan but do not implement yet:

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


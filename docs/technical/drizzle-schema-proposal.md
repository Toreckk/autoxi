# Drizzle Schema Proposal

This is the Phase 1 Drizzle/PostgreSQL schema shape. It intentionally models only player cards and Collection browsing.

## Package Location

Schema belongs in `packages/db`.

Recommended structure:

```text
packages/db/
  src/
    client.ts
    index.ts
    schema/
      enums.ts
      source.ts
      nations.ts
      player-cards.ts
      analytics.ts
    seed/
      seed.ts
      seed-data.ts
  drizzle/
    migrations/
  drizzle.config.ts
```

## Tables

Immediate Phase 1 tables:

- `source_imports`
- `source_players`
- `nations`
- `world_cup_editions`
- `player_identities`
- `player_aliases`
- `player_cards`
- `player_card_stats`
- `analytics_events` optional but planned

Do not implement yet:

- `runs`
- `matches`
- `scouting_windows`
- `scouting_offers`
- `team_snapshots`
- `rankings`
- `collection_discovery`
- `users`
- auth tables

## Enums

```ts
export const cardTier = pgEnum("card_tier", [
  "SQUAD_PLAYER",
  "STARTER",
  "KEY_PLAYER",
  "STAR",
  "WORLD_CLASS",
  "HERO",
  "ICON",
]);

export const visiblePosition = pgEnum("visible_position", [
  "GK",
  "CB",
  "LB",
  "RB",
  "CM",
  "CDM",
  "CAM",
  "LW",
  "RW",
  "ST",
]);

export const broadLine = pgEnum("broad_line", ["GK", "DF", "MF", "FW"]);

export const aliasRiskLevel = pgEnum("alias_risk_level", [
  "SAFE",
  "EVOCATIVE",
  "RISKY",
  "BLOCKED",
]);

export const cardMaterialKey = pgEnum("card_material_key", [
  "MATTE_GRAPHITE",
  "BRUSHED_STEEL",
  "EMERALD_COMPOSITE",
  "VIOLET_PHASE",
  "COBALT_GOLD",
  "RUBY_HERO",
  "IVORY_GOLD_ICON",
  "BLACK_PEARL_ICON",
]);
```

## Table Sketch

```ts
export const sourceImports = pgTable("source_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceProvider: text("source_provider").notNull(),
  sourceName: text("source_name").notNull(),
  sourceVersion: text("source_version"),
  sourceUrl: text("source_url"),
  licenseNote: text("license_note"),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourcePlayers = pgTable(
  "source_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceImportId: uuid("source_import_id").notNull().references(() => sourceImports.id),
    sourceProvider: text("source_provider").notNull(),
    sourceExternalId: text("source_external_id").notNull(),
    rawName: text("raw_name").notNull(),
    rawNationality: text("raw_nationality"),
    rawPosition: text("raw_position"),
    rawPayloadJson: jsonb("raw_payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueSourcePlayer: unique().on(table.sourceProvider, table.sourceExternalId),
    sourceImportIdx: index("source_players_source_import_id_idx").on(table.sourceImportId),
  }),
);
```

Continue this style for:

- `nations` with `iso2Code`, `iso3Code`, `fifaCode`, `displayName`, `flagCode`, and optional `flagAssetPath`,
- `world_cup_editions` with unique `year`,
- `player_identities` with unique `identityKey`,
- `player_aliases` with `displayName`, `shortName`, `riskLevel`, `isApproved`, review fields, and notes,
- `player_cards` with rating, tier, position, broad line, role, material key, and cost,
- `player_card_stats` with one row per card,
- `analytics_events` for local analytics capture.

## Constraints

Add database constraints where practical:

- rating between 55 and 99,
- stats between 0 and 99,
- cost positive,
- unique nation code,
- unique World Cup year,
- unique player card version where appropriate,
- public card uses an approved alias where feasible.

Drizzle and Zod should both validate important boundaries. Database constraints protect persisted data; Zod protects API and seed inputs before they reach the database.

## Indexes

Required Phase 1 indexes:

- `player_cards.rating`
- `player_cards.tier`
- `player_cards.position`
- `player_cards.broad_line`
- `player_cards.nation_id`
- `player_cards.world_cup_edition_id`
- `player_aliases.display_name`
- `player_aliases.short_name`
- `player_card_stats.pace`
- `player_card_stats.shooting`
- `player_card_stats.passing`
- `player_card_stats.dribbling`
- `player_card_stats.defending`
- `player_card_stats.physical`
- `player_card_stats.goalkeeping`

For MVP search, `ILIKE` is acceptable. Full-text search or trigram indexes can come later.

## Public Safety

Public card queries must join only approved aliases and map to `PublicPlayerCardDto`.

Never expose:

- `rawName`
- `sourceName`
- `sourcePlayerId`
- `sourceExternalId`
- `rawPayloadJson`
- `sourceImportId`
- `riskScore`
- `approvalNotes`
- `generationPrompt`
- `internalSourceName`

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  BROAD_LINES,
  CARD_ROLES,
  CARD_TIERS,
  MATERIAL_KEYS,
  STAT_PROFILES,
  VISIBLE_POSITIONS,
  type BroadLine,
  type CardRole,
  type CardTier,
  type MaterialKey,
  type StatProfile,
  type VisiblePosition
} from "@autoxi/domain";

export const cardTierEnum = pgEnum("card_tier", CARD_TIERS);
export const visiblePositionEnum = pgEnum("visible_position", VISIBLE_POSITIONS);
export const broadLineEnum = pgEnum("broad_line", BROAD_LINES);
export const cardRoleEnum = pgEnum("card_role", CARD_ROLES);
export const materialKeyEnum = pgEnum("material_key", MATERIAL_KEYS);
export const statProfileEnum = pgEnum("stat_profile", STAT_PROFILES);
export const aliasRiskLevelEnum = pgEnum("alias_risk_level", ["SAFE", "EVOCATIVE", "RISKY", "BLOCKED"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const nations = pgTable(
  "nations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    iso2Code: text("iso2_code"),
    iso3Code: text("iso3_code"),
    fifaCode: text("fifa_code"),
    displayName: text("display_name").notNull(),
    flagCode: text("flag_code").notNull(),
    flagAssetPath: text("flag_asset_path"),
    ...timestamps
  },
  (table) => ({
    flagCodeUnique: unique("nations_flag_code_unique").on(table.flagCode),
    displayNameIdx: index("nations_display_name_idx").on(table.displayName),
    fifaCodeIdx: index("nations_fifa_code_idx").on(table.fifaCode)
  })
);

export const worldCupEditions = pgTable(
  "world_cup_editions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: integer("year").notNull().unique(),
    hostName: text("host_name").notNull(),
    hostCountryCode: text("host_country_code"),
    ...timestamps
  },
  (table) => ({
    hostNameIdx: index("world_cup_editions_host_name_idx").on(table.hostName)
  })
);

export const sourceImports = pgTable("source_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceName: text("source_name").notNull(),
  sourceVersion: text("source_version"),
  sourceUrl: text("source_url"),
  licenseNote: text("license_note"),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({})
});

export const sourcePlayers = pgTable(
  "source_players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceImportId: uuid("source_import_id")
      .notNull()
      .references(() => sourceImports.id, { onDelete: "cascade" }),
    sourceProvider: text("source_provider").notNull(),
    sourceExternalId: text("source_external_id").notNull(),
    rawName: text("raw_name").notNull(),
    rawNationality: text("raw_nationality"),
    rawPosition: text("raw_position"),
    rawPayloadJson: jsonb("raw_payload_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    sourceProviderExternalIdUnique: unique("source_players_provider_external_unique").on(
      table.sourceProvider,
      table.sourceExternalId
    ),
    rawNameIdx: index("source_players_raw_name_idx").on(table.rawName)
  })
);

export const playerIdentities = pgTable(
  "player_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identityKey: text("identity_key").notNull().unique(),
    sourcePlayerId: uuid("source_player_id").references(() => sourcePlayers.id, { onDelete: "set null" }),
    nationalityId: uuid("nationality_id")
      .notNull()
      .references(() => nations.id, { onDelete: "restrict" }),
    canonicalPosition: text("canonical_position"),
    notes: text("notes"),
    ...timestamps
  },
  (table) => ({
    nationalityIdx: index("player_identities_nationality_idx").on(table.nationalityId)
  })
);

export const playerAliases = pgTable(
  "player_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerIdentityId: uuid("player_identity_id")
      .notNull()
      .references(() => playerIdentities.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    shortName: text("short_name").notNull(),
    localeHint: text("locale_hint"),
    riskLevel: aliasRiskLevelEnum("risk_level").default("SAFE").notNull(),
    generationMethod: text("generation_method").notNull(),
    isApproved: boolean("is_approved").default(false).notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({})
  },
  (table) => ({
    identityIdx: index("player_aliases_identity_idx").on(table.playerIdentityId),
    approvedIdx: index("player_aliases_approved_idx").on(table.isApproved),
    identityDisplayUnique: unique("player_aliases_identity_display_unique").on(table.playerIdentityId, table.displayName)
  })
);

export const playerCards = pgTable(
  "player_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerIdentityId: uuid("player_identity_id")
      .notNull()
      .references(() => playerIdentities.id, { onDelete: "cascade" }),
    nationId: uuid("nation_id")
      .notNull()
      .references(() => nations.id, { onDelete: "restrict" }),
    worldCupEditionId: uuid("world_cup_edition_id")
      .notNull()
      .references(() => worldCupEditions.id, { onDelete: "restrict" }),
    aliasId: uuid("alias_id")
      .notNull()
      .references(() => playerAliases.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    tier: cardTierEnum("tier").notNull().$type<CardTier>(),
    tierOverride: cardTierEnum("tier_override").$type<CardTier | null>(),
    position: visiblePositionEnum("position").notNull().$type<VisiblePosition>(),
    broadLine: broadLineEnum("broad_line").notNull().$type<BroadLine>(),
    statProfile: statProfileEnum("stat_profile").notNull().$type<StatProfile>(),
    role: cardRoleEnum("role").notNull().$type<CardRole>(),
    cost: integer("cost").notNull(),
    materialKey: materialKeyEnum("material_key").notNull().$type<MaterialKey>(),
    ...timestamps
  },
  (table) => ({
    ratingIdx: index("player_cards_rating_idx").on(table.rating),
    tierIdx: index("player_cards_tier_idx").on(table.tier),
    positionIdx: index("player_cards_position_idx").on(table.position),
    broadLineIdx: index("player_cards_broad_line_idx").on(table.broadLine),
    nationIdx: index("player_cards_nation_idx").on(table.nationId),
    worldCupIdx: index("player_cards_world_cup_idx").on(table.worldCupEditionId),
    identityEditionUnique: unique("player_cards_identity_edition_unique").on(
      table.playerIdentityId,
      table.worldCupEditionId
    ),
    ratingCheck: check("player_cards_rating_check", sql`${table.rating} between 55 and 99`),
    costCheck: check("player_cards_cost_check", sql`${table.cost} >= 0`)
  })
);

export const playerCardOutfieldStats = pgTable(
  "player_card_outfield_stats",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => playerCards.id, { onDelete: "cascade" }),
    pace: integer("pace").notNull(),
    shooting: integer("shooting").notNull(),
    passing: integer("passing").notNull(),
    dribbling: integer("dribbling").notNull(),
    defending: integer("defending").notNull(),
    physical: integer("physical").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.cardId] }),
    paceCheck: check("player_card_outfield_stats_pace_check", sql`${table.pace} between 0 and 99`),
    shootingCheck: check("player_card_outfield_stats_shooting_check", sql`${table.shooting} between 0 and 99`),
    passingCheck: check("player_card_outfield_stats_passing_check", sql`${table.passing} between 0 and 99`),
    dribblingCheck: check("player_card_outfield_stats_dribbling_check", sql`${table.dribbling} between 0 and 99`),
    defendingCheck: check("player_card_outfield_stats_defending_check", sql`${table.defending} between 0 and 99`),
    physicalCheck: check("player_card_outfield_stats_physical_check", sql`${table.physical} between 0 and 99`)
  })
);

export const playerCardGoalkeeperStats = pgTable(
  "player_card_goalkeeper_stats",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => playerCards.id, { onDelete: "cascade" }),
    diving: integer("diving").notNull(),
    handling: integer("handling").notNull(),
    kicking: integer("kicking").notNull(),
    reflexes: integer("reflexes").notNull(),
    speed: integer("speed").notNull(),
    positioning: integer("positioning").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.cardId] }),
    divingCheck: check("player_card_goalkeeper_stats_diving_check", sql`${table.diving} between 0 and 99`),
    handlingCheck: check("player_card_goalkeeper_stats_handling_check", sql`${table.handling} between 0 and 99`),
    kickingCheck: check("player_card_goalkeeper_stats_kicking_check", sql`${table.kicking} between 0 and 99`),
    reflexesCheck: check("player_card_goalkeeper_stats_reflexes_check", sql`${table.reflexes} between 0 and 99`),
    speedCheck: check("player_card_goalkeeper_stats_speed_check", sql`${table.speed} between 0 and 99`),
    positioningCheck: check("player_card_goalkeeper_stats_positioning_check", sql`${table.positioning} between 0 and 99`)
  })
);

export const cardTags = pgTable(
  "card_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => playerCards.id, { onDelete: "cascade" }),
    tag: text("tag").notNull()
  },
  (table) => ({
    cardTagUnique: unique("card_tags_card_tag_unique").on(table.cardId, table.tag),
    tagIdx: index("card_tags_tag_idx").on(table.tag)
  })
);

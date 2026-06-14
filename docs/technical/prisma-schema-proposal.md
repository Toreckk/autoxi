# Prisma Schema Proposal

This is a first-slice Prisma shape. It should be refined during implementation.

```prisma
enum CardTier {
  SQUAD_PLAYER
  STARTER
  KEY_PLAYER
  STAR
  WORLD_CLASS
  HERO
  ICON
}

enum VisiblePosition {
  GK
  CB
  LB
  RB
  CM
  CDM
  CAM
  LW
  RW
  ST
}

enum BroadLine {
  GK
  DF
  MF
  FW
}

enum CardRole {
  MAESTRO
  FINISHER
  ENGINE
  ANCHOR
  COMMANDER
  SWEEPER
  SHOT_STOPPER
  WIDE_CREATOR
  TARGET_MAN
  BALL_WINNER
  DRIBBLER
  LIBERO
}

enum AliasRiskLevel {
  SAFE
  EVOCATIVE
  RISKY
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

model Nation {
  id        String   @id @default(uuid()) @db.Uuid
  code      String   @unique
  name      String
  flagEmoji String?  @map("flag_emoji")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identities PlayerIdentity[]
  cards      Card[]

  @@index([name])
  @@map("nations")
}

model WorldCupEdition {
  id              String   @id @default(uuid()) @db.Uuid
  year            Int      @unique
  hostName        String   @map("host_name")
  hostCountryCode String?  @map("host_country_code")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  cards Card[]

  @@index([hostName])
  @@map("world_cup_editions")
}

model SourceImport {
  id            String   @id @default(uuid()) @db.Uuid
  sourceName    String   @map("source_name")
  sourceVersion String?  @map("source_version")
  sourceUrl     String?  @map("source_url")
  licenseNote   String?  @map("license_note")
  importedAt    DateTime @default(now()) @map("imported_at")
  metadata      Json     @default("{}")

  rawPlayers SourcePlayerRaw[]

  @@map("source_imports")
}

model SourcePlayerRaw {
  id              String   @id @default(uuid()) @db.Uuid
  sourceImportId  String   @map("source_import_id") @db.Uuid
  sourcePlayerKey String   @map("source_player_key")
  rawName         String   @map("raw_name")
  rawNation       String?  @map("raw_nation")
  rawPosition     String?  @map("raw_position")
  rawPayload      Json     @default("{}") @map("raw_payload")
  createdAt       DateTime @default(now()) @map("created_at")

  sourceImport SourceImport     @relation(fields: [sourceImportId], references: [id])
  identities   PlayerIdentity[]

  @@unique([sourceImportId, sourcePlayerKey])
  @@index([rawName])
  @@map("source_players_raw")
}

model PlayerIdentity {
  id                String   @id @default(uuid()) @db.Uuid
  identityKey       String   @unique @map("identity_key")
  primaryNationId   String   @map("primary_nation_id") @db.Uuid
  sourcePlayerRawId String?  @map("source_player_raw_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  primaryNation   Nation           @relation(fields: [primaryNationId], references: [id])
  sourcePlayerRaw SourcePlayerRaw?  @relation(fields: [sourcePlayerRawId], references: [id])
  aliases         PlayerAlias[]
  cards           Card[]

  @@index([primaryNationId])
  @@map("player_identities")
}

model PlayerAlias {
  id               String         @id @default(uuid()) @db.Uuid
  playerIdentityId String         @map("player_identity_id") @db.Uuid
  publicName       String         @map("public_name")
  shortName        String         @map("short_name")
  localeHint       String?        @map("locale_hint")
  riskLevel        AliasRiskLevel @map("risk_level")
  riskScore        Decimal        @map("risk_score") @db.Decimal(5, 2)
  approvalStatus   ApprovalStatus @map("approval_status")
  approvedAt       DateTime?      @map("approved_at")
  createdAt        DateTime       @default(now()) @map("created_at")
  metadata         Json           @default("{}")

  playerIdentity PlayerIdentity @relation(fields: [playerIdentityId], references: [id])
  approvedCards  Card[]

  @@unique([playerIdentityId, publicName])
  @@index([approvalStatus])
  @@map("player_aliases")
}

model Card {
  id                String          @id @default(uuid()) @db.Uuid
  playerIdentityId  String          @map("player_identity_id") @db.Uuid
  nationId          String          @map("nation_id") @db.Uuid
  worldCupEditionId String          @map("world_cup_edition_id") @db.Uuid
  approvedAliasId   String          @map("approved_alias_id") @db.Uuid
  rating            Int
  tier              CardTier
  tierOverride      CardTier?       @map("tier_override")
  visiblePosition   VisiblePosition @map("visible_position")
  broadLine         BroadLine       @map("broad_line")
  role              CardRole
  cost              Int
  materialKey       String          @map("material_key")
  animationLevel    Int             @map("animation_level")
  isPublic          Boolean         @default(true) @map("is_public")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")

  playerIdentity  PlayerIdentity  @relation(fields: [playerIdentityId], references: [id])
  nation          Nation          @relation(fields: [nationId], references: [id])
  worldCupEdition WorldCupEdition @relation(fields: [worldCupEditionId], references: [id])
  approvedAlias   PlayerAlias     @relation(fields: [approvedAliasId], references: [id])
  stats           CardStats?
  tags            CardTag[]
  discoveries     CollectionDiscovery[]

  @@unique([playerIdentityId, worldCupEditionId])
  @@index([rating])
  @@index([tier])
  @@index([visiblePosition])
  @@index([broadLine])
  @@index([nationId])
  @@index([worldCupEditionId])
  @@map("cards")
}

model CardStats {
  cardId      String @id @map("card_id") @db.Uuid
  pace        Int
  shooting    Int
  passing     Int
  dribbling   Int
  defending   Int
  physical    Int
  goalkeeping Int

  card Card @relation(fields: [cardId], references: [id])

  @@map("card_stats")
}
```

Prisma cannot express every numeric check constraint cleanly in the schema. Add database-level check constraints through migrations if needed, and keep Zod validation in the domain package.


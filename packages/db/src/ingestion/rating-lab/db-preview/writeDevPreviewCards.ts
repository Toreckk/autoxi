import { broadLineForPosition, costForTier, materialForTier, type CardRole } from "@autoxi/domain";
import { eq, inArray, like } from "drizzle-orm";
import { createDbClient } from "../../../client.js";
import {
  cardTags,
  nations,
  playerAliases,
  playerCardGoalkeeperStats,
  playerCardOutfieldStats,
  playerCards,
  playerIdentities,
  sourceImports,
  sourcePlayers,
  worldCupAwardWinners,
  worldCupEditions
} from "../../../schema.js";
import { deterministicUuid } from "../../../seedData.js";
import { generateStatsFromOverall } from "../domain/rating/generateStatsFromOverall.js";
import type { RatingLabCardSnapshot, RatingLabSummary } from "../domain/types.js";
import { selectPreviewCards } from "./selectPreviewCards.js";
import type { PreviewImportEstimate } from "./estimatePreviewImportSize.js";

const PREVIEW_SOURCE_NAME = "rating_lab_preview";
const PREVIEW_IDENTITY_PREFIX = "rating-lab-preview:";

export type DevPreviewWriteResult = {
  sourceImportId: string;
  cardsWritten: number;
  nationsAvailable: number;
  editionsAvailable: number;
  sourcePlayersWritten: number;
  identitiesWritten: number;
  aliasesWritten: number;
  outfieldStatsWritten: number;
  goalkeeperStatsWritten: number;
};

export function devPreviewUnavailableMessage(estimate?: PreviewImportEstimate): string {
  const estimateText = estimate
    ? ` Estimated rows: ${estimate.estimatedTotalRows}, storage: ${estimate.estimatedStorageMb} MB.`
    : "";
  return `Stage B dev DB preview is only available with --dev-only, --reset-rating-lab-preview, and DATABASE_URL.${estimateText} Use Stage A HTML preview: pnpm db:rating-lab:preview -- --report data/import-reports/rating-lab/latest-summary.json`;
}

export async function writeDevPreviewCards(options: {
  summary: RatingLabSummary;
  maxCards?: number;
  connectionString?: string;
}): Promise<DevPreviewWriteResult> {
  const selections = selectPreviewCards(options.summary, options.maxCards ?? 500);
  const { db, client } = createDbClient(options.connectionString);

  try {
    return await db.transaction(async (tx) => {
      await resetRatingLabPreviewInTransaction(tx);

      const sourceImportId = deterministicUuid(`source-import-${PREVIEW_SOURCE_NAME}-${options.summary.generatedAt}`);
      await tx.insert(sourceImports).values({
        id: sourceImportId,
        sourceName: PREVIEW_SOURCE_NAME,
        sourceVersion: options.summary.generatedAt,
        licenseNote: "Development-only preview rows generated from rating-lab ingestion reports.",
        metadata: {
          sourceDir: options.summary.sourceDir,
          sampleMode: options.summary.sampleMode,
          seed: options.summary.seed,
          publicSafeAliases: true
        }
      });

      const nationByCode = await ensurePreviewNations(tx, selections.map((selection) => selection.card));
      const editionByYear = await ensurePreviewEditions(tx, selections.map((selection) => selection.card));

      const sourcePlayerRows: Array<typeof sourcePlayers.$inferInsert> = [];
      const identityRows: Array<typeof playerIdentities.$inferInsert> = [];
      const aliasRows: Array<typeof playerAliases.$inferInsert> = [];
      const cardRows: Array<typeof playerCards.$inferInsert> = [];
      const outfieldStatRows: Array<typeof playerCardOutfieldStats.$inferInsert> = [];
      const goalkeeperStatRows: Array<typeof playerCardGoalkeeperStats.$inferInsert> = [];

      for (const [index, selection] of selections.entries()) {
        const card = selection.card;
        const nation = nationByCode.get(card.nation);
        const edition = editionByYear.get(card.worldCupYear);
        if (!nation || !edition) throw new Error(`Missing preview relation for ${card.publicPlaceholderName}`);

        const previewKey = `${card.key}:${index}`;
        const sourcePlayerId = deterministicUuid(`source-player-${PREVIEW_SOURCE_NAME}-${previewKey}`);
        const identityId = deterministicUuid(`identity-${PREVIEW_SOURCE_NAME}-${previewKey}`);
        const aliasId = deterministicUuid(`alias-${PREVIEW_SOURCE_NAME}-${previewKey}`);
        const cardId = deterministicUuid(`card-${PREVIEW_SOURCE_NAME}-${previewKey}`);
        const role = defaultRoleForPosition(card.position);
        const stats = generateStatsFromOverall({
          overall: card.overall,
          position: card.position,
          role,
          seed: `${options.summary.seed}:${card.key}`
        });

        sourcePlayerRows.push({
          id: sourcePlayerId,
          sourceImportId,
          sourceProvider: PREVIEW_SOURCE_NAME,
          sourceExternalId: `preview-${index.toString().padStart(5, "0")}-${shortHash(card.key)}`,
          rawName: card.internalRawName,
          rawNationality: card.nation,
          rawPosition: card.position,
          rawPayloadJson: {
            publicPlaceholderName: card.publicPlaceholderName,
            worldCupYear: card.worldCupYear,
            overall: card.overall,
            tier: card.tier,
            primarySource: card.primarySource,
            confidence: card.confidence,
            warnings: card.warnings,
            reasons: card.reasons,
            previewReasons: selection.reasons
          }
        });

        identityRows.push({
          id: identityId,
          identityKey: `${PREVIEW_IDENTITY_PREFIX}${previewKey}`,
          sourcePlayerId,
          nationalityId: nation.id,
          canonicalPosition: card.position,
          notes: "Development-only rating-lab preview identity."
        });

        aliasRows.push({
          id: aliasId,
          playerIdentityId: identityId,
          displayName: devPreviewDisplayName(card),
          shortName: shortAlias(devPreviewDisplayName(card)),
          localeHint: nation.flagCode,
          riskLevel: "SAFE",
          generationMethod: card.isLocalDebugOnly ? "rating_lab_local_debug_name" : "rating_lab_public_placeholder",
          isApproved: false,
          notes: card.isLocalDebugOnly
            ? "Development-only rating-lab alias using source/debug name."
            : "Public-safe placeholder alias generated from ingested source data.",
          metadata: {
            publicSafe: !card.isLocalDebugOnly,
            isLocalDebugOnly: Boolean(card.isLocalDebugOnly),
            publicDisplayName: card.publicDisplayName ?? card.publicPlaceholderName,
            debugRealName: card.debugRealName ?? null,
            previewReasons: selection.reasons
          }
        });

        cardRows.push({
          id: cardId,
          playerIdentityId: identityId,
          nationId: nation.id,
          worldCupEditionId: edition.id,
          aliasId,
          rating: card.overall,
          tier: card.tier,
          position: card.position,
          broadLine: broadLineForPosition(card.position),
          statProfile: stats.profile,
          role,
          editionKey: "NONE",
          cost: costForTier(card.tier),
          materialKey: materialForTier(card.tier)
        });

        if (stats.profile === "GOALKEEPER") {
          goalkeeperStatRows.push({
            cardId,
            diving: stats.diving,
            handling: stats.handling,
            kicking: stats.kicking,
            reflexes: stats.reflexes,
            speed: stats.speed,
            positioning: stats.positioning
          });
        } else {
          outfieldStatRows.push({
            cardId,
            pace: stats.pace,
            shooting: stats.shooting,
            passing: stats.passing,
            dribbling: stats.dribbling,
            defending: stats.defending,
            physical: stats.physical
          });
        }
      }

      if (sourcePlayerRows.length > 0) await tx.insert(sourcePlayers).values(sourcePlayerRows);
      if (identityRows.length > 0) await tx.insert(playerIdentities).values(identityRows);
      if (aliasRows.length > 0) await tx.insert(playerAliases).values(aliasRows);
      if (cardRows.length > 0) await tx.insert(playerCards).values(cardRows);
      if (outfieldStatRows.length > 0) await tx.insert(playerCardOutfieldStats).values(outfieldStatRows);
      if (goalkeeperStatRows.length > 0) await tx.insert(playerCardGoalkeeperStats).values(goalkeeperStatRows);

      return {
        sourceImportId,
        cardsWritten: selections.length,
        nationsAvailable: nationByCode.size,
        editionsAvailable: editionByYear.size,
        sourcePlayersWritten: selections.length,
        identitiesWritten: selections.length,
        aliasesWritten: selections.length,
        outfieldStatsWritten: outfieldStatRows.length,
        goalkeeperStatsWritten: goalkeeperStatRows.length
      };
    });
  } finally {
    await client.end();
  }
}

export async function resetRatingLabPreview(options: { connectionString?: string } = {}): Promise<void> {
  const { db, client } = createDbClient(options.connectionString);
  try {
    await db.transaction(async (tx) => {
      await resetRatingLabPreviewInTransaction(tx);
    });
  } finally {
    await client.end();
  }
}

async function resetRatingLabPreviewInTransaction(tx: Parameters<Parameters<ReturnType<typeof createDbClient>["db"]["transaction"]>[0]>[0]) {
  const previewImports = await tx
    .select({ id: sourceImports.id })
    .from(sourceImports)
    .where(eq(sourceImports.sourceName, PREVIEW_SOURCE_NAME));
  const importIds = previewImports.map((row) => row.id);

  const previewSourcePlayers =
    importIds.length > 0
      ? await tx.select({ id: sourcePlayers.id }).from(sourcePlayers).where(inArray(sourcePlayers.sourceImportId, importIds))
      : [];
  const sourcePlayerIds = previewSourcePlayers.map((row) => row.id);

  const previewIdentities = await tx
    .select({ id: playerIdentities.id })
    .from(playerIdentities)
    .where(like(playerIdentities.identityKey, `${PREVIEW_IDENTITY_PREFIX}%`));
  const identityIds = previewIdentities.map((row) => row.id);

  const previewCards =
    identityIds.length > 0
      ? await tx.select({ id: playerCards.id }).from(playerCards).where(inArray(playerCards.playerIdentityId, identityIds))
      : [];
  const cardIds = previewCards.map((row) => row.id);

  if (cardIds.length > 0) {
    await tx.delete(playerCardGoalkeeperStats).where(inArray(playerCardGoalkeeperStats.cardId, cardIds));
    await tx.delete(playerCardOutfieldStats).where(inArray(playerCardOutfieldStats.cardId, cardIds));
    await tx.delete(cardTags).where(inArray(cardTags.cardId, cardIds));
    await tx.delete(worldCupAwardWinners).where(inArray(worldCupAwardWinners.playerCardId, cardIds));
    await tx.delete(playerCards).where(inArray(playerCards.id, cardIds));
  }

  if (identityIds.length > 0) {
    await tx.delete(worldCupAwardWinners).where(inArray(worldCupAwardWinners.playerIdentityId, identityIds));
    await tx.delete(playerAliases).where(inArray(playerAliases.playerIdentityId, identityIds));
    await tx.delete(playerIdentities).where(inArray(playerIdentities.id, identityIds));
  }

  if (sourcePlayerIds.length > 0) {
    await tx.delete(worldCupAwardWinners).where(inArray(worldCupAwardWinners.sourcePlayerId, sourcePlayerIds));
    await tx.delete(sourcePlayers).where(inArray(sourcePlayers.id, sourcePlayerIds));
  }

  if (importIds.length > 0) await tx.delete(sourceImports).where(inArray(sourceImports.id, importIds));
}

async function ensurePreviewNations(
  tx: Parameters<Parameters<ReturnType<typeof createDbClient>["db"]["transaction"]>[0]>[0],
  cards: readonly RatingLabCardSnapshot[]
): Promise<Map<string, { id: string; flagCode: string }>> {
  const codes = [...new Set(cards.map((card) => card.nation))].sort();
  const flagCodes = codes.map((code) => previewFlagCode(code));
  const existing =
    flagCodes.length > 0
      ? await tx
          .select({ id: nations.id, fifaCode: nations.fifaCode, flagCode: nations.flagCode })
          .from(nations)
          .where(inArray(nations.flagCode, flagCodes))
      : [];
  const existingFlags = new Set(existing.map((nation) => nation.flagCode));

  for (const code of codes) {
    const flagCode = previewFlagCode(code);
    if (existingFlags.has(flagCode)) continue;
    await tx.insert(nations).values({
      id: deterministicUuid(`nation-${flagCode}`),
      iso2Code: null,
      iso3Code: code.length === 3 ? code : null,
      fifaCode: code,
      displayName: code,
      flagCode,
      flagAssetPath: `/flags/${flagCode}.svg`
    });
  }

  const rows =
    flagCodes.length > 0
      ? await tx
          .select({ id: nations.id, fifaCode: nations.fifaCode, flagCode: nations.flagCode })
          .from(nations)
          .where(inArray(nations.flagCode, flagCodes))
      : [];
  return new Map(rows.map((row) => [row.fifaCode ?? row.flagCode.toUpperCase(), { id: row.id, flagCode: row.flagCode }]));
}

async function ensurePreviewEditions(
  tx: Parameters<Parameters<ReturnType<typeof createDbClient>["db"]["transaction"]>[0]>[0],
  cards: readonly RatingLabCardSnapshot[]
): Promise<Map<number, { id: string }>> {
  const years = [...new Set(cards.map((card) => card.worldCupYear))].sort((left, right) => left - right);
  const existing =
    years.length > 0
      ? await tx.select({ id: worldCupEditions.id, year: worldCupEditions.year }).from(worldCupEditions).where(inArray(worldCupEditions.year, years))
      : [];
  const existingYears = new Set(existing.map((edition) => edition.year));

  for (const year of years) {
    if (existingYears.has(year)) continue;
    const representative = cards.find((card) => card.worldCupYear === year);
    await tx.insert(worldCupEditions).values({
      id: deterministicUuid(`edition-${year}`),
      year,
      hostName: hostNameForPreview(representative),
      hostCountryCode: representative?.hostCountryCode && representative.hostCountryCode !== "UNK" ? representative.hostCountryCode : null
    });
  }

  for (const year of years) {
    const representative = cards.find((card) => card.worldCupYear === year);
    if (!representative || representative.hostCountryLabel === "UNKNOWN HOST") continue;
    await tx
      .update(worldCupEditions)
      .set({
        hostName: hostNameForPreview(representative),
        hostCountryCode: representative.hostCountryCode && representative.hostCountryCode !== "UNK" ? representative.hostCountryCode : null
      })
      .where(eq(worldCupEditions.year, year));
  }

  const rows =
    years.length > 0
      ? await tx.select({ id: worldCupEditions.id, year: worldCupEditions.year }).from(worldCupEditions).where(inArray(worldCupEditions.year, years))
      : [];
  return new Map(rows.map((row) => [row.year, { id: row.id }]));
}

function defaultRoleForPosition(position: RatingLabCardSnapshot["position"]): CardRole {
  if (position === "GK") return "Shot Stopper";
  if (position === "CB") return "Anchor";
  if (position === "LB" || position === "RB") return "Wingback";
  if (position === "CDM") return "Ball Winner";
  if (position === "CM") return "Tempo Setter";
  if (position === "LM" || position === "RM" || position === "LW" || position === "RW") return "Wide Threat";
  if (position === "ST") return "Finisher";
  return "Creator";
}

function previewFlagCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "unk";
}

function shortAlias(publicPlaceholderName: string): string {
  const parts = publicPlaceholderName.split("-");
  return parts.length >= 4 ? parts.slice(0, 4).join("-") : publicPlaceholderName.slice(0, 24);
}

function devPreviewDisplayName(card: RatingLabCardSnapshot): string {
  return card.isLocalDebugOnly && card.debugRealName ? card.debugRealName : card.publicDisplayName ?? card.publicPlaceholderName;
}

function hostNameForPreview(card: RatingLabCardSnapshot | undefined): string {
  return card?.hostCountryLabel && card.hostCountryLabel !== "UNKNOWN HOST" ? card.hostCountryLabel : "Unknown Host";
}

function shortHash(value: string): string {
  return deterministicUuid(value).slice(0, 8);
}

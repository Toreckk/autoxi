import { eq } from "drizzle-orm";
import { createDbClient } from "./client.js";
import {
  nations,
  playerAliases,
  playerCardGoalkeeperStats,
  playerCardOutfieldStats,
  playerCards,
  playerIdentities,
  sourceImports,
  sourcePlayers,
  worldCupAwards,
  worldCupAwardWinners,
  worldCupEditionTeamResults,
  worldCupEditions
} from "./schema.js";
import {
  deterministicUuid,
  seedCards,
  seedEditions,
  seedImportId,
  seedNations,
  seedTeamResults,
  seedWorldCupAwards
} from "./seedData.js";

async function seed() {
  const { db, client } = createDbClient();
  const includeFictionalSeedCards = process.env.INCLUDE_FICTIONAL_SEED_CARDS === "true";

  try {
    await db.transaction(async (tx) => {
      await tx.delete(playerCardGoalkeeperStats);
      await tx.delete(playerCardOutfieldStats);
      await tx.delete(worldCupAwardWinners);
      await tx.delete(worldCupEditionTeamResults);
      await tx.delete(playerCards);
      await tx.delete(playerAliases);
      await tx.delete(playerIdentities);
      await tx.delete(sourcePlayers);
      await tx.delete(sourceImports);
      await tx.delete(worldCupAwards);
      await tx.delete(worldCupEditions);
      await tx.delete(nations);

      await tx.insert(nations).values(
        seedNations.map(([flagCode, iso2Code, iso3Code, displayName]) => ({
          id: deterministicUuid(`nation-${flagCode}`),
          iso2Code,
          iso3Code,
          fifaCode: iso3Code,
          displayName,
          flagCode,
          flagAssetPath: `/flags/${flagCode}.svg`
        }))
      );

      await tx.insert(worldCupEditions).values(
        seedEditions.map(([year, hostName, hostCountryCode]) => ({
          id: deterministicUuid(`edition-${year}`),
          year,
          hostName,
          hostCountryCode
        }))
      );

      await tx.insert(worldCupAwards).values(
        seedWorldCupAwards.map(([code, label, description]) => ({
          id: deterministicUuid(`world-cup-award-${code}`),
          code,
          label,
          description
        }))
      );

      for (const [year, flagCode, resultCode, finalRank] of seedTeamResults) {
        const [edition] = await tx.select().from(worldCupEditions).where(eq(worldCupEditions.year, year)).limit(1);
        const [resultNation] = await tx.select().from(nations).where(eq(nations.flagCode, flagCode)).limit(1);

        if (edition && resultNation) {
          await tx.insert(worldCupEditionTeamResults).values({
            id: deterministicUuid(`edition-result-${year}-${flagCode}-${resultCode}`),
            worldCupEditionId: edition.id,
            nationId: resultNation.id,
            finalRank,
            resultCode
          });
        } else {
          throw new Error(`Missing seed team result relation for ${year} ${flagCode} ${resultCode}`);
        }
      }

      if (includeFictionalSeedCards) {
        await tx.insert(sourceImports).values({
          id: seedImportId,
          sourceName: "curated_fictional_seed_v1",
          sourceVersion: "1",
          licenseNote: "Fictional development seed data only.",
          metadata: { publicSafeAliases: true }
        });
      }

      for (const card of includeFictionalSeedCards ? seedCards : []) {
        const [nation] = await tx.select().from(nations).where(eq(nations.flagCode, card.nation)).limit(1);
        const [edition] = await tx.select().from(worldCupEditions).where(eq(worldCupEditions.year, card.year)).limit(1);

        if (!nation || !edition) {
          throw new Error(`Missing seed relation for ${card.displayName}`);
        }

        const sourcePlayerId = deterministicUuid(`source-player-${card.identityKey}`);
        const identityId = deterministicUuid(`identity-${card.identityKey}`);
        const aliasId = deterministicUuid(`alias-${card.identityKey}`);
        const cardId = deterministicUuid(`card-${card.identityKey}`);

        await tx.insert(sourcePlayers).values({
          id: sourcePlayerId,
          sourceImportId: seedImportId,
          sourceProvider: "curated_fictional_seed_v1",
          sourceExternalId: `seed-${card.ordinal.toString().padStart(3, "0")}`,
          rawName: `Private Seed Player ${card.ordinal.toString().padStart(3, "0")}`,
          rawNationality: nation.displayName,
          rawPosition: card.position,
          rawPayloadJson: { note: "Fictional private seed row; never expose through public API." }
        });

        await tx.insert(playerIdentities).values({
          id: identityId,
          identityKey: card.identityKey,
          sourcePlayerId,
          nationalityId: nation.id,
          canonicalPosition: card.position,
          notes: "Curated fictional development identity."
        });

        await tx.insert(playerAliases).values({
          id: aliasId,
          playerIdentityId: identityId,
          displayName: card.displayName,
          shortName: card.shortName,
          localeHint: nation.flagCode,
          riskLevel: "SAFE",
          generationMethod: "manual_curated_seed",
          isApproved: true,
          reviewedBy: "curated_seed",
          reviewedAt: new Date(),
          notes: "Fictional public alias.",
          metadata: { publicSafe: true }
        });

        await tx.insert(playerCards).values({
          id: cardId,
          playerIdentityId: identityId,
          nationId: nation.id,
          worldCupEditionId: edition.id,
          aliasId,
          rating: card.rating,
          tier: card.tier,
          position: card.position,
          broadLine: card.broadLine,
          statProfile: card.statProfile,
          role: card.role,
          editionKey: card.editionKey,
          cost: card.cost,
          materialKey: card.materialKey
        });

        if (card.stats.profile === "GOALKEEPER") {
          await tx.insert(playerCardGoalkeeperStats).values({
            cardId,
            diving: card.stats.diving,
            handling: card.stats.handling,
            kicking: card.stats.kicking,
            reflexes: card.stats.reflexes,
            speed: card.stats.speed,
            positioning: card.stats.positioning
          });
        } else {
          await tx.insert(playerCardOutfieldStats).values({
            cardId,
            pace: card.stats.pace,
            shooting: card.stats.shooting,
            passing: card.stats.passing,
            dribbling: card.stats.dribbling,
            defending: card.stats.defending,
            physical: card.stats.physical
          });
        }

        if (card.editionKey !== "NONE") {
          const [award] = await tx.select().from(worldCupAwards).where(eq(worldCupAwards.code, card.editionKey)).limit(1);

          if (!award) {
            throw new Error(`Missing seed award ${card.editionKey}`);
          }

          await tx.insert(worldCupAwardWinners).values({
            id: deterministicUuid(`award-winner-${card.identityKey}-${card.editionKey}`),
            worldCupEditionId: edition.id,
            awardId: award.id,
            playerIdentityId: identityId,
            playerCardId: cardId,
            nationId: nation.id,
            sourcePlayerId,
            rawWinnerName: null,
            notes: "Fictional public-safe award winner for visual testing."
          });
        }
      }
    });

    console.info(
      includeFictionalSeedCards
        ? `[db:seed] inserted ${seedCards.length} fictional public cards`
        : "[db:seed] skipped fictional public cards; run rating-lab dev preview for collection data"
    );
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error("[db:seed] failed", error);
  process.exitCode = 1;
});

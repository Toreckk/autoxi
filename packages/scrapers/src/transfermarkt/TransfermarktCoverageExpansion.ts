import { join } from "node:path";
import { readCsv } from "../shared/CsvWriters.js";
import { buildCoverageSummary, type CoverageSummary } from "../shared/EnrichmentReports.js";
import { ScraperCache } from "../shared/ScraperCache.js";
import { matchTransfermarktCandidates, type TransfermarktMissingPlayer, type TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { loadLeagueExpansionPlan, roundById } from "./TransfermarktCompetitionConfig.js";
import { buildTransfermarktIdentityCandidateIndex, identityCandidateRowsToSquadPlayers } from "./TransfermarktIdentityCandidateIndex.js";
import { writeTransfermarktOverlays } from "./TransfermarktOverlayWriter.js";
import { resolveWorldCupTransfermarktSeasonPlan, transfermarktSeasonIdsForWorldCup } from "./WorldCupTransfermarktSeasonResolver.js";
import type { TransfermarktSquadProvider } from "./TransfermarktScraper.js";

export type TransfermarktEnrichmentOptions = {
  repoRoot: string;
  candidatesPath: string;
  sourceDir: string;
  outputDir: string;
  planPath?: string;
  roundId?: string;
  worldCupYear?: number;
  dryRun?: boolean;
  forceRefresh?: boolean;
  squadProvider?: TransfermarktSquadProvider;
  maxLeagues?: number;
};

export type TransfermarktEnrichmentResult = {
  roundId: string;
  roundDescription: string;
  leaguesScanned: string[];
  yearsScanned: number[];
  transfermarktSeasonsScanned: number[];
  cacheHits: number;
  cacheMisses: number;
  missingPlayerCount: number;
  playersApproved: number;
  playersNeedsReview: number;
  playersFound: number;
  coverageSummary: CoverageSummary;
  dryRun: boolean;
};

export async function runTransfermarktCoverageExpansion(options: TransfermarktEnrichmentOptions): Promise<TransfermarktEnrichmentResult> {
  const plan = await loadLeagueExpansionPlan(options.planPath);
  const round = roundById(plan, options.roundId ?? "round-1-core");
  const missingPlayers = (await loadMissingPlayers(options.candidatesPath)).filter(
    (player) => !options.worldCupYear || player.worldCupYear === options.worldCupYear
  );
  const years = [...new Set(missingPlayers.map((player) => player.worldCupYear))].sort((left, right) => left - right);
  const transfermarktSeasons = [...new Set(years.flatMap((year) => transfermarktSeasonIdsForWorldCup(year)))].sort((left, right) => left - right);
  const cache = new ScraperCache(join(options.outputDir, "transfermarkt-overlay", "cache"));
  const leagues = options.maxLeagues ? round.leagues.slice(0, options.maxLeagues) : round.leagues;
  const squadProvider = options.squadProvider;
  let cacheHits = 0;
  let cacheMisses = 0;
  const squadRows: TransfermarktSquadPlayer[] = [];

  for (const worldCupYear of years) {
    const seasonPlan = resolveWorldCupTransfermarktSeasonPlan(worldCupYear);
    const seasons = [seasonPlan.primarySeasonId, ...seasonPlan.secondarySeasonIds];
    for (const season of seasons) {
    for (const leagueId of leagues) {
      const cacheKey = { leagueId, season, worldCupYear };
      if ((await cache.hasSquadCache(cacheKey)) && !options.forceRefresh) {
        cacheHits += 1;
        squadRows.push(...(await cache.readSquadCache(cacheKey)).map((row) => squadPlayerFromCache(row, leagueId, season, worldCupYear)));
      } else {
        cacheMisses += 1;
        if (!options.dryRun) {
          if (!squadProvider) {
            throw new Error("Transfermarkt USER_AGENT is required for live enrichment cache misses.");
          }
          const fetched = await squadProvider.listSquadPlayers(leagueId, season);
          await cache.writeSquadCache(cacheKey, SQUAD_CACHE_HEADERS, fetched.map(squadPlayerToCacheRow));
          squadRows.push(...fetched.map((row) => ({ ...row, worldCupYear })));
        }
      }
    }
    }
  }

  const identityIndexRows = await buildTransfermarktIdentityCandidateIndex({
    sourceDir: options.sourceDir,
    outputDir: options.outputDir,
    squadRows
  });
  const matches = matchTransfermarktCandidates(missingPlayers, identityCandidateRowsToSquadPlayers(identityIndexRows));
  const approved = matches.filter((match) => match.status === "auto_approved");
  const needsReview = matches.filter((match) => match.status === "needs_review");

  if (!options.dryRun) {
    await writeTransfermarktOverlays({
      playersOverlayPath: join(options.outputDir, "transfermarkt-overlay", "players_overlay.csv"),
      squadPresenceOverlayPath: join(options.outputDir, "transfermarkt-overlay", "squad_presence_overlay.csv"),
      providerLinksPath: join(options.outputDir, "identity", "provider_player_links.csv"),
      needsReviewPath: join(options.outputDir, "enrichment", "enrichment_needs_review.csv"),
      roundId: round.id,
      matches
    });
  }

  return {
    roundId: round.id,
    roundDescription: round.description,
    leaguesScanned: leagues,
    yearsScanned: years,
    transfermarktSeasonsScanned: transfermarktSeasons,
    cacheHits,
    cacheMisses,
    missingPlayerCount: missingPlayers.length,
    playersApproved: approved.length,
    playersNeedsReview: needsReview.length,
    playersFound: matches.length,
    coverageSummary: buildCoverageSummary(missingPlayers.length, approved.length, {
      newProviderLinksApproved: approved.length,
      newOverlayPlayersWritten: approved.length,
      needsReviewCount: needsReview.length,
      failureCount: 0
    }),
    dryRun: options.dryRun ?? false
  };
}

const SQUAD_CACHE_HEADERS = ["player_id", "name", "country_of_citizenship", "birth_year", "date_of_birth", "position", "current_club_name", "season", "league"];

function squadPlayerToCacheRow(player: TransfermarktSquadPlayer): Record<string, string | number | undefined> {
  return {
    player_id: player.playerId,
    name: player.name,
    country_of_citizenship: player.nationalities.join("|"),
    birth_year: player.birthYear,
    date_of_birth: player.dateOfBirth,
    position: player.position,
    current_club_name: player.clubName,
    season: player.season,
    league: player.leagueId
  };
}

export async function loadMissingPlayers(path: string): Promise<TransfermarktMissingPlayer[]> {
  const rows = await readCsv(path);
  return rows
    .filter((row) => row.candidateCategory?.startsWith("TRANSFERMARKT") || row.needsTransfermarktProfile === "true" || row.needsTransfermarktValuations === "true")
    .map((row) => ({
      requestKey: row.transfermarktPlayerId ? `transfermarkt:${row.transfermarktPlayerId}` : `transfermarkt:search:${row.ratingSubjectId}`,
      ratingSubjectId: row.ratingSubjectId ?? "",
      canonicalPlayerId: row.transfermarktPlayerId ? `tm:${row.transfermarktPlayerId}` : row.fjelstulPlayerId ?? "",
      name: row.debugRealName || row.sourceName || "",
      aliases: [],
      nation: row.nationCode ?? "",
      worldCupYear: Number(row.worldCupYear),
      position: row.position ?? "",
      birthYear: row.birthYear ? Number(row.birthYear) : null,
      transfermarktId: row.transfermarktPlayerId || null,
      localIdEvidence: Boolean(row.localTransfermarktIdEvidence)
    }));
}

function squadPlayerFromCache(row: Record<string, string>, leagueId: string, season: number, worldCupYear?: number): TransfermarktSquadPlayer {
  return {
    playerId: row.player_id || row.tm_id || row.id || "",
    name: row.name || row.player_name || row.tm_name || "",
    nationalities: (row.country_of_citizenship || row.country || row.nation || "").split("|").filter(Boolean),
    dateOfBirth: row.date_of_birth || row.dob,
    birthYear: row.birth_year ? Number(row.birth_year) : undefined,
    position: row.position,
    clubName: row.current_club_name || row.squad || row.club,
    leagueId: row.league || leagueId,
    season: row.season ? Number(row.season) : season,
    worldCupYear
  };
}

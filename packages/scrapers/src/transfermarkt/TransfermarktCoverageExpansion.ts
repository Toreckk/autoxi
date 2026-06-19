import { join } from "node:path";
import { readCsv } from "../shared/CsvWriters.js";
import { buildCoverageSummary, type CoverageSummary } from "../shared/EnrichmentReports.js";
import { ScraperCache } from "../shared/ScraperCache.js";
import { matchTransfermarktCandidates, type TransfermarktMissingPlayer, type TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { loadLeagueExpansionPlan, roundById } from "./TransfermarktCompetitionConfig.js";
import { buildTransfermarktIdentityCandidateIndex, identityCandidateRowsToSquadPlayers } from "./TransfermarktIdentityCandidateIndex.js";
import { writeTransfermarktOverlays } from "./TransfermarktOverlayWriter.js";
import { resolveWorldCupTransfermarktCompetitionSeasonPlan } from "./WorldCupTransfermarktSeasonResolver.js";
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
  seasonPlans: TransfermarktSeasonPlanReportRow[];
  identityMatches: TransfermarktIdentityMatchReportRow[];
};

export type TransfermarktSeasonPlanReportRow = {
  worldCupYear: number;
  competitionId: string;
  seasonModel: string;
  primarySeasonId: number;
  secondarySeasonIds: number[];
  allSeasonIds: number[];
  transfermarktSeasonId: number;
  reason: string;
  warnings: string[];
  cacheFile: string;
  cacheHit: boolean;
};

export type TransfermarktIdentityMatchReportRow = {
  requestKey: string;
  ratingSubjectId: string;
  playerName: string;
  nation: string;
  worldCupYear: number;
  position: string;
  transfermarktPlayerId: string;
  candidateName: string;
  competitionId: string;
  transfermarktSeasonId: number;
  score: number;
  status: string;
  evidenceFamiliesPresent: string;
  evidenceFamiliesMissing: string;
  autoApprovalReason: string;
  needsReviewReason: string;
  rejectedReason: string;
  matchReasons: string;
  hardContradictions: string;
};

export async function runTransfermarktCoverageExpansion(options: TransfermarktEnrichmentOptions): Promise<TransfermarktEnrichmentResult> {
  const plan = await loadLeagueExpansionPlan(options.planPath);
  const round = roundById(plan, options.roundId ?? "round-1-core");
  const missingPlayers = (await loadMissingPlayers(options.candidatesPath)).filter(
    (player) => !options.worldCupYear || player.worldCupYear === options.worldCupYear
  );
  const years = [...new Set(missingPlayers.map((player) => player.worldCupYear))].sort((left, right) => left - right);
  const cache = new ScraperCache(join(options.outputDir, "transfermarkt-overlay", "cache"));
  const leagues = options.maxLeagues ? round.leagues.slice(0, options.maxLeagues) : round.leagues;
  const transfermarktSeasons = [
    ...new Set(
      years.flatMap((year) =>
        leagues.flatMap((leagueId) =>
          resolveWorldCupTransfermarktCompetitionSeasonPlan(year, leagueId, plan.transfermarktSeasonConfig).allSeasonIds
        )
      )
    )
  ].sort((left, right) => left - right);
  const squadProvider = options.squadProvider;
  let cacheHits = 0;
  let cacheMisses = 0;
  const squadRows: TransfermarktSquadPlayer[] = [];
  const seasonPlans: TransfermarktSeasonPlanReportRow[] = [];

  for (const worldCupYear of years) {
    for (const leagueId of leagues) {
      const seasonPlan = resolveWorldCupTransfermarktCompetitionSeasonPlan(worldCupYear, leagueId, plan.transfermarktSeasonConfig);
      for (const season of seasonPlan.allSeasonIds) {
      const cacheKey = { leagueId, season, worldCupYear };
      const cacheHit = (await cache.hasSquadCache(cacheKey)) && !options.forceRefresh;
      seasonPlans.push({
        worldCupYear,
        competitionId: leagueId,
        seasonModel: seasonPlan.seasonModel,
        primarySeasonId: seasonPlan.primarySeasonId,
        secondarySeasonIds: seasonPlan.secondarySeasonIds,
        allSeasonIds: seasonPlan.allSeasonIds,
        transfermarktSeasonId: season,
        reason: seasonPlan.reason,
        warnings: seasonPlan.warnings,
        cacheFile: cache.squadCachePath(cacheKey),
        cacheHit
      });
      if (cacheHit) {
        cacheHits += 1;
        squadRows.push(...(await cache.readSquadCache(cacheKey)).map((row) => squadPlayerFromCache(row, leagueId, season, worldCupYear)));
      } else {
        cacheMisses += 1;
        if (!options.dryRun) {
          if (!squadProvider) continue;
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
  const matches = matchTransfermarktCandidates(missingPlayers, identityCandidateRowsToSquadPlayers(identityIndexRows), {
    seasonConfig: plan.transfermarktSeasonConfig
  });
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
    dryRun: options.dryRun ?? false,
    seasonPlans,
    identityMatches: matches.map((match) => ({
      requestKey: match.request.requestKey,
      ratingSubjectId: match.request.ratingSubjectId,
      playerName: match.request.name,
      nation: match.request.nation,
      worldCupYear: match.request.worldCupYear,
      position: match.request.position,
      transfermarktPlayerId: match.candidate.playerId,
      candidateName: match.candidate.name,
      competitionId: match.candidate.leagueId,
      transfermarktSeasonId: match.candidate.season,
      score: match.score,
      status: match.status,
      evidenceFamiliesPresent: match.evidenceFamiliesPresent.join("|"),
      evidenceFamiliesMissing: match.evidenceFamiliesMissing.join("|"),
      autoApprovalReason: match.autoApprovedReason,
      needsReviewReason: match.needsReviewReason,
      rejectedReason: match.rejectedReason,
      matchReasons: match.reasons.join("|"),
      hardContradictions: match.hardContradictions.join("|")
    }))
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

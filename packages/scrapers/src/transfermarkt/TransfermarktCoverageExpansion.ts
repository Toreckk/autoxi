import { join } from "node:path";
import { readCsv } from "../shared/CsvWriters.js";
import { buildCoverageSummary, type CoverageSummary } from "../shared/EnrichmentReports.js";
import { ScraperCache } from "../shared/ScraperCache.js";
import { matchTransfermarktCandidates, type TransfermarktMissingPlayer, type TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { loadLeagueExpansionPlan, roundById } from "./TransfermarktCompetitionConfig.js";
import type { TransfermarktCompetitionSeasonConfig } from "./TransfermarktCompetitionSeasonModel.js";
import { buildTransfermarktIdentityCandidateIndex, identityCandidateRowsToSquadPlayers } from "./TransfermarktIdentityCandidateIndex.js";
import { writeTransfermarktOverlays } from "./TransfermarktOverlayWriter.js";
import { resolveWorldCupTransfermarktCompetitionSeasonPlan } from "./WorldCupTransfermarktSeasonResolver.js";
import {
  loadTransfermarktProfileIdentityOverlay,
  profileIdentityIsSuccessful,
  writeTransfermarktProfileIdentityOverlay,
  type TransfermarktProfileIdentityRow
} from "./TransfermarktProfileIdentity.js";
import type { TransfermarktProfileIdentityProvider, TransfermarktSquadProvider } from "./TransfermarktScraper.js";

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
  forceProfileRefresh?: boolean;
  squadProvider?: TransfermarktSquadProvider;
  profileProvider?: TransfermarktProfileIdentityProvider;
  profileEnrich?: boolean;
  maxProfileAttempts?: number;
  profileOnly?: boolean;
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
  profileRepairEnabled: boolean;
  profileRepairWorklist: TransfermarktProfileRepairWorklistRow[];
  profileRepairBlockingError: string;
  profileIdentityCacheCount: number;
  profileIdentitySuccessCount: number;
  profileIdentityFailureCount: number;
  profileIdentityAttempts: TransfermarktProfileIdentityAttemptRow[];
  squadCacheFieldQuality: TransfermarktSquadCacheFieldQualityRow[];
};

export type TransfermarktProfileRepairWorklistRow = {
  ratingSubjectId: string;
  debugRealName: string;
  nation: string;
  worldCupYear: number;
  position: string;
  tier: string;
  bestCandidateTransfermarktId: string;
  bestCandidateName: string;
  bestCandidateScore: number;
  missingFields: string;
  repairReason: string;
  profileRepairRequired: boolean;
  profileRepairCandidateIds: string;
  skipReason: string;
};

export type TransfermarktProfileIdentityAttemptRow = {
  transfermarktPlayerId: string;
  candidateName: string;
  missingFields: string;
  attempted: boolean;
  status: string;
  cacheStatus: string;
  reason: string;
};

export type TransfermarktSquadCacheFieldQualityRow = {
  worldCupYear: string;
  transfermarktSeasonId: string;
  competitionId: string;
  cacheFile: string;
  rowCount: number;
  playerIdPresentPercent: number;
  namePresentPercent: number;
  birthYearPresentPercent: number;
  dateOfBirthPresentPercent: number;
  nationalityPresentPercent: number;
  positionPresentPercent: number;
  clubPresentPercent: number;
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
  const profileProvider = options.profileProvider;
  let cacheHits = 0;
  let cacheMisses = 0;
  const squadRows: TransfermarktSquadPlayer[] = [];
  const seasonPlans: TransfermarktSeasonPlanReportRow[] = [];
  const squadCacheFieldQuality: TransfermarktSquadCacheFieldQualityRow[] = [];

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
        const cacheRows = await cache.readSquadCache(cacheKey);
        squadCacheFieldQuality.push(squadCacheQualityRow(cache.squadCachePath(cacheKey), cacheRows, leagueId, season, worldCupYear));
        squadRows.push(...cacheRows.map((row) => squadPlayerFromCache(row, leagueId, season, worldCupYear)));
      } else {
        cacheMisses += 1;
        if (!options.dryRun) {
          if (!squadProvider) continue;
          const fetched = await squadProvider.listSquadPlayers(leagueId, season);
          await cache.writeSquadCache(cacheKey, SQUAD_CACHE_HEADERS, fetched.map(squadPlayerToCacheRow));
          squadCacheFieldQuality.push(squadCacheQualityRow(cache.squadCachePath(cacheKey), fetched.map(squadPlayerToCacheRow), leagueId, season, worldCupYear));
          squadRows.push(...fetched.map((row) => ({ ...row, worldCupYear })));
        }
      }
      }
    }
  }

  const existingProfileRows = await loadTransfermarktProfileIdentityOverlay(options.outputDir);
  const profileRepairWorklist = buildProfileRepairWorklist({
    missingPlayers,
    squadRows,
    seasonConfig: plan.transfermarktSeasonConfig,
    existingProfileRows
  });
  const profileRepairTargetIds = new Set(profileRepairWorklist.map((row) => row.bestCandidateTransfermarktId));
  const profileIdentity = await enrichProfileIdentityOverlay({
    outputDir: options.outputDir,
    squadRows,
    targetPlayerIds: profileRepairTargetIds,
    profileProvider,
    enabled: Boolean(options.profileEnrich),
    forceRefresh: Boolean(options.forceProfileRefresh ?? options.forceRefresh),
    maxAttempts: options.maxProfileAttempts
  });
  const profileAttemptLikeCount = profileIdentity.attempts.filter((attempt) => attempt.attempted || attempt.status.startsWith("cache_hit")).length;
  const profileRepairBlockingError =
    options.profileEnrich && profileRepairWorklist.length > 0 && profileAttemptLikeCount === 0
      ? "profile_enrich_requested_but_no_attempts"
      : "";
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

  if (!options.dryRun && !options.profileOnly) {
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
    })),
    profileRepairEnabled: Boolean(options.profileEnrich),
    profileRepairWorklist,
    profileRepairBlockingError,
    profileIdentityCacheCount: profileIdentity.rows.length,
    profileIdentitySuccessCount: profileIdentity.rows.filter(profileIdentityIsSuccessful).length,
    profileIdentityFailureCount: profileIdentity.rows.filter((row) => row.cache_status.startsWith("failed")).length,
    profileIdentityAttempts: profileIdentity.attempts,
    squadCacheFieldQuality
  };
}

const SQUAD_CACHE_HEADERS = ["player_id", "name", "country_of_citizenship", "birth_year", "date_of_birth", "position", "current_club_name", "profile_url", "profile_slug", "season", "league"];

function squadPlayerToCacheRow(player: TransfermarktSquadPlayer): Record<string, string | number | undefined> {
  return {
    player_id: player.playerId,
    name: player.name,
    country_of_citizenship: player.nationalities.join("|"),
    birth_year: player.birthYear,
    date_of_birth: player.dateOfBirth,
    position: player.position,
    current_club_name: player.clubName,
    profile_url: player.profileUrl,
    profile_slug: player.profileSlug,
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
      aliases: splitList(row.aliases ?? ""),
      nation: row.nationCode ?? "",
      worldCupYear: Number(row.worldCupYear),
      position: row.position ?? "",
      tier: row.tier ?? "",
      overall: row.overall ? Number(row.overall) : undefined,
      priority: row.priority ? Number(row.priority) : undefined,
      birthYear: row.birthYear ? Number(row.birthYear) : null,
      dateOfBirth: row.dateOfBirth || row.date_of_birth || null,
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
    profileUrl: row.profile_url,
    profileSlug: row.profile_slug,
    leagueId: row.league || leagueId,
    season: row.season ? Number(row.season) : season,
    worldCupYear
  };
}

async function enrichProfileIdentityOverlay({
  outputDir,
  squadRows,
  targetPlayerIds,
  profileProvider,
  enabled,
  forceRefresh,
  maxAttempts
}: {
  outputDir: string;
  squadRows: readonly TransfermarktSquadPlayer[];
  targetPlayerIds: ReadonlySet<string>;
  profileProvider?: TransfermarktProfileIdentityProvider;
  enabled: boolean;
  forceRefresh: boolean;
  maxAttempts?: number;
}): Promise<{ rows: TransfermarktProfileIdentityRow[]; attempts: TransfermarktProfileIdentityAttemptRow[] }> {
  const existing = await loadTransfermarktProfileIdentityOverlay(outputDir);
  const rowsById = new Map(existing.map((row) => [row.transfermarkt_player_id, row]));
  const incompleteProfiles = incompleteProfileCandidates(squadRows, targetPlayerIds);
  const attempts: TransfermarktProfileIdentityAttemptRow[] = [];
  let changed = false;
  let fetchAttempts = 0;
  for (const profile of incompleteProfiles) {
    const playerId = profile.transfermarktPlayerId;
    const cached = rowsById.get(playerId);
    if (cached && !forceRefresh) {
      attempts.push({
        ...profile,
        attempted: false,
        status: profileIdentityIsSuccessful(cached) ? "cache_hit_success" : "cache_hit_incomplete_or_failed",
        cacheStatus: cached.cache_status,
        reason: "profile_identity_cache_already_present"
      });
      continue;
    }
    if (!enabled) {
      attempts.push({
        ...profile,
        attempted: false,
        status: "skipped_profile_enrich_disabled",
        cacheStatus: cached?.cache_status ?? "",
        reason: "run_with_profile_enrich_to_fetch_missing_identity_fields"
      });
      continue;
    }
    if (!profileProvider) {
      attempts.push({
        ...profile,
        attempted: false,
        status: "skipped_profile_provider_missing",
        cacheStatus: cached?.cache_status ?? "",
        reason: "configure_transfermarkt_user_agent_and_run_non_dry_profile_enrich"
      });
      continue;
    }
    if (maxAttempts !== undefined && fetchAttempts >= maxAttempts) {
      attempts.push({
        ...profile,
        attempted: false,
        status: "skipped_max_profile_attempts_reached",
        cacheStatus: cached?.cache_status ?? "",
        reason: `max_profile_attempts:${maxAttempts}`
      });
      continue;
    }
    try {
      fetchAttempts += 1;
      const representative = squadRows.find((row) => row.playerId === playerId);
      const row = await profileProvider.getProfileIdentity(playerId, representative?.profileSlug);
      rowsById.set(playerId, row);
      changed = true;
      attempts.push({
        ...profile,
        attempted: true,
        status: profileIdentityIsSuccessful(row) ? "fetched_success" : "fetched_incomplete",
        cacheStatus: row.cache_status,
        reason: profileIdentityIsSuccessful(row) ? "profile_identity_repair_available" : "profile_identity_fetched_but_missing_required_fields"
      });
    } catch (error: unknown) {
      const failedRow = {
        transfermarkt_player_id: playerId,
        canonical_name: profile.candidateName,
        profile_slug: "",
        profile_url: "",
        date_of_birth: "",
        birth_year: "",
        country_of_birth: "",
        citizenships: "",
        nationalities: "",
        main_position: "",
        alternate_positions: "",
        foot: "",
        height_cm: "",
        current_club: "",
        source: "transfermarkt_profile",
        extracted_at: new Date().toISOString(),
        cache_status: `failed:${error instanceof Error ? error.message : "unknown_error"}`,
        failure_reason: error instanceof Error ? error.message : "unknown_error"
      };
      rowsById.set(playerId, failedRow);
      changed = true;
      attempts.push({
        ...profile,
        attempted: true,
        status: "fetched_failed",
        cacheStatus: failedRow.cache_status,
        reason: failedRow.cache_status
      });
    }
  }
  const rows = [...rowsById.values()].sort((left, right) => left.transfermarkt_player_id.localeCompare(right.transfermarkt_player_id));
  if (changed) await writeTransfermarktProfileIdentityOverlay(outputDir, rows);
  return { rows, attempts };
}

function buildProfileRepairWorklist({
  missingPlayers,
  squadRows,
  seasonConfig,
  existingProfileRows
}: {
  missingPlayers: readonly TransfermarktMissingPlayer[];
  squadRows: readonly TransfermarktSquadPlayer[];
  seasonConfig?: TransfermarktCompetitionSeasonConfig;
  existingProfileRows: readonly TransfermarktProfileIdentityRow[];
}): TransfermarktProfileRepairWorklistRow[] {
  const existingProfilesById = new Map(existingProfileRows.map((row) => [row.transfermarkt_player_id, row]));
  const initialMatches = matchTransfermarktCandidates(missingPlayers, squadRows, { seasonConfig });
  const bySubject = new Map<string, ReturnType<typeof matchTransfermarktCandidates>>();
  for (const match of initialMatches) bySubject.set(match.request.ratingSubjectId, [...(bySubject.get(match.request.ratingSubjectId) ?? []), match]);
  return missingPlayers.flatMap((player) => {
    const best = [...(bySubject.get(player.ratingSubjectId) ?? [])].sort((left, right) => right.score - left.score)[0];
    if (!best?.candidate.playerId) return [];
    const existingProfile = existingProfilesById.get(best.candidate.playerId);
    const missingFields = missingProfileRepairFields(best.candidate, existingProfile);
    if (missingFields.length === 0) return [];
    return [{
      ratingSubjectId: player.ratingSubjectId,
      debugRealName: player.name,
      nation: player.nation,
      worldCupYear: player.worldCupYear,
      position: player.position,
      tier: player.tier ?? "",
      bestCandidateTransfermarktId: best.candidate.playerId,
      bestCandidateName: best.candidate.name,
      bestCandidateScore: best.score,
      missingFields: missingFields.join("|"),
      repairReason: repairReasonFor(missingFields),
      profileRepairRequired: true,
      profileRepairCandidateIds: best.candidate.playerId,
      skipReason: ""
    }];
  });
}

function missingProfileRepairFields(
  candidate: TransfermarktSquadPlayer,
  existingProfile: TransfermarktProfileIdentityRow | undefined
): string[] {
  const profileSuccessful = profileIdentityIsSuccessful(existingProfile);
  return [
    candidate.nationalities.length === 0 && !(profileSuccessful && (existingProfile?.nationalities || existingProfile?.citizenships)) ? "nationality" : "",
    !candidate.dateOfBirth && !candidate.birthYear && !(profileSuccessful && (existingProfile?.date_of_birth || existingProfile?.birth_year)) ? "date_of_birth" : "",
    !candidate.position && !(profileSuccessful && existingProfile?.main_position) ? "main_position" : "",
    !profileSuccessful || !existingProfile?.profile_url ? "profile_url" : ""
  ].filter(Boolean);
}

function repairReasonFor(missingFields: readonly string[]): string {
  if (missingFields.includes("nationality")) return "missing_nationality_profile_enrichment_required";
  if (missingFields.includes("date_of_birth")) return "missing_birth_profile_enrichment_required";
  if (missingFields.includes("main_position")) return "missing_position_profile_enrichment_required";
  return "missing_profile_identity_cache";
}

function incompleteProfileCandidates(
  rows: readonly TransfermarktSquadPlayer[],
  targetPlayerIds: ReadonlySet<string>
): TransfermarktProfileIdentityAttemptRow[] {
  const byPlayerId = new Map<string, TransfermarktSquadPlayer[]>();
  for (const row of rows) {
    if (!row.playerId) continue;
    if (!targetPlayerIds.has(row.playerId)) continue;
    byPlayerId.set(row.playerId, [...(byPlayerId.get(row.playerId) ?? []), row]);
  }
  return [...byPlayerId.entries()].flatMap(([playerId, playerRows]) => {
    const missing = [
      playerRows.every((row) => row.nationalities.length === 0) ? "nationality" : "",
      playerRows.every((row) => !row.dateOfBirth && !row.birthYear) ? "date_of_birth" : "",
      playerRows.every((row) => !row.position) ? "main_position" : "",
      "profile_url"
    ].filter(Boolean);
    if (missing.length === 0) return [];
    return [{
      transfermarktPlayerId: playerId,
      candidateName: playerRows.find((row) => row.name)?.name ?? "",
      missingFields: missing.join("|"),
      attempted: false,
      status: "",
      cacheStatus: "",
      reason: ""
    }];
  });
}

function squadCacheQualityRow(
  cacheFile: string,
  rows: readonly Record<string, string | number | undefined>[],
  competitionId: string,
  season: number,
  worldCupYear: number
): TransfermarktSquadCacheFieldQualityRow {
  const total = Math.max(rows.length, 1);
  return {
    worldCupYear: String(worldCupYear),
    transfermarktSeasonId: String(season),
    competitionId,
    cacheFile,
    rowCount: rows.length,
    playerIdPresentPercent: presentPercent(rows, total, ["player_id", "tm_id", "id"]),
    namePresentPercent: presentPercent(rows, total, ["name", "player_name", "tm_name"]),
    birthYearPresentPercent: presentPercent(rows, total, ["birth_year"]),
    dateOfBirthPresentPercent: presentPercent(rows, total, ["date_of_birth", "dob"]),
    nationalityPresentPercent: presentPercent(rows, total, ["country_of_citizenship", "country", "nation"]),
    positionPresentPercent: presentPercent(rows, total, ["position"]),
    clubPresentPercent: presentPercent(rows, total, ["current_club_name", "club", "squad"])
  };
}

function presentPercent(rows: readonly Record<string, string | number | undefined>[], total: number, keys: readonly string[]): number {
  const count = rows.filter((row) => keys.some((key) => row[key] !== undefined && row[key] !== "")).length;
  return Number(((count / total) * 100).toFixed(1));
}

function splitList(value: string): string[] {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readCsv, runTransfermarktCoverageExpansion, TransfermarktWebScraper, writeCsv } from "@autoxi/scrapers";
import { isCliEntrypoint } from "./cliEntrypoint.js";

export async function runTransfermarktEnrich(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const outputDir = resolve(cwd, "data/sources");
  const reportDir = resolve(cwd, "data/import-reports/rating-lab");
  const candidatesArg = typeof args.candidates === "string" ? args.candidates : undefined;
  const candidatesPath = resolve(cwd, candidatesArg ?? (await latestCandidatesPath(reportDir)));
  const userAgent = process.env.TRANSFERMARKT_USER_AGENT ?? process.env.USER_AGENT ?? "";
  const transfermarktWebScraper = userAgent
    ? new TransfermarktWebScraper({
        userAgent,
        rateLimitMs: Number(process.env.TRANSFERMARKT_RATE_LIMIT_MS ?? 2500)
      })
    : undefined;
  const result = await runTransfermarktCoverageExpansion({
    repoRoot: cwd,
    candidatesPath,
    sourceDir: resolve(cwd, "data/sources/transfermarkt"),
    outputDir,
    planPath: resolve(cwd, "data/sources/enrichment/league-expansion-plan.json"),
    roundId: typeof args.round === "string" ? args.round : "round-1-core",
    worldCupYear: typeof args.worldCupYear === "string" ? Number(args.worldCupYear) : undefined,
    dryRun: args.dryRun === true,
    forceRefresh: args.forceRefresh === true,
    forceProfileRefresh: args.forceProfileRefresh === true,
    maxLeagues: typeof args.maxLeagues === "string" ? Number(args.maxLeagues) : undefined,
    maxProfileAttempts: typeof args.maxProfileAttempts === "string" ? Number(args.maxProfileAttempts) : undefined,
    profileEnrich: args.profileEnrich === true,
    profileOnly: args.profileOnly === true,
    squadProvider: args.dryRun === true ? undefined : transfermarktWebScraper,
    profileProvider: args.dryRun === true ? undefined : transfermarktWebScraper
  });
  await mkdir(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const reportPath = join(reportDir, `rating-lab-transfermarkt-coverage-summary-${timestamp}.json`);
  await writeFile(reportPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  const csvReports = await writeTransfermarktEnrichmentReports({
    reportDir,
    timestamp,
    candidatesPath,
    result
  });
  if (result.profileRepairBlockingError) {
    throw new Error(`${result.profileRepairBlockingError}. See ${csvReports.map((path) => path.split(/[\\/]/u).at(-1)).join(", ")}.`);
  }
  return [
    args.dryRun ? "Transfermarkt enrichment dry run completed." : "Transfermarkt enrichment completed.",
    `Round: ${result.roundId} (${result.roundDescription})`,
    `Candidates: ${result.missingPlayerCount}`,
    `Years: ${result.yearsScanned.join(", ") || "none"}`,
    `Transfermarkt seasons: ${result.transfermarktSeasonsScanned.join(", ") || "none"}`,
    `Leagues: ${result.leaguesScanned.join(", ")}`,
    `Cache: ${result.cacheHits} hits, ${result.cacheMisses} misses`,
    "Profile repair:",
    `  enabled: ${result.profileRepairEnabled}`,
    `  worklist candidates: ${result.profileRepairWorklist.length}`,
    `  max attempts: ${typeof args.maxProfileAttempts === "string" ? args.maxProfileAttempts : "unlimited"}`,
    `  attempts: ${result.profileIdentityAttempts.filter((row) => row.attempted || row.status.startsWith("cache_hit")).length}`,
    `  successes: ${result.profileIdentityAttempts.filter((row) => row.status === "fetched_success" || row.status === "cache_hit_success").length}`,
    `  failures: ${result.profileIdentityAttempts.filter((row) => row.status === "fetched_failed").length}`,
    `  skipped: ${result.profileIdentityAttempts.filter((row) => !row.attempted && !row.status.startsWith("cache_hit")).length}`,
    result.profileRepairEnabled
      ? (transfermarktWebScraper ? "  provider: configured" : "  provider: missing Transfermarkt USER_AGENT")
      : "  Profile repair disabled. Run with --profile-enrich to repair missing nationality/date-of-birth/profile fields.",
    `Profile identity cache: ${result.profileIdentitySuccessCount} success, ${result.profileIdentityFailureCount} failure, ${result.profileIdentityCacheCount} total`,
    `Matches: ${result.playersApproved} approved, ${result.playersNeedsReview} need review`,
    `Report: ${reportPath}`,
    `CSV reports: ${csvReports.map((path) => path.split(/[\\/]/u).at(-1)).join(", ")}`
  ].join("\n");
}

type TransfermarktEnrichmentCliResult = Awaited<ReturnType<typeof runTransfermarktCoverageExpansion>>;

async function writeTransfermarktEnrichmentReports({
  reportDir,
  timestamp,
  candidatesPath,
  result
}: {
  reportDir: string;
  timestamp: string;
  candidatesPath: string;
  result: TransfermarktEnrichmentCliResult;
}): Promise<string[]> {
  const candidateRows = (await readCsv(candidatesPath)).filter(
    (row) => row.candidateCategory?.startsWith("TRANSFERMARKT") || row.needsTransfermarktProfile === "true" || row.needsTransfermarktValuations === "true"
  );
  const byYear = summarizeCandidatesBy(candidateRows, "worldCupYear").map((row) => ({
    worldCupYear: row.key,
    totalCards: row.total,
    withTransfermarktData: 0,
    withoutTransfermarktData: row.total,
    coveragePercent: 0,
    newMatchesThisRun: 0,
    stillMissingHighPriority: row.highPriority
  }));
  const byTier = summarizeCandidatesBy(candidateRows, "priorityTier").map((row) => ({
    tier: row.key || "unknown",
    totalCards: row.total,
    withTransfermarktData: 0,
    withoutTransfermarktData: row.total,
    coveragePercent: 0
  }));
  const byRound = [
    {
      roundId: result.roundId,
      roundDescription: result.roundDescription,
      leaguesScanned: result.leaguesScanned.join("|"),
      yearsScanned: result.yearsScanned.join("|"),
      transfermarktSeasonsScanned: result.transfermarktSeasonsScanned.join("|"),
      beforeCoveragePercent: result.coverageSummary.transfermarktCoveragePercent,
      afterCoveragePercent: result.coverageSummary.transfermarktCoveragePercent,
      coverageDelta: 0,
      playersFound: result.playersFound,
      playersApproved: result.playersApproved,
      playersNeedsReview: result.playersNeedsReview,
      playersStillMissing: result.missingPlayerCount - result.playersApproved,
      cacheHits: result.cacheHits,
      cacheMisses: result.cacheMisses,
      dryRun: result.dryRun
    }
  ];
  const identityIndexRows = await readCsv(resolve(process.env.INIT_CWD ?? process.cwd(), "data/sources/transfermarkt-overlay/identity_candidate_index.csv"));
  const identityMatchHeaders = [
    "requestKey",
    "ratingSubjectId",
    "playerName",
    "nation",
    "worldCupYear",
    "position",
    "transfermarktPlayerId",
    "candidateName",
    "competitionId",
    "transfermarktSeasonId",
    "score",
    "status",
    "evidenceFamiliesPresent",
    "evidenceFamiliesMissing",
    "autoApprovalReason",
    "needsReviewReason",
    "rejectedReason",
    "matchReasons",
    "hardContradictions"
  ] as const;
  const outputs = [
    join(reportDir, `rating-lab-transfermarkt-coverage-by-year-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-coverage-by-tier-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-coverage-by-round-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-enrichment-candidates-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-squad-cache-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-season-plan-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-identity-candidate-index-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-identity-auto-approved-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-identity-needs-review-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-identity-rejected-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-squad-cache-field-quality-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-cache-refresh-recommendations-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-profile-repair-worklist-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-profile-identity-attempts-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-profile-identity-overlay-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-identity-funnel-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-identity-funnel-summary-${timestamp}.json`)
  ];
  await writeCsv(outputs[0]!, ["worldCupYear", "totalCards", "withTransfermarktData", "withoutTransfermarktData", "coveragePercent", "newMatchesThisRun", "stillMissingHighPriority"], byYear);
  await writeCsv(outputs[1]!, ["tier", "totalCards", "withTransfermarktData", "withoutTransfermarktData", "coveragePercent"], byTier);
  await writeCsv(
    outputs[2]!,
    [
      "roundId",
      "roundDescription",
      "leaguesScanned",
      "yearsScanned",
      "transfermarktSeasonsScanned",
      "beforeCoveragePercent",
      "afterCoveragePercent",
      "coverageDelta",
      "playersFound",
      "playersApproved",
      "playersNeedsReview",
      "playersStillMissing",
      "cacheHits",
      "cacheMisses",
      "dryRun"
    ],
    byRound
  );
  await writeCsv(outputs[3]!, Object.keys(candidateRows[0] ?? { candidateCategory: "" }), candidateRows);
  await writeCsv(
    outputs[4]!,
    ["roundId", "leagueId", "worldCupYear", "transfermarktSeasonId", "cacheStatus"],
    result.seasonPlans.map((plan) => ({
      roundId: result.roundId,
      leagueId: plan.competitionId,
      worldCupYear: plan.worldCupYear,
      transfermarktSeasonId: plan.transfermarktSeasonId,
      cacheStatus: plan.cacheHit ? "hit" : "miss_or_refresh_needed"
    }))
  );
  await writeCsv(
    outputs[5]!,
    ["worldCupYear", "competitionId", "seasonModel", "primarySeasonId", "secondarySeasonIds", "allSeasonIds", "transfermarktSeasonId", "reason", "warnings", "cacheFile", "cacheHit"],
    result.seasonPlans.map((plan) => ({
      ...plan,
      secondarySeasonIds: plan.secondarySeasonIds.join("|"),
      allSeasonIds: plan.allSeasonIds.join("|"),
      warnings: plan.warnings.join("|")
    }))
  );
  await writeCsv(outputs[6]!, Object.keys(identityIndexRows[0] ?? { transfermarkt_player_id: "" }), identityIndexRows);
  await writeCsv(outputs[7]!, identityMatchHeaders, result.identityMatches.filter((row) => row.status === "auto_approved"));
  await writeCsv(outputs[8]!, identityMatchHeaders, result.identityMatches.filter((row) => row.status === "needs_review"));
  await writeCsv(outputs[9]!, identityMatchHeaders, result.identityMatches.filter((row) => row.status === "rejected"));
  await writeCsv(
    outputs[10]!,
    [
      "worldCupYear",
      "transfermarktSeasonId",
      "competitionId",
      "cacheFile",
      "rowCount",
      "playerIdPresentPercent",
      "namePresentPercent",
      "birthYearPresentPercent",
      "dateOfBirthPresentPercent",
      "nationalityPresentPercent",
      "positionPresentPercent",
      "clubPresentPercent"
    ],
    result.squadCacheFieldQuality
  );
  await writeCsv(
    outputs[11]!,
    ["cacheFile", "worldCupYear", "transfermarktSeasonId", "competitionId", "nationalityPresentPercent", "birthYearPresentPercent", "clubPresentPercent", "recommendedAction"],
    result.squadCacheFieldQuality.map((row) => ({
      cacheFile: row.cacheFile,
      worldCupYear: row.worldCupYear,
      transfermarktSeasonId: row.transfermarktSeasonId,
      competitionId: row.competitionId,
      nationalityPresentPercent: row.nationalityPresentPercent,
      birthYearPresentPercent: row.birthYearPresentPercent,
      clubPresentPercent: row.clubPresentPercent,
      recommendedAction: cacheRefreshRecommendation(row)
    }))
  );
  await writeCsv(
    outputs[12]!,
    [
      "ratingSubjectId",
      "debugRealName",
      "nation",
      "worldCupYear",
      "position",
      "tier",
      "bestCandidateTransfermarktId",
      "bestCandidateName",
      "bestCandidateScore",
      "missingFields",
      "repairReason",
      "profileRepairRequired",
      "profileRepairCandidateIds",
      "skipReason"
    ],
    result.profileRepairWorklist
  );
  await writeCsv(
    outputs[13]!,
    ["transfermarktPlayerId", "candidateName", "missingFields", "attempted", "status", "cacheStatus", "reason"],
    result.profileIdentityAttempts
  );
  const profileOverlayRows = await readCsv(resolve(process.env.INIT_CWD ?? process.cwd(), "data/sources/transfermarkt-overlay/profile_identity_overlay.csv"));
  await writeCsv(outputs[14]!, Object.keys(profileOverlayRows[0] ?? { transfermarkt_player_id: "" }), profileOverlayRows);
  const funnel = await buildIdentityFunnelReport({ reportDir, candidatesPath, result });
  await writeCsv(outputs[15]!, IDENTITY_FUNNEL_HEADERS, funnel.rows);
  await writeFile(outputs[16]!, `${JSON.stringify(funnel.summary, null, 2)}\n`, "utf8");
  return outputs;
}

const IDENTITY_FUNNEL_HEADERS = [
  "ratingSubjectId",
  "debugRealName",
  "nation",
  "worldCupYear",
  "position",
  "tier",
  "overall",
  "priority",
  "wasExported",
  "exportSkipReason",
  "candidateCount",
  "bestCandidateTransfermarktId",
  "bestCandidateName",
  "bestCandidateScore",
  "bestCandidateStatus",
  "bestCandidateMissingFields",
  "bestCandidateEvidenceFamilies",
  "needsReviewReason",
  "rejectedReason",
  "approvedProviderLinkWritten",
  "ratingLabIdentityCoverageAfter",
  "profileRepairAttempted",
  "profileRepairStatus",
  "profileRepairCandidateIds",
  "funnelOutcome",
  "recommendedNextStep"
] as const;

type IdentityFunnelRow = Record<(typeof IDENTITY_FUNNEL_HEADERS)[number], string | number | boolean>;

async function buildIdentityFunnelReport({
  reportDir,
  candidatesPath,
  result
}: {
  reportDir: string;
  candidatesPath: string;
  result: TransfermarktEnrichmentCliResult;
}): Promise<{ rows: IdentityFunnelRow[]; summary: Record<string, number | boolean> }> {
  const summaryPath = await latestSummaryPath(reportDir);
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as {
    cardSnapshots: Array<Record<string, string | number | boolean | null | undefined>>;
  };
  const cards = summary.cardSnapshots;
  const candidateRows = await readCsv(candidatesPath);
  const exportedIds = new Set(candidateRows.map((row) => row.ratingSubjectId));
  const providerLinks = await readCsv(resolve(process.env.INIT_CWD ?? process.cwd(), "data/sources/identity/provider_player_links.csv"));
  const approvedLinkIds = new Set(
    providerLinks
      .filter((row) => row.subject_id && (row.review_status === "auto_approved" || row.review_status === "manual_approved"))
      .map((row) => row.subject_id as string)
  );
  const matchesBySubject = groupMatchesBySubject(result.identityMatches);
  const profileAttemptsById = new Map(result.profileIdentityAttempts.map((row) => [row.transfermarktPlayerId, row]));
  const rows = cards
    .filter((card) => !Boolean(card.transfermarktIdentityCoverage))
    .map((card) => {
      const ratingSubjectId = subjectIdFromSnapshot(card);
      const matches = matchesBySubject.get(ratingSubjectId) ?? [];
      const best = [...matches].sort((left, right) => Number(right.score) - Number(left.score))[0];
      const profileAttempt = best ? profileAttemptsById.get(best.transfermarktPlayerId) : undefined;
      const wasExported = exportedIds.has(ratingSubjectId);
      const approvedProviderLinkWritten = approvedLinkIds.has(ratingSubjectId);
      return {
        ratingSubjectId,
        debugRealName: String(card.debugRealName ?? card.internalRawName ?? ""),
        nation: String(card.nation ?? ""),
        worldCupYear: Number(card.worldCupYear ?? 0),
        position: String(card.position ?? ""),
        tier: String(card.tier ?? ""),
        overall: Number(card.overall ?? 0),
        priority: String(candidateRows.find((row) => row.ratingSubjectId === ratingSubjectId)?.priority ?? ""),
        wasExported,
        exportSkipReason: wasExported ? "" : "not_selected_by_current_export_scope_or_category",
        candidateCount: matches.length,
        bestCandidateTransfermarktId: best?.transfermarktPlayerId ?? "",
        bestCandidateName: best?.candidateName ?? "",
        bestCandidateScore: best?.score ?? "",
        bestCandidateStatus: best?.status ?? "",
        bestCandidateMissingFields: best?.evidenceFamiliesMissing ?? "",
        bestCandidateEvidenceFamilies: best?.evidenceFamiliesPresent ?? "",
        needsReviewReason: best?.needsReviewReason ?? "",
        rejectedReason: best?.rejectedReason ?? "",
        approvedProviderLinkWritten,
        ratingLabIdentityCoverageAfter: Boolean(card.transfermarktIdentityCoverage),
        profileRepairAttempted: profileAttempt?.attempted ?? false,
        profileRepairStatus: profileAttempt?.status ?? "",
        profileRepairCandidateIds: profileAttempt?.transfermarktPlayerId ?? "",
        funnelOutcome: funnelOutcome({ wasExported, best, approvedProviderLinkWritten, identityCoverageAfter: Boolean(card.transfermarktIdentityCoverage) }),
        recommendedNextStep: recommendedNextStep(best)
      };
    });
  const missingIds = new Set(rows.map((row) => String(row.ratingSubjectId)));
  const summaryCounts = {
    allRatingLabCards: cards.length,
    cardsMissingTransfermarktIdentity: rows.length,
    cardsExportedForTransfermarktEnrichment: rows.filter((row) => row.wasExported).length,
    cardsSkippedFromExport: rows.filter((row) => !row.wasExported).length,
    missingPlayersWithSquadCacheCandidate: rows.filter((row) => Number(row.candidateCount) > 0).length,
    missingPlayersWithProfileCandidate: result.profileIdentitySuccessCount,
    missingPlayersWithApprovedProviderLink: [...approvedLinkIds].filter((id) => missingIds.has(id)).length,
    missingPlayersNeedsReview: rows.filter((row) => row.bestCandidateStatus === "needs_review").length,
    missingPlayersRejected: rows.filter((row) => row.bestCandidateStatus === "rejected").length,
    missingPlayersStillMissing: rows.filter((row) => !row.approvedProviderLinkWritten).length,
    profileIdentityCacheCount: result.profileIdentityCacheCount,
    profileIdentitySuccessCount: result.profileIdentitySuccessCount,
    profileIdentityFailureCount: result.profileIdentityFailureCount,
    profileRepairEnabled: result.profileRepairEnabled,
    profileRepairWorklistCount: result.profileRepairWorklist.length,
    profileIdentityAttemptCount: result.profileIdentityAttempts.length,
    profileIdentityFetchAttemptedCount: result.profileIdentityAttempts.filter((row) => row.attempted).length,
    profileIdentityFetchSkippedCount: result.profileIdentityAttempts.filter((row) => !row.attempted && row.status.startsWith("skipped")).length,
    profileIdentityCacheHitCount: result.profileIdentityAttempts.filter((row) => row.status.startsWith("cache_hit")).length,
    needsReviewBecauseNationalityMissingCount: rows.filter((row) => String(row.needsReviewReason).includes("nation")).length
  };
  return { rows, summary: summaryCounts };
}

function groupMatchesBySubject(rows: readonly TransfermarktEnrichmentCliResult["identityMatches"][number][]): Map<string, TransfermarktEnrichmentCliResult["identityMatches"]> {
  const groups = new Map<string, TransfermarktEnrichmentCliResult["identityMatches"]>();
  for (const row of rows) groups.set(row.ratingSubjectId, [...(groups.get(row.ratingSubjectId) ?? []), row]);
  return groups;
}

function subjectIdFromSnapshot(card: Record<string, string | number | boolean | null | undefined>): string {
  const name = String(card.debugRealName ?? card.internalRawName ?? "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${String(card.nation ?? "")}-${String(card.worldCupYear ?? "")}-${name}`;
}

function recommendedNextStep(best: TransfermarktEnrichmentCliResult["identityMatches"][number] | undefined): string {
  if (!best) return "expand_export_scope_or_add_leagues";
  if (best.status === "auto_approved") return "rerun_rating_lab_to_count_provider_link";
  if (best.needsReviewReason.includes("nation")) return "fetch_transfermarkt_profile_identity";
  if (best.needsReviewReason) return "manual_review_or_add_provider_link";
  if (best.rejectedReason) return "inspect_rejected_candidate_or_expand_search";
  return "inspect_identity_candidate";
}

function funnelOutcome({
  wasExported,
  best,
  approvedProviderLinkWritten,
  identityCoverageAfter
}: {
  wasExported: boolean;
  best: TransfermarktEnrichmentCliResult["identityMatches"][number] | undefined;
  approvedProviderLinkWritten: boolean;
  identityCoverageAfter: boolean;
}): string {
  if (identityCoverageAfter) return "already_counted_as_identity_coverage";
  if (!wasExported) return "not_exported_in_current_funnel_run";
  if (!best) return "exported_no_candidate_found";
  if (approvedProviderLinkWritten) return "approved_provider_link_written";
  if (best.status === "auto_approved") return "auto_approved_not_yet_counted_by_rating_lab";
  if (best.status === "needs_review") return `needs_review:${best.needsReviewReason || "unspecified"}`;
  if (best.status === "rejected") return `rejected:${best.rejectedReason || "unspecified"}`;
  return "candidate_found_without_terminal_status";
}

function cacheRefreshRecommendation(row: { nationalityPresentPercent: number; clubPresentPercent: number }): string {
  if (row.nationalityPresentPercent === 0) return "legacy_cache_missing_identity_fields:profile_repair_or_force_refresh";
  if (row.clubPresentPercent === 0) return "cache_missing_club_context:profile_repair_or_force_refresh";
  return "cache_identity_fields_available";
}

function summarizeCandidatesBy(rows: readonly Record<string, string>[], key: string): { key: string; total: number; highPriority: number }[] {
  const groups = new Map<string, { key: string; total: number; highPriority: number }>();
  for (const row of rows) {
    const groupKey = row[key] ?? "";
    const group = groups.get(groupKey) ?? { key: groupKey, total: 0, highPriority: 0 };
    group.total += 1;
    const priorityScore = Number(row.priorityScore ?? 0);
    if (priorityScore >= 90 || row.priorityTier === "elite") group.highPriority += 1;
    groups.set(groupKey, group);
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function parseArgs(argv: readonly string[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, char: string) => char.toUpperCase());
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else values[key] = true;
  }
  return values;
}

async function latestCandidatesPath(reportDir: string): Promise<string> {
  const files = (await readdir(reportDir)).filter((file) => file.startsWith("rating-lab-enrichment-candidates-") && file.endsWith(".csv")).sort();
  const latest = files.at(-1);
  if (!latest) throw new Error("No rating-lab enrichment candidate CSV found. Run pnpm db:rating-lab:export-enrichment first.");
  return join(reportDir, latest);
}

async function latestSummaryPath(reportDir: string): Promise<string> {
  const files = (await readdir(reportDir)).filter((file) => file.startsWith("rating-lab-summary-") && file.endsWith(".json")).sort();
  return join(reportDir, files.at(-1) ?? "latest-summary.json");
}

if (isCliEntrypoint(import.meta.url)) {
  runTransfermarktEnrich()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

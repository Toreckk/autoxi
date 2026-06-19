import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveEditionKeyFromAwards } from "@autoxi/domain";
import { detectAnomalies, detectAnomalyDetails } from "../domain/evaluation/anomalyDetection.js";
import { evaluateBenchmarks } from "../domain/evaluation/benchmarkRanges.js";
import { summarizeSevenAZeroComparison } from "../sources/seven-a-zero/compareWithSevenAZero.js";
import { evaluateRatingGates } from "../domain/evaluation/evaluateRatingGates.js";
import { evaluatePairwiseChecks } from "../domain/evaluation/pairwiseChecks.js";
import { resolveRatingDistributionDiagnostics } from "../domain/evaluation/resolveRatingDistributionDiagnostics.js";
import { evaluateSevenAZeroManualReferences } from "../sources/seven-a-zero/sevenAZeroManualReferences.js";
import type { FjelstulSourceReadiness } from "../sources/fjelstul/loadFjelstulSample.js";
import type { RatingLabReports } from "./reportTypes.js";
import type { RatingFormulaConfig } from "../domain/rating/ratingFormulaConfig.js";
import type {
  DistributionBucket,
  DistributionGroup,
  FjelstulCardContext,
  RatingLabAnomaly,
  RatingLabCardReport,
  RatingLabCardSnapshot,
  RatingLabSourceAvailability,
  RatingLabSummary,
  ResolvedRating,
  SevenAZeroComparison,
  SevenAZeroManualReferenceResult,
  TransfermarktCoverageSummary
} from "../domain/types.js";
import { countBy } from "../utils.js";

export { detectAnomalies } from "../domain/evaluation/anomalyDetection.js";

const CSV_COLUMNS = [
  "cardKey",
  "internalRawName",
  "publicPlaceholderName",
  "debugRealName",
  "publicDisplayName",
  "isLocalDebugOnly",
  "hostCountryLabel",
  "hostCountryCode",
  "hostResolutionSource",
  "hostResolutionWarning",
  "worldCupYear",
  "nation",
  "position",
  "birthYear",
  "overall",
  "estimatedOverallFromStats",
  "overallStatDelta",
  "tier",
  "editionKey",
  "primarySource",
  "sourceTypes",
  "confidence",
  "teamResult",
  "awards",
  "appearances",
  "goals",
  "sevenAZeroRating",
  "sevenAZeroDelta",
  "baseRating",
  "manualFloorApplied",
  "awardFloorApplied",
  "teamResultModifier",
  "appearanceModifier",
  "goalModifier",
  "externalReferenceDelta",
  "finalOverall",
  "warnings",
  "reasons",
  "formulaVersion",
  "formulaConfigPath",
  "selectedDistributionStrategy",
  "rawEvidenceOverall",
  "selectedOverall",
  "seasonAbilityBaseline",
  "seasonAbilitySource",
  "seasonAbilityConfidence",
  "sameSeasonScore",
  "previousSeasonScore",
  "twoSeasonsBackScore",
  "threeSeasonsBackScore",
  "weightedMultiSeasonScore",
  "marketValueTrend",
  "productionTrend",
  "minutesTrend",
  "trendAdjustment",
  "worldCupPerformanceRating",
  "worldCupRating",
  "worldCupPerformanceSource",
  "worldCupPerformanceConfidence",
  "transfermarktRating",
  "transfermarktIdentityConfidence",
  "transfermarktIdentityCoverage",
  "transfermarktContextCoverage",
  "transfermarktRatingEvidenceCoverage",
  "transfermarktAppliedRatingCoverage",
  "transfermarktRatingEvidenceReason",
  "transfermarktEffectiveWeight",
  "worldCupEffectiveWeight",
  "finalBlendedRating",
  "transfermarktMatchConfidence",
  "transfermarktCoverage",
  "transfermarktEligibleYears",
  "transfermarktAvailableYears",
  "tmOldestYear",
  "tmTwoBackYear",
  "tmPreviousYear",
  "tmWorldCupYear",
  "tmOldestRating",
  "tmTwoBackRating",
  "tmPreviousRating",
  "tmWorldCupYearRating",
  "tmSameSeasonScore",
  "tmPreviousSeasonScore",
  "tmTwoSeasonsBackScore",
  "tmThreeSeasonsBackScore",
  "tmWeightedMultiSeasonScore",
  "tmMarketValuePercentile",
  "tmAppearanceVolumeScore",
  "tmGoalContributionScore",
  "tmAssistContributionScore",
  "tmLeagueStrengthScore",
  "tmClubStrengthScore",
  "tmAgeCurveScore",
  "tmStarterShareScore",
  "tmCardsDisciplineScore",
  "transfermarktPlayerId",
  "transfermarktRatingConfidence",
  "transfermarktMatchFailureReason",
  "transfermarktSignalsAvailable",
  "transfermarktSignalsMissing",
  "transfermarktChangedRatingBy",
  "manualTransfermarktOverrideApplied",
  "manualTransfermarktOverrideReason",
  "awardMaxCapApplied",
  "absoluteClampApplied",
  "rating99Eligible",
  "rating99EligibilityReason",
  "exceptionalSignals",
  "tmMarketValueTrend",
  "tmProductionTrend",
  "tmMinutesTrend",
  "tmTrendAdjustment",
  "leagueStrengthAdjustment",
  "clubStrengthAdjustment",
  "ageCurveAdjustment",
  "awardAdjustment",
  "manualAnchorAdjustment",
  "finalOverallBeforeCaps",
  "capsApplied",
  "bonusesApplied",
  "warningsApplied",
  "evidenceSummary",
  "comparisonSummary"
] as const satisfies readonly (keyof RatingLabCardReport)[];

export function toCardReport({
  context,
  resolved,
  sevenAZero,
  transfermarktEvidence
}: {
  context: FjelstulCardContext;
  resolved: ResolvedRating;
  sevenAZero?: SevenAZeroComparison;
  transfermarktEvidence?: {
    playerId: string;
    identityConfidence: RatingLabCardReport["transfermarktIdentityConfidence"];
    identityCoverage: boolean;
    contextCoverage: boolean;
    ratingEvidenceCoverage: boolean;
    ratingEvidenceReason: string;
  };
}): RatingLabCardReport {
  const sevenAZeroDelta = sevenAZero ? resolved.overall - sevenAZero.rating : null;
  const baseEvidence = resolved.evidence.find(
    (evidence) => evidence.source === "FJELSTUL_WORLD_CUP" || evidence.source === "FJELSTUL_GENERATED"
  );
  const manualFloorApplied = resolved.evidence.some((evidence) => evidence.source === "MANUAL_CURATED");
  const awardFloorApplied = resolved.reasons.some((reason) => reason.includes("award winner floor"));
  const sourceTypes = [...new Set(resolved.evidence.map((evidence) => evidence.source))].join("|");
  const breakdown = resolved.breakdown;
  const multiSeason = breakdown?.multiSeasonAbility;
  const transfermarktSource = breakdown?.appliedSources.find((source) => source.sourceKey === "TRANSFERMARKT") ??
    breakdown?.ignoredSources.find((source) => source.sourceKey === "TRANSFERMARKT");
  const tmSignals = transfermarktSource?.signals ?? {};

  return {
    cardKey: `${context.identityKey}:${context.worldCupYear}`,
    internalRawName: context.internalRawName,
    publicPlaceholderName: context.publicPlaceholderName,
    debugRealName: context.debugRealName ?? context.internalRawName,
    publicDisplayName: context.publicDisplayName ?? context.publicPlaceholderName,
    isLocalDebugOnly: Boolean(context.isLocalDebugOnly ?? true),
    hostCountryLabel: context.hostCountryLabel ?? (context.host ? context.nation : "UNKNOWN HOST"),
    hostCountryCode: context.hostCountryCode ?? (context.host ? context.nation : "UNK"),
    hostResolutionSource: context.hostResolutionSource ?? (context.host ? "host_countries.csv" : "fallback"),
    hostResolutionWarning: context.hostResolutionWarning === undefined
      ? context.host
        ? null
        : `host_country_unresolved:${context.worldCupYear}`
      : context.hostResolutionWarning,
    worldCupYear: context.worldCupYear,
    nation: context.nation,
    position: context.position,
    birthYear: context.birthYear ?? null,
    overall: resolved.overall,
    estimatedOverallFromStats: resolved.estimatedOverallFromStats,
    overallStatDelta: resolved.overallStatDelta,
    tier: resolved.tier,
    editionKey: resolveEditionKeyFromAwards({ position: context.position, awardKeys: context.awards }),
    primarySource: resolved.primarySource,
    sourceTypes,
    confidence: resolved.confidence,
    teamResult: context.teamResult,
    awards: context.awards.join("|"),
    appearances: context.appearances ?? 0,
    goals: context.goals ?? 0,
    sevenAZeroRating: sevenAZero?.rating ?? null,
    sevenAZeroDelta,
    baseRating: baseEvidence?.value ?? null,
    manualFloorApplied: String(manualFloorApplied),
    awardFloorApplied: String(awardFloorApplied),
    // TODO: expose per-modifier values from resolveCardRating instead of inferring them from reason text.
    teamResultModifier: null,
    appearanceModifier: null,
    goalModifier: null,
    externalReferenceDelta: sevenAZeroDelta,
    finalOverall: resolved.overall,
    warnings: resolved.warnings.map((warning) => warning.code).join("|"),
    reasons: resolved.reasons.join("|"),
    formulaVersion: breakdown?.formulaVersion ?? "unknown",
    formulaConfigPath: breakdown?.formulaConfigPath ?? null,
    selectedDistributionStrategy: breakdown?.selectedDistributionStrategy ?? "RAW_EVIDENCE",
    rawEvidenceOverall: breakdown?.rawEvidenceOverall ?? resolved.overall,
    selectedOverall: breakdown?.selectedOverall ?? resolved.overall,
    seasonAbilityBaseline: breakdown?.seasonAbilityBaseline ?? null,
    seasonAbilitySource: breakdown?.seasonAbilitySource ?? null,
    seasonAbilityConfidence: breakdown?.seasonAbilityConfidence ?? "NONE",
    sameSeasonScore: multiSeason?.sameSeasonScore ?? null,
    previousSeasonScore: multiSeason?.previousSeasonScore ?? null,
    twoSeasonsBackScore: multiSeason?.twoSeasonsBackScore ?? null,
    threeSeasonsBackScore: multiSeason?.threeSeasonsBackScore ?? null,
    weightedMultiSeasonScore: multiSeason?.weightedMultiSeasonScore ?? null,
    marketValueTrend: multiSeason?.marketValueTrend ?? "UNKNOWN",
    productionTrend: multiSeason?.productionTrend ?? "UNKNOWN",
    minutesTrend: multiSeason?.minutesTrend ?? "UNKNOWN",
    trendAdjustment: breakdown?.trendAdjustment ?? 0,
    worldCupPerformanceRating: breakdown?.worldCupPerformanceRating ?? null,
    worldCupRating: breakdown?.worldCupPerformanceRating ?? null,
    worldCupPerformanceSource: breakdown?.worldCupPerformanceSource ?? null,
    worldCupPerformanceConfidence: breakdown?.worldCupPerformanceConfidence ?? "NONE",
    transfermarktRating: breakdown?.transfermarktRating ?? null,
    transfermarktIdentityConfidence: transfermarktEvidence?.identityConfidence ?? breakdown?.transfermarktMatchConfidence ?? "NONE",
    transfermarktIdentityCoverage: transfermarktEvidence?.identityCoverage ?? Boolean(breakdown?.transfermarktMatchConfidence && breakdown.transfermarktMatchConfidence !== "NONE"),
    transfermarktContextCoverage: transfermarktEvidence?.contextCoverage ?? false,
    transfermarktRatingEvidenceCoverage: transfermarktEvidence?.ratingEvidenceCoverage ?? Boolean(breakdown?.transfermarktRating !== null && breakdown?.transfermarktRating !== undefined),
    transfermarktAppliedRatingCoverage: (breakdown?.transfermarktEffectiveWeight ?? 0) > 0,
    transfermarktRatingEvidenceReason: transfermarktEvidence?.ratingEvidenceReason ?? (breakdown?.transfermarktRating ? "real_transfermarkt_rating_evidence_present" : "no_transfermarkt_identity_or_rating_evidence"),
    transfermarktEffectiveWeight: breakdown?.transfermarktEffectiveWeight ?? 0,
    worldCupEffectiveWeight: breakdown?.worldCupEffectiveWeight ?? 0,
    finalBlendedRating: breakdown?.finalBlendedRating ?? resolved.overall,
    transfermarktMatchConfidence: breakdown?.transfermarktMatchConfidence ?? "NONE",
    transfermarktCoverage: breakdown?.transfermarktCoverage ?? null,
    transfermarktEligibleYears: stringSignal(tmSignals, "transfermarktEligibleYears"),
    transfermarktAvailableYears: stringSignal(tmSignals, "transfermarktAvailableYears"),
    tmOldestYear: numericSignal(tmSignals, "tmOldestYear"),
    tmTwoBackYear: numericSignal(tmSignals, "tmTwoBackYear"),
    tmPreviousYear: numericSignal(tmSignals, "tmPreviousYear"),
    tmWorldCupYear: numericSignal(tmSignals, "tmWorldCupYear"),
    tmOldestRating: numericSignal(tmSignals, "tmOldestRating"),
    tmTwoBackRating: numericSignal(tmSignals, "tmTwoBackRating"),
    tmPreviousRating: numericSignal(tmSignals, "tmPreviousRating"),
    tmWorldCupYearRating: numericSignal(tmSignals, "tmWorldCupYearRating"),
    tmSameSeasonScore: numericSignal(tmSignals, "tmWorldCupYearRating"),
    tmPreviousSeasonScore: numericSignal(tmSignals, "tmPreviousRating"),
    tmTwoSeasonsBackScore: numericSignal(tmSignals, "tmTwoBackRating"),
    tmThreeSeasonsBackScore: numericSignal(tmSignals, "tmOldestRating"),
    tmWeightedMultiSeasonScore: numericSignal(tmSignals, "tmWeightedMultiSeasonScore"),
    tmMarketValuePercentile: numericSignal(tmSignals, "marketValuePercentile"),
    tmAppearanceVolumeScore: numericSignal(tmSignals, "appearanceVolumeScore"),
    tmGoalContributionScore: numericSignal(tmSignals, "goalContributionScore"),
    tmAssistContributionScore: numericSignal(tmSignals, "assistContributionScore"),
    tmLeagueStrengthScore: numericSignal(tmSignals, "leagueStrengthScore"),
    tmClubStrengthScore: numericSignal(tmSignals, "clubStrengthScore"),
    tmAgeCurveScore: numericSignal(tmSignals, "ageCurveScore"),
    tmStarterShareScore: numericSignal(tmSignals, "starterShareScore"),
    tmCardsDisciplineScore: numericSignal(tmSignals, "cardsDisciplineScore"),
    transfermarktPlayerId: stringSignal(tmSignals, "transfermarktPlayerId") || transfermarktEvidence?.playerId || "",
    transfermarktRatingConfidence: stringSignal(tmSignals, "transfermarktRatingConfidence", "NONE") as RatingLabCardReport["transfermarktRatingConfidence"],
    transfermarktMatchFailureReason: stringSignal(tmSignals, "transfermarktMatchFailureReason"),
    transfermarktSignalsAvailable: stringSignal(tmSignals, "signalsAvailable"),
    transfermarktSignalsMissing: stringSignal(tmSignals, "signalsMissing"),
    transfermarktChangedRatingBy:
      breakdown?.transfermarktRating !== null && breakdown?.transfermarktRating !== undefined && breakdown.worldCupPerformanceRating !== null
        ? breakdown.finalOverall - breakdown.worldCupPerformanceRating
        : null,
    manualTransfermarktOverrideApplied: stringSignal(tmSignals, "manualTransfermarktOverrideApplied") === "true",
    manualTransfermarktOverrideReason: stringSignal(tmSignals, "manualTransfermarktOverrideReason"),
    awardMaxCapApplied: (breakdown?.capsApplied ?? []).some((cap) => cap.includes("award")),
    absoluteClampApplied:
      breakdown?.finalOverallBeforeCaps !== undefined && breakdown.finalOverallBeforeCaps !== breakdown.finalOverall,
    rating99Eligible: isRating99Eligible(context, resolved),
    rating99EligibilityReason: rating99EligibilityReason(context, resolved),
    exceptionalSignals: exceptionalSignals(context, resolved).join("|"),
    tmMarketValueTrend: stringSignal(tmSignals, "tmMarketValueTrend", "UNKNOWN"),
    tmProductionTrend: stringSignal(tmSignals, "tmProductionTrend", "UNKNOWN"),
    tmMinutesTrend: stringSignal(tmSignals, "tmMinutesTrend", "UNKNOWN"),
    tmTrendAdjustment: numericSignal(tmSignals, "tmTrendAdjustment") ?? 0,
    leagueStrengthAdjustment: breakdown?.leagueStrengthAdjustment ?? 0,
    clubStrengthAdjustment: breakdown?.clubStrengthAdjustment ?? 0,
    ageCurveAdjustment: breakdown?.ageCurveAdjustment ?? 0,
    awardAdjustment: breakdown?.awardAdjustment ?? 0,
    manualAnchorAdjustment: breakdown?.manualAnchorAdjustment ?? 0,
    finalOverallBeforeCaps: breakdown?.finalOverallBeforeCaps ?? resolved.overall,
    capsApplied: (breakdown?.capsApplied ?? []).join("|"),
    bonusesApplied: (breakdown?.bonusesApplied ?? []).join("|"),
    warningsApplied: (breakdown?.warningsApplied ?? []).join("|"),
    evidenceSummary: (breakdown?.evidence ?? resolved.evidence)
      .map((evidence) => `${evidence.source}:${evidence.confidence}:${evidence.value ?? ""}:${evidence.reason}`)
      .join("|"),
    comparisonSummary: (breakdown?.comparisonReferences ?? [])
      .map((reference) => `${reference.sourceKey}:comparisonOnly=${reference.comparisonOnly}:delta=${reference.delta ?? ""}`)
      .join("|")
  };
}

export function buildReports({
  cards,
  sourceDir,
  sampleMode,
  seed,
  formulaConfig,
  sourceAvailability,
  sourceReadiness
}: {
  cards: readonly RatingLabCardReport[];
  sourceDir: string;
  sampleMode: string;
  seed: string;
  formulaConfig?: RatingFormulaConfig;
  sourceAvailability?: readonly RatingLabSourceAvailability[];
  sourceReadiness?: FjelstulSourceReadiness;
}): RatingLabReports {
  const anomalyOptions = { sampleMode };
  const anomalyDetails = detectAnomalyDetails(cards, anomalyOptions);
  const anomalies = detectAnomalies(cards, anomalyOptions);
  const sevenAZeroManualReferences = evaluateSevenAZeroManualReferences(cards);
  const distributionDiagnostics = resolveRatingDistributionDiagnostics(cards);
  const summary = buildSummary({
    cards,
    anomalies,
    anomalyDetails,
    sourceDir,
    sampleMode,
    seed,
    formulaConfig,
    sourceAvailability,
    distributionDiagnostics,
    sourceReadiness,
    sevenAZeroManualReferences
  });
  const icons = cards.filter((card) => card.tier === "ICON" || card.primarySource === "MANUAL_CURATED");
  const topByTournament = Object.values(groupBy(cards, (card) => String(card.worldCupYear))).flatMap((yearCards) =>
    [...yearCards].sort((left, right) => right.overall - left.overall).slice(0, 25)
  );
  const awardWinners = cards.filter((card) => card.awards.length > 0 || card.editionKey !== "NONE");
  const generatedOnlyOutliers = cards
    .filter((card) => card.primarySource === "FJELSTUL_GENERATED" && card.overall >= 88)
    .sort((left, right) => right.overall - left.overall);
  const sevenAZeroComparison = cards.filter((card) => card.sevenAZeroRating !== null);

  return {
    summary,
    allCards: [...cards],
    icons,
    randomSample: [...cards]
      .sort((left, right) => left.publicPlaceholderName.localeCompare(right.publicPlaceholderName))
      .slice(0, 300),
    topByTournament,
    awardWinners,
    generatedOnlyOutliers,
    sevenAZeroComparison,
    sevenAZeroManualReferences,
    anomalies,
    sourceAvailability: [...(sourceAvailability ?? [])],
    distributionBuckets: [...distributionDiagnostics.buckets],
    distributionGroups: flattenDistributionGroups(distributionDiagnostics)
  };
}

function isRating99Eligible(context: FjelstulCardContext, resolved: ResolvedRating): boolean {
  return exceptionalSignals(context, resolved).length > 0;
}

function rating99EligibilityReason(context: FjelstulCardContext, resolved: ResolvedRating): string {
  const signals = exceptionalSignals(context, resolved);
  if (signals.length === 0) return "no_exceptional_signal";
  return `eligible:${signals.join("|")}`;
}

function exceptionalSignals(context: FjelstulCardContext, resolved: ResolvedRating): string[] {
  const signals: string[] = [];
  if (resolved.primarySource === "MANUAL_CURATED" && resolved.overall >= 97) signals.push("manualAllTimeBenchmark");
  if (context.awards.includes("GOLDEN_BALL") && (context.minutes ?? 0) >= 450 && (context.goals ?? 0) >= 3) {
    signals.push("goldenBallPlusEliteWorldCupPerformance");
  }
  if (context.teamResult === "CHAMPION" && context.awards.includes("GOLDEN_BALL")) {
    signals.push("worldCupWinnerPlusTournamentMVP");
  }
  if ((context.goals ?? 0) >= 8) signals.push("worldCupRecordOrHistoricTournament");
  if (
    resolved.breakdown?.appliedSources.some(
      (source) => source.sourceKey === "TRANSFERMARKT" && source.confidence === "HIGH" && source.rating >= 97
    )
  ) {
    signals.push("highConfidenceExternalRating");
  }
  return signals;
}

export async function writeRatingLabReports({
  reports,
  outputDir = "data/import-reports/rating-lab",
  timestamp = new Date().toISOString().replace(/[:.]/g, "-")
}: {
  reports: RatingLabReports;
  outputDir?: string;
  timestamp?: string;
}): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });
  const files = [
    [`rating-lab-summary-${timestamp}.json`, `${JSON.stringify(reports.summary, null, 2)}\n`],
    ["latest-summary.json", `${JSON.stringify(reports.summary, null, 2)}\n`],
    [`rating-lab-rating-breakdown-${timestamp}.csv`, toCsv(reports.allCards)],
    [`rating-lab-icons-${timestamp}.csv`, toCsv(reports.icons)],
    [`rating-lab-random-sample-${timestamp}.csv`, toCsv(reports.randomSample)],
    [`rating-lab-top-by-tournament-${timestamp}.csv`, toCsv(reports.topByTournament)],
    [`rating-lab-award-winners-${timestamp}.csv`, toCsv(reports.awardWinners)],
    [`rating-lab-generated-only-outliers-${timestamp}.csv`, toCsv(reports.generatedOnlyOutliers)],
    [`rating-lab-seven-a-zero-comparison-${timestamp}.csv`, toCsv(reports.sevenAZeroComparison)],
    [`rating-lab-seven-a-zero-manual-references-${timestamp}.csv`, manualReferencesToCsv(reports.sevenAZeroManualReferences)],
    [`rating-lab-anomalies-${timestamp}.csv`, toCsv(reports.anomalies)],
    [`rating-lab-source-availability-${timestamp}.csv`, sourceAvailabilityToCsv(reports.sourceAvailability)],
    [`rating-lab-source-matches-${timestamp}.csv`, toCsv(reports.allCards.filter((card) => card.transfermarktMatchConfidence !== "NONE" || card.transfermarktIdentityCoverage))],
    [`rating-lab-transfermarkt-match-diagnostics-${timestamp}.csv`, toCsv(reports.allCards)],
    [`rating-lab-transfermarkt-identity-risk-${timestamp}.csv`, identityRiskToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-unmatched-by-reason-${timestamp}.csv`, unmatchedByReasonToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-signal-coverage-${timestamp}.csv`, signalCoverageToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-coverage-by-era-${timestamp}.csv`, coverageSummaryToCsv(reports.summary.transfermarktCoverageByEra ?? [])],
    [`rating-lab-transfermarkt-coverage-by-world-cup-year-${timestamp}.csv`, coverageSummaryToCsv(reports.summary.transfermarktCoverageByWorldCupYear ?? [])],
    [`rating-lab-transfermarkt-coverage-by-tier-${timestamp}.csv`, coverageSummaryToCsv(reports.summary.transfermarktCoverageByTier ?? [])],
    [`rating-lab-transfermarkt-high-priority-coverage-${timestamp}.csv`, highPriorityTransfermarktCoverageToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-one-token-status-${timestamp}.csv`, oneTokenTransfermarktStatusToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-rating-evidence-missing-${timestamp}.csv`, ratingEvidenceMissingToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-squad-presence-${timestamp}.csv`, squadPresenceContextToCsv(reports.allCards)],
    [`rating-lab-transfermarkt-baselines-${timestamp}.csv`, toCsv(reports.allCards.filter((card) => card.transfermarktRating !== null))],
    [`rating-lab-transfermarkt-multi-season-${timestamp}.csv`, toCsv(reports.allCards.filter((card) => card.tmWeightedMultiSeasonScore !== null))],
    [`rating-lab-top-100-raw-evidence-${timestamp}.csv`, toCsv([...reports.allCards].sort((left, right) => right.rawEvidenceOverall - left.rawEvidenceOverall).slice(0, 100))],
    [`rating-lab-low-confidence-elites-${timestamp}.csv`, toCsv(reports.allCards.filter((card) => card.overall >= 90 && card.confidence !== "HIGH"))],
    [`rating-lab-rating-distribution-buckets-${timestamp}.csv`, distributionBucketsToCsv(reports.distributionBuckets)],
    [`rating-lab-rating-distribution-groups-${timestamp}.csv`, distributionGroupsToCsv(reports.distributionGroups)],
    [`rating-lab-distribution-summary-${timestamp}.csv`, distributionGroupsToCsv(reports.distributionGroups)],
    [`rating-lab-rating-cap-events-${timestamp}.csv`, toCsv(reports.allCards.filter((card) => card.awardMaxCapApplied || card.absoluteClampApplied || card.capsApplied))],
    [`rating-lab-tournament-filter-summary-${timestamp}.csv`, tournamentFilterToCsv(reports.summary)]
  ] as const;

  const paths: string[] = [];
  for (const [name, contents] of files) {
    const path = join(outputDir, name);
    await writeFile(path, contents, "utf8");
    paths.push(path);
  }
  const mergeReadinessPath = join(outputDir, `rating-lab-transfermarkt-merge-readiness-${timestamp}.json`);
  await writeFile(mergeReadinessPath, `${JSON.stringify(buildTransfermarktMergeReadiness(reports.allCards), null, 2)}\n`, "utf8");
  paths.push(mergeReadinessPath);
  return paths;
}

function buildSummary({
  cards,
  anomalies,
  anomalyDetails,
  sourceDir,
  sampleMode,
  seed,
  formulaConfig,
  sourceAvailability,
  distributionDiagnostics,
  sourceReadiness,
  sevenAZeroManualReferences
}: {
  cards: readonly RatingLabCardReport[];
  anomalies: readonly RatingLabCardReport[];
  anomalyDetails: readonly RatingLabAnomaly[];
  sourceDir: string;
  sampleMode: string;
  seed: string;
  formulaConfig?: RatingFormulaConfig;
  sourceAvailability?: readonly RatingLabSourceAvailability[];
  distributionDiagnostics: RatingLabSummary["distributionDiagnostics"];
  sourceReadiness?: FjelstulSourceReadiness;
  sevenAZeroManualReferences: readonly SevenAZeroManualReferenceResult[];
}): RatingLabSummary {
  const warningsByCode = mergeWarningCounts(
    countCardWarnings(cards),
    countAnomalyWarnings(anomalyDetails, cards),
    countSourceWarnings(sourceReadiness?.sourceWarnings ?? [])
  );
  const confidenceGateReasons: string[] = [];
  if (cards.some((card) => card.overall < 55 || card.overall > 99)) confidenceGateReasons.push("rating outside 55-99");
  if (cards.some((card) => card.overallStatDelta > 4)) confidenceGateReasons.push("some overall/stat deltas exceed 4");
  if (cards.some((card) => card.primarySource === "FJELSTUL_GENERATED" && card.overall >= 90)) {
    confidenceGateReasons.push("generated-only player reached 90+");
  }

  const benchmarks = evaluateBenchmarks(cards);
  const sevenAZeroReferenceSummary = summarizeManualReferences(sevenAZeroManualReferences);
  const pairwiseChecks = evaluatePairwiseChecks(cards);
  const overallStatDeltas = cards.map((card) => card.overallStatDelta).sort((left, right) => left - right);
  const awardWinners = cards.filter((card) => card.awards.length > 0 || card.editionKey !== "NONE");
  const awardWinnerFloorPct =
    awardWinners.length === 0
      ? null
      : (awardWinners.filter((card) => !card.warnings.split("|").includes("award_winner_below_floor")).length /
          awardWinners.length) *
        100;

  if (benchmarks.some((benchmark) => benchmark.status === "FAIL")) confidenceGateReasons.push("benchmark failure");
  if (pairwiseChecks.some((check) => check.status === "FAIL")) confidenceGateReasons.push("pairwise failure");

  const summary: RatingLabSummary = {
    generatedAt: new Date().toISOString(),
    formulaVersion: formulaConfig?.version ?? cards[0]?.formulaVersion,
    formulaConfigPath: formulaConfig?.formulaConfigPath ?? cards[0]?.formulaConfigPath ?? null,
    formulaConfigFallbackUsed: formulaConfig?.formulaConfigFallbackUsed ?? false,
    selectedDistributionStrategy: formulaConfig?.ratingDistribution.selectedStrategy ?? cards[0]?.selectedDistributionStrategy,
    sourceDir,
    sourceAvailability: [...(sourceAvailability ?? [])],
    distributionDiagnostics,
    tournamentFilterMode: sourceReadiness?.tournamentFilterSummary?.mode,
    tournamentFilterSummary: sourceReadiness?.tournamentFilterSummary
      ? {
          includedMenWorldCupYears: sourceReadiness.tournamentFilterSummary.includedMenWorldCupYears,
          excludedWomenWorldCupYears: sourceReadiness.tournamentFilterSummary.excludedWomenWorldCupYears,
          totalCardsBeforeGenderFilter: sourceReadiness.tournamentFilterSummary.totalCardsBeforeGenderFilter,
          totalCardsAfterGenderFilter: sourceReadiness.tournamentFilterSummary.totalCardsAfterGenderFilter
        }
      : undefined,
    tournamentFilterRows: sourceReadiness?.tournamentFilterSummary?.rows,
    transfermarktCoverageByEra: buildTransfermarktCoverageByEra(cards),
    transfermarktCoverageByWorldCupYear: buildTransfermarktCoverageByYear(cards),
    transfermarktCoverageByTier: buildTransfermarktCoverageByTier(cards),
    tmIdentityCount: cards.filter((card) => card.transfermarktIdentityCoverage).length,
    tmIdentityPercent: rate(cards.filter((card) => card.transfermarktIdentityCoverage).length, cards.length),
    tmContextCount: cards.filter((card) => card.transfermarktContextCoverage).length,
    tmContextPercent: rate(cards.filter((card) => card.transfermarktContextCoverage).length, cards.length),
    tmRatingEvidenceCount: cards.filter((card) => card.transfermarktRatingEvidenceCoverage).length,
    tmRatingEvidencePercent: rate(cards.filter((card) => card.transfermarktRatingEvidenceCoverage).length, cards.length),
    tmAppliedRatingCount: cards.filter((card) => card.transfermarktAppliedRatingCoverage).length,
    tmAppliedRatingPercent: rate(cards.filter((card) => card.transfermarktAppliedRatingCoverage).length, cards.length),
    sampleMode,
    seed,
    totalCardsSampled: cards.length,
    cardsResolved: cards.filter((card) => card.overall >= 55 && card.overall <= 99).length,
    cardsGeneratedOnly: cards.filter((card) => card.primarySource === "FJELSTUL_GENERATED").length,
    cardsWithManualCurated: cards.filter((card) => hasSourceType(card, "MANUAL_CURATED")).length,
    cardsWithEaHistorical: cards.filter((card) => hasSourceType(card, "EA_HISTORICAL")).length,
    cardsWithRetroReference: cards.filter((card) => hasSourceType(card, "RETRO_REFERENCE")).length,
    cardsWithFiveThirtyEight: cards.filter((card) => hasSourceType(card, "FIVETHIRTYEIGHT_WORLD_CUP")).length,
    cardsWithStatsBomb: cards.filter((card) => hasSourceType(card, "STATSBOMB_WORLD_CUP")).length,
    cardsWithSevenAZeroComparison: cards.filter((card) => card.sevenAZeroRating !== null).length,
    cardsWithHighConfidenceSource: cards.filter((card) => card.confidence === "HIGH").length,
    cardsWithMediumConfidenceOnly: cards.filter((card) => card.confidence === "MEDIUM").length,
    cardsWithLowConfidenceOnly: cards.filter((card) => card.confidence === "LOW").length,
    playersRowsRead: sourceReadiness?.playersRowsRead ?? 0,
    squadRowsRead: sourceReadiness?.squadRowsRead ?? 0,
    tournamentRowsRead: sourceReadiness?.tournamentRowsRead ?? 0,
    teamRowsRead: sourceReadiness?.teamRowsRead ?? 0,
    standingRowsRead: sourceReadiness?.standingRowsRead ?? 0,
    awardRowsRead: sourceReadiness?.awardRowsRead ?? 0,
    awardWinnerRowsRead: sourceReadiness?.awardWinnerRowsRead ?? 0,
    hostRowsRead: sourceReadiness?.hostRowsRead ?? 0,
    optionalAppearanceRowsRead: sourceReadiness?.optionalAppearanceRowsRead ?? 0,
    optionalGoalRowsRead: sourceReadiness?.optionalGoalRowsRead ?? 0,
    requiredSourceFilesLoaded: sourceReadiness?.requiredSourceFilesLoaded ?? false,
    sourceWarnings: sourceReadiness?.sourceWarnings ?? [],
    byWorldCupYear: countBy(cards, (card) => card.worldCupYear),
    byDecade: countBy(cards, (card) => `${Math.floor(card.worldCupYear / 10) * 10}s`),
    byNation: countBy(cards, (card) => card.nation),
    byPosition: countBy(cards, (card) => card.position),
    byTier: countBy(cards, (card) => card.tier),
    bySourceType: countBy(cards, (card) => card.primarySource),
    byConfidence: countBy(cards, (card) => card.confidence),
    warningsByCode,
    benchmarks,
    cardSnapshots: cards.map(toSnapshot),
    anomalyDetails: [...anomalyDetails],
    pairwiseChecks,
    pairwisePass: pairwiseChecks.filter((check) => check.status === "PASS").length,
    pairwiseWarn: pairwiseChecks.filter((check) => check.status === "WARN").length,
    pairwiseFail: pairwiseChecks.filter((check) => check.status === "FAIL").length,
    pairwiseMissing: pairwiseChecks.filter((check) => check.status === "MISSING").length,
    pairwiseAmbiguous: pairwiseChecks.filter((check) => check.status === "AMBIGUOUS").length,
    generatedOnlyTop3PerTournament: anomalyDetails.filter(
      (anomaly) => anomaly.code === "generated_only_top3_tournament" && anomaly.severity === "HARD_FAIL"
    ).length,
    overallStatDeltaP90: percentile(overallStatDeltas, 0.9),
    awardWinnerFloorPct,
    sevenAZeroComparison: summarizeSevenAZeroComparison(cards),
    ...sevenAZeroReferenceSummary,
    confidenceGateStatus: cards.length === 0 ? "BLOCKED_BY_SOURCE_QUALITY" : "NEEDS_TUNING",
    confidenceGateReasons
  };
  const evaluation = evaluateRatingGates(summary);
  return {
    ...summary,
    confidenceGateStatus: evaluation.status,
    confidenceGateReasons: [...evaluation.hardFailures, ...evaluation.warnings].map((result) => result.message)
  };
}

function toCsv(rows: readonly RatingLabCardReport[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

const MANUAL_REFERENCE_COLUMNS = [
  "referenceId",
  "playerName",
  "aliases",
  "worldCupYear",
  "nationCode",
  "referenceOverall",
  "actualRating",
  "delta",
  "status",
  "matchedInternalRawName",
  "matchedPublicName",
  "candidateNames",
  "tolerance",
  "reason"
] as const;

function manualReferencesToCsv(rows: readonly SevenAZeroManualReferenceResult[]): string {
  const lines = [MANUAL_REFERENCE_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.playerName,
        (row.aliases ?? []).join("|"),
        row.worldCupYear,
        row.nationCode,
        row.referenceOverall,
        row.actualRating,
        row.delta,
        row.status,
        row.matchedInternalRawName ?? "",
        row.matchedPublicName ?? "",
        (row.candidateNames ?? []).join("|"),
        row.tolerance,
        row.reason
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function numericSignal(signals: Record<string, number | string | null>, key: string): number | null {
  const value = signals[key];
  return typeof value === "number" ? value : null;
}

function stringSignal(signals: Record<string, number | string | null>, key: string, fallback = ""): string {
  const value = signals[key];
  return typeof value === "string" ? value : fallback;
}

function toSnapshot(card: RatingLabCardReport): RatingLabCardSnapshot {
  return {
    key: card.cardKey,
    internalRawName: card.internalRawName,
    publicPlaceholderName: card.publicPlaceholderName,
    debugRealName: card.debugRealName,
    publicDisplayName: card.publicDisplayName,
    isLocalDebugOnly: card.isLocalDebugOnly,
    hostCountryLabel: card.hostCountryLabel,
    hostCountryCode: card.hostCountryCode,
    hostResolutionSource: card.hostResolutionSource,
    hostResolutionWarning: card.hostResolutionWarning,
    worldCupYear: card.worldCupYear,
    nation: card.nation,
    position: card.position,
    overall: card.overall,
    tier: card.tier,
    editionKey: card.editionKey,
    awards: card.awards,
    primarySource: card.primarySource,
    confidence: card.confidence,
    warnings: card.warnings,
    reasons: card.reasons,
    selectedDistributionStrategy: card.selectedDistributionStrategy,
    rawEvidenceOverall: card.rawEvidenceOverall,
    selectedOverall: card.selectedOverall,
    seasonAbilityBaseline: card.seasonAbilityBaseline,
    worldCupPerformanceRating: card.worldCupPerformanceRating,
    transfermarktRating: card.transfermarktRating,
    transfermarktIdentityConfidence: card.transfermarktIdentityConfidence,
    transfermarktIdentityCoverage: card.transfermarktIdentityCoverage,
    transfermarktContextCoverage: card.transfermarktContextCoverage,
    transfermarktRatingEvidenceCoverage: card.transfermarktRatingEvidenceCoverage,
    transfermarktAppliedRatingCoverage: card.transfermarktAppliedRatingCoverage,
    transfermarktRatingEvidenceReason: card.transfermarktRatingEvidenceReason,
    transfermarktEffectiveWeight: card.transfermarktEffectiveWeight,
    worldCupEffectiveWeight: card.worldCupEffectiveWeight,
    finalBlendedRating: card.finalBlendedRating,
    transfermarktMatchConfidence: card.transfermarktMatchConfidence,
    transfermarktCoverage: card.transfermarktCoverage,
    transfermarktPlayerId: card.transfermarktPlayerId,
    transfermarktRatingConfidence: card.transfermarktRatingConfidence,
    transfermarktMatchFailureReason: card.transfermarktMatchFailureReason,
    transfermarktSignalsAvailable: card.transfermarktSignalsAvailable,
    transfermarktSignalsMissing: card.transfermarktSignalsMissing,
    transfermarktChangedRatingBy: card.transfermarktChangedRatingBy,
    rating99Eligible: card.rating99Eligible,
    rating99EligibilityReason: card.rating99EligibilityReason,
    trendAdjustment: card.trendAdjustment,
    capsApplied: card.capsApplied,
    evidenceSummary: card.evidenceSummary,
    comparisonSummary: card.comparisonSummary
  };
}

function flattenDistributionGroups(
  diagnostics: NonNullable<RatingLabSummary["distributionDiagnostics"]>
): DistributionGroup[] {
  return [
    ...prefixGroups("year", diagnostics.byWorldCupYear),
    ...prefixGroups("decade", diagnostics.byDecade),
    ...prefixGroups("position", diagnostics.byPosition),
    ...prefixGroups("source", diagnostics.byPrimarySource),
    ...prefixGroups("confidence", diagnostics.byConfidence)
  ];
}

function prefixGroups(prefix: string, groups: readonly DistributionGroup[]): DistributionGroup[] {
  return groups.map((group) => ({ ...group, key: `${prefix}:${group.key}` }));
}

function buildTransfermarktCoverageByEra(cards: readonly RatingLabCardReport[]): TransfermarktCoverageSummary[] {
  return Object.entries(groupBy(cards, (card) => eraBucket(card.worldCupYear)))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => transfermarktCoverageSummary(key, group));
}

function buildTransfermarktCoverageByYear(cards: readonly RatingLabCardReport[]): TransfermarktCoverageSummary[] {
  return Object.entries(groupBy(cards, (card) => String(card.worldCupYear)))
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([key, group]) => transfermarktCoverageSummary(key, group));
}

function buildTransfermarktCoverageByTier(cards: readonly RatingLabCardReport[]): TransfermarktCoverageSummary[] {
  return Object.entries(groupBy(cards, (card) => card.tier))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => transfermarktCoverageSummary(key, group));
}

function transfermarktCoverageSummary(key: string, cards: readonly RatingLabCardReport[]): TransfermarktCoverageSummary {
  const high = cards.filter((card) => card.transfermarktMatchConfidence === "HIGH").length;
  const medium = cards.filter((card) => card.transfermarktMatchConfidence === "MEDIUM").length;
  const low = cards.filter((card) => card.transfermarktMatchConfidence === "LOW").length;
  const none = cards.length - high - medium - low;
  const identity = cards.filter((card) => card.transfermarktIdentityCoverage).length;
  const context = cards.filter((card) => card.transfermarktContextCoverage).length;
  const ratingEvidence = cards.filter((card) => card.transfermarktRatingEvidenceCoverage).length;
  const applied = cards.filter((card) => card.transfermarktAppliedRatingCoverage).length;
  return {
    key,
    totalMaleCards: cards.length,
    identityMatches: identity,
    contextMatches: context,
    ratingEvidenceMatches: ratingEvidence,
    appliedRatingMatches: applied,
    identityRate: rate(identity, cards.length),
    contextRate: rate(context, cards.length),
    ratingEvidenceRate: rate(ratingEvidence, cards.length),
    appliedRatingRate: rate(applied, cards.length),
    highTransfermarktMatches: high,
    mediumTransfermarktMatches: medium,
    lowTransfermarktMatches: low,
    noTransfermarktMatch: none,
    highMatchRate: rate(high, cards.length),
    mediumOrBetterRate: rate(high + medium, cards.length),
    manualOverrideCount: cards.filter((card) => card.manualTransfermarktOverrideApplied).length
  };
}

function eraBucket(year: number): string {
  if (year <= 1966) return "1930-1966";
  if (year <= 1990) return "1970-1990";
  return "1994-2022";
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : Number((count / total).toFixed(4));
}

function sourceAvailabilityToCsv(rows: readonly RatingLabSourceAvailability[]): string {
  const lines = ["sourceKey,label,status,required,mode,path,affectsRating,warnings,details"];
  for (const row of rows) {
    lines.push(
      [
        row.sourceKey,
        row.label,
        row.status,
        String(row.required),
        row.mode,
        row.path ?? "",
        String(row.affectsRating),
        row.warnings.join("|"),
        row.details ? Object.entries(row.details).map(([key, value]) => `${key}=${value}`).join("|") : ""
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function distributionBucketsToCsv(rows: readonly DistributionBucket[]): string {
  const lines = ["rating,count,percentage,examples"];
  for (const row of rows) {
    lines.push([row.rating, row.count, row.percentage, row.examples.join("|")].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function distributionGroupsToCsv(rows: readonly DistributionGroup[]): string {
  const lines = ["key,totalCards,count90Plus,count95Plus,count99"];
  for (const row of rows) {
    lines.push([row.key, row.totalCards, row.count90Plus, row.count95Plus, row.count99].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function tournamentFilterToCsv(summary: RatingLabSummary): string {
  const lines = ["worldCupYear,tournamentId,tournamentName,genderOrCategory,included,excludedReason,cardCount"];
  const filterRows = summary.tournamentFilterRows ?? [];
  for (const row of filterRows) {
    lines.push(
      [
        row.worldCupYear,
        row.tournamentId,
        row.tournamentName,
        row.genderOrCategory,
        String(row.included),
        row.excludedReason,
        row.cardCount
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function unmatchedByReasonToCsv(cards: readonly RatingLabCardReport[]): string {
  const unmatched = cards.filter((card) => card.transfermarktMatchConfidence === "NONE" || card.transfermarktMatchFailureReason);
  const counts = countBy(unmatched, (card) => card.transfermarktMatchFailureReason || "no_transfermarkt_match");
  const lines = ["reason,count"];
  for (const [reason, count] of Object.entries(counts).sort((left, right) => right[1] - left[1])) {
    lines.push([reason, count].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function signalCoverageToCsv(cards: readonly RatingLabCardReport[]): string {
  const signalNames = new Set<string>();
  for (const card of cards) {
    for (const signal of card.transfermarktSignalsAvailable.split("|").filter(Boolean)) signalNames.add(signal);
    for (const signal of card.transfermarktSignalsMissing.split("|").filter(Boolean)) signalNames.add(signal);
  }
  const lines = ["signal,availableCount,missingCount"];
  for (const signal of [...signalNames].sort()) {
    lines.push(
      [
        signal,
        cards.filter((card) => card.transfermarktSignalsAvailable.split("|").includes(signal)).length,
        cards.filter((card) => card.transfermarktSignalsMissing.split("|").includes(signal)).length
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function ratingEvidenceMissingToCsv(cards: readonly RatingLabCardReport[]): string {
  const lines = [
    "playerName,worldCupYear,nation,position,transfermarktPlayerId,identityConfidence,contextEvidence,missingReason,recommendedNextStep"
  ];
  for (const card of cards.filter((item) => item.transfermarktIdentityCoverage && !item.transfermarktRatingEvidenceCoverage)) {
    lines.push(
      [
        card.debugRealName || card.internalRawName,
        card.worldCupYear,
        card.nation,
        card.position,
        card.transfermarktPlayerId,
        card.transfermarktIdentityConfidence,
        card.transfermarktContextCoverage ? "squad_presence_or_context_present" : "identity_only",
        card.transfermarktRatingEvidenceReason,
        "import_real_transfermarkt_season_stats_or_market_values"
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function identityRiskToCsv(cards: readonly RatingLabCardReport[]): string {
  const lines = [
    "riskReason,cardKey,internalRawName,debugRealName,worldCupYear,nation,position,birthYear,overall,tier,transfermarktPlayerId,transfermarktMatchConfidence,transfermarktRatingConfidence,transfermarktMatchFailureReason,manualTransfermarktOverrideApplied,manualTransfermarktOverrideReason"
  ];
  for (const card of cards) {
    const riskReason = transfermarktIdentityRiskReason(card);
    if (!riskReason) continue;
    lines.push(
      [
        riskReason,
        card.cardKey,
        card.internalRawName,
        card.debugRealName ?? "",
        card.worldCupYear,
        card.nation,
        card.position,
        card.birthYear ?? "",
        card.overall,
        card.tier,
        card.transfermarktPlayerId,
        card.transfermarktMatchConfidence,
        card.transfermarktRatingConfidence,
        card.transfermarktMatchFailureReason,
        card.manualTransfermarktOverrideApplied,
        card.manualTransfermarktOverrideReason
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function highPriorityTransfermarktCoverageToCsv(cards: readonly RatingLabCardReport[]): string {
  const lines = [
    "name,publicName,debugRealName,nation,year,tier,position,one_token_name,tm_identity,tm_context,tm_rating_evidence,tm_applied,tm_player_id,identity_score,evidence_families,auto_approval_reason,needs_review_reason,rejected_reason,rating_evidence_missing_reason"
  ];
  for (const card of cards.filter(isHighPriorityTransfermarktCard)) {
    lines.push(transfermarktStatusCsvRow(card));
  }
  return `${lines.join("\n")}\n`;
}

function oneTokenTransfermarktStatusToCsv(cards: readonly RatingLabCardReport[]): string {
  const lines = [
    "name,publicName,debugRealName,nation,year,tier,position,one_token_name,tm_identity,tm_context,tm_rating_evidence,tm_applied,tm_player_id,identity_score,evidence_families,auto_approval_reason,needs_review_reason,rejected_reason,rating_evidence_missing_reason"
  ];
  for (const card of cards.filter((item) => isSingleTokenName(item.debugRealName || item.internalRawName))) {
    lines.push(transfermarktStatusCsvRow(card));
  }
  return `${lines.join("\n")}\n`;
}

function squadPresenceContextToCsv(cards: readonly RatingLabCardReport[]): string {
  const lines = ["playerName,worldCupYear,nation,transfermarktPlayerId,contextPresent,ratingEvidencePresent,appliedRatingPresent,ratingEvidenceMissingReason"];
  for (const card of cards.filter((item) => item.transfermarktContextCoverage || item.transfermarktRatingEvidenceReason === "real_transfermarkt_season_stats_not_imported")) {
    lines.push(
      [
        card.debugRealName || card.internalRawName,
        card.worldCupYear,
        card.nation,
        card.transfermarktPlayerId,
        card.transfermarktContextCoverage,
        card.transfermarktRatingEvidenceCoverage,
        card.transfermarktAppliedRatingCoverage,
        card.transfermarktRatingEvidenceReason
      ].map(csvCell).join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function transfermarktStatusCsvRow(card: RatingLabCardReport): string {
  const signals = card.transfermarktSignalsAvailable.split("|").filter(Boolean);
  return [
    card.internalRawName,
    card.publicDisplayName,
    card.debugRealName ?? "",
    card.nation,
    card.worldCupYear,
    card.tier,
    card.position,
    isSingleTokenName(card.debugRealName || card.internalRawName),
    card.transfermarktIdentityConfidence,
    card.transfermarktContextCoverage ? "PRESENT" : "MISSING",
    card.transfermarktRatingEvidenceCoverage,
    card.transfermarktAppliedRatingCoverage,
    card.transfermarktPlayerId,
    "",
    signals.join("|"),
    card.transfermarktAppliedRatingCoverage ? "real_rating_evidence_applied" : "",
    card.transfermarktIdentityCoverage && !card.transfermarktAppliedRatingCoverage ? card.transfermarktRatingEvidenceReason : "",
    card.transfermarktMatchFailureReason,
    card.transfermarktRatingEvidenceReason
  ].map(csvCell).join(",");
}

function buildTransfermarktMergeReadiness(cards: readonly RatingLabCardReport[]): Record<string, unknown> {
  const modernCards = cards.filter((card) => card.worldCupYear >= 1994);
  const highPriorityModern = modernCards.filter(isHighPriorityTransfermarktCard);
  const oneTokenHighPriorityModern = highPriorityModern.filter((card) => isSingleTokenName(card.debugRealName || card.internalRawName));
  const cards2002 = cards.filter((card) => card.worldCupYear === 2002);
  const fakeRatingEvidenceCount = cards.filter(
    (card) =>
      card.transfermarktRatingEvidenceCoverage &&
      /transfermarkt_squad_presence/iu.test(`${card.evidenceSummary}|${card.transfermarktSignalsAvailable}|${card.transfermarktRatingEvidenceReason}`)
  ).length;
  const modernIdentityCoveragePercent = percentNumber(modernCards.filter((card) => card.transfermarktIdentityCoverage).length, modernCards.length);
  const highPriorityModernIdentityCoveragePercent = percentNumber(highPriorityModern.filter((card) => card.transfermarktIdentityCoverage).length, highPriorityModern.length);
  const oneTokenHighPriorityModernIdentityCoveragePercent = percentNumber(
    oneTokenHighPriorityModern.filter((card) => card.transfermarktIdentityCoverage).length,
    oneTokenHighPriorityModern.length
  );
  const worldCup2002IdentityCoveragePercent = percentNumber(cards2002.filter((card) => card.transfermarktIdentityCoverage).length, cards2002.length);
  const blockingReasons = fakeRatingEvidenceCount > 0 ? ["fakeRatingEvidenceCount must be 0"] : [];
  const warnings = [
    highPriorityModern.length > 0 && highPriorityModernIdentityCoveragePercent < 90
      ? "high_priority_modern_identity_coverage_below_90_percent"
      : "",
    oneTokenHighPriorityModern.length > 0 && oneTokenHighPriorityModernIdentityCoveragePercent < 80
      ? "one_token_high_priority_modern_identity_coverage_below_80_percent"
      : "",
    cards2002.length > 0 && cards2002.filter((card) => card.transfermarktIdentityCoverage).length <= 1
      ? "world_cup_2002_identity_coverage_not_materially_higher_than_1_card"
      : ""
  ].filter(Boolean);
  return {
    mergeReady: blockingReasons.length === 0 && warnings.length === 0,
    blockingReasons,
    warnings,
    modernIdentityCoveragePercent,
    highPriorityModernIdentityCoveragePercent,
    oneTokenHighPriorityModernIdentityCoveragePercent,
    worldCup2002IdentityCoveragePercent,
    tmIdentityCount: cards.filter((card) => card.transfermarktIdentityCoverage).length,
    tmContextCount: cards.filter((card) => card.transfermarktContextCoverage).length,
    tmRatingEvidenceCount: cards.filter((card) => card.transfermarktRatingEvidenceCoverage).length,
    tmAppliedRatingCount: cards.filter((card) => card.transfermarktAppliedRatingCoverage).length,
    identityOnlyCount: cards.filter((card) => card.transfermarktIdentityCoverage && !card.transfermarktRatingEvidenceCoverage).length,
    ratingEvidenceCount: cards.filter((card) => card.transfermarktRatingEvidenceCoverage).length,
    appliedCount: cards.filter((card) => card.transfermarktAppliedRatingCoverage).length,
    needsReviewHighPriorityCount: highPriorityModern.filter(
      (card) => card.transfermarktIdentityCoverage && !card.transfermarktAppliedRatingCoverage && card.transfermarktRatingEvidenceReason !== "real_transfermarkt_season_stats_not_imported"
    ).length,
    stillMissingHighPriorityCount: highPriorityModern.filter((card) => !card.transfermarktIdentityCoverage).length,
    fakeRatingEvidenceCount
  };
}

function isHighPriorityTransfermarktCard(card: RatingLabCardReport): boolean {
  return (
    card.tier === "ICON" ||
    card.tier === "HERO" ||
    card.tier === "WORLD_CLASS" ||
    card.overall >= 87 ||
    Boolean(card.awards) ||
    card.manualFloorApplied === "true" ||
    Math.abs(card.sevenAZeroDelta ?? 0) >= 8
  );
}

function percentNumber(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(1));
}

function transfermarktIdentityRiskReason(card: RatingLabCardReport): string {
  if (!card.transfermarktPlayerId) return "";
  if (card.transfermarktMatchFailureReason) return card.transfermarktMatchFailureReason;
  if (card.transfermarktMatchConfidence !== "HIGH") return "non_high_identity_confidence";
  if (isSingleTokenName(card.debugRealName || card.internalRawName) && !card.birthYear) return "single_token_name_without_birth_year";
  return "";
}

function isSingleTokenName(name: string): boolean {
  return name.trim().split(/\s+/u).filter(Boolean).length === 1;
}

function coverageSummaryToCsv(rows: readonly TransfermarktCoverageSummary[]): string {
  const lines = [
    "key,totalMaleCards,identityMatches,contextMatches,ratingEvidenceMatches,appliedRatingMatches,identityRate,contextRate,ratingEvidenceRate,appliedRatingRate,highTransfermarktMatches,mediumTransfermarktMatches,lowTransfermarktMatches,noTransfermarktMatch,highMatchRate,mediumOrBetterRate,manualOverrideCount"
  ];
  for (const row of rows) {
    lines.push(
      [
        row.key,
        row.totalMaleCards,
        row.identityMatches,
        row.contextMatches,
        row.ratingEvidenceMatches,
        row.appliedRatingMatches,
        row.identityRate,
        row.contextRate,
        row.ratingEvidenceRate,
        row.appliedRatingRate,
        row.highTransfermarktMatches,
        row.mediumTransfermarktMatches,
        row.lowTransfermarktMatches,
        row.noTransfermarktMatch,
        row.highMatchRate,
        row.mediumOrBetterRate,
        row.manualOverrideCount
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const value = key(item);
    groups[value] = [...(groups[value] ?? []), item];
  }
  return groups;
}

function countCardWarnings(cards: readonly RatingLabCardReport[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    for (const warning of card.warnings.split("|").filter(Boolean)) {
      counts[warning] = (counts[warning] ?? 0) + 1;
    }
  }
  return counts;
}

function countAnomalyWarnings(
  anomalies: readonly RatingLabAnomaly[],
  cards: readonly RatingLabCardReport[]
): Record<string, number> {
  const cardWarningKeys = new Set<string>();
  for (const card of cards) {
    for (const warning of card.warnings.split("|").filter(Boolean)) {
      cardWarningKeys.add(`${warning}:${card.internalRawName}:${card.worldCupYear}:${card.nation}`);
    }
  }

  const counts: Record<string, number> = {};
  for (const anomaly of anomalies) {
    const key = `${anomaly.code}:${anomaly.internalRawName}:${anomaly.worldCupYear}:${anomaly.nation}`;
    if (cardWarningKeys.has(key)) continue;
    counts[anomaly.code] = (counts[anomaly.code] ?? 0) + 1;
  }
  return counts;
}

function countSourceWarnings(warnings: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const warning of warnings) {
    counts[warning] = (counts[warning] ?? 0) + 1;
  }
  return counts;
}

function mergeWarningCounts(...counts: readonly Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const count of counts) {
    for (const [key, value] of Object.entries(count)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
}

function hasSourceType(card: RatingLabCardReport, source: string): boolean {
  return card.sourceTypes.split("|").includes(source);
}

function summarizeManualReferences(results: readonly SevenAZeroManualReferenceResult[]): Pick<
  RatingLabSummary,
  | "sevenAZeroManualPass"
  | "sevenAZeroManualWarn"
  | "sevenAZeroManualFail"
  | "sevenAZeroManualMissing"
  | "sevenAZeroManualAmbiguous"
  | "sevenAZeroManualMatched"
  | "sevenAZeroManualAverageAbsoluteDelta"
  | "sevenAZeroManualMedianAbsoluteDelta"
  | "sevenAZeroManualDeltaP90"
> {
  const deltas = results
    .map((result) => result.delta)
    .filter((delta): delta is number => delta !== null)
    .map(Math.abs)
    .sort((left, right) => left - right);

  return {
    sevenAZeroManualPass: results.filter((result) => result.status === "PASS").length,
    sevenAZeroManualWarn: results.filter((result) => result.status === "WARN").length,
    sevenAZeroManualFail: results.filter((result) => result.status === "FAIL").length,
    sevenAZeroManualMissing: results.filter((result) => result.status === "MISSING").length,
    sevenAZeroManualAmbiguous: results.filter((result) => result.status === "AMBIGUOUS").length,
    sevenAZeroManualMatched: results.filter((result) => result.actualRating !== null).length,
    sevenAZeroManualAverageAbsoluteDelta: average(deltas),
    sevenAZeroManualMedianAbsoluteDelta: percentile(deltas, 0.5),
    sevenAZeroManualDeltaP90: percentile(deltas, 0.9)
  };
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
  return values[index] ?? null;
}

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  SevenAZeroManualReferenceResult
} from "../domain/types.js";
import { countBy } from "../utils.js";

export { detectAnomalies } from "../domain/evaluation/anomalyDetection.js";

const CSV_COLUMNS = [
  "internalRawName",
  "publicPlaceholderName",
  "worldCupYear",
  "nation",
  "position",
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
  "worldCupPerformanceSource",
  "worldCupPerformanceConfidence",
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
  sevenAZero
}: {
  context: FjelstulCardContext;
  resolved: ResolvedRating;
  sevenAZero?: SevenAZeroComparison;
}): RatingLabCardReport {
  const sevenAZeroDelta = sevenAZero ? resolved.overall - sevenAZero.rating : null;
  const baseEvidence = resolved.evidence.find((evidence) => evidence.source === "FJELSTUL_GENERATED");
  const manualFloorApplied = resolved.evidence.some((evidence) => evidence.source === "MANUAL_CURATED");
  const awardFloorApplied = resolved.reasons.some((reason) => reason.includes("award winner floor"));
  const sourceTypes = [...new Set(resolved.evidence.map((evidence) => evidence.source))].join("|");
  const breakdown = resolved.breakdown;
  const multiSeason = breakdown?.multiSeasonAbility;

  return {
    internalRawName: context.internalRawName,
    publicPlaceholderName: context.publicPlaceholderName,
    worldCupYear: context.worldCupYear,
    nation: context.nation,
    position: context.position,
    overall: resolved.overall,
    estimatedOverallFromStats: resolved.estimatedOverallFromStats,
    overallStatDelta: resolved.overallStatDelta,
    tier: resolved.tier,
    editionKey: context.awards[0] ?? "NONE",
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
    worldCupPerformanceSource: breakdown?.worldCupPerformanceSource ?? null,
    worldCupPerformanceConfidence: breakdown?.worldCupPerformanceConfidence ?? "NONE",
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
    [`rating-lab-icons-${timestamp}.csv`, toCsv(reports.icons)],
    [`rating-lab-random-sample-${timestamp}.csv`, toCsv(reports.randomSample)],
    [`rating-lab-top-by-tournament-${timestamp}.csv`, toCsv(reports.topByTournament)],
    [`rating-lab-award-winners-${timestamp}.csv`, toCsv(reports.awardWinners)],
    [`rating-lab-generated-only-outliers-${timestamp}.csv`, toCsv(reports.generatedOnlyOutliers)],
    [`rating-lab-seven-a-zero-comparison-${timestamp}.csv`, toCsv(reports.sevenAZeroComparison)],
    [`rating-lab-seven-a-zero-manual-references-${timestamp}.csv`, manualReferencesToCsv(reports.sevenAZeroManualReferences)],
    [`rating-lab-anomalies-${timestamp}.csv`, toCsv(reports.anomalies)],
    [`rating-lab-source-availability-${timestamp}.csv`, sourceAvailabilityToCsv(reports.sourceAvailability)],
    [`rating-lab-rating-distribution-buckets-${timestamp}.csv`, distributionBucketsToCsv(reports.distributionBuckets)],
    [`rating-lab-rating-distribution-groups-${timestamp}.csv`, distributionGroupsToCsv(reports.distributionGroups)]
  ] as const;

  const paths: string[] = [];
  for (const [name, contents] of files) {
    const path = join(outputDir, name);
    await writeFile(path, contents, "utf8");
    paths.push(path);
  }
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
    selectedDistributionStrategy: formulaConfig?.ratingDistribution.selectedStrategy ?? cards[0]?.selectedDistributionStrategy,
    sourceDir,
    sourceAvailability: [...(sourceAvailability ?? [])],
    distributionDiagnostics,
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

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toSnapshot(card: RatingLabCardReport): RatingLabCardSnapshot {
  return {
    key: `${card.internalRawName}:${card.worldCupYear}:${card.nation}`,
    internalRawName: card.internalRawName,
    publicPlaceholderName: card.publicPlaceholderName,
    worldCupYear: card.worldCupYear,
    nation: card.nation,
    position: card.position,
    overall: card.overall,
    tier: card.tier,
    primarySource: card.primarySource,
    confidence: card.confidence,
    warnings: card.warnings,
    reasons: card.reasons,
    selectedDistributionStrategy: card.selectedDistributionStrategy,
    rawEvidenceOverall: card.rawEvidenceOverall,
    selectedOverall: card.selectedOverall,
    seasonAbilityBaseline: card.seasonAbilityBaseline,
    worldCupPerformanceRating: card.worldCupPerformanceRating,
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

function sourceAvailabilityToCsv(rows: readonly RatingLabSourceAvailability[]): string {
  const lines = ["sourceKey,label,status,required,mode,path,affectsRating,warnings"];
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
        row.warnings.join("|")
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

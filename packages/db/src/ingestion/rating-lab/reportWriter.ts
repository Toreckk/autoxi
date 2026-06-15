import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { detectAnomalies, detectAnomalyDetails } from "./anomalyDetection.js";
import { evaluateBenchmarks } from "./benchmarkRanges.js";
import { summarizeSevenAZeroComparison } from "./compareWithSevenAZero.js";
import { evaluateRatingGates } from "./evaluateRatingGates.js";
import { evaluatePairwiseChecks } from "./pairwiseChecks.js";
import { evaluateSevenAZeroManualReferences } from "./sevenAZeroManualReferences.js";
import type { FjelstulSourceReadiness } from "./loadFjelstulSample.js";
import type { RatingLabReports } from "./reportTypes.js";
import type {
  FjelstulCardContext,
  RatingLabAnomaly,
  RatingLabCardReport,
  RatingLabCardSnapshot,
  RatingLabSummary,
  ResolvedRating,
  SevenAZeroComparison,
  SevenAZeroManualReferenceResult
} from "./types.js";
import { countBy } from "./utils.js";

export { detectAnomalies } from "./anomalyDetection.js";

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
  "reasons"
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
    reasons: resolved.reasons.join("|")
  };
}

export function buildReports({
  cards,
  sourceDir,
  sampleMode,
  seed,
  sourceReadiness
}: {
  cards: readonly RatingLabCardReport[];
  sourceDir: string;
  sampleMode: string;
  seed: string;
  sourceReadiness?: FjelstulSourceReadiness;
}): RatingLabReports {
  const anomalyDetails = detectAnomalyDetails(cards);
  const anomalies = detectAnomalies(cards);
  const sevenAZeroManualReferences = evaluateSevenAZeroManualReferences(cards);
  const summary = buildSummary({
    cards,
    anomalies,
    anomalyDetails,
    sourceDir,
    sampleMode,
    seed,
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
    anomalies
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
    [`rating-lab-anomalies-${timestamp}.csv`, toCsv(reports.anomalies)]
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
  sourceReadiness,
  sevenAZeroManualReferences
}: {
  cards: readonly RatingLabCardReport[];
  anomalies: readonly RatingLabCardReport[];
  anomalyDetails: readonly RatingLabAnomaly[];
  sourceDir: string;
  sampleMode: string;
  seed: string;
  sourceReadiness?: FjelstulSourceReadiness;
  sevenAZeroManualReferences: readonly SevenAZeroManualReferenceResult[];
}): RatingLabSummary {
  const warningsByCode = countWarnings([...cards, ...anomalies]);
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
    sourceDir,
    sampleMode,
    seed,
    totalCardsSampled: cards.length,
    cardsResolved: cards.filter((card) => card.overall >= 55 && card.overall <= 99).length,
    cardsGeneratedOnly: cards.filter((card) => card.primarySource === "FJELSTUL_GENERATED").length,
    cardsWithManualCurated: cards.filter((card) => card.primarySource === "MANUAL_CURATED").length,
    cardsWithEaHistorical: cards.filter((card) => card.primarySource === "EA_HISTORICAL").length,
    cardsWithRetroReference: cards.filter((card) => card.reasons.includes("RETRO_REFERENCE")).length,
    cardsWithFiveThirtyEight: cards.filter((card) => card.reasons.includes("FIVETHIRTYEIGHT_WORLD_CUP")).length,
    cardsWithStatsBomb: cards.filter((card) => card.reasons.includes("STATSBOMB_WORLD_CUP")).length,
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
    generatedOnlyTop3PerTournament: anomalyDetails.filter((anomaly) => anomaly.code === "generated_only_top3_tournament").length,
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
    reasons: card.reasons
  };
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const value = key(item);
    groups[value] = [...(groups[value] ?? []), item];
  }
  return groups;
}

function countWarnings(cards: readonly RatingLabCardReport[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    for (const warning of card.warnings.split("|").filter(Boolean)) {
      counts[warning] = (counts[warning] ?? 0) + 1;
    }
  }
  return counts;
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

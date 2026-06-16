import { deriveTier, statProfileForPosition } from "@autoxi/domain";
import { nationMatches } from "../evaluation/benchmarkRanges.js";
import { estimateOverallFromStats } from "./estimateOverallFromStats.js";
import { generateOverallFromFjelstulContext, awardFloorForAwards } from "./generateOverallFromFjelstulContext.js";
import { generateStatsFromOverall } from "./generateStatsFromOverall.js";
import { SOURCE_PRIORITY } from "./sourcePriority.js";
import { prePhase1BCalibrationConfig } from "./ratingFormulaPresets.js";
import type { RatingFormulaConfig } from "./ratingFormulaConfig.js";
import type {
  ExternalRatingRecord,
  FjelstulCardContext,
  RatingEvidence,
  RatingSourcesInput,
  RatingWarning,
  ResolvedRating
} from "../types.js";
import { clamp, normalizeName, roundClamp } from "../../utils.js";

export function resolveCardRating(
  cardContext: FjelstulCardContext,
  sources: RatingSourcesInput = {},
  config: RatingFormulaConfig = prePhase1BCalibrationConfig
): ResolvedRating {
  const evidence: RatingEvidence[] = [];
  const warnings: RatingWarning[] = [];
  const generated = generateOverallFromFjelstulContext(cardContext, config);
  const generatedOverall = generated.overall;
  let overall = generated.overall;
  let confidence = generated.confidence;
  let primarySource: ResolvedRating["primarySource"] = "FJELSTUL_GENERATED";
  const reasons = [...generated.reasons];

  evidence.push({
    source: "FJELSTUL_GENERATED",
    confidence: generated.confidence,
    value: generated.overall,
    reason: generated.reasons.join("; ")
  });

  const manual = findManual(cardContext, sources.manualCurated ?? []);
  if (manual) {
    overall = Math.max(overall, manual.floor);
    confidence = "HIGH";
    primarySource = "MANUAL_CURATED";
    evidence.unshift({ source: "MANUAL_CURATED", confidence: "HIGH", value: overall, reason: manual.reason });
    reasons.push(manual.reason);
  }

  const ea = findExternal(cardContext, sources.eaHistorical ?? []);
  let externalStats: ExternalRatingRecord["stats"];
  if (!manual && ea?.overall !== undefined && ea.confidence === "HIGH") {
    overall = ea.overall;
    confidence = "HIGH";
    primarySource = "EA_HISTORICAL";
    externalStats = ea.stats;
    evidence.unshift({ source: "EA_HISTORICAL", confidence: ea.confidence, value: ea.overall, reason: ea.reason });
    reasons.push(ea.reason);
  }

  for (const [source, records] of [
    ["RETRO_REFERENCE", sources.retroReference ?? []],
    ["FIVETHIRTYEIGHT_WORLD_CUP", sources.fiveThirtyEight ?? []],
    ["STATSBOMB_WORLD_CUP", sources.statsBomb ?? []]
  ] as const) {
    const record = findExternal(cardContext, records);
    if (!record?.overall) continue;
    const modifier = source === "RETRO_REFERENCE" ? Math.sign(record.overall - overall) : clamp(Math.round((record.overall - overall) / 4), -2, 2);
    overall = roundClamp(overall + modifier, 55, 99);
    evidence.push({ source, confidence: record.confidence, value: record.overall, reason: record.reason });
    if (primarySource === "FJELSTUL_GENERATED") primarySource = "MIXED";
  }

  const sevenAZero = findSevenAZeroComparison(cardContext, sources.sevenAZeroComparison ?? []);
  if (sevenAZero) {
    evidence.push({
      source: "SEVEN_A_ZERO_COMPARISON",
      confidence: "MEDIUM",
      value: sevenAZero.rating,
      reason: "Local 7a0 JSON comparison only; not applied by default."
    });
    if (sources.applySevenAZero && primarySource === "FJELSTUL_GENERATED") {
      overall = sevenAZero.rating;
      confidence = "MEDIUM";
      primarySource = "SEVEN_A_ZERO_COMPARISON";
    }
  }

  overall = roundClamp(overall, 55, 99);
  const stats = externalStats ?? generateStatsFromOverall({
    overall,
    position: cardContext.position,
    role: cardContext.role,
    seed: cardContext.seed
  });
  const estimatedOverallFromStats = estimateOverallFromStats({ position: cardContext.position, stats });
  const overallStatDelta = Math.abs(overall - estimatedOverallFromStats);
  const tier = deriveTier(overall);

  if (overallStatDelta > 4) {
    warnings.push({
      code: "overall_stat_delta_gt_4",
      message: `Visible overall ${overall} differs from stat estimate ${estimatedOverallFromStats}.`,
      severity: "WARN"
    });
  }

  if (statProfileForPosition(cardContext.position) !== stats.profile) {
    warnings.push({
      code: cardContext.position === "GK" ? "gk_has_outfield_stats" : "outfield_has_gk_stats",
      message: `Position ${cardContext.position} received ${stats.profile} stats.`,
      severity: "FAIL"
    });
  }

  const awardFloor = awardFloorForAwards(cardContext.awards);
  if (awardFloor !== null && overall < awardFloor) {
    warnings.push({
      code: "award_winner_below_floor",
      message: `Award winner below configured floor ${awardFloor}.`,
      severity: "FAIL"
    });
  }

  if ((cardContext.appearances ?? 0) <= 0 && overall >= 91 && primarySource !== "MANUAL_CURATED") {
    warnings.push({
      code: "non_appearing_squad_player_hero_icon",
      message: "Non-appearing squad player reached Hero/Icon without manual curation.",
      severity: "FAIL"
    });
  }

  if (sevenAZero && Math.abs(overall - sevenAZero.rating) >= 8) {
    warnings.push({
      code: "seven_a_zero_delta_gt_8",
      message: `Rating differs from local 7a0 comparison by ${Math.abs(overall - sevenAZero.rating)}.`,
      severity: "WARN"
    });
  }

  const warningCodes = warnings.map((warning) => warning.code);
  const comparisonReferences = sevenAZero
    ? [
        {
          sourceKey: "SEVEN_A_ZERO_MANUAL" as const,
          comparisonOnly: true as const,
          sourceWeight: 0 as const,
          canAffectRating: false as const,
          referenceOverall: sevenAZero.rating,
          delta: overall - sevenAZero.rating,
          reason: "Local 7a0 JSON comparison only; not applied by default."
        }
      ]
    : [];
  const breakdown = {
    formulaVersion: config.version,
    selectedDistributionStrategy: config.ratingDistribution.selectedStrategy,
    rawEvidenceOverall: overall,
    selectedOverall: overall,
    seasonAbilityBaseline: null,
    seasonAbilitySource: null,
    seasonAbilityConfidence: "NONE" as const,
    multiSeasonAbility: null,
    worldCupPerformanceRating: generatedOverall,
    worldCupPerformanceSource: "FJELSTUL_WORLD_CUP" as const,
    worldCupPerformanceConfidence: generated.confidence,
    contextAdjustment: overall - generatedOverall,
    leagueStrengthAdjustment: 0,
    clubStrengthAdjustment: 0,
    ageCurveAdjustment: 0,
    trendAdjustment: 0,
    awardAdjustment: generated.reasons.some((reason) => reason.includes("award")) ? overall - generatedOverall : 0,
    manualAnchorAdjustment: primarySource === "MANUAL_CURATED" ? overall - generatedOverall : 0,
    capsApplied: generated.reasons.filter((reason) => reason.includes("cap")),
    bonusesApplied: generated.reasons.filter((reason) => !reason.includes("cap")),
    warningsApplied: warningCodes,
    finalOverallBeforeCaps: generatedOverall,
    finalOverall: overall,
    individualStatsSource: externalStats ? primarySource === "EA_HISTORICAL" ? "EA_HISTORICAL" as const : "TRANSFERMARKT" as const : "GENERATED" as const,
    individualStatsConfidence: confidence,
    evidence: sortEvidence(evidence),
    comparisonReferences,
    warnings: warningCodes
  };

  return {
    overall,
    stats,
    estimatedOverallFromStats,
    overallStatDelta,
    tier,
    primarySource,
    confidence,
    evidence: breakdown.evidence,
    warnings,
    reasons,
    breakdown
  };
}

function findManual(
  cardContext: FjelstulCardContext,
  records: NonNullable<RatingSourcesInput["manualCurated"]>
): NonNullable<RatingSourcesInput["manualCurated"]>[number] | undefined {
  const name = normalizeName(cardContext.internalRawName);
  const matches = records
    .filter(
      (record) =>
        (record.worldCupYear === undefined || record.worldCupYear === cardContext.worldCupYear) &&
        (record.nationCode === undefined || nationMatches(cardContext.nation, record.nationCode))
    )
    .map((record) => ({
      record,
      score: Math.max(...[record.nameSearch, ...(record.aliases ?? [])].map((term) => manualTermScore(name, normalizeName(term))))
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || right.record.floor - left.record.floor);

  const [best, second] = matches;
  if (!best) return undefined;
  if (second && best.score === second.score && best.record.floor < second.record.floor) return second.record;
  return best.record;
}

function manualTermScore(name: string, term: string): number {
  if (name === term) return 4;
  if (name.endsWith(` ${term}`) || name.startsWith(`${term} `)) return 3;
  if (name.includes(term)) return 2;
  return 0;
}

function findExternal(cardContext: FjelstulCardContext, records: readonly ExternalRatingRecord[]): ExternalRatingRecord | undefined {
  const name = normalizeName(cardContext.internalRawName);
  const nation = normalizeName(cardContext.nation);
  return records.find(
    (record) =>
      name.includes(record.normalizedName) &&
      (record.worldCupYear === undefined || record.worldCupYear === cardContext.worldCupYear) &&
      (record.nation === undefined || normalizeName(record.nation) === nation)
  );
}

function findSevenAZeroComparison(
  card: { internalRawName: string; nation: string; worldCupYear: number },
  comparisons: NonNullable<RatingSourcesInput["sevenAZeroComparison"]>
) {
  const normalizedName = normalizeName(card.internalRawName);
  const nation = normalizeName(card.nation);
  return comparisons.find(
    (comparison) =>
      comparison.worldCupYear === card.worldCupYear &&
      normalizeName(comparison.nation) === nation &&
      (normalizedName === comparison.normalizedName ||
        normalizedName.includes(comparison.normalizedName) ||
        comparison.normalizedName.includes(normalizedName))
  );
}

function sortEvidence(evidence: readonly RatingEvidence[]): RatingEvidence[] {
  return [...evidence].sort((left, right) => priorityIndex(left.source) - priorityIndex(right.source));
}

function priorityIndex(source: RatingEvidence["source"]): number {
  const index = SOURCE_PRIORITY.indexOf(source as (typeof SOURCE_PRIORITY)[number]);
  return index === -1 ? SOURCE_PRIORITY.length : index;
}

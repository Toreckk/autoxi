import type { FjelstulCardContext } from "../../domain/types.js";
import type { RatingFormulaConfig } from "../../domain/rating/ratingFormulaConfig.js";
import { prePhase1BCalibrationConfig } from "../../domain/rating/ratingFormulaPresets.js";
import { clamp } from "../../utils.js";
import { resolveTransfermarktSeasonBaseline, availabilityScore } from "./transfermarktSeasonBaseline.js";
import type {
  TransfermarktMatchCandidate,
  TransfermarktMultiSeasonBaseline,
  TransfermarktPlayerSeason,
  TransfermarktRatingResult
} from "./transfermarktTypes.js";

export function resolveTransfermarktMultiSeasonBaseline(scoresByOffset: {
  sameSeasonScore?: number | null;
  previousSeasonScore?: number | null;
  twoSeasonsBackScore?: number | null;
  threeSeasonsBackScore?: number | null;
}, config: RatingFormulaConfig = prePhase1BCalibrationConfig): TransfermarktMultiSeasonBaseline {
  const same = scoresByOffset.sameSeasonScore ?? null;
  const previous = scoresByOffset.previousSeasonScore ?? null;
  const twoBack = scoresByOffset.twoSeasonsBackScore ?? null;
  const threeBack = scoresByOffset.threeSeasonsBackScore ?? null;
  const weights = config.transfermarkt.seasonWindow.weights;
  const weighted = weightedAverage([
    [same, weights.worldCupYear],
    [previous, weights.previous],
    [twoBack, weights.twoBack],
    [threeBack, weights.oldest]
  ]);
  const trend = trendFromScores([threeBack, twoBack, previous, same]);
  return {
    sameSeasonScore: same,
    previousSeasonScore: previous,
    twoSeasonsBackScore: twoBack,
    threeSeasonsBackScore: threeBack,
    weightedMultiSeasonScore: weighted,
    marketValueTrend: trend,
    productionTrend: "UNKNOWN",
    minutesTrend: "UNKNOWN",
    trendAdjustment: trend === "RISING" ? 1 : trend === "DECLINING" ? -1 : 0
  };
}

export function worldCupCycleYears(worldCupYear: number): [number, number, number, number] {
  return [worldCupYear - 3, worldCupYear - 2, worldCupYear - 1, worldCupYear];
}

export function resolveTransfermarktRating({
  context,
  candidate,
  records,
  config = prePhase1BCalibrationConfig
}: {
  context: FjelstulCardContext;
  candidate: TransfermarktMatchCandidate;
  records: readonly TransfermarktPlayerSeason[];
  config?: RatingFormulaConfig;
}): TransfermarktRatingResult | null {
  const [oldestYear, twoBackYear, previousYear, worldCupYear] = worldCupCycleYears(context.worldCupYear);
  const years = [oldestYear, twoBackYear, previousYear, worldCupYear] as const;
  const expectedYears = years.filter((year) => isSeasonExpected(context, candidate.record, year, config));
  const playerRecords = records.filter(
    (record) => record.playerId === candidate.record.playerId && years.includes(record.seasonYear)
  );
  const scoreByYear = new Map<number, number>();
  const availabilityScores: number[] = [];
  const warnings: string[] = [];

  for (const year of years) {
    const record = playerRecords.find((item) => item.seasonYear === year);
    if (!record) continue;
    const peerGroup = records.filter((item) => item.seasonYear === year);
    const baseline = resolveTransfermarktSeasonBaseline(record, peerGroup.length > 0 ? peerGroup : records, config);
    scoreByYear.set(year, baseline.score);
    const availability = availabilityScore(record, config);
    if (availability !== null) availabilityScores.push(availability);
    if (availability !== null && availability < 0.5) warnings.push(`low_availability:${year}`);
  }

  const availableExpectedYears = expectedYears.filter((year) => scoreByYear.has(year));
  const coverage = expectedYears.length === 0 ? 0 : availableExpectedYears.length / expectedYears.length;
  if (availableExpectedYears.length === 0) return null;

  const multiSeason = resolveTransfermarktMultiSeasonBaseline(
    {
      sameSeasonScore: scoreByYear.get(worldCupYear) ?? null,
      previousSeasonScore: scoreByYear.get(previousYear) ?? null,
      twoSeasonsBackScore: scoreByYear.get(twoBackYear) ?? null,
      threeSeasonsBackScore: scoreByYear.get(oldestYear) ?? null
    },
    config
  );
  const weighted = multiSeason.weightedMultiSeasonScore;
  if (weighted === null) return null;

  const missingExpected = expectedYears.length - availableExpectedYears.length;
  if (missingExpected > 0 && ageAtSeason(context, candidate.record, context.worldCupYear) >= config.missingSeasonRules.establishedPlayerAgeMin) {
    warnings.push(`missing_expected_seasons:${missingExpected}`);
  }
  const averageAvailability = availabilityScores.length === 0 ? 1 : availabilityScores.reduce((sum, value) => sum + value, 0) / availabilityScores.length;
  const confidence =
    candidate.confidence !== "HIGH" || coverage < 0.5 || averageAvailability < 0.5 || missingExpected >= 2
      ? coverage >= 0.25
        ? "MEDIUM"
        : "LOW"
      : "HIGH";
  const rating = clamp(Math.round(weighted + multiSeason.trendAdjustment), 55, 99);
  const latestRecord = playerRecords.find((record) => record.seasonYear === worldCupYear) ?? playerRecords[playerRecords.length - 1]!;
  const latestBaseline = resolveTransfermarktSeasonBaseline(latestRecord, records.filter((record) => record.seasonYear === latestRecord.seasonYear), config);
  const signalMap = {
    marketValuePercentile: latestBaseline.marketValuePercentile,
    appearanceVolume: latestBaseline.appearancePercentile,
    goalContribution: latestBaseline.productionPercentile,
    assistContribution: latestBaseline.productionPercentile,
    starterShare: starterShareScoreFor(latestRecord),
    leagueStrength: 0.5,
    clubStrength: 0.5,
    ageCurve: 0.5,
    cardsDiscipline: cardsDisciplineScoreFor(latestRecord)
  };
  const signalsAvailable = Object.entries(signalMap)
    .filter(([, value]) => value !== null)
    .map(([key]) => key);
  const signalsMissing = Object.entries(signalMap)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  const hasRequiredSignals = config.transfermarkt.requiredSignalsForHighConfidenceRating.every((signal) =>
    signalsAvailable.includes(signal)
  );
  const hasEnoughSignals = signalsAvailable.length >= config.transfermarkt.minimumSignalsForHighConfidenceRating;
  const ratingConfidence = confidence === "HIGH" && hasRequiredSignals && hasEnoughSignals ? "HIGH" : confidence === "LOW" ? "LOW" : "MEDIUM";

  return {
    rating,
    confidence: ratingConfidence,
    coverage: Number(coverage.toFixed(4)),
    matchConfidence: candidate.confidence,
    multiSeason,
    signals: {
      transfermarktPlayerId: candidate.record.playerId,
      marketValuePercentile: latestBaseline.marketValuePercentile ?? undefined,
      appearanceVolumeScore: latestBaseline.appearancePercentile ?? undefined,
      goalContributionScore: latestBaseline.productionPercentile ?? undefined,
      assistContributionScore: latestBaseline.productionPercentile ?? undefined,
      starterShareScore: signalMap.starterShare ?? undefined,
      leagueStrengthScore: 0.5,
      clubStrengthScore: 0.5,
      ageCurveScore: 0.5,
      cardsDisciplineScore: signalMap.cardsDiscipline ?? undefined,
      signalsAvailable: signalsAvailable.join("|"),
      signalsMissing: signalsMissing.join("|")
    },
    reasons: [
      `transfermarkt_cycle:${years.join("|")}`,
      `eligible_years:${expectedYears.join("|")}`,
      `available_years:${availableExpectedYears.join("|")}`,
      `rating_confidence:${ratingConfidence}`,
      hasRequiredSignals ? "required_signals_present" : "insufficient_rating_signals"
    ],
    warnings: hasRequiredSignals && hasEnoughSignals ? warnings : [...warnings, "insufficient_rating_signals"]
  };
}

function weightedAverage(values: readonly (readonly [number | null, number])[]): number | null {
  const available = values.filter((entry): entry is readonly [number, number] => entry[0] !== null);
  const weight = available.reduce((sum, [, itemWeight]) => sum + itemWeight, 0);
  if (weight === 0) return null;
  return Number((available.reduce((sum, [value, itemWeight]) => sum + value * itemWeight, 0) / weight).toFixed(2));
}

function isSeasonExpected(
  context: FjelstulCardContext,
  record: TransfermarktPlayerSeason,
  seasonYear: number,
  config: RatingFormulaConfig
): boolean {
  if (!config.missingSeasonRules.underAgeSeasonIsNotExpected) return true;
  return ageAtSeason(context, record, seasonYear) >= config.missingSeasonRules.underAgeCutoff;
}

function ageAtSeason(context: FjelstulCardContext, record: TransfermarktPlayerSeason, seasonYear: number): number {
  const birthYear = record.birthYear ?? context.birthYear;
  return birthYear ? seasonYear - birthYear : 99;
}

function trendFromScores(oldestToNewest: readonly (number | null)[]): "RISING" | "STABLE" | "DECLINING" | "UNKNOWN" {
  const values = oldestToNewest.filter((value): value is number => value !== null);
  if (values.length < 2) return "UNKNOWN";
  const delta = values[values.length - 1]! - values[0]!;
  if (delta >= 3) return "RISING";
  if (delta <= -3) return "DECLINING";
  return "STABLE";
}

function starterShareScoreFor(record: TransfermarktPlayerSeason): number | null {
  const starts = record.starterCount ?? 0;
  const bench = record.benchCount ?? 0;
  const total = starts + bench;
  return total > 0 ? clamp(starts / total, 0, 1) : null;
}

function cardsDisciplineScoreFor(record: TransfermarktPlayerSeason): number | null {
  const yellowCards = record.yellowCards ?? 0;
  const redCards = record.redCards ?? 0;
  if (yellowCards === 0 && redCards === 0 && record.appearances === null) return null;
  const appearances = Math.max(record.appearances ?? 1, 1);
  return 1 - clamp((yellowCards * 0.03 + redCards * 0.18) / appearances, 0, 0.35);
}

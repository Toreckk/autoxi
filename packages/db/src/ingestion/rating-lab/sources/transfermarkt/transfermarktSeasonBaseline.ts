import type { TransfermarktPlayerSeason, TransfermarktSeasonBaseline } from "./transfermarktTypes.js";
import type { RatingFormulaConfig } from "../../domain/rating/ratingFormulaConfig.js";
import { prePhase1BCalibrationConfig } from "../../domain/rating/ratingFormulaPresets.js";
import { clamp } from "../../utils.js";

export function resolveTransfermarktSeasonBaseline(
  record: TransfermarktPlayerSeason,
  peerGroup: readonly TransfermarktPlayerSeason[],
  config: RatingFormulaConfig = prePhase1BCalibrationConfig
): TransfermarktSeasonBaseline {
  const marketValuePercentile = percentileRank(record.marketValueEur, peerGroup.map((peer) => peer.marketValueEur));
  const appearanceVolumeScore = availabilityScore(record, config);
  const goalContributionScore = percentileRank(record.goals, peerGroup.map((peer) => peer.goals));
  const assistContributionScore = percentileRank(record.assists, peerGroup.map((peer) => peer.assists));
  const starterShareScore = starterShareScoreFor(record);
  const leagueStrengthScore = 0.5;
  const clubStrengthScore = 0.5;
  const ageCurveScore = ageCurveScoreFor(record);
  const cardsDisciplineScore = cardsDisciplineScoreFor(record);
  const availableSignalCount = [
    marketValuePercentile,
    appearanceVolumeScore,
    goalContributionScore,
    assistContributionScore,
    starterShareScore,
    leagueStrengthScore,
    clubStrengthScore,
    ageCurveScore,
    cardsDisciplineScore
  ].filter((value): value is number => value !== null).length;
  const weights = config.transfermarkt.annualSignalWeights;
  const weighted = weightedSignalAverage(
    [
      ["marketValuePercentile", marketValuePercentile, weights.marketValuePercentile],
      ["appearanceVolume", appearanceVolumeScore, weights.appearanceVolume],
      ["goalContribution", goalContributionScore, weights.goalContribution],
      ["assistContribution", assistContributionScore, weights.assistContribution],
      ["starterShare", starterShareScore, weights.starterShare],
      ["leagueStrength", leagueStrengthScore, weights.leagueStrength],
      ["clubStrength", clubStrengthScore, weights.clubStrength],
      ["ageCurve", ageCurveScore, weights.ageCurve],
      ["cardsDiscipline", cardsDisciplineScore, weights.cardsDiscipline]
    ],
    config.transfermarkt.normalizeAnnualWeightsOverAvailableSignals
  );
  const availabilityPenalty =
    config.availabilityRules.enabled &&
    config.availabilityRules.lowAvailabilityAffects === "seasonScoreAndConfidence" &&
    appearanceVolumeScore !== null
      ? (1 - appearanceVolumeScore) * config.availabilityRules.lowMinutesScorePenaltyMax
      : 0;
  const score = Math.round(55 + clamp(weighted - availabilityPenalty, 0, 1) * 44);

  return {
    score,
    confidence: marketValuePercentile !== null && appearanceVolumeScore !== null ? "HIGH" : availableSignalCount >= 2 ? "MEDIUM" : "LOW",
    marketValuePercentile,
    appearancePercentile: appearanceVolumeScore,
    productionPercentile: nullableAverage(goalContributionScore, assistContributionScore),
    reason: "Transfermarkt percentile baseline; never raw market value as rating."
  };
}

function weightedSignalAverage(
  signals: readonly (readonly [string, number | null, number])[],
  normalizeWeightsOverAvailableSignals: boolean
): number {
  const available = signals.filter((signal): signal is readonly [string, number, number] => signal[1] !== null);
  if (available.length === 0) return 0.35;
  if (!normalizeWeightsOverAvailableSignals) {
    const fallback = average(available.map(([, value]) => value));
    return signals.reduce((sum, [, value, weight]) => sum + (value ?? fallback) * weight, 0);
  }
  const totalWeight = available.reduce((sum, [, , weight]) => sum + weight, 0);
  if (totalWeight === 0) return average(available.map(([, value]) => value));
  return available.reduce((sum, [, value, weight]) => sum + value * (weight / totalWeight), 0);
}

function percentileRank(value: number | null, values: readonly (number | null)[]): number | null {
  if (value === null) return null;
  const clean = values.filter((candidate): candidate is number => candidate !== null).sort((left, right) => left - right);
  if (clean.length === 0) return null;
  const belowOrEqual = clean.filter((candidate) => candidate <= value).length;
  return Number((belowOrEqual / clean.length).toFixed(4));
}

function nullableSum(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function nullableAverage(left: number | null, right: number | null): number | null {
  const values = [left, right].filter((value): value is number => value !== null);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0.35 : values.reduce((sum, value) => sum + value, 0) / values.length;
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
  const penalty = clamp((yellowCards * 0.03 + redCards * 0.18) / appearances, 0, 0.35);
  return 1 - penalty;
}

export function availabilityScore(record: TransfermarktPlayerSeason, config: RatingFormulaConfig): number | null {
  if (config.availabilityRules.useMinutesPlayed && record.minutes !== null) {
    return clamp(record.minutes / config.availabilityRules.minimumStrongSeasonMinutes, 0, 1);
  }
  if (config.availabilityRules.useAppearancesWhenMinutesMissing && record.appearances !== null) {
    return clamp(record.appearances / 25, 0, 1);
  }
  return null;
}

function ageCurveScoreFor(record: TransfermarktPlayerSeason): number {
  if (!record.birthYear) return 0.5;
  const age = record.seasonYear - record.birthYear;
  if (age < 18) return 0.55;
  if (age <= 24) return 0.78;
  if (age <= 29) return 0.9;
  if (age <= 33) return 0.72;
  return 0.5;
}

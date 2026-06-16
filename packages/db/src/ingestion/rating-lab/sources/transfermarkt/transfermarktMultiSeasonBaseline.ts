import type { TransfermarktMultiSeasonBaseline } from "./transfermarktTypes.js";

export function resolveTransfermarktMultiSeasonBaseline(scoresByOffset: {
  sameSeasonScore?: number | null;
  previousSeasonScore?: number | null;
  twoSeasonsBackScore?: number | null;
  threeSeasonsBackScore?: number | null;
}): TransfermarktMultiSeasonBaseline {
  const same = scoresByOffset.sameSeasonScore ?? null;
  const previous = scoresByOffset.previousSeasonScore ?? null;
  const twoBack = scoresByOffset.twoSeasonsBackScore ?? null;
  const threeBack = scoresByOffset.threeSeasonsBackScore ?? null;
  const weighted = weightedAverage([
    [same, 0.55],
    [previous, 0.25],
    [twoBack, 0.13],
    [threeBack, 0.07]
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

function weightedAverage(values: readonly (readonly [number | null, number])[]): number | null {
  const available = values.filter((entry): entry is readonly [number, number] => entry[0] !== null);
  const weight = available.reduce((sum, [, itemWeight]) => sum + itemWeight, 0);
  if (weight === 0) return null;
  return Number((available.reduce((sum, [value, itemWeight]) => sum + value * itemWeight, 0) / weight).toFixed(2));
}

function trendFromScores(oldestToNewest: readonly (number | null)[]): "RISING" | "STABLE" | "DECLINING" | "UNKNOWN" {
  const values = oldestToNewest.filter((value): value is number => value !== null);
  if (values.length < 2) return "UNKNOWN";
  const delta = values[values.length - 1]! - values[0]!;
  if (delta >= 3) return "RISING";
  if (delta <= -3) return "DECLINING";
  return "STABLE";
}

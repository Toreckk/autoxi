import type { TransfermarktPlayerSeason, TransfermarktSeasonBaseline } from "./transfermarktTypes.js";

export function resolveTransfermarktSeasonBaseline(
  record: TransfermarktPlayerSeason,
  peerGroup: readonly TransfermarktPlayerSeason[]
): TransfermarktSeasonBaseline {
  const marketValuePercentile = percentileRank(record.marketValueEur, peerGroup.map((peer) => peer.marketValueEur));
  const appearancePercentile = percentileRank(record.appearances, peerGroup.map((peer) => peer.appearances));
  const production = nullableSum(record.goals, record.assists);
  const productionPercentile = percentileRank(production, peerGroup.map((peer) => nullableSum(peer.goals, peer.assists)));
  const available = [marketValuePercentile, appearancePercentile, productionPercentile].filter(
    (value): value is number => value !== null
  );
  const weighted =
    (marketValuePercentile ?? average(available)) * 0.58 +
    (appearancePercentile ?? average(available)) * 0.22 +
    (productionPercentile ?? average(available)) * 0.2;
  const score = Math.round(55 + weighted * 44);

  return {
    score,
    confidence: marketValuePercentile !== null && appearancePercentile !== null ? "HIGH" : available.length >= 2 ? "MEDIUM" : "LOW",
    marketValuePercentile,
    appearancePercentile,
    productionPercentile,
    reason: "Transfermarkt percentile baseline; never raw market value as rating."
  };
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

function average(values: readonly number[]): number {
  return values.length === 0 ? 0.35 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

import type { BenchmarkStatus, RatingLabCardSnapshot, RatingLabSummary } from "./types.js";

export type RatingLabReportDiff = {
  baselineGeneratedAt: string;
  currentGeneratedAt: string;
  gateStatusChange: { baseline: string; current: string };
  coverageChange: { baselineCardsResolvedPct: number; currentCardsResolvedPct: number };
  ratingChanges: Array<{ key: string; name: string; baseline: number; current: number; delta: number }>;
  tierChanges: Array<{ key: string; name: string; baseline: string; current: string }>;
  benchmarkStatusChanges: Array<{ id: string; baseline: BenchmarkStatus; current: BenchmarkStatus }>;
  sevenAZeroManualDeltaChange: { baseline: number | null; current: number | null };
  newAnomalies: string[];
  resolvedAnomalies: string[];
  sourceProvenanceChanges: Array<{ key: string; name: string; baseline: string; current: string }>;
};

export function compareRatingLabReports(baseline: RatingLabSummary, current: RatingLabSummary): RatingLabReportDiff {
  const baselineCards = new Map((baseline.cardSnapshots ?? []).map((card) => [card.key, card]));
  const currentCards = new Map((current.cardSnapshots ?? []).map((card) => [card.key, card]));
  const sharedKeys = [...currentCards.keys()].filter((key) => baselineCards.has(key));

  return {
    baselineGeneratedAt: baseline.generatedAt,
    currentGeneratedAt: current.generatedAt,
    gateStatusChange: { baseline: baseline.confidenceGateStatus, current: current.confidenceGateStatus },
    coverageChange: {
      baselineCardsResolvedPct: resolvedPct(baseline),
      currentCardsResolvedPct: resolvedPct(current)
    },
    ratingChanges: sharedKeys
      .map((key) => ratingChange(key, baselineCards.get(key)!, currentCards.get(key)!))
      .filter((change): change is NonNullable<typeof change> => change !== null),
    tierChanges: sharedKeys
      .map((key) => tierChange(key, baselineCards.get(key)!, currentCards.get(key)!))
      .filter((change): change is NonNullable<typeof change> => change !== null),
    benchmarkStatusChanges: benchmarkChanges(baseline, current),
    sevenAZeroManualDeltaChange: {
      baseline: baseline.sevenAZeroManualAverageAbsoluteDelta,
      current: current.sevenAZeroManualAverageAbsoluteDelta
    },
    newAnomalies: anomalyKeys(current).filter((key) => !anomalyKeys(baseline).includes(key)),
    resolvedAnomalies: anomalyKeys(baseline).filter((key) => !anomalyKeys(current).includes(key)),
    sourceProvenanceChanges: sharedKeys
      .map((key) => sourceChange(key, baselineCards.get(key)!, currentCards.get(key)!))
      .filter((change): change is NonNullable<typeof change> => change !== null)
  };
}

function ratingChange(key: string, baseline: RatingLabCardSnapshot, current: RatingLabCardSnapshot) {
  if (baseline.overall === current.overall) return null;
  return {
    key,
    name: current.internalRawName,
    baseline: baseline.overall,
    current: current.overall,
    delta: current.overall - baseline.overall
  };
}

function tierChange(key: string, baseline: RatingLabCardSnapshot, current: RatingLabCardSnapshot) {
  if (baseline.tier === current.tier) return null;
  return { key, name: current.internalRawName, baseline: baseline.tier, current: current.tier };
}

function sourceChange(key: string, baseline: RatingLabCardSnapshot, current: RatingLabCardSnapshot) {
  if (baseline.primarySource === current.primarySource && baseline.confidence === current.confidence) return null;
  return {
    key,
    name: current.internalRawName,
    baseline: `${baseline.primarySource}/${baseline.confidence}`,
    current: `${current.primarySource}/${current.confidence}`
  };
}

function benchmarkChanges(baseline: RatingLabSummary, current: RatingLabSummary) {
  const baselineBenchmarks = new Map(baseline.benchmarks.map((benchmark) => [benchmark.id, benchmark.status]));
  return current.benchmarks
    .map((benchmark) => {
      const baselineStatus = baselineBenchmarks.get(benchmark.id);
      if (!baselineStatus || baselineStatus === benchmark.status) return null;
      return { id: benchmark.id, baseline: baselineStatus, current: benchmark.status };
    })
    .filter((change): change is { id: string; baseline: BenchmarkStatus; current: BenchmarkStatus } => change !== null);
}

function anomalyKeys(summary: RatingLabSummary): string[] {
  return summary.anomalyDetails.map(
    (anomaly) => `${anomaly.code}:${anomaly.internalRawName}:${anomaly.worldCupYear}:${anomaly.nation}`
  );
}

function resolvedPct(summary: RatingLabSummary): number {
  return summary.totalCardsSampled === 0 ? 0 : Number(((summary.cardsResolved / summary.totalCardsSampled) * 100).toFixed(2));
}

export const PRE_PHASE_1B_GATES = {
  maxBenchmarkFails: 0,
  maxBenchmarkWarns: 5,
  maxSevenAZeroAverageDelta: 5,
  maxSevenAZeroP90Delta: 9,
  maxGeneratedOnlyTop3PerTournament: 0,
  maxOverallStatDeltaP90: 4,
  maxUnknownHighRating: 0,
  minCardsResolvedPct: 100,
  minAwardWinnerFloorPct: 100,
  maxHardFailures: 0
} as const;

export type RatingGateConfig = typeof PRE_PHASE_1B_GATES;

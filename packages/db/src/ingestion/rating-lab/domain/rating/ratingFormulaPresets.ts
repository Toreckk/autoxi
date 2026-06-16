import type { RatingFormulaConfig } from "./ratingFormulaConfig.js";

const baseIndividualStatWeights = {
  outfield: {
    pace: { overall: 0.6, ageCurve: 0.2, positionArchetype: 0.2 },
    shooting: { overall: 0.55, goals: 0.35, positionArchetype: 0.1 },
    passing: { overall: 0.55, assists: 0.25, role: 0.2 },
    dribbling: { overall: 0.65, role: 0.2, ageCurve: 0.15 },
    defending: { overall: 0.55, positionArchetype: 0.35, cardsPenalty: -0.1 },
    physical: { overall: 0.6, minutes: 0.2, ageCurve: 0.2 }
  },
  goalkeeper: {
    diving: { overall: 0.75, role: 0.25 },
    handling: { overall: 0.75, role: 0.25 },
    kicking: { overall: 0.65, role: 0.35 },
    reflexes: { overall: 0.8, role: 0.2 },
    speed: { overall: 0.45, ageCurve: 0.35, role: 0.2 },
    positioning: { overall: 0.8, experience: 0.2 }
  }
} as const;

export const prePhase1BCalibrationConfig = {
  version: "pre-phase-1b-raw-evidence-v1",
  sourcePriority: {
    seasonAbility: ["MANUAL_ANCHORS", "TRANSFERMARKT", "EA_HISTORICAL"],
    worldCupPerformance: ["FJELSTUL_WORLD_CUP", "STATSBOMB"],
    individualStats: ["EA_HISTORICAL", "TRANSFERMARKT", "FJELSTUL_WORLD_CUP"],
    comparisonOnly: ["SEVEN_A_ZERO_MANUAL"]
  },
  finalOverallWeights: {
    highConfidenceSeasonData: { seasonAbility: 0.65, worldCupPerformance: 0.25, context: 0.1 },
    historicalPartialData: { seasonAbility: 0.55, worldCupPerformance: 0.3, context: 0.15 },
    worldCupOnlyFallback: { generatedBaseline: 0.45, worldCupPerformance: 0.4, context: 0.15 }
  },
  seasonWindow: {
    enabled: true,
    seasonsBack: 3,
    sameSeasonWeight: 0.55,
    previousSeasonWeight: 0.25,
    twoSeasonsBackWeight: 0.13,
    threeSeasonsBackWeight: 0.07,
    trendAdjustmentMaxBonus: 2,
    trendAdjustmentMaxPenalty: -3,
    lowMinutesConfidencePenalty: 1,
    decliningTrendCapPenalty: 2,
    risingTrendConfidenceBonus: 1
  },
  seasonAbilityWeights: {
    transfermarkt: {
      marketValuePercentile: 0.45,
      appearanceVolume: 0.16,
      goalContribution: 0.13,
      assistContribution: 0.08,
      clubStrength: 0.06,
      leagueStrength: 0.06,
      ageCurve: 0.03,
      transferSignal: 0.01,
      multiSeasonConsistency: 0.01,
      trendDirection: 0.01
    },
    eaHistorical: { overall: 0.8, stats: 0.2 },
    manualAnchor: { floorWeight: 1, capWeight: 1 }
  },
  worldCupPerformanceWeights: {
    appearances: 0.16,
    starts: 0.1,
    minutes: 0.16,
    goals: 0.2,
    assists: 0.08,
    cleanSheetsOrKeeperSignal: 0.08,
    cardsPenalty: -0.04,
    teamFinish: 0.16,
    awards: 0.14
  },
  individualStatWeights: baseIndividualStatWeights,
  caps: {
    noSignalGeneratedMax: 78,
    limitedSignalGeneratedMax: 84,
    generatedOnlyNoStrongSignalMax: 88,
    highRatingRequiresStrongSignalMin: 90,
    eliteRatingRequiresExceptionalSignalMin: 95,
    generatedGoldenBallMax: 97,
    generatedGoldenBootMax: 94,
    generatedGoldenGloveMax: 93,
    generatedBestYoungPlayerMax: 90
  },
  adjustments: {
    leagueStrengthMaxBonus: 2,
    leagueStrengthMaxPenalty: -2,
    clubStrengthMaxBonus: 2,
    clubStrengthMaxPenalty: -2,
    ageCurveMaxBonus: 2,
    ageCurveMaxPenalty: -3,
    awardMaxBonus: 8,
    manualAnchorMaxBonus: 12
  },
  ratingDistribution: {
    selectedStrategy: "RAW_EVIDENCE",
    strategiesToReport: ["RAW_EVIDENCE"],
    diagnostics: {
      enabled: true,
      eliteRatingMin: 90,
      buckets: [99, 98, 97, 96, 95, 94, 93, 92, 91, 90],
      warnOnly: true
    }
  },
  comparisonOnlySources: {
    sevenAZeroManual: {
      enabled: true,
      affectsRating: false,
      defaultTolerance: 4,
      warningDelta: 8
    }
  }
} as const satisfies RatingFormulaConfig;

export const conservativeHistoricalConfig = {
  ...prePhase1BCalibrationConfig,
  version: "conservative-historical-v1",
  caps: {
    ...prePhase1BCalibrationConfig.caps,
    generatedOnlyNoStrongSignalMax: 86,
    generatedGoldenBootMax: 93
  }
} as const satisfies RatingFormulaConfig;

export const modernDataHeavyConfig = {
  ...prePhase1BCalibrationConfig,
  version: "modern-data-heavy-v1",
  finalOverallWeights: {
    ...prePhase1BCalibrationConfig.finalOverallWeights,
    highConfidenceSeasonData: { seasonAbility: 0.72, worldCupPerformance: 0.2, context: 0.08 }
  }
} as const satisfies RatingFormulaConfig;

export const ratingFormulaPresets = {
  "pre-phase-1b-calibration": prePhase1BCalibrationConfig,
  "conservative-historical": conservativeHistoricalConfig,
  "modern-data-heavy": modernDataHeavyConfig
} as const;

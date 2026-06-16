import type { RatingDistributionStrategy, RatingSourceKey } from "../types.js";

export type RatingFormulaConfig = {
  version: string;
  sourcePriority: {
    seasonAbility: readonly RatingSourceKey[];
    worldCupPerformance: readonly RatingSourceKey[];
    individualStats: readonly RatingSourceKey[];
    comparisonOnly: readonly RatingSourceKey[];
  };
  finalOverallWeights: {
    highConfidenceSeasonData: { seasonAbility: number; worldCupPerformance: number; context: number };
    historicalPartialData: { seasonAbility: number; worldCupPerformance: number; context: number };
    worldCupOnlyFallback: { generatedBaseline: number; worldCupPerformance: number; context: number };
  };
  seasonWindow: {
    enabled: boolean;
    seasonsBack: number;
    sameSeasonWeight: number;
    previousSeasonWeight: number;
    twoSeasonsBackWeight: number;
    threeSeasonsBackWeight: number;
    trendAdjustmentMaxBonus: number;
    trendAdjustmentMaxPenalty: number;
    lowMinutesConfidencePenalty: number;
    decliningTrendCapPenalty: number;
    risingTrendConfidenceBonus: number;
  };
  seasonAbilityWeights: {
    transfermarkt: {
      marketValuePercentile: number;
      appearanceVolume: number;
      goalContribution: number;
      assistContribution: number;
      clubStrength: number;
      leagueStrength: number;
      ageCurve: number;
      transferSignal: number;
      multiSeasonConsistency: number;
      trendDirection: number;
    };
    eaHistorical: { overall: number; stats: number };
    manualAnchor: { floorWeight: number; capWeight: number };
  };
  worldCupPerformanceWeights: {
    appearances: number;
    starts: number;
    minutes: number;
    goals: number;
    assists: number;
    cleanSheetsOrKeeperSignal: number;
    cardsPenalty: number;
    teamFinish: number;
    awards: number;
  };
  individualStatWeights: {
    outfield: Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", Record<string, number>>;
    goalkeeper: Record<"diving" | "handling" | "kicking" | "reflexes" | "speed" | "positioning", Record<string, number>>;
  };
  caps: {
    noSignalGeneratedMax: number;
    limitedSignalGeneratedMax: number;
    generatedOnlyNoStrongSignalMax: number;
    highRatingRequiresStrongSignalMin: number;
    eliteRatingRequiresExceptionalSignalMin: number;
    generatedGoldenBallMax: number;
    generatedGoldenBootMax: number;
    generatedGoldenGloveMax: number;
    generatedBestYoungPlayerMax: number;
  };
  adjustments: {
    leagueStrengthMaxBonus: number;
    leagueStrengthMaxPenalty: number;
    clubStrengthMaxBonus: number;
    clubStrengthMaxPenalty: number;
    ageCurveMaxBonus: number;
    ageCurveMaxPenalty: number;
    awardMaxBonus: number;
    manualAnchorMaxBonus: number;
  };
  ratingDistribution: {
    selectedStrategy: RatingDistributionStrategy;
    strategiesToReport: readonly RatingDistributionStrategy[];
    diagnostics: {
      enabled: boolean;
      eliteRatingMin: number;
      buckets: readonly number[];
      warnOnly: boolean;
    };
  };
  comparisonOnlySources: {
    sevenAZeroManual: {
      enabled: boolean;
      affectsRating: false;
      defaultTolerance: number;
      warningDelta: number;
    };
  };
};

export type RatingFormulaPresetKey = "pre-phase-1b-calibration" | "conservative-historical" | "modern-data-heavy";

export async function loadRatingFormulaPreset(presetKey: RatingFormulaPresetKey = "pre-phase-1b-calibration"): Promise<RatingFormulaConfig> {
  const { ratingFormulaPresets } = await import("./ratingFormulaPresets.js");
  return ratingFormulaPresets[presetKey];
}

export async function mergeRatingFormulaPreset(
  presetKey: RatingFormulaPresetKey = "pre-phase-1b-calibration",
  override: Partial<RatingFormulaConfig> = {}
): Promise<RatingFormulaConfig> {
  return mergeRatingFormulaConfig(await loadRatingFormulaPreset(presetKey), override);
}

export async function loadRatingFormulaConfig(options: {
  preset?: "pre-phase-1b-calibration" | "conservative-historical" | "modern-data-heavy";
  override?: Partial<RatingFormulaConfig>;
} = {}): Promise<RatingFormulaConfig> {
  return mergeRatingFormulaPreset(options.preset, options.override);
}

export function mergeRatingFormulaConfig(base: RatingFormulaConfig, override: Partial<RatingFormulaConfig>): RatingFormulaConfig {
  return deepMerge(base, override) as RatingFormulaConfig;
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (isPlainObject(base) && isPlainObject(override)) {
    return Object.fromEntries(
      [...new Set([...Object.keys(base), ...Object.keys(override)])].map((key) => [
        key,
        key in override ? deepMerge(base[key], override[key]) : base[key]
      ])
    );
  }
  return override ?? base;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

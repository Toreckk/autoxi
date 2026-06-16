import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  mergeRatingFormulaPreset,
  type RatingFormulaConfig,
  type RatingFormulaPresetKey
} from "../domain/rating/ratingFormulaConfig.js";
import {
  RatingFormulaJsonSchema,
  type RatingFormulaJsonConfig
} from "../domain/rating/ratingFormulaConfig.schema.js";

export async function loadRatingFormulaConfigFromFile(options: {
  preset?: RatingFormulaPresetKey;
  overridePath?: string;
} = {}): Promise<RatingFormulaConfig> {
  const base = await mergeRatingFormulaPreset(options.preset);
  const configuredPath =
    options.overridePath ??
    process.env.RATING_LAB_FORMULA_CONFIG ??
    resolve(process.env.INIT_CWD ?? process.cwd(), "data/rating-formulas/pre-phase-1b-raw-evidence.json");

  try {
    const parsed = RatingFormulaJsonSchema.parse(JSON.parse(await readFile(configuredPath, "utf8")));
    return applyFormulaJsonConfig(base, parsed, { path: configuredPath, fallbackUsed: false });
  } catch (error) {
    if (options.overridePath || process.env.RATING_LAB_FORMULA_CONFIG) {
      throw error;
    }
    return {
      ...base,
      selectedStrategy: base.ratingDistribution.selectedStrategy,
      formulaConfigPath: "built-in TypeScript fallback",
      formulaConfigFallbackUsed: true
    };
  }
}

export function applyFormulaJsonConfig(
  base: RatingFormulaConfig,
  formula: RatingFormulaJsonConfig,
  meta: { path: string; fallbackUsed: boolean }
): RatingFormulaConfig {
  return {
    ...base,
    version: formula.version,
    selectedStrategy: formula.selectedStrategy,
    formulaConfigPath: meta.path,
    formulaConfigFallbackUsed: meta.fallbackUsed,
    sourceBlendWeights: formula.sourceBlendWeights,
    transfermarkt: formula.transfermarkt,
    missingSeasonRules: formula.missingSeasonRules,
    availabilityRules: formula.availabilityRules,
    preview: formula.preview,
    distributionDiagnostics: formula.distributionDiagnostics,
    caps: {
      ...base.caps,
      ...formula.caps
    },
    seasonWindow: {
      ...base.seasonWindow,
      enabled: formula.transfermarkt.seasonWindow.enabled,
      sameSeasonWeight: formula.transfermarkt.seasonWindow.weights.worldCupYear,
      previousSeasonWeight: formula.transfermarkt.seasonWindow.weights.previous,
      twoSeasonsBackWeight: formula.transfermarkt.seasonWindow.weights.twoBack,
      threeSeasonsBackWeight: formula.transfermarkt.seasonWindow.weights.oldest
    },
    seasonAbilityWeights: {
      ...base.seasonAbilityWeights,
      transfermarkt: {
        ...base.seasonAbilityWeights.transfermarkt,
        ...formula.transfermarkt.annualSignalWeights,
        transferSignal: 0,
        multiSeasonConsistency: 0,
        trendDirection: 0
      }
    },
    ratingDistribution: {
      ...base.ratingDistribution,
      selectedStrategy: formula.selectedStrategy,
      diagnostics: {
        ...base.ratingDistribution.diagnostics,
        enabled: formula.distributionDiagnostics.enabled,
        buckets: formula.distributionDiagnostics.buckets,
        warnOnly: formula.distributionDiagnostics.warnOnly
      }
    },
    comparisonOnlySources: formula.comparisonOnlySources
  };
}

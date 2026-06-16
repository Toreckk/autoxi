import { findSevenAZeroComparison, loadSevenAZeroLocalJsonComparisonsWithWarnings } from "../sources/seven-a-zero/compareWithSevenAZero.js";
import { MANUAL_RATING_FLOORS } from "../sources/manual/iconicTargets.js";
import { loadFjelstulSampleWithReadiness } from "../sources/fjelstul/loadFjelstulSample.js";
import { buildReports, toCardReport, writeRatingLabReports } from "../reporting/reportWriter.js";
import { resolveCardRating } from "../domain/rating/resolveCardRating.js";
import { prePhase1BCalibrationConfig } from "../domain/rating/ratingFormulaPresets.js";
import type { RatingFormulaConfig } from "../domain/rating/ratingFormulaConfig.js";
import type { RatingLabSourceAvailability } from "../domain/types.js";

export type RunCalibrationOptions = {
  sourceDir: string;
  sevenAZeroDir?: string;
  sample: "all" | "iconic-plus-random" | "random";
  randomCount: number;
  seed: string;
  players?: string[];
  worldCupYears?: number[];
  outputDir: string;
  formulaConfig?: RatingFormulaConfig;
  sourceAvailability?: readonly RatingLabSourceAvailability[];
};

export async function runCalibration(options: RunCalibrationOptions): Promise<string[]> {
  const formulaConfig = options.formulaConfig ?? prePhase1BCalibrationConfig;
  const sevenAZeroLocalJson = await loadSevenAZeroLocalJsonComparisonsWithWarnings(options.sevenAZeroDir);
  const sevenAZeroComparison = sevenAZeroLocalJson.comparisons;
  const { cards: contexts, sourceReadiness } = await loadFjelstulSampleWithReadiness({
    sourceDir: options.sourceDir,
    sample: options.sample,
    randomCount: options.randomCount,
    seed: options.seed,
    players: options.players,
    worldCupYears: options.worldCupYears
  });

  const cards = contexts.map((context) => {
    const resolved = resolveCardRating(context, {
      manualCurated: MANUAL_RATING_FLOORS,
      sevenAZeroComparison
    }, formulaConfig);
    return toCardReport({
      context,
      resolved,
      sevenAZero: findSevenAZeroComparison(context, sevenAZeroComparison)
    });
  });

  const reports = buildReports({
    cards,
    sourceDir: options.sourceDir,
    sampleMode: options.sample,
    seed: options.seed,
    formulaConfig,
    sourceAvailability: options.sourceAvailability,
    sourceReadiness: {
      ...sourceReadiness,
      sourceWarnings: [
        ...sourceReadiness.sourceWarnings,
        ...sevenAZeroLocalJson.warnings.map((warning) => warning.code)
      ]
    }
  });

  return writeRatingLabReports({ reports, outputDir: options.outputDir });
}

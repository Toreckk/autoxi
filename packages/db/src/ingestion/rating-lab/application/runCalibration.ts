import { findSevenAZeroComparison, loadSevenAZeroLocalJsonComparisonsWithWarnings } from "../sources/seven-a-zero/compareWithSevenAZero.js";
import { MANUAL_RATING_FLOORS } from "../sources/manual/iconicTargets.js";
import { loadFjelstulSampleWithReadiness } from "../sources/fjelstul/loadFjelstulSample.js";
import { buildReports, toCardReport, writeRatingLabReports } from "../reporting/reportWriter.js";
import { resolveCardRating } from "../domain/rating/resolveCardRating.js";
import { prePhase1BCalibrationConfig } from "../domain/rating/ratingFormulaPresets.js";
import { matchTransfermarktPlayer } from "../sources/transfermarkt/transfermarktMatcher.js";
import { loadTransfermarktSeasons } from "../sources/transfermarkt/loadTransfermarktSeasons.js";
import { resolveTransfermarktRating, worldCupCycleYears } from "../sources/transfermarkt/transfermarktMultiSeasonBaseline.js";
import type { RatingFormulaConfig } from "../domain/rating/ratingFormulaConfig.js";
import type { AppliedRatingSource, FjelstulCardContext, RatingLabSourceAvailability } from "../domain/types.js";
import type { TransfermarktPlayerSeason } from "../sources/transfermarkt/transfermarktTypes.js";

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
  transfermarktSourceDir?: string;
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
  const transfermarktYears = new Set(contexts.flatMap((context) => worldCupCycleYears(context.worldCupYear)));
  console.log(
    `Loading Transfermarkt season evidence for ${contexts.length} sampled cards across ${transfermarktYears.size} cycle years...`
  );
  const transfermarktRecords = await loadTransfermarktSeasons(options.transfermarktSourceDir, {
    years: transfermarktYears,
    targetNames: contexts.map((context) => context.internalRawName)
  });
  console.log(`Loaded ${transfermarktRecords.length} Transfermarkt season rows for rating-lab matching.`);

  const cards = contexts.map((context) => {
    const transfermarktSource = buildTransfermarktAppliedSource(context, transfermarktRecords, formulaConfig);
    const resolved = resolveCardRating(context, {
      manualCurated: MANUAL_RATING_FLOORS,
      sevenAZeroComparison,
      transfermarktRatings: transfermarktSource ? [transfermarktSource] : []
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

function buildTransfermarktAppliedSource(
  context: FjelstulCardContext,
  records: readonly TransfermarktPlayerSeason[],
  config: RatingFormulaConfig
): AppliedRatingSource | null {
  const candidates = matchTransfermarktPlayer(context, records).filter((candidate) => candidate.confidence === "HIGH");
  const candidate = candidates[0];
  if (!candidate) return null;
  const result = resolveTransfermarktRating({ context, candidate, records, config });
  if (!result) return null;
  const [oldest, twoBack, previous, worldCupYear] = worldCupCycleYears(context.worldCupYear);
  const source: AppliedRatingSource = {
    sourceKey: "TRANSFERMARKT",
    rating: result.rating,
    baseWeight: config.sourceBlendWeights.highConfidenceTransfermarkt,
    confidence: result.confidence,
    coverage: result.coverage,
    effectiveWeight: config.sourceBlendWeights.highConfidenceTransfermarkt,
    affectsRating: result.matchConfidence === "HIGH" && result.coverage >= config.transfermarkt.minimumCoverageToApply,
    reasons: result.reasons,
    warnings: result.warnings,
    signals: {
      ...result.signals,
      transfermarktEligibleYears: eligibleYearsFromReasons(result.reasons),
      transfermarktAvailableYears: availableYearsFromReasons(result.reasons),
      tmOldestYear: oldest,
      tmTwoBackYear: twoBack,
      tmPreviousYear: previous,
      tmWorldCupYear: worldCupYear,
      tmOldestRating: result.multiSeason.threeSeasonsBackScore,
      tmTwoBackRating: result.multiSeason.twoSeasonsBackScore,
      tmPreviousRating: result.multiSeason.previousSeasonScore,
      tmWorldCupYearRating: result.multiSeason.sameSeasonScore,
      tmWeightedMultiSeasonScore: result.multiSeason.weightedMultiSeasonScore,
      tmMarketValueTrend: result.multiSeason.marketValueTrend,
      tmProductionTrend: result.multiSeason.productionTrend,
      tmMinutesTrend: result.multiSeason.minutesTrend,
      tmTrendAdjustment: result.multiSeason.trendAdjustment
    }
  };
  return source;
}

function eligibleYearsFromReasons(reasons: readonly string[]): string {
  return reasonSuffix(reasons, "eligible_years:");
}

function availableYearsFromReasons(reasons: readonly string[]): string {
  return reasonSuffix(reasons, "available_years:");
}

function reasonSuffix(reasons: readonly string[], prefix: string): string {
  return reasons.find((reason) => reason.startsWith(prefix))?.slice(prefix.length) ?? "";
}

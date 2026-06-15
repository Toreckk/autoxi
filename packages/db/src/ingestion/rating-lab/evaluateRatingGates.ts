import { PRE_PHASE_1B_GATES, type RatingGateConfig } from "./ratingGateConfig.js";
import type { RatingLabSummary } from "./types.js";

export type RatingLabReadinessStatus = "READY_FOR_PHASE_1B" | "NEEDS_TUNING" | "BLOCKED_BY_SOURCE_QUALITY";
export type RatingGateSeverity = "HARD_FAIL" | "WARNING";

export type RatingGateResult = {
  key: string;
  severity: RatingGateSeverity;
  passed: boolean;
  actual: number | string | null;
  expected: number | string;
  message: string;
};

export type RatingGateEvaluation = {
  status: RatingLabReadinessStatus;
  passed: boolean;
  hardFailures: RatingGateResult[];
  warnings: RatingGateResult[];
  results: RatingGateResult[];
};

export function evaluateRatingGates(
  summary: RatingLabSummary,
  gates: RatingGateConfig = PRE_PHASE_1B_GATES
): RatingGateEvaluation {
  const cardsResolvedPct =
    summary.totalCardsSampled === 0 ? 0 : (summary.cardsResolved / summary.totalCardsSampled) * 100;
  const benchmarkFails = summary.benchmarks.filter((benchmark) => benchmark.status === "FAIL").length;
  const benchmarkWarns = summary.benchmarks.filter((benchmark) => benchmark.status === "WARN").length;
  const hardAnomalies = summary.anomalyDetails.filter((anomaly) => anomaly.severity === "HARD_FAIL").length;
  const unknownHighRating = summary.warningsByCode.unknown_high_rating ?? 0;

  const results: RatingGateResult[] = [
    hard(
      "required_source_files_loaded",
      String(summary.requiredSourceFilesLoaded),
      "true",
      summary.requiredSourceFilesLoaded
    ),
    hard("players_rows_read", summary.playersRowsRead, "> 0", summary.playersRowsRead > 0),
    hard("squad_rows_read", summary.squadRowsRead, "> 0", summary.squadRowsRead > 0),
    hard("tournament_rows_read", summary.tournamentRowsRead, "> 0", summary.tournamentRowsRead > 0),
    hard("team_rows_read", summary.teamRowsRead, "> 0", summary.teamRowsRead > 0),
    hard("cards_resolved_pct", cardsResolvedPct, gates.minCardsResolvedPct, cardsResolvedPct >= gates.minCardsResolvedPct),
    hard("benchmark_fails", benchmarkFails, `<= ${gates.maxBenchmarkFails}`, benchmarkFails <= gates.maxBenchmarkFails),
    hard(
      "generated_only_top3_per_tournament",
      summary.generatedOnlyTop3PerTournament,
      `<= ${gates.maxGeneratedOnlyTop3PerTournament}`,
      summary.generatedOnlyTop3PerTournament <= gates.maxGeneratedOnlyTop3PerTournament
    ),
    hard("unknown_high_rating", unknownHighRating, `<= ${gates.maxUnknownHighRating}`, unknownHighRating <= gates.maxUnknownHighRating),
    hard(
      "award_winner_floor_pct",
      summary.awardWinnerFloorPct,
      `>= ${gates.minAwardWinnerFloorPct}`,
      summary.awardWinnerFloorPct === null || summary.awardWinnerFloorPct >= gates.minAwardWinnerFloorPct
    ),
    hard("hard_anomalies", hardAnomalies, `<= ${gates.maxHardFailures}`, hardAnomalies <= gates.maxHardFailures),
    warn("benchmark_warns", benchmarkWarns, `<= ${gates.maxBenchmarkWarns}`, benchmarkWarns <= gates.maxBenchmarkWarns),
    warn("standing_rows_read", summary.standingRowsRead, "> 0", summary.standingRowsRead > 0),
    warn("award_rows_read", summary.awardRowsRead, "> 0", summary.awardRowsRead > 0),
    warn("award_winner_rows_read", summary.awardWinnerRowsRead, "> 0", summary.awardWinnerRowsRead > 0),
    warn("host_rows_read", summary.hostRowsRead, "> 0", summary.hostRowsRead > 0),
    warn(
      "award_winner_floor_pct_unavailable",
      summary.awardWinnerFloorPct,
      "available",
      summary.awardWinnerFloorPct !== null
    ),
    warn(
      "seven_a_zero_manual_average_delta",
      summary.sevenAZeroManualAverageAbsoluteDelta,
      `<= ${gates.maxSevenAZeroAverageDelta}`,
      summary.sevenAZeroManualAverageAbsoluteDelta === null ||
        summary.sevenAZeroManualAverageAbsoluteDelta <= gates.maxSevenAZeroAverageDelta
    ),
    warn(
      "seven_a_zero_manual_p90_delta",
      summary.sevenAZeroManualDeltaP90,
      `<= ${gates.maxSevenAZeroP90Delta}`,
      summary.sevenAZeroManualDeltaP90 === null || summary.sevenAZeroManualDeltaP90 <= gates.maxSevenAZeroP90Delta
    ),
    warn(
      "overall_stat_delta_p90",
      summary.overallStatDeltaP90,
      `<= ${gates.maxOverallStatDeltaP90}`,
      summary.overallStatDeltaP90 === null || summary.overallStatDeltaP90 <= gates.maxOverallStatDeltaP90
    ),
    warn("pairwise_failures", summary.pairwiseFail, "0", summary.pairwiseFail === 0)
  ];

  if (!summary.requiredSourceFilesLoaded || summary.totalCardsSampled === 0 || cardsResolvedPct < 50) {
    return finish("BLOCKED_BY_SOURCE_QUALITY", results);
  }

  const hardFailures = results.filter((result) => result.severity === "HARD_FAIL" && !result.passed);
  const warnings = results.filter((result) => result.severity === "WARNING" && !result.passed);
  return finish(hardFailures.length === 0 && warnings.length === 0 ? "READY_FOR_PHASE_1B" : "NEEDS_TUNING", results);
}

function hard(key: string, actual: number | string | null, expected: number | string, passed: boolean): RatingGateResult {
  return result(key, "HARD_FAIL", actual, expected, passed);
}

function warn(key: string, actual: number | string | null, expected: number | string, passed: boolean): RatingGateResult {
  return result(key, "WARNING", actual, expected, passed);
}

function result(
  key: string,
  severity: RatingGateSeverity,
  actual: number | string | null,
  expected: number | string,
  passed: boolean
): RatingGateResult {
  return {
    key,
    severity,
    passed,
    actual,
    expected,
    message: `${key}: actual ${actual ?? "n/a"}, expected ${expected}`
  };
}

function finish(status: RatingLabReadinessStatus, results: RatingGateResult[]): RatingGateEvaluation {
  const hardFailures = results.filter((result) => result.severity === "HARD_FAIL" && !result.passed);
  const warnings = results.filter((result) => result.severity === "WARNING" && !result.passed);
  return {
    status,
    passed: status === "READY_FOR_PHASE_1B",
    hardFailures,
    warnings,
    results
  };
}

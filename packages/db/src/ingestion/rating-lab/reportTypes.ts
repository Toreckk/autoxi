import type { RatingLabCardReport, RatingLabSummary, SevenAZeroManualReferenceResult } from "./types.js";

export type RatingLabReports = {
  summary: RatingLabSummary;
  icons: RatingLabCardReport[];
  randomSample: RatingLabCardReport[];
  topByTournament: RatingLabCardReport[];
  awardWinners: RatingLabCardReport[];
  generatedOnlyOutliers: RatingLabCardReport[];
  sevenAZeroComparison: RatingLabCardReport[];
  sevenAZeroManualReferences: SevenAZeroManualReferenceResult[];
  anomalies: RatingLabCardReport[];
};

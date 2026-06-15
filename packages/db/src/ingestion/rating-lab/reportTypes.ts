import type { RatingLabCardReport, RatingLabSummary } from "./types.js";

export type RatingLabReports = {
  summary: RatingLabSummary;
  icons: RatingLabCardReport[];
  randomSample: RatingLabCardReport[];
  topByTournament: RatingLabCardReport[];
  awardWinners: RatingLabCardReport[];
  generatedOnlyOutliers: RatingLabCardReport[];
  sevenAZeroComparison: RatingLabCardReport[];
  anomalies: RatingLabCardReport[];
};

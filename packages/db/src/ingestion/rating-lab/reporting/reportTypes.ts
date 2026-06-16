import type {
  DistributionBucket,
  DistributionGroup,
  RatingLabCardReport,
  RatingLabSourceAvailability,
  RatingLabSummary,
  SevenAZeroManualReferenceResult
} from "../domain/types.js";

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
  sourceAvailability: RatingLabSourceAvailability[];
  distributionBuckets: DistributionBucket[];
  distributionGroups: DistributionGroup[];
};

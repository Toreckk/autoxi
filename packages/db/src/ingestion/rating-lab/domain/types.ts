import type {
  CardEditionKey,
  CardRole,
  CardTier,
  GoalkeeperCardStatsDto,
  OutfieldCardStatsDto,
  VisiblePosition
} from "@autoxi/domain";

export const RATING_SOURCES = [
  "MANUAL_CURATED",
  "EA_HISTORICAL",
  "RETRO_REFERENCE",
  "FIVETHIRTYEIGHT_WORLD_CUP",
  "STATSBOMB_WORLD_CUP",
  "SEVEN_A_ZERO_COMPARISON",
  "TRANSFERMARKT",
  "FJELSTUL_WORLD_CUP",
  "FJELSTUL_GENERATED",
  "MIXED"
] as const;

export type RatingSource = (typeof RATING_SOURCES)[number];
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type SourceConfidence = Confidence | "NONE";
export type RatingDistributionStrategy = "RAW_EVIDENCE" | "PERCENTILE_CURVE" | "ELITE_SCARCITY_CURVE" | "HYBRID_RECOMMENDED";
export type RatingSourceKey =
  | "FJELSTUL_WORLD_CUP"
  | "TRANSFERMARKT"
  | "EA_HISTORICAL"
  | "CLUB_ELO"
  | "FBREF"
  | "STATSBOMB"
  | "FIVETHIRTYEIGHT_WORLD_CUP"
  | "ANNUAL_AWARDS"
  | "MANUAL_ANCHORS"
  | "SEVEN_A_ZERO_MANUAL";
export type TeamResult = "CHAMPION" | "RUNNER_UP" | "THIRD" | "FOURTH" | "HOST" | "GROUP_STAGE" | "UNKNOWN";
export type RatingTierLabel =
  | "SQUAD_PLAYER"
  | "STARTER"
  | "KEY_PLAYER"
  | "STAR"
  | "WORLD_CLASS"
  | "HERO"
  | "ICON";

export type RatingModifier = {
  key: string;
  value: number;
  reason: string;
};

export type GeneratedOverallResult = {
  overall: number;
  confidence: Confidence;
  reasons: string[];
  modifiers: RatingModifier[];
};

export type RatingEvidence = {
  source: RatingSource;
  confidence: Confidence;
  value?: number;
  reason: string;
};

export type MultiSeasonAbilitySignals = {
  sameSeasonScore: number | null;
  previousSeasonScore: number | null;
  twoSeasonsBackScore: number | null;
  threeSeasonsBackScore: number | null;
  weightedMultiSeasonScore: number | null;
  marketValueTrend: "RISING" | "STABLE" | "DECLINING" | "UNKNOWN";
  productionTrend: "RISING" | "STABLE" | "DECLINING" | "UNKNOWN";
  minutesTrend: "RISING" | "STABLE" | "DECLINING" | "UNKNOWN";
  trendAdjustment: number;
};

export type ComparisonReference = {
  sourceKey: RatingSourceKey;
  comparisonOnly: true;
  sourceWeight: 0;
  canAffectRating: false;
  referenceOverall: number;
  delta: number | null;
  reason: string;
};

export type AppliedRatingSource = {
  sourceKey: RatingSourceKey;
  rating: number;
  baseWeight: number;
  confidence: Confidence;
  coverage: number;
  effectiveWeight: number;
  affectsRating: boolean;
  reasons: readonly string[];
  warnings: readonly string[];
  signals?: Record<string, number | string | null>;
};

export type RatingWarning = {
  code: string;
  message: string;
  severity: "INFO" | "WARN" | "FAIL";
};

export type ManualCuratedRating = {
  id: string;
  nameSearch: string;
  aliases?: readonly string[];
  nationCode?: string;
  worldCupYear?: number;
  floor: number;
  reason: string;
};

export type ExternalRatingRecord = {
  normalizedName: string;
  worldCupYear?: number;
  nation?: string;
  overall?: number;
  stats?: OutfieldCardStatsDto | GoalkeeperCardStatsDto;
  confidence: Confidence;
  reason: string;
};

export type SevenAZeroSquadPlayer = {
  playerId?: string;
  name: string;
  sel: string;
  copa: number;
  positions?: string[];
  number?: number;
  f: number;
  legend?: boolean;
};

export type SevenAZeroSquadFile = {
  sel: string;
  copa: number;
  squad: SevenAZeroSquadPlayer[];
};

export type SevenAZeroComparison = {
  normalizedName: string;
  internalName: string;
  nation: string;
  worldCupYear: number;
  rating: number;
  delta?: number;
};

export type RatingSourcesInput = {
  manualCurated?: readonly ManualCuratedRating[];
  eaHistorical?: readonly ExternalRatingRecord[];
  retroReference?: readonly ExternalRatingRecord[];
  fiveThirtyEight?: readonly ExternalRatingRecord[];
  statsBomb?: readonly ExternalRatingRecord[];
  sevenAZeroComparison?: readonly SevenAZeroComparison[];
  transfermarktRatings?: readonly AppliedRatingSource[];
  applySevenAZero?: boolean;
};

export type FjelstulCardContext = {
  identityKey: string;
  internalRawName: string;
  publicPlaceholderName: string;
  worldCupYear: number;
  nation: string;
  position: VisiblePosition;
  role: CardRole;
  squadPresence: boolean;
  appearances?: number;
  minutes?: number;
  goals?: number;
  captain?: boolean;
  awards: CardEditionKey[];
  teamResult: TeamResult;
  host: boolean;
  tournamentCount: number;
  samePlayerEditionCount: number;
  seed: string;
  birthYear?: number;
  debugRealName?: string;
  publicDisplayName?: string;
  isLocalDebugOnly?: boolean;
  hostCountryLabel?: string;
  hostCountryCode?: string;
  hostResolutionSource?: string;
  hostResolutionWarning?: string | null;
};

export type ResolvedRating = {
  overall: number;
  stats: OutfieldCardStatsDto | GoalkeeperCardStatsDto;
  estimatedOverallFromStats: number;
  overallStatDelta: number;
  tier: CardTier;
  primarySource: RatingSource;
  confidence: Confidence;
  evidence: RatingEvidence[];
  warnings: RatingWarning[];
  reasons: string[];
  breakdown?: RatingBreakdown;
};

export type RatingBreakdown = {
  formulaVersion: string;
  formulaConfigPath: string | null;
  selectedDistributionStrategy: RatingDistributionStrategy;
  rawEvidenceOverall: number;
  selectedOverall: number;
  seasonAbilityBaseline: number | null;
  seasonAbilitySource: RatingSourceKey | null;
  seasonAbilityConfidence: SourceConfidence;
  multiSeasonAbility: MultiSeasonAbilitySignals | null;
  worldCupPerformanceRating: number | null;
  worldCupPerformanceSource: RatingSourceKey | null;
  worldCupPerformanceConfidence: SourceConfidence;
  contextAdjustment: number;
  leagueStrengthAdjustment: number;
  clubStrengthAdjustment: number;
  ageCurveAdjustment: number;
  trendAdjustment: number;
  awardAdjustment: number;
  manualAnchorAdjustment: number;
  capsApplied: readonly string[];
  bonusesApplied: readonly string[];
  warningsApplied: readonly string[];
  finalOverallBeforeCaps: number;
  finalOverall: number;
  individualStatsSource: RatingSourceKey | "GENERATED";
  individualStatsConfidence: Confidence;
  evidence: readonly RatingEvidence[];
  comparisonReferences: readonly ComparisonReference[];
  appliedSources: readonly AppliedRatingSource[];
  ignoredSources: readonly AppliedRatingSource[];
  transfermarktRating: number | null;
  transfermarktMatchConfidence: SourceConfidence;
  transfermarktCoverage: number | null;
  transfermarktEffectiveWeight: number;
  worldCupEffectiveWeight: number;
  finalBlendedRating: number;
  warnings: readonly string[];
};

export type RatingLabCardReport = {
  cardKey: string;
  internalRawName: string;
  publicPlaceholderName: string;
  debugRealName: string | null;
  publicDisplayName: string;
  isLocalDebugOnly: boolean;
  hostCountryLabel: string;
  hostCountryCode: string;
  hostResolutionSource: string;
  hostResolutionWarning: string | null;
  worldCupYear: number;
  nation: string;
  position: VisiblePosition;
  overall: number;
  estimatedOverallFromStats: number;
  overallStatDelta: number;
  tier: CardTier;
  editionKey: CardEditionKey;
  primarySource: RatingSource;
  sourceTypes: string;
  confidence: Confidence;
  teamResult: TeamResult;
  awards: string;
  appearances: number;
  goals: number;
  sevenAZeroRating: number | null;
  sevenAZeroDelta: number | null;
  baseRating: number | null;
  manualFloorApplied: string;
  awardFloorApplied: string;
  teamResultModifier: number | null;
  appearanceModifier: number | null;
  goalModifier: number | null;
  externalReferenceDelta: number | null;
  finalOverall: number;
  warnings: string;
  reasons: string;
  formulaVersion: string;
  formulaConfigPath: string | null;
  selectedDistributionStrategy: RatingDistributionStrategy;
  rawEvidenceOverall: number;
  selectedOverall: number;
  seasonAbilityBaseline: number | null;
  seasonAbilitySource: RatingSourceKey | null;
  seasonAbilityConfidence: SourceConfidence;
  sameSeasonScore: number | null;
  previousSeasonScore: number | null;
  twoSeasonsBackScore: number | null;
  threeSeasonsBackScore: number | null;
  weightedMultiSeasonScore: number | null;
  marketValueTrend: string;
  productionTrend: string;
  minutesTrend: string;
  trendAdjustment: number;
  worldCupPerformanceRating: number | null;
  worldCupPerformanceSource: RatingSourceKey | null;
  worldCupPerformanceConfidence: SourceConfidence;
  worldCupRating: number | null;
  transfermarktRating: number | null;
  transfermarktEffectiveWeight: number;
  worldCupEffectiveWeight: number;
  finalBlendedRating: number;
  transfermarktMatchConfidence: SourceConfidence;
  transfermarktCoverage: number | null;
  transfermarktEligibleYears: string;
  transfermarktAvailableYears: string;
  tmOldestYear: number | null;
  tmTwoBackYear: number | null;
  tmPreviousYear: number | null;
  tmWorldCupYear: number | null;
  tmOldestRating: number | null;
  tmTwoBackRating: number | null;
  tmPreviousRating: number | null;
  tmWorldCupYearRating: number | null;
  tmSameSeasonScore: number | null;
  tmPreviousSeasonScore: number | null;
  tmTwoSeasonsBackScore: number | null;
  tmThreeSeasonsBackScore: number | null;
  tmWeightedMultiSeasonScore: number | null;
  tmMarketValuePercentile: number | null;
  tmAppearanceVolumeScore: number | null;
  tmGoalContributionScore: number | null;
  tmAssistContributionScore: number | null;
  tmLeagueStrengthScore: number | null;
  tmClubStrengthScore: number | null;
  tmAgeCurveScore: number | null;
  tmStarterShareScore: number | null;
  tmCardsDisciplineScore: number | null;
  transfermarktPlayerId: string;
  transfermarktRatingConfidence: SourceConfidence;
  transfermarktMatchFailureReason: string;
  transfermarktSignalsAvailable: string;
  transfermarktSignalsMissing: string;
  transfermarktChangedRatingBy: number | null;
  manualTransfermarktOverrideApplied: boolean;
  manualTransfermarktOverrideReason: string;
  awardMaxCapApplied: boolean;
  absoluteClampApplied: boolean;
  rating99Eligible: boolean;
  rating99EligibilityReason: string;
  exceptionalSignals: string;
  tmMarketValueTrend: string;
  tmProductionTrend: string;
  tmMinutesTrend: string;
  tmTrendAdjustment: number;
  leagueStrengthAdjustment: number;
  clubStrengthAdjustment: number;
  ageCurveAdjustment: number;
  awardAdjustment: number;
  manualAnchorAdjustment: number;
  finalOverallBeforeCaps: number;
  capsApplied: string;
  bonusesApplied: string;
  warningsApplied: string;
  evidenceSummary: string;
  comparisonSummary: string;
};

export type RatingLabCardSnapshot = {
  key: string;
  internalRawName: string;
  publicPlaceholderName: string;
  debugRealName?: string | null;
  publicDisplayName?: string;
  isLocalDebugOnly?: boolean;
  hostCountryLabel?: string;
  hostCountryCode?: string;
  hostResolutionSource?: string;
  hostResolutionWarning?: string | null;
  worldCupYear: number;
  nation: string;
  position: VisiblePosition;
  overall: number;
  tier: CardTier;
  editionKey?: CardEditionKey;
  awards?: string;
  primarySource: RatingSource;
  confidence: Confidence;
  warnings: string;
  reasons: string;
  selectedDistributionStrategy?: RatingDistributionStrategy;
  rawEvidenceOverall?: number;
  selectedOverall?: number;
  seasonAbilityBaseline?: number | null;
  worldCupPerformanceRating?: number | null;
  transfermarktRating?: number | null;
  transfermarktEffectiveWeight?: number;
  worldCupEffectiveWeight?: number;
  finalBlendedRating?: number;
  transfermarktMatchConfidence?: SourceConfidence;
  transfermarktCoverage?: number | null;
  transfermarktPlayerId?: string;
  transfermarktRatingConfidence?: SourceConfidence;
  transfermarktMatchFailureReason?: string;
  transfermarktSignalsAvailable?: string;
  transfermarktSignalsMissing?: string;
  transfermarktChangedRatingBy?: number | null;
  rating99Eligible?: boolean;
  rating99EligibilityReason?: string;
  trendAdjustment?: number;
  capsApplied?: string;
  evidenceSummary?: string;
  comparisonSummary?: string;
};

export type RatingLabAnomaly = {
  code: string;
  severity: "HARD_FAIL" | "WARNING";
  internalRawName: string;
  worldCupYear: number;
  nation: string;
  overall: number;
  reason: string;
};

export type BenchmarkType =
  | "ICON_RANGE"
  | "AWARD_WINNER_RANGE"
  | "GOALKEEPER_RANGE"
  | "ROLE_PLAYER_RANGE"
  | "NEGATIVE_CONTROL"
  | "MODERN_REFERENCE_RANGE";

export type BenchmarkStatus = "PASS" | "WARN" | "FAIL" | "MISSING" | "AMBIGUOUS";

export type BenchmarkTarget = {
  id: string;
  nameSearch: string;
  aliases?: readonly string[];
  worldCupYear: number;
  nationCode?: string;
  expectedRatingMin: number;
  expectedRatingMax: number;
  benchmarkType: BenchmarkType;
  reason: string;
};

export type BenchmarkResult = BenchmarkTarget & {
  status: BenchmarkStatus;
  actualRating: number | null;
  matchedInternalRawName?: string;
  matchedPublicName?: string;
  matchedNation?: string;
  matchedPosition?: string;
  distance?: number;
  candidateCount?: number;
  candidateNames?: readonly string[];
};

export type SevenAZeroManualReference = {
  id: string;
  source?: "SEVEN_A_ZERO_MANUAL";
  playerName: string;
  aliases?: readonly string[];
  nationCode: string;
  worldCupYear: number;
  positionHint?: string;
  referenceOverall: number;
  tolerance: number;
  reason: string;
};

export type SevenAZeroManualReferenceResult = SevenAZeroManualReference & {
  status: BenchmarkStatus;
  actualRating: number | null;
  delta: number | null;
  matchedInternalRawName?: string;
  matchedPublicName?: string;
  candidateNames?: readonly string[];
};

export type SevenAZeroComparisonSummary = {
  matchedPlayers: number;
  unmatchedPlayers: number;
  averageAbsoluteDelta: number | null;
  medianAbsoluteDelta: number | null;
  deltaP90: number | null;
  largestPositiveDeltas: RatingLabCardReport[];
  largestNegativeDeltas: RatingLabCardReport[];
};

export type PairwiseRatingCheckResult = {
  id: string;
  status: BenchmarkStatus;
  severity: "HARD_FAIL" | "WARNING";
  higherName: string;
  lowerName: string;
  higherRating: number | null;
  lowerRating: number | null;
  actualGap: number | null;
  expectedMinGap: number;
  reason: string;
  candidateNames?: readonly string[];
};

export type RatingLabSourceAvailability = {
  sourceKey: RatingSourceKey;
  label: string;
  status: "available" | "unavailable";
  required: boolean;
  mode: "required" | "optional" | "built-in" | "comparison-only";
  path: string | null;
  warnings: string[];
  rowCount?: number;
  affectsRating: boolean;
};

export type DistributionBucket = {
  rating: number;
  count: number;
  percentage: number;
  examples: readonly string[];
};

export type DistributionGroup = {
  key: string;
  totalCards: number;
  count90Plus: number;
  count95Plus: number;
  count99: number;
};

export type RatingDistributionDiagnostics = {
  totalCards: number;
  buckets: readonly DistributionBucket[];
  count90Plus: number;
  count95Plus: number;
  count98Plus: number;
  count99: number;
  percentage90Plus: number;
  percentage95Plus: number;
  percentage98Plus: number;
  percentage99: number;
  byWorldCupYear: readonly DistributionGroup[];
  byDecade: readonly DistributionGroup[];
  byPosition: readonly DistributionGroup[];
  byPrimarySource: readonly DistributionGroup[];
  byConfidence: readonly DistributionGroup[];
};

export type RatingLabSummary = {
  generatedAt: string;
  formulaVersion?: string;
  formulaConfigPath?: string | null;
  formulaConfigFallbackUsed?: boolean;
  selectedDistributionStrategy?: RatingDistributionStrategy;
  sourceDir: string;
  sourceAvailability?: RatingLabSourceAvailability[];
  distributionDiagnostics?: RatingDistributionDiagnostics;
  tournamentFilterMode?: string;
  tournamentFilterSummary?: {
    includedMenWorldCupYears: number[];
    excludedWomenWorldCupYears: number[];
    totalCardsBeforeGenderFilter: number;
    totalCardsAfterGenderFilter: number;
  };
  tournamentFilterRows?: Array<{
    worldCupYear: number;
    tournamentId: string;
    tournamentName: string;
    genderOrCategory: string;
    included: boolean;
    excludedReason: string;
    cardCount: number;
  }>;
  transfermarktCoverageByEra?: TransfermarktCoverageSummary[];
  transfermarktCoverageByWorldCupYear?: TransfermarktCoverageSummary[];
  sampleMode: string;
  seed: string;
  totalCardsSampled: number;
  cardsResolved: number;
  cardsGeneratedOnly: number;
  cardsWithManualCurated: number;
  cardsWithEaHistorical: number;
  cardsWithRetroReference: number;
  cardsWithFiveThirtyEight: number;
  cardsWithStatsBomb: number;
  cardsWithSevenAZeroComparison: number;
  cardsWithHighConfidenceSource: number;
  cardsWithMediumConfidenceOnly: number;
  cardsWithLowConfidenceOnly: number;
  playersRowsRead: number;
  squadRowsRead: number;
  tournamentRowsRead: number;
  teamRowsRead: number;
  standingRowsRead: number;
  awardRowsRead: number;
  awardWinnerRowsRead: number;
  hostRowsRead: number;
  optionalAppearanceRowsRead: number;
  optionalGoalRowsRead: number;
  requiredSourceFilesLoaded: boolean;
  sourceWarnings: string[];
  byWorldCupYear: Record<string, number>;
  byDecade: Record<string, number>;
  byNation: Record<string, number>;
  byPosition: Record<string, number>;
  byTier: Record<string, number>;
  bySourceType: Record<string, number>;
  byConfidence: Record<string, number>;
  warningsByCode: Record<string, number>;
  benchmarks: BenchmarkResult[];
  cardSnapshots: RatingLabCardSnapshot[];
  anomalyDetails: RatingLabAnomaly[];
  pairwiseChecks: PairwiseRatingCheckResult[];
  pairwisePass: number;
  pairwiseWarn: number;
  pairwiseFail: number;
  pairwiseMissing: number;
  pairwiseAmbiguous: number;
  generatedOnlyTop3PerTournament: number;
  overallStatDeltaP90: number | null;
  awardWinnerFloorPct: number | null;
  sevenAZeroComparison: SevenAZeroComparisonSummary | null;
  sevenAZeroManualPass: number;
  sevenAZeroManualWarn: number;
  sevenAZeroManualFail: number;
  sevenAZeroManualMissing: number;
  sevenAZeroManualAmbiguous: number;
  sevenAZeroManualMatched: number;
  sevenAZeroManualAverageAbsoluteDelta: number | null;
  sevenAZeroManualMedianAbsoluteDelta: number | null;
  sevenAZeroManualDeltaP90: number | null;
  confidenceGateStatus: "READY_FOR_PHASE_1B" | "NEEDS_TUNING" | "BLOCKED_BY_SOURCE_QUALITY";
  confidenceGateReasons: string[];
};

export type TransfermarktCoverageSummary = {
  key: string;
  totalMaleCards: number;
  highTransfermarktMatches: number;
  mediumTransfermarktMatches: number;
  lowTransfermarktMatches: number;
  noTransfermarktMatch: number;
  highMatchRate: number;
  mediumOrBetterRate: number;
  manualOverrideCount: number;
};

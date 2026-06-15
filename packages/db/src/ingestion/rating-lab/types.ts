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
  "FJELSTUL_GENERATED",
  "MIXED"
] as const;

export type RatingSource = (typeof RATING_SOURCES)[number];
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
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
};

export type RatingLabCardReport = {
  internalRawName: string;
  publicPlaceholderName: string;
  worldCupYear: number;
  nation: string;
  position: VisiblePosition;
  overall: number;
  estimatedOverallFromStats: number;
  overallStatDelta: number;
  tier: CardTier;
  editionKey: CardEditionKey;
  primarySource: RatingSource;
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
};

export type RatingLabCardSnapshot = {
  key: string;
  internalRawName: string;
  publicPlaceholderName: string;
  worldCupYear: number;
  nation: string;
  position: VisiblePosition;
  overall: number;
  tier: CardTier;
  primarySource: RatingSource;
  confidence: Confidence;
  warnings: string;
  reasons: string;
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

export type RatingLabSummary = {
  generatedAt: string;
  sourceDir: string;
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
  sevenAZeroManualAverageAbsoluteDelta: number | null;
  sevenAZeroManualMedianAbsoluteDelta: number | null;
  sevenAZeroManualDeltaP90: number | null;
  confidenceGateStatus: "READY_FOR_PHASE_1B" | "NEEDS_TUNING" | "BLOCKED_BY_SOURCE_QUALITY";
  confidenceGateReasons: string[];
};

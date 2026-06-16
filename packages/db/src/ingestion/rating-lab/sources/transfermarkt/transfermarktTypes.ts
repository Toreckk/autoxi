import type { Confidence, FjelstulCardContext, MultiSeasonAbilitySignals } from "../../domain/types.js";

export type TransfermarktProfile = {
  sourceDir: string;
  files: TransfermarktFileProfile[];
  totalRows: number;
  warnings: string[];
};

export type TransfermarktFileProfile = {
  file: string;
  rows: number;
  columns: string[];
  minYear: number | null;
  maxYear: number | null;
};

export type TransfermarktPlayerSeason = {
  playerName: string;
  normalizedName: string;
  nation?: string;
  seasonYear: number;
  birthYear?: number;
  marketValueEur: number | null;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  minutes: number | null;
  clubName?: string;
  leagueName?: string;
};

export type TransfermarktMatchCandidate = {
  context: FjelstulCardContext;
  record: TransfermarktPlayerSeason;
  score: number;
  confidence: Confidence;
  reasons: string[];
};

export type TransfermarktSeasonBaseline = {
  score: number;
  confidence: Confidence;
  marketValuePercentile: number | null;
  appearancePercentile: number | null;
  productionPercentile: number | null;
  reason: string;
};

export type TransfermarktRatingResult = {
  rating: number;
  confidence: Confidence;
  coverage: number;
  matchConfidence: Confidence;
  multiSeason: MultiSeasonAbilitySignals;
  signals: {
    marketValuePercentile?: number;
    appearanceVolumeScore?: number;
    goalContributionScore?: number;
    assistContributionScore?: number;
    leagueStrengthScore?: number;
    clubStrengthScore?: number;
    ageCurveScore?: number;
  };
  reasons: readonly string[];
  warnings: readonly string[];
};

export type TransfermarktMultiSeasonBaseline = {
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

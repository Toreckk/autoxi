import type { GoalkeeperCardStatsDto, OutfieldCardStatsDto } from "@autoxi/domain";
import type { Confidence, FjelstulCardContext, RatingSource } from "../domain/types.js";

export type RatingSourceLoadOptions = {
  sourceDir?: string;
  mode?: "report-only" | "apply-high-confidence";
};

export type RatingCandidate = {
  sourceKey: string;
  sourceType: Extract<
    RatingSource,
    "EA_HISTORICAL" | "RETRO_REFERENCE" | "FIVETHIRTYEIGHT_WORLD_CUP" | "STATSBOMB_WORLD_CUP"
  >;
  confidence: Confidence;
  rating?: number;
  stats?: OutfieldCardStatsDto | GoalkeeperCardStatsDto;
  reasons: string[];
  rawPayload?: unknown;
};

export type LoadedRatingSource = {
  sourceKey: string;
  warnings: string[];
  candidateCount: number;
  details?: Record<string, string | number | boolean>;
};

export type RatingSourceAdapter = {
  sourceKey: string;
  load(options: RatingSourceLoadOptions): Promise<LoadedRatingSource>;
  findCandidates(context: FjelstulCardContext): readonly RatingCandidate[];
};

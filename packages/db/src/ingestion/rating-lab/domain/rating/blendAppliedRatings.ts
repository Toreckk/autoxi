import type { AppliedRatingSource } from "../types.js";

export function blendAppliedRatings(sources: readonly AppliedRatingSource[]): {
  finalOverallBeforeCaps: number;
  appliedSources: readonly AppliedRatingSource[];
  ignoredSources: readonly AppliedRatingSource[];
} {
  const active = sources.filter((source) => source.affectsRating && source.effectiveWeight > 0);
  const totalWeight = active.reduce((sum, source) => sum + source.effectiveWeight, 0);

  if (totalWeight <= 0) {
    throw new Error("No rating sources available");
  }

  const rating = active.reduce((sum, source) => sum + source.rating * source.effectiveWeight, 0) / totalWeight;

  return {
    finalOverallBeforeCaps: Math.round(rating),
    appliedSources: active,
    ignoredSources: sources.filter((source) => !source.affectsRating || source.effectiveWeight <= 0)
  };
}

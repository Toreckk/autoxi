import type { RatingLabSourceAvailability } from "../domain/types.js";

export function sourceAvailabilityWarnings(availability: readonly RatingLabSourceAvailability[]): string[] {
  return availability.flatMap((source) => source.warnings.map((warning) => `${source.sourceKey}:${warning}`));
}

export function sourceAvailabilitySummary(availability: readonly RatingLabSourceAvailability[]): Record<string, string> {
  return Object.fromEntries(availability.map((source) => [source.sourceKey, source.status]));
}

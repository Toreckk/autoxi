import type { RatingLabSourcePathKey, ResolvedRatingLabSources } from "../config/ratingLabSourcePaths.js";
import type { RatingLabSourceAvailability } from "../domain/types.js";
import { createEaHistoricalAdapter } from "./ea/eaHistoricalAdapter.js";
import { probeLocalSource } from "./localSourceProbe.js";
import { createFbrefOverlayAdapter } from "./fbref/fbrefOverlayAdapter.js";
import { createRetroReferenceAdapter } from "./retro/retroReferenceAdapter.js";
import type { RatingSourceAdapter } from "./sourceAdapterTypes.js";
import { createTransfermarktAdapter } from "./transfermarkt/transfermarktAdapter.js";

export type RatingLabSourceRegistryEntry = {
  pathKey: RatingLabSourcePathKey;
  adapter: RatingSourceAdapter | null;
  readiness: "active" | "profile-only" | "skeleton" | "comparison-only" | "built-in";
};

export function ratingLabSourceRegistry(): RatingLabSourceRegistryEntry[] {
  return [
    { pathKey: "fjelstul", adapter: null, readiness: "active" },
    { pathKey: "transfermarkt", adapter: createTransfermarktAdapter(), readiness: "profile-only" },
    { pathKey: "eaHistorical", adapter: createEaHistoricalAdapter(), readiness: "skeleton" },
    { pathKey: "clubElo", adapter: createSkeletonAdapter("CLUB_ELO"), readiness: "skeleton" },
    { pathKey: "fbref", adapter: createFbrefOverlayAdapter(), readiness: "skeleton" },
    { pathKey: "sofascore", adapter: createSkeletonAdapter("SOFASCORE"), readiness: "skeleton" },
    { pathKey: "statsbomb", adapter: createSkeletonAdapter("STATSBOMB"), readiness: "skeleton" },
    { pathKey: "fiveThirtyEight", adapter: createRetroReferenceAdapter(), readiness: "skeleton" },
    { pathKey: "annualAwards", adapter: createSkeletonAdapter("ANNUAL_AWARDS"), readiness: "skeleton" },
    { pathKey: "manual", adapter: null, readiness: "built-in" },
    { pathKey: "sevenAZeroManual", adapter: null, readiness: "comparison-only" }
  ];
}

export async function profileRegisteredSources(resolvedSources: ResolvedRatingLabSources): Promise<RatingLabSourceAvailability[]> {
  const availability = new Map(resolvedSources.availability.map((source) => [source.sourceKey, { ...source }]));
  for (const entry of ratingLabSourceRegistry()) {
    const source = resolvedSources.sources[entry.pathKey];
    if (!entry.adapter || !source.available) continue;
    const loaded = await entry.adapter.load({ sourceDir: source.path, mode: "report-only" });
    const current = availability.get(source.sourceKey);
    if (!current) continue;
    if (loaded.candidateCount === 0 && loaded.warnings.includes("source_unavailable")) {
      current.status = "unavailable";
    }
    if (entry.readiness === "skeleton" && source.sourceKey === "FBREF") {
      current.status = "skeleton";
    }
    current.rowCount = loaded.candidateCount;
    current.warnings = [...current.warnings, ...loaded.warnings];
    current.details = { ...(current.details ?? {}), ...(loaded.details ?? {}) };
  }
  return [...availability.values()];
}

function createSkeletonAdapter(sourceKey: string): RatingSourceAdapter {
  return {
    sourceKey,
    async load(options) {
      const probe = await probeLocalSource(options.sourceDir);
      if (!options.sourceDir || probe.fileCount === 0) {
        return { sourceKey, warnings: ["source_unavailable"], candidateCount: 0 };
      }
      return { sourceKey, warnings: ["adapter_not_implemented"], candidateCount: probe.recordCount };
    },
    findCandidates() {
      return [];
    }
  };
}

import { access } from "node:fs/promises";
import type {
  LoadedRatingSource,
  RatingSourceAdapter,
  RatingSourceLoadOptions
} from "../sourceAdapterTypes.js";

export function createEaHistoricalAdapter(): RatingSourceAdapter {
  let loaded: LoadedRatingSource = { sourceKey: "ea-historical", warnings: [], candidateCount: 0 };

  return {
    sourceKey: "ea-historical",
    async load(options: RatingSourceLoadOptions): Promise<LoadedRatingSource> {
      if (!options.sourceDir) {
        loaded = { sourceKey: "ea-historical", warnings: ["source_unavailable"], candidateCount: 0 };
        return loaded;
      }
      try {
        await access(options.sourceDir);
      } catch {
        loaded = { sourceKey: "ea-historical", warnings: ["source_unavailable"], candidateCount: 0 };
        return loaded;
      }
      loaded = { sourceKey: "ea-historical", warnings: ["adapter_not_implemented"], candidateCount: 0 };
      return loaded;
    },
    findCandidates() {
      return [];
    }
  };
}

import { access } from "node:fs/promises";
import type {
  LoadedRatingSource,
  RatingSourceAdapter,
  RatingSourceLoadOptions
} from "../sourceAdapterTypes.js";

export function createRetroReferenceAdapter(): RatingSourceAdapter {
  let loaded: LoadedRatingSource = { sourceKey: "retro-reference", warnings: [], candidateCount: 0 };

  return {
    sourceKey: "retro-reference",
    async load(options: RatingSourceLoadOptions): Promise<LoadedRatingSource> {
      if (!options.sourceDir) {
        loaded = { sourceKey: "retro-reference", warnings: ["source_unavailable"], candidateCount: 0 };
        return loaded;
      }
      try {
        await access(options.sourceDir);
      } catch {
        loaded = { sourceKey: "retro-reference", warnings: ["source_unavailable"], candidateCount: 0 };
        return loaded;
      }
      loaded = { sourceKey: "retro-reference", warnings: ["adapter_not_implemented"], candidateCount: 0 };
      return loaded;
    },
    findCandidates() {
      return [];
    }
  };
}

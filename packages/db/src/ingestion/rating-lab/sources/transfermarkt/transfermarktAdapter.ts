import type { RatingSourceAdapter } from "../sourceAdapterTypes.js";
import { profileTransfermarktSource } from "./transfermarktProfiler.js";

export function createTransfermarktAdapter(): RatingSourceAdapter {
  return {
    sourceKey: "TRANSFERMARKT",
    async load(options) {
      if (!options.sourceDir) return { sourceKey: "TRANSFERMARKT", warnings: ["source_unavailable"], candidateCount: 0 };
      const profile = await profileTransfermarktSource(options.sourceDir);
      return {
        sourceKey: "TRANSFERMARKT",
        warnings: profile.totalRows === 0 ? ["source_unavailable"] : profile.warnings,
        candidateCount: profile.totalRows
      };
    },
    findCandidates() {
      return [];
    }
  };
}

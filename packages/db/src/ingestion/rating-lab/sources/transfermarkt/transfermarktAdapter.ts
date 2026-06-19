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
        candidateCount: profile.totalRows,
        details: {
          baseAvailable: profile.files.some((file) => !file.file.includes("overlay/")),
          overlayAvailable: profile.files.some((file) => file.file.includes("overlay/")),
          overlayPlayersCount: profile.files.find((file) => file.file.endsWith("players_overlay.csv"))?.rows ?? 0,
          overlayValuationsCount: profile.files.find((file) => file.file.endsWith("player_valuations_overlay.csv"))?.rows ?? 0
        }
      };
    },
    findCandidates() {
      return [];
    }
  };
}

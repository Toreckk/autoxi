import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { RatingSourceAdapter } from "../sourceAdapterTypes.js";
import { readCsvRows } from "../csvUtils.js";

export type FbrefOverlayProfile = {
  sourceDir: string;
  available: boolean;
  totalRows: number;
  fileRows: Record<string, number>;
  linkedPlayersCount: number;
  warnings: string[];
};

export function createFbrefOverlayAdapter(): RatingSourceAdapter {
  return {
    sourceKey: "FBREF",
    async load(options) {
      const profile = await profileFbrefOverlay(options.sourceDir);
      if (!profile.available) {
        const details: Record<string, string | number | boolean> = {
          affectsRating: false,
          reason: "live extraction disabled; future source investigation required"
        };
        return {
          sourceKey: "FBREF",
          warnings: ["source_unavailable", "live_extraction_disabled"],
          candidateCount: 0,
          details
        };
      }
      const details: Record<string, string | number | boolean> = {
        overlayAvailable: true,
        standardRows: profile.fileRows["player_season_standard.csv"] ?? 0,
        shootingRows: profile.fileRows["player_season_shooting.csv"] ?? 0,
        passingRows: profile.fileRows["player_season_passing.csv"] ?? 0,
        defenseRows: profile.fileRows["player_season_defense.csv"] ?? 0,
        possessionRows: profile.fileRows["player_season_possession.csv"] ?? 0,
        keeperRows: (profile.fileRows["player_season_keeper.csv"] ?? 0) + (profile.fileRows["player_season_keeper_adv.csv"] ?? 0),
        linkedPlayersCount: profile.linkedPlayersCount,
        affectsRating: false,
        reason: "report-only overlay profile; live extraction disabled"
      };
      return {
        sourceKey: "FBREF",
        warnings: [...profile.warnings, "live_extraction_disabled"],
        candidateCount: profile.totalRows,
        details
      };
    },
    findCandidates() {
      return [];
    }
  };
}

export async function profileFbrefOverlay(sourceDir?: string): Promise<FbrefOverlayProfile> {
  if (!sourceDir || !(await isDirectory(sourceDir))) {
    return { sourceDir: sourceDir ?? "", available: false, totalRows: 0, fileRows: {}, linkedPlayersCount: 0, warnings: [] };
  }
  const files = (await readdir(sourceDir)).filter((file) => file.endsWith(".csv")).sort();
  const fileRows: Record<string, number> = {};
  const playerIds = new Set<string>();
  const warnings: string[] = [];
  for (const file of files) {
    try {
      const rows = await readCsvRows(join(sourceDir, file));
      fileRows[file] = rows.length;
      for (const row of rows) {
        if (row.fbref_player_id) playerIds.add(row.fbref_player_id);
      }
    } catch (error) {
      warnings.push(`fbref_overlay_profile_failed:${file}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    sourceDir,
    available: files.length > 0,
    totalRows: Object.values(fileRows).reduce((sum, count) => sum + count, 0),
    fileRows,
    linkedPlayersCount: playerIds.size,
    warnings
  };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

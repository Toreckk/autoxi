import { stat } from "node:fs/promises";
import { join } from "node:path";
import { readCsvRows } from "../csvUtils.js";

export type TransfermarktSquadPresence = {
  transfermarktPlayerId: string;
  name: string;
  worldCupYear: number | null;
  seasonId: number | null;
  competitionId: string;
  clubName: string;
  reviewStatus: string;
  matchScore: number | null;
};

export async function loadTransfermarktSquadPresence(
  sourceDir = "data/sources/transfermarkt"
): Promise<TransfermarktSquadPresence[]> {
  const path = join(sourceDir, "..", "transfermarkt-overlay", "squad_presence_overlay.csv");
  if (!(await isFile(path))) return [];
  const rows = await readCsvRows(path);
  return rows
    .map((row) => ({
      transfermarktPlayerId: row.transfermarkt_player_id ?? "",
      name: row.name ?? "",
      worldCupYear: row.world_cup_year ? Number(row.world_cup_year) : null,
      seasonId: row.season_id ? Number(row.season_id) : null,
      competitionId: row.competition_id ?? "",
      clubName: row.club_name ?? "",
      reviewStatus: row.review_status ?? "",
      matchScore: row.match_score ? Number(row.match_score) : null
    }))
    .filter((row) => row.transfermarktPlayerId && row.worldCupYear !== null);
}

export function findTransfermarktSquadPresence(
  playerId: string | undefined,
  worldCupYear: number,
  rows: readonly TransfermarktSquadPresence[]
): TransfermarktSquadPresence | undefined {
  if (!playerId) return undefined;
  return rows.find((row) => row.transfermarktPlayerId === playerId && row.worldCupYear === worldCupYear);
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

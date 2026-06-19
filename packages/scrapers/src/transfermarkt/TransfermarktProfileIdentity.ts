import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readCsv, writeCsv } from "../shared/CsvWriters.js";

export const PROFILE_IDENTITY_OVERLAY_HEADERS = [
  "transfermarkt_player_id",
  "canonical_name",
  "profile_slug",
  "profile_url",
  "date_of_birth",
  "birth_year",
  "country_of_birth",
  "citizenships",
  "nationalities",
  "main_position",
  "alternate_positions",
  "foot",
  "height_cm",
  "current_club",
  "source",
  "extracted_at",
  "cache_status",
  "failure_reason"
] as const;

export type TransfermarktProfileIdentityRow = Record<(typeof PROFILE_IDENTITY_OVERLAY_HEADERS)[number], string>;

export async function loadTransfermarktProfileIdentityOverlay(outputDir: string): Promise<TransfermarktProfileIdentityRow[]> {
  return readCsv(profileIdentityOverlayPath(outputDir)) as Promise<TransfermarktProfileIdentityRow[]>;
}

export async function writeTransfermarktProfileIdentityOverlay(
  outputDir: string,
  rows: readonly TransfermarktProfileIdentityRow[]
): Promise<void> {
  await writeCsv(profileIdentityOverlayPath(outputDir), PROFILE_IDENTITY_OVERLAY_HEADERS, rows);
  await Promise.all(rows.filter((row) => row.transfermarkt_player_id).map((row) => writeProfileIdentityJsonCache(outputDir, row)));
}

export function profileIdentityOverlayPath(outputDir: string): string {
  return join(outputDir, "transfermarkt-overlay", "profile_identity_overlay.csv");
}

export function profileIdentityJsonCachePath(outputDir: string, playerId: string): string {
  return join(outputDir, "transfermarkt-overlay", "cache", "profiles", `profile_${playerId}.json`);
}

export function profileIdentityByPlayerId(
  rows: readonly TransfermarktProfileIdentityRow[]
): Map<string, TransfermarktProfileIdentityRow> {
  return new Map(rows.filter((row) => row.transfermarkt_player_id).map((row) => [row.transfermarkt_player_id, row]));
}

export function profileIdentityIsSuccessful(row: TransfermarktProfileIdentityRow | undefined): boolean {
  return Boolean(row && (row.cache_status === "hit" || row.cache_status === "fetched" || row.cache_status === "manual_overlay"));
}

async function writeProfileIdentityJsonCache(outputDir: string, row: TransfermarktProfileIdentityRow): Promise<void> {
  const path = profileIdentityJsonCachePath(outputDir, row.transfermarkt_player_id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(row, null, 2)}\n`, "utf8");
}

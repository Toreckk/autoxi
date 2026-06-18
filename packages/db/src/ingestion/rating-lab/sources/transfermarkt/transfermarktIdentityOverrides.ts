import { readFile } from "node:fs/promises";
import { normalizeName } from "../../utils.js";
import type { FjelstulCardContext } from "../../domain/types.js";
import { normalizeNationToCode } from "../nations/normalizeNation.js";

export type TransfermarktIdentityOverride = {
  fjelstulPlayerId: string;
  worldCupYear: number;
  nationCode: string;
  sourceName: string;
  transfermarktPlayerId: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

export async function loadTransfermarktIdentityOverrides(path = "data/sources/manual/transfermarkt_identity_overrides.csv"): Promise<TransfermarktIdentityOverride[]> {
  try {
    return parseOverrides(await readFile(path, "utf8"));
  } catch {
    return [];
  }
}

export function findTransfermarktIdentityOverride(
  context: FjelstulCardContext,
  overrides: readonly TransfermarktIdentityOverride[]
): TransfermarktIdentityOverride | undefined {
  const contextNation = normalizeNationToCode(context.nation);
  const contextPlayerId = context.identityKey.startsWith("fjelstul:") ? context.identityKey.slice("fjelstul:".length) : "";
  return overrides.find(
    (override) =>
      override.confidence === "HIGH" &&
      override.worldCupYear === context.worldCupYear &&
      normalizeNationToCode(override.nationCode) === contextNation &&
      (override.fjelstulPlayerId === contextPlayerId ||
        normalizeName(override.sourceName) === normalizeName(context.internalRawName))
  );
}

function parseOverrides(text: string): TransfermarktIdentityOverride[] {
  const rows = splitCsvRows(text);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])))
    .map((row) => ({
      fjelstulPlayerId: row.fjelstul_player_id ?? "",
      worldCupYear: Number(row.world_cup_year),
      nationCode: row.nation_code ?? "",
      sourceName: row.source_name ?? "",
      transfermarktPlayerId: row.transfermarkt_player_id ?? "",
      confidence: confidence(row.confidence),
      reason: row.reason ?? ""
    }))
    .filter((row) => Number.isFinite(row.worldCupYear) && row.transfermarktPlayerId);
}

function confidence(value: string | undefined): TransfermarktIdentityOverride["confidence"] {
  return value === "MEDIUM" || value === "LOW" ? value : "HIGH";
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { normalizeName } from "../../utils.js";
import { streamCsvRows, valueFor, yearFromValue, type CsvRow } from "./enrichmentCsv.js";

export type TransfermarktLocalIdDiscovery = {
  playerId: string;
  seenInPlayers: boolean;
  seenInValuations: boolean;
  seenInAppearances: boolean;
  seenInLineups: boolean;
  seenInEvents: boolean;
  seenInTransfers: boolean;
  namesSeen: string[];
  countriesSeen: string[];
  clubsSeen: string[];
  seasonsSeen: number[];
  competitionsSeen: string[];
  positionsSeen: string[];
  eventTypesSeen: string[];
  firstSeenDate: string | null;
  lastSeenDate: string | null;
};

const FILES = [
  "players.csv",
  "player_valuations.csv",
  "appearances.csv",
  "game_lineups.csv",
  "game_events.csv",
  "transfers.csv"
] as const;

export async function discoverLocalTransfermarktPlayerIds(
  sourceDir?: string,
  options: { targetNames?: readonly string[]; maxRowsPerFile?: number } = {}
): Promise<TransfermarktLocalIdDiscovery[]> {
  if (!sourceDir) return [];
  const targetNames = (options.targetNames ?? []).map(normalizeName).filter(Boolean);
  const index = new Map<string, MutableDiscovery>();
  for (const file of FILES) {
    const filePath = join(sourceDir, file);
    if (!(await isFile(filePath))) continue;
    let rowsRead = 0;
    for await (const row of streamCsvRows(filePath)) {
      rowsRead += 1;
      if (options.maxRowsPerFile && rowsRead > options.maxRowsPerFile) break;
      const playerId = valueFor(row, ["player_id", "player"]);
      if (!playerId) continue;
      if (targetNames.length > 0 && !index.has(playerId) && !rowMatchesTargetName(row, targetNames)) continue;
      applyRow(discoveryFor(index, playerId), file, row);
    }
  }
  return [...index.values()]
    .map((entry) => ({
      ...entry,
      namesSeen: sorted(entry.namesSeen),
      countriesSeen: sorted(entry.countriesSeen),
      clubsSeen: sorted(entry.clubsSeen),
      seasonsSeen: [...entry.seasonsSeen].sort((left, right) => left - right),
      competitionsSeen: sorted(entry.competitionsSeen),
      positionsSeen: sorted(entry.positionsSeen),
      eventTypesSeen: sorted(entry.eventTypesSeen)
    }))
    .sort((left, right) => Number(left.playerId) - Number(right.playerId) || left.playerId.localeCompare(right.playerId));
}

function rowMatchesTargetName(row: CsvRow, targetNames: readonly string[]): boolean {
  const rowName = valueFor(row, ["name", "player_name", "pretty_name", "player_pretty_name", "first_name"]);
  if (!rowName) return false;
  const normalized = normalizeName(rowName);
  return targetNames.some((target) => nameScore(target, normalized) >= 50);
}

export function localDiscoveryReportRows(rows: readonly TransfermarktLocalIdDiscovery[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    transfermarktPlayerId: row.playerId,
    namesSeen: row.namesSeen.join("|"),
    seenInPlayers: row.seenInPlayers,
    seenInValuations: row.seenInValuations,
    seenInAppearances: row.seenInAppearances,
    seenInLineups: row.seenInLineups,
    seenInEvents: row.seenInEvents,
    seenInTransfers: row.seenInTransfers,
    seasonsSeen: row.seasonsSeen.join("|"),
    countriesSeen: row.countriesSeen.join("|"),
    positionsSeen: row.positionsSeen.join("|"),
    profileMissing: !row.seenInPlayers,
    valuationMissing: !row.seenInValuations,
    evidenceSummary: evidenceSummary(row)
  }));
}

export function findLocalTransfermarktIdEvidence(
  rows: readonly TransfermarktLocalIdDiscovery[],
  name: string,
  nationCode?: string
): TransfermarktLocalIdDiscovery | undefined {
  const target = normalizeName(name);
  return rows
    .map((row) => ({
      row,
      score: Math.max(...row.namesSeen.map((candidate) => nameScore(target, normalizeName(candidate))), 0) +
        (nationCode && row.countriesSeen.some((country) => normalizeName(country) === normalizeName(nationCode)) ? 10 : 0)
    }))
    .filter((candidate) => candidate.score >= 50)
    .sort((left, right) => right.score - left.score)[0]?.row;
}

type MutableDiscovery = Omit<
  TransfermarktLocalIdDiscovery,
  "namesSeen" | "countriesSeen" | "clubsSeen" | "seasonsSeen" | "competitionsSeen" | "positionsSeen" | "eventTypesSeen"
> & {
  namesSeen: Set<string>;
  countriesSeen: Set<string>;
  clubsSeen: Set<string>;
  seasonsSeen: Set<number>;
  competitionsSeen: Set<string>;
  positionsSeen: Set<string>;
  eventTypesSeen: Set<string>;
};

function discoveryFor(index: Map<string, MutableDiscovery>, playerId: string): MutableDiscovery {
  const existing = index.get(playerId);
  if (existing) return existing;
  const created: MutableDiscovery = {
    playerId,
    seenInPlayers: false,
    seenInValuations: false,
    seenInAppearances: false,
    seenInLineups: false,
    seenInEvents: false,
    seenInTransfers: false,
    namesSeen: new Set(),
    countriesSeen: new Set(),
    clubsSeen: new Set(),
    seasonsSeen: new Set(),
    competitionsSeen: new Set(),
    positionsSeen: new Set(),
    eventTypesSeen: new Set(),
    firstSeenDate: null,
    lastSeenDate: null
  };
  index.set(playerId, created);
  return created;
}

function applyRow(entry: MutableDiscovery, file: (typeof FILES)[number], row: CsvRow): void {
  if (file === "players.csv") entry.seenInPlayers = true;
  if (file === "player_valuations.csv") entry.seenInValuations = true;
  if (file === "appearances.csv") entry.seenInAppearances = true;
  if (file === "game_lineups.csv") entry.seenInLineups = true;
  if (file === "game_events.csv") entry.seenInEvents = true;
  if (file === "transfers.csv") entry.seenInTransfers = true;

  add(entry.namesSeen, valueFor(row, ["name", "player_name", "pretty_name", "player_pretty_name", "first_name"]));
  add(entry.countriesSeen, valueFor(row, ["country_of_citizenship", "country_of_birth", "country", "nationality"]));
  add(entry.clubsSeen, valueFor(row, ["current_club_name", "club_name", "player_club_name", "from_club_name", "to_club_name"]));
  add(entry.competitionsSeen, valueFor(row, ["competition_id", "competition_code", "player_club_domestic_competition_id"]));
  add(entry.positionsSeen, valueFor(row, ["position", "sub_position"]));
  add(entry.eventTypesSeen, valueFor(row, ["type", "event_type"]));
  const date = valueFor(row, ["date", "transfer_date"]);
  const year = yearFromValue(date ?? valueFor(row, ["season", "year"]));
  if (year !== null) entry.seasonsSeen.add(year);
  if (date) {
    entry.firstSeenDate = entry.firstSeenDate === null || date < entry.firstSeenDate ? date : entry.firstSeenDate;
    entry.lastSeenDate = entry.lastSeenDate === null || date > entry.lastSeenDate ? date : entry.lastSeenDate;
  }
}

function evidenceSummary(row: TransfermarktLocalIdDiscovery): string {
  const files = [
    row.seenInPlayers ? "players.csv" : "",
    row.seenInValuations ? "player_valuations.csv" : "",
    row.seenInAppearances ? "appearances.csv" : "",
    row.seenInLineups ? "game_lineups.csv" : "",
    row.seenInEvents ? "game_events.csv" : "",
    row.seenInTransfers ? "transfers.csv" : ""
  ].filter(Boolean);
  return `files=${files.join("|")};seasons=${row.seasonsSeen.join("|")}`;
}

function nameScore(target: string, candidate: string): number {
  if (!target || !candidate) return 0;
  if (target === candidate) return 90;
  const targetTokenCount = target.split(" ").filter(Boolean).length;
  const candidateTokenCount = candidate.split(" ").filter(Boolean).length;
  if ((targetTokenCount > 1 && candidateTokenCount > 1) && (target.includes(candidate) || candidate.includes(target))) return 70;
  const targetTokens = new Set(target.split(" ").filter((token) => token.length > 2));
  const candidateTokens = new Set(candidate.split(" ").filter((token) => token.length > 2));
  if (targetTokens.size < 2 || candidateTokens.size < 2) return 0;
  if (targetTokens.size === 0 || candidateTokens.size === 0) return 0;
  const overlap = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
  return (overlap / Math.min(targetTokens.size, candidateTokens.size)) * 70;
}

function add(values: Set<string>, value: string | undefined): void {
  if (value?.trim()) values.add(value.trim());
}

function sorted(values: Set<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

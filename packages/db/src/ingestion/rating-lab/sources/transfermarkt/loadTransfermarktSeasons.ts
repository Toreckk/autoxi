import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { normalizeName } from "../../utils.js";
import type { TransfermarktPlayerSeason } from "./transfermarktTypes.js";

type CsvRow = Record<string, string>;

type PlayerMeta = {
  playerId: string;
  playerName: string;
  normalizedName: string;
  nation?: string;
  birthYear?: number;
  clubName?: string;
  leagueName?: string;
};

type SeasonAccumulator = {
  meta: PlayerMeta;
  seasonYear: number;
  marketValueEur: number | null;
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
};

export async function loadTransfermarktSeasons(
  sourceDir?: string,
  options: {
    years?: ReadonlySet<number>;
    targetNames?: readonly string[];
    peerRowsPerYear?: number;
  } = {}
): Promise<TransfermarktPlayerSeason[]> {
  if (!sourceDir) return [];
  const years = options.years ?? new Set<number>();
  const targetNames = (options.targetNames ?? []).map(normalizeName).filter(Boolean);
  const players = await loadPlayers(sourceDir);
  const targetIds = new Set(
    [...players.values()]
      .filter((player) => targetNames.length === 0 || targetNames.some((target) => likelySamePlayer(target, player.normalizedName)))
      .map((player) => player.playerId)
  );
  if (targetIds.size === 0 && targetNames.length > 0) return [];

  const seasons = new Map<string, SeasonAccumulator>();
  await loadValuations({ sourceDir, years, players, targetIds, seasons, peerRowsPerYear: options.peerRowsPerYear ?? 1000 });
  await loadAppearances({ sourceDir, years, players, targetIds, seasons, peerRowsPerYear: options.peerRowsPerYear ?? 1000 });

  return [...seasons.values()].map((season) => ({
    playerName: season.meta.playerName,
    normalizedName: season.meta.normalizedName,
    nation: season.meta.nation,
    seasonYear: season.seasonYear,
    birthYear: season.meta.birthYear,
    marketValueEur: season.marketValueEur,
    appearances: season.appearances || null,
    goals: season.goals || null,
    assists: season.assists || null,
    minutes: season.minutes || null,
    clubName: season.meta.clubName,
    leagueName: season.meta.leagueName
  }));
}

async function loadPlayers(sourceDir: string): Promise<Map<string, PlayerMeta>> {
  const path = join(sourceDir, "players.csv");
  if (!(await exists(path))) return new Map();
  const players = new Map<string, PlayerMeta>();
  for await (const row of streamCsv(path)) {
    const playerId = valueFor(row, ["player_id", "player"]);
    const playerName = valueFor(row, ["name", "player_name"]) ?? [valueFor(row, ["first_name"]), valueFor(row, ["last_name"])].filter(Boolean).join(" ");
    if (!playerId || !playerName) continue;
    players.set(playerId, {
      playerId,
      playerName,
      normalizedName: normalizeName(playerName),
      nation: valueFor(row, ["country_of_citizenship", "country_of_birth"]),
      birthYear: yearFromValue(valueFor(row, ["date_of_birth"])) ?? undefined,
      clubName: valueFor(row, ["current_club_name"]),
      leagueName: valueFor(row, ["current_club_domestic_competition_id"])
    });
  }
  return players;
}

async function loadValuations({
  sourceDir,
  years,
  players,
  targetIds,
  seasons,
  peerRowsPerYear
}: {
  sourceDir: string;
  years: ReadonlySet<number>;
  players: ReadonlyMap<string, PlayerMeta>;
  targetIds: ReadonlySet<string>;
  seasons: Map<string, SeasonAccumulator>;
  peerRowsPerYear: number;
}): Promise<void> {
  const path = join(sourceDir, "player_valuations.csv");
  if (!(await exists(path))) return;
  const peerCounts = new Map<number, number>();
  for await (const row of streamCsv(path)) {
    const playerId = valueFor(row, ["player_id"]);
    const year = yearFromValue(valueFor(row, ["date"]));
    if (!playerId || year === null || (years.size > 0 && !years.has(year))) continue;
    const meta = players.get(playerId);
    if (!meta) continue;
    if (!shouldKeepRow(playerId, year, targetIds, peerCounts, peerRowsPerYear)) continue;
    const season = seasonFor(seasons, meta, year);
    const value = numberFor(row, ["market_value_in_eur", "market_value_eur", "market_value"]);
    if (value !== null) season.marketValueEur = Math.max(season.marketValueEur ?? 0, value);
  }
}

async function loadAppearances({
  sourceDir,
  years,
  players,
  targetIds,
  seasons,
  peerRowsPerYear
}: {
  sourceDir: string;
  years: ReadonlySet<number>;
  players: ReadonlyMap<string, PlayerMeta>;
  targetIds: ReadonlySet<string>;
  seasons: Map<string, SeasonAccumulator>;
  peerRowsPerYear: number;
}): Promise<void> {
  const path = join(sourceDir, "appearances.csv");
  if (!(await exists(path))) return;
  const peerCounts = new Map<number, number>();
  for await (const row of streamCsv(path)) {
    const playerId = valueFor(row, ["player_id"]);
    const year = yearFromValue(valueFor(row, ["date"]));
    if (!playerId || year === null || (years.size > 0 && !years.has(year))) continue;
    const meta = players.get(playerId) ?? metaFromAppearanceRow(playerId, row);
    if (!shouldKeepRow(playerId, year, targetIds, peerCounts, peerRowsPerYear)) continue;
    const season = seasonFor(seasons, meta, year);
    season.appearances += 1;
    season.goals += numberFor(row, ["goals"]) ?? 0;
    season.assists += numberFor(row, ["assists"]) ?? 0;
    season.minutes += numberFor(row, ["minutes_played", "minutes", "mins"]) ?? 0;
  }
}

function seasonFor(seasons: Map<string, SeasonAccumulator>, meta: PlayerMeta, seasonYear: number): SeasonAccumulator {
  const key = `${meta.playerId}:${seasonYear}`;
  const existing = seasons.get(key);
  if (existing) return existing;
  const created = {
    meta,
    seasonYear,
    marketValueEur: null,
    appearances: 0,
    goals: 0,
    assists: 0,
    minutes: 0
  };
  seasons.set(key, created);
  return created;
}

function shouldKeepRow(
  playerId: string,
  year: number,
  targetIds: ReadonlySet<string>,
  peerCounts: Map<number, number>,
  peerRowsPerYear: number
): boolean {
  if (targetIds.has(playerId)) return true;
  const count = peerCounts.get(year) ?? 0;
  if (count >= peerRowsPerYear) return false;
  peerCounts.set(year, count + 1);
  return true;
}

function metaFromAppearanceRow(playerId: string, row: CsvRow): PlayerMeta {
  const playerName = valueFor(row, ["player_name", "name"]) ?? playerId;
  return {
    playerId,
    playerName,
    normalizedName: normalizeName(playerName)
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function* streamCsv(filePath: string): AsyncGenerator<CsvRow> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers: string[] | null = null;
  for await (const line of lines) {
    if (headers === null) {
      headers = parseCsvLine(line).map((header) => header.trim());
      continue;
    }
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    yield Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  values.push(cell);
  return values;
}

function valueFor(row: CsvRow, keys: readonly string[]): string | undefined {
  const normalizedEntries = new Map(Object.entries(row).map(([key, value]) => [normalizeName(key), value]));
  for (const key of keys) {
    const value = normalizedEntries.get(normalizeName(key));
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function numberFor(row: CsvRow, keys: readonly string[]): number | null {
  const value = valueFor(row, keys);
  if (!value) return null;
  const normalized = value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function yearFromValue(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/\b(18|19|20)\d{2}\b/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function likelySamePlayer(target: string, candidate: string): boolean {
  if (target === candidate || target.includes(candidate) || candidate.includes(target)) return true;
  const targetTokens = new Set(target.split(" ").filter((token) => token.length > 2));
  const candidateTokens = new Set(candidate.split(" ").filter((token) => token.length > 2));
  if (targetTokens.size === 0 || candidateTokens.size === 0) return false;
  const overlap = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
  return overlap / Math.min(targetTokens.size, candidateTokens.size) >= 0.67;
}

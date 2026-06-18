import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  position?: string;
  subPosition?: string;
  clubName?: string;
  leagueName?: string;
};

type SeasonAccumulator = {
  meta: PlayerMeta;
  seasonYear: number;
  marketValueEur: number | null;
  highestMarketValueEur: number | null;
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
  starterCount: number;
  benchCount: number;
  captainCount: number;
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
  await loadLineups({ sourceDir, years, players, targetIds, seasons, peerRowsPerYear: options.peerRowsPerYear ?? 1000 });

  return [...seasons.values()].map((season) => ({
    playerId: season.meta.playerId,
    playerName: season.meta.playerName,
    normalizedName: season.meta.normalizedName,
    nation: season.meta.nation,
    seasonYear: season.seasonYear,
    birthYear: season.meta.birthYear,
    position: season.meta.position,
    subPosition: season.meta.subPosition,
    marketValueEur: season.marketValueEur,
    highestMarketValueEur: season.highestMarketValueEur,
    appearances: season.appearances || null,
    goals: season.goals || null,
    assists: season.assists || null,
    minutes: season.minutes || null,
    yellowCards: season.yellowCards || null,
    redCards: season.redCards || null,
    starterCount: season.starterCount || null,
    benchCount: season.benchCount || null,
    captainCount: season.captainCount || null,
    clubName: season.meta.clubName,
    leagueName: season.meta.leagueName
  }));
}

async function loadPlayers(sourceDir: string): Promise<Map<string, PlayerMeta>> {
  const path = join(sourceDir, "players.csv");
  const players = new Map<string, PlayerMeta>();
  for (const playerPath of [path, join(dirname(sourceDir), "transfermarkt-overlay", "players_overlay.csv")]) {
    if (!(await exists(playerPath))) continue;
    for await (const row of streamCsv(playerPath)) {
    const playerId = valueFor(row, ["player_id", "player"]);
    const playerName = valueFor(row, ["name", "player_name"]) ?? [valueFor(row, ["first_name"]), valueFor(row, ["last_name"])].filter(Boolean).join(" ");
    if (!playerId || !playerName) continue;
      const next = {
      playerId,
      playerName,
      normalizedName: normalizeName(playerName),
      nation: valueFor(row, ["country_of_citizenship", "country_of_birth"]),
      birthYear: yearFromValue(valueFor(row, ["date_of_birth"])) ?? undefined,
      position: valueFor(row, ["position"]),
      subPosition: valueFor(row, ["sub_position"]),
      clubName: valueFor(row, ["current_club_name"]),
      leagueName: valueFor(row, ["current_club_domestic_competition_id"])
      };
      const existing = players.get(playerId);
      players.set(playerId, existing ? fillMissingPlayerMeta(existing, next) : next);
    }
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
  const peerCounts = new Map<number, number>();
  for (const path of [join(sourceDir, "player_valuations.csv"), join(dirname(sourceDir), "transfermarkt-overlay", "player_valuations_overlay.csv")]) {
    if (!(await exists(path))) continue;
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
    if (value !== null) season.highestMarketValueEur = Math.max(season.highestMarketValueEur ?? 0, value);
    }
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
  const peerCounts = new Map<number, number>();
  for (const path of [join(sourceDir, "appearances.csv"), join(dirname(sourceDir), "transfermarkt-overlay", "appearances_overlay.csv")]) {
    if (!(await exists(path))) continue;
    for await (const row of streamCsv(path)) {
    const source = (valueFor(row, ["source"]) ?? "").toLowerCase().replaceAll("_", " ");
    if (source.startsWith("transfermarkt squad presence")) continue;
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
    season.yellowCards += numberFor(row, ["yellow_cards"]) ?? 0;
    season.redCards += numberFor(row, ["red_cards"]) ?? 0;
    }
  }
}

async function loadLineups({
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
  const peerCounts = new Map<number, number>();
  for (const path of [join(sourceDir, "game_lineups.csv"), join(dirname(sourceDir), "transfermarkt-overlay", "game_lineups_overlay.csv")]) {
    if (!(await exists(path))) continue;
    for await (const row of streamCsv(path)) {
    const playerId = valueFor(row, ["player_id"]);
    const year = yearFromValue(valueFor(row, ["date"]));
    if (!playerId || year === null || (years.size > 0 && !years.has(year))) continue;
    const meta = players.get(playerId) ?? metaFromAppearanceRow(playerId, row);
    if (!shouldKeepRow(playerId, year, targetIds, peerCounts, peerRowsPerYear)) continue;
    const season = seasonFor(seasons, meta, year);
    const type = normalizeName(valueFor(row, ["type"]) ?? "");
    if (type.includes("start") || type === "starting lineup") season.starterCount += 1;
    if (type.includes("sub") || type.includes("bench")) season.benchCount += 1;
    if (normalizeName(valueFor(row, ["team_captain"]) ?? "") === "1" || normalizeName(valueFor(row, ["team_captain"]) ?? "") === "true") {
      season.captainCount += 1;
    }
    }
  }
}

function fillMissingPlayerMeta(base: PlayerMeta, overlay: PlayerMeta): PlayerMeta {
  return {
    playerId: base.playerId,
    playerName: base.playerName || overlay.playerName,
    normalizedName: base.normalizedName || overlay.normalizedName,
    nation: base.nation || overlay.nation,
    birthYear: base.birthYear ?? overlay.birthYear,
    position: base.position || overlay.position,
    subPosition: base.subPosition || overlay.subPosition,
    clubName: base.clubName || overlay.clubName,
    leagueName: base.leagueName || overlay.leagueName
  };
}

function seasonFor(seasons: Map<string, SeasonAccumulator>, meta: PlayerMeta, seasonYear: number): SeasonAccumulator {
  const key = `${meta.playerId}:${seasonYear}`;
  const existing = seasons.get(key);
  if (existing) return existing;
  const created = {
    meta,
    seasonYear,
    marketValueEur: null,
    highestMarketValueEur: null,
    appearances: 0,
    goals: 0,
    assists: 0,
    minutes: 0,
    yellowCards: 0,
    redCards: 0,
    starterCount: 0,
    benchCount: 0,
    captainCount: 0
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

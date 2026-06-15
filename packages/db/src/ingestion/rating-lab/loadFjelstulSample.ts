import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  broadLineForPosition,
  resolveEditionKeyFromAwards,
  type CardEditionKey,
  type CardRole,
  type VisiblePosition
} from "@autoxi/domain";
import { ICONIC_TARGET_SEARCH_TERMS } from "./iconicTargets.js";
import type { FjelstulCardContext, TeamResult } from "./types.js";
import { deterministicPick, deterministicUnit, normalizeName, publicSafePlaceholderName } from "./utils.js";

export type LoadFjelstulSampleOptions = {
  sourceDir: string;
  sample?: "all" | "iconic-plus-random" | "random";
  randomCount?: number;
  seed?: string;
  players?: string[];
  worldCupYears?: number[];
};

type CsvRow = Record<string, string>;

const POSITION_ALIASES: Record<string, VisiblePosition> = {
  gk: "GK",
  goalkeeper: "GK",
  goalie: "GK",
  df: "CB",
  defender: "CB",
  cb: "CB",
  sw: "CB",
  lb: "LB",
  rb: "RB",
  mf: "CM",
  midfielder: "CM",
  cdm: "CDM",
  dm: "CDM",
  cm: "CM",
  cam: "CAM",
  am: "CAM",
  lm: "LM",
  rm: "RM",
  fw: "ST",
  forward: "ST",
  st: "ST",
  cf: "ST",
  ca: "ST",
  lw: "LW",
  rw: "RW",
  pd: "RW",
  pe: "LW"
};

export async function loadFjelstulSample(options: LoadFjelstulSampleOptions): Promise<FjelstulCardContext[]> {
  const files = await readCsvFiles(options.sourceDir);
  const squads = pickRows(files, ["squad", "roster", "player_appearances", "appearances", "players"]);
  const appearances = pickRows(files, ["appearance", "lineup", "player_match"]);
  const goals = pickRows(files, ["goal", "event"]);
  const awards = pickRows(files, ["award"]);
  const tournaments = pickRows(files, ["tournament", "world_cup"]);
  const results = pickRows(files, ["result", "standing", "team"]);

  const appearanceIndex = aggregateNumber(appearances, ["appearances", "appearance", "match_count"], 1);
  const minutesIndex = aggregateNumber(appearances, ["minutes", "mins"], 0);
  const goalsIndex = aggregateNumber(goals, ["goals", "goal_count"], 1);
  const awardIndex = aggregateAwards(awards);
  const resultIndex = aggregateResults(results);
  const hosts = aggregateHosts(tournaments);

  const seen = new Map<string, FjelstulCardContext>();
  for (const row of squads) {
    const internalRawName = valueFor(row, ["player_name", "given_name", "family_name", "name", "player"]) || "Unknown Player";
    const worldCupYear = numberFor(row, ["year", "world_cup_year", "tournament_year", "copa"]);
    if (!worldCupYear) continue;

    const nation = valueFor(row, ["team_code", "team", "nation", "squad", "sel", "country"]) || "UNK";
    const identityBase = normalizeName(valueFor(row, ["player_id", "playerId", "person_id", "id"]) || internalRawName);
    const identityKey = `${identityBase}-${normalizeName(nation)}`;
    const key = `${identityKey}-${worldCupYear}`;
    if (seen.has(key)) continue;

    const position = mapFjelstulPosition(valueFor(row, ["position", "pos", "shirt_position", "positions"]));
    const metricKey = metricKeyFor(row, internalRawName, nation, worldCupYear);
    const rowAwards = awardIndex.get(metricKey) ?? [];
    const context: FjelstulCardContext = {
      identityKey,
      internalRawName,
      publicPlaceholderName: publicSafePlaceholderName({ nation, worldCupYear, position, identityKey: key }),
      worldCupYear,
      nation,
      position,
      role: roleForPosition(position),
      squadPresence: true,
      appearances: numberFor(row, ["appearances", "matches", "caps"]) ?? appearanceIndex.get(metricKey) ?? 0,
      minutes: numberFor(row, ["minutes", "mins"]) ?? minutesIndex.get(metricKey) ?? 0,
      goals: numberFor(row, ["goals"]) ?? goalsIndex.get(metricKey) ?? 0,
      captain: booleanFor(row, ["captain", "is_captain"]),
      awards: rowAwards,
      teamResult: resultIndex.get(`${worldCupYear}:${normalizeName(nation)}`) ?? "UNKNOWN",
      host: hosts.get(worldCupYear) === normalizeName(nation),
      tournamentCount: 1,
      samePlayerEditionCount: 1,
      seed: options.seed ?? "rating-lab"
    };
    context.awards = rowAwards.length > 0 ? rowAwards : [resolveEditionKeyFromAwards({ position, awardKeys: [] })].filter(
      (award): award is CardEditionKey => award !== "NONE"
    );
    seen.set(key, context);
  }

  const countsByIdentity = new Map<string, number>();
  for (const card of seen.values()) {
    countsByIdentity.set(card.identityKey, (countsByIdentity.get(card.identityKey) ?? 0) + 1);
  }

  const allCards = [...seen.values()].map((card) => ({
    ...card,
    samePlayerEditionCount: countsByIdentity.get(card.identityKey) ?? 1,
    tournamentCount: countsByIdentity.get(card.identityKey) ?? 1
  }));

  return selectSample(allCards, options);
}

export function mapFjelstulPosition(rawPosition?: string): VisiblePosition {
  const normalized = normalizeName(rawPosition ?? "");
  if (!normalized) return "CM";
  const tokens = normalized.split(" ");
  for (const token of tokens) {
    if (POSITION_ALIASES[token]) return POSITION_ALIASES[token];
  }
  return POSITION_ALIASES[normalized] ?? "CM";
}

function roleForPosition(position: VisiblePosition): CardRole {
  switch (broadLineForPosition(position)) {
    case "GOALKEEPER":
      return "Shot Stopper";
    case "DEFENDER":
      return position === "LB" || position === "RB" ? "Wingback" : "Anchor";
    case "MIDFIELDER":
      return position === "CDM" ? "Ball Winner" : position === "CAM" ? "Creator" : "Tempo Setter";
    case "FORWARD":
      return position === "ST" ? "Finisher" : "Wide Threat";
  }
}

async function readCsvFiles(sourceDir: string): Promise<Map<string, CsvRow[]>> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const csvFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"));
  const files = new Map<string, CsvRow[]>();
  for (const file of csvFiles) {
    const text = await readFile(join(sourceDir, file.name), "utf8");
    files.set(file.name.toLowerCase(), parseCsv(text));
  }
  return files;
}

function parseCsv(text: string): CsvRow[] {
  const rows = splitCsvRows(text);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]))
    );
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

function pickRows(files: Map<string, CsvRow[]>, needles: readonly string[]): CsvRow[] {
  const match = [...files.entries()].find(([name]) => needles.some((needle) => name.includes(needle)));
  return match?.[1] ?? [];
}

function valueFor(row: CsvRow, keys: readonly string[]): string | undefined {
  const normalizedEntries = new Map(Object.entries(row).map(([key, value]) => [normalizeName(key), value]));
  for (const key of keys) {
    const value = normalizedEntries.get(normalizeName(key));
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function numberFor(row: CsvRow, keys: readonly string[]): number | undefined {
  const value = valueFor(row, keys);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanFor(row: CsvRow, keys: readonly string[]): boolean {
  const value = normalizeName(valueFor(row, keys) ?? "");
  return value === "1" || value === "true" || value === "yes" || value === "captain";
}

function metricKeyFor(row: CsvRow, rawName: string, nation: string, year: number): string {
  const playerId = valueFor(row, ["player_id", "playerId", "person_id", "id"]);
  return `${year}:${normalizeName(nation)}:${normalizeName(playerId || rawName)}`;
}

function aggregateNumber(rows: readonly CsvRow[], keys: readonly string[], fallbackIncrement: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const rawName = valueFor(row, ["player_name", "name", "player"]) || "";
    const nation = valueFor(row, ["team_code", "team", "nation", "sel", "country"]) || "UNK";
    const year = numberFor(row, ["year", "world_cup_year", "tournament_year", "copa"]);
    if (!year || !rawName) continue;
    const key = metricKeyFor(row, rawName, nation, year);
    totals.set(key, (totals.get(key) ?? 0) + (numberFor(row, keys) ?? fallbackIncrement));
  }
  return totals;
}

function aggregateAwards(rows: readonly CsvRow[]): Map<string, CardEditionKey[]> {
  const awards = new Map<string, CardEditionKey[]>();
  for (const row of rows) {
    const rawName = valueFor(row, ["player_name", "winner", "name", "player"]) || "";
    const nation = valueFor(row, ["team_code", "team", "nation", "sel", "country"]) || "UNK";
    const year = numberFor(row, ["year", "world_cup_year", "tournament_year", "copa"]);
    if (!year || !rawName) continue;
    const award = mapAward(valueFor(row, ["award", "award_code", "label", "type"]));
    if (!award) continue;
    const key = metricKeyFor(row, rawName, nation, year);
    awards.set(key, [...(awards.get(key) ?? []), award]);
  }
  return awards;
}

function mapAward(rawAward?: string): CardEditionKey | null {
  const normalized = normalizeName(rawAward ?? "");
  if (normalized.includes("golden ball")) return "GOLDEN_BALL";
  if (normalized.includes("golden boot") || normalized.includes("top scorer")) return "GOLDEN_BOOT";
  if (normalized.includes("golden glove") || normalized.includes("yashin")) return "GOLDEN_GLOVE";
  if (normalized.includes("young")) return "BEST_YOUNG_PLAYER";
  return null;
}

function aggregateResults(rows: readonly CsvRow[]): Map<string, TeamResult> {
  const results = new Map<string, TeamResult>();
  for (const row of rows) {
    const year = numberFor(row, ["year", "world_cup_year", "tournament_year", "copa"]);
    const nation = valueFor(row, ["team_code", "team", "nation", "sel", "country"]);
    if (!year || !nation) continue;
    const finalRank = numberFor(row, ["final_rank", "rank", "position"]);
    const resultCode = normalizeName(valueFor(row, ["result_code", "result", "stage"]) ?? "");
    const result =
      finalRank === 1 || resultCode.includes("champion")
        ? "CHAMPION"
        : finalRank === 2 || resultCode.includes("runner")
          ? "RUNNER_UP"
          : finalRank === 3
            ? "THIRD"
            : finalRank === 4
              ? "FOURTH"
              : resultCode.includes("group")
                ? "GROUP_STAGE"
                : "UNKNOWN";
    results.set(`${year}:${normalizeName(nation)}`, result);
  }
  return results;
}

function aggregateHosts(rows: readonly CsvRow[]): Map<number, string> {
  const hosts = new Map<number, string>();
  for (const row of rows) {
    const year = numberFor(row, ["year", "world_cup_year", "tournament_year", "copa"]);
    const host = valueFor(row, ["host_country_code", "host", "host_name", "country"]);
    if (year && host) hosts.set(year, normalizeName(host));
  }
  return hosts;
}

function selectSample(cards: readonly FjelstulCardContext[], options: LoadFjelstulSampleOptions): FjelstulCardContext[] {
  const yearSet = options.worldCupYears ? new Set(options.worldCupYears) : null;
  const playerSearch = options.players?.map(normalizeName);
  let filtered = cards.filter((card) => !yearSet || yearSet.has(card.worldCupYear));
  if (playerSearch?.length) {
    filtered = filtered.filter((card) =>
      playerSearch.some((term) => normalizeName(card.internalRawName).includes(term))
    );
  }

  if (options.sample === "all" || playerSearch?.length) return filtered;

  const iconicTerms = ICONIC_TARGET_SEARCH_TERMS.map(normalizeName);
  const iconic = filtered.filter((card) =>
    iconicTerms.some((term) => normalizeName(card.internalRawName).includes(term))
  );
  const randomPool = filtered.filter((card) => !iconic.includes(card));
  const randomCount = options.randomCount ?? 100;
  const seed = options.seed ?? "rating-lab";
  const random = [...randomPool]
    .sort((left, right) => deterministicUnit(`${seed}:${left.identityKey}:${left.worldCupYear}`) - deterministicUnit(`${seed}:${right.identityKey}:${right.worldCupYear}`))
    .slice(0, randomCount);

  if (options.sample === "random") return random;
  return [...iconic, ...random].sort((left, right) =>
    deterministicPick([-1, 1] as const, `${seed}:order:${left.identityKey}:${right.identityKey}`)
  );
}

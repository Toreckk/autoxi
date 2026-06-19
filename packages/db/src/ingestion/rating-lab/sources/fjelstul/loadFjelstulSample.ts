import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  broadLineForPosition,
  resolveEditionKeyFromAwards,
  type CardEditionKey,
  type CardRole,
  type VisiblePosition
} from "@autoxi/domain";
import { ICONIC_TARGET_SEARCH_TERMS } from "../manual/iconicTargets.js";
import type { FjelstulCardContext, TeamResult } from "../../domain/types.js";
import { deterministicUnit, normalizeName, publicSafePlaceholderName } from "../../utils.js";

export type LoadFjelstulSampleOptions = {
  sourceDir: string;
  sample?: "all" | "iconic-plus-random" | "random";
  randomCount?: number;
  seed?: string;
  players?: string[];
  worldCupYears?: number[];
  includeWomensWorldCups?: boolean;
};

export type FjelstulSourceReadiness = {
  playersRowsRead: number;
  squadRowsRead: number;
  tournamentRowsRead: number;
  teamRowsRead: number;
  standingRowsRead: number;
  awardRowsRead: number;
  awardWinnerRowsRead: number;
  hostRowsRead: number;
  optionalAppearanceRowsRead: number;
  optionalGoalRowsRead: number;
  requiredSourceFilesLoaded: boolean;
  sourceWarnings: string[];
  tournamentFilterSummary?: TournamentFilterRunSummary;
};

export type FjelstulSampleLoadResult = {
  cards: FjelstulCardContext[];
  sourceReadiness: FjelstulSourceReadiness;
};

export type TournamentFilterReportRow = {
  worldCupYear: number;
  tournamentId: string;
  tournamentName: string;
  genderOrCategory: "MEN" | "WOMEN" | "UNKNOWN";
  included: boolean;
  excludedReason: string;
  cardCount: number;
};

export type TournamentFilterRunSummary = {
  mode: "MEN_ONLY" | "INCLUDE_WOMENS_WORLD_CUPS";
  includedMenWorldCupYears: number[];
  excludedWomenWorldCupYears: number[];
  totalCardsBeforeGenderFilter: number;
  totalCardsAfterGenderFilter: number;
  rows: TournamentFilterReportRow[];
};

type CsvRow = Record<string, string>;

type AwardDefinition = {
  id: string;
  label: string;
  editionKey: CardEditionKey | null;
};

type AwardWinnerIndex = {
  awards: Map<string, CardEditionKey[]>;
  warnings: string[];
};

type PlayerTournamentNationIndex = Map<string, string>;
type TournamentInfo = {
  id: string;
  year: number;
  name: string;
  genderOrCategory: "MEN" | "WOMEN" | "UNKNOWN";
};
type HostResolution = {
  label: string;
  code: string;
  source: string;
  warning: string | null;
};

const POSITION_ALIASES: Record<string, VisiblePosition> = {
  gk: "GK",
  goalkeeper: "GK",
  "goal keeper": "GK",
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
  return (await loadFjelstulSampleWithReadiness(options)).cards;
}

export async function loadFjelstulSampleWithReadiness(
  options: LoadFjelstulSampleOptions
): Promise<FjelstulSampleLoadResult> {
  const files = await readCsvFiles(options.sourceDir);
  const squadRows = pickFirstExisting(files, ["squads.csv", "player_squads.csv"]);
  const playerRows = pickFirstExisting(files, ["players.csv"]);
  const awardRows = pickFirstExisting(files, ["awards.csv"]);
  const awardWinnerRows = pickFirstExisting(files, ["award_winners.csv"]);
  const standingRows = pickFirstExisting(files, ["tournament_standings.csv"]);
  const hostRows = pickFirstExisting(files, ["host_countries.csv"]);
  const teamRows = pickFirstExisting(files, ["teams.csv"]);
  const tournamentRows = pickFirstExisting(files, ["tournaments.csv"]);
  const appearanceRows = pickFirstExisting(files, ["appearances.csv", "player_appearances.csv"]);
  const goalRows = pickFirstExisting(files, ["goals.csv"]);

  const sourceWarnings = new Set<string>();
  addMissingWarnings(sourceWarnings, [
    ["players.csv", playerRows, "players_missing"],
    ["squads.csv", squadRows, "squads_missing"],
    ["tournaments.csv", tournamentRows, "tournaments_missing"],
    ["teams.csv", teamRows, "teams_missing"],
    ["tournament_standings.csv", standingRows, "standings_missing"],
    ["awards.csv", awardRows, "award_definitions_missing"],
    ["award_winners.csv", awardWinnerRows, "award_winners_missing"],
    ["host_countries.csv", hostRows, "host_countries_missing"],
    ["appearances.csv", appearanceRows, "appearances_missing"],
    ["goals.csv", goalRows, "goals_missing"]
  ]);

  const playersById = buildRowsById(playerRows, ["player_id", "player", "person_id", "id"]);
  const tournamentYearById = buildTournamentYearById(tournamentRows);
  const tournamentInfoByYear = buildTournamentInfoByYear(tournamentRows);
  const teamCodeById = buildTeamCodeById(teamRows);
  const playerTournamentNationIndex = buildPlayerTournamentNationIndex({
    squadRows,
    tournamentYearById,
    teamCodeById
  });
  const appearanceIndex = aggregateNumber({
    rows: appearanceRows,
    keys: ["appearances", "appearance", "match_count"],
    fallbackIncrement: 1,
    playersById,
    tournamentYearById,
    teamCodeById,
    playerTournamentNationIndex,
    warnings: sourceWarnings
  });
  const minutesIndex = aggregateNumber({
    rows: appearanceRows,
    keys: ["minutes", "mins"],
    fallbackIncrement: 0,
    playersById,
    tournamentYearById,
    teamCodeById,
    playerTournamentNationIndex,
    warnings: sourceWarnings
  });
  const goalsIndex = aggregateNumber({
    rows: goalRows,
    keys: ["goals", "goal_count"],
    fallbackIncrement: 1,
    playersById,
    tournamentYearById,
    teamCodeById,
    playerTournamentNationIndex,
    warnings: sourceWarnings
  });
  const awardIndex = aggregateAwardWinners({
    awardRows,
    awardWinnerRows,
    playerRows,
    tournamentRows,
    teamRows,
    playerTournamentNationIndex
  });
  for (const warning of awardIndex.warnings) sourceWarnings.add(warning);
  const resultIndex = aggregateResults(standingRows, tournamentYearById, teamCodeById);
  const hosts = aggregateHosts(hostRows, tournamentYearById, teamCodeById);
  const hostLabels = aggregateHostLabels(hostRows, tournamentRows, teamRows, tournamentYearById, teamCodeById);

  const seen = new Map<string, FjelstulCardContext>();
  for (const row of squadRows) {
    const playerRow = playerRowFor(row, playersById);
    const mergedRow = { ...(playerRow ?? {}), ...row };
    const internalRawName = playerDisplayNameFromRow(mergedRow);
    const worldCupYear = yearForRow(mergedRow, tournamentYearById);
    if (!worldCupYear) continue;

    const nation = nationForRow(mergedRow, teamCodeById);
    const identityKey = identityKeyFor(mergedRow, internalRawName, nation);
    const key = `${identityKey}:${worldCupYear}`;
    if (seen.has(key)) continue;

    const position = positionForRow(mergedRow);
    const metricKey = metricKeyFor(mergedRow, internalRawName, nation, worldCupYear);
    const rowAwards = awardIndex.awards.get(metricKey) ?? [];
    const context: FjelstulCardContext = {
      identityKey,
      internalRawName,
      publicPlaceholderName: publicSafePlaceholderName({ nation, worldCupYear, position, identityKey: key }),
      worldCupYear,
      nation,
      position,
      role: roleForPosition(position),
      squadPresence: true,
      appearances:
        numberFor(mergedRow, ["appearances", "matches", "caps"]) ?? appearanceIndex.get(metricKey) ?? 0,
      minutes: numberFor(mergedRow, ["minutes", "mins"]) ?? minutesIndex.get(metricKey) ?? 0,
      goals: numberFor(mergedRow, ["goals"]) ?? goalsIndex.get(metricKey) ?? 0,
      captain: booleanFor(mergedRow, ["captain", "is_captain"]),
      awards:
        rowAwards.length > 0
          ? rowAwards
          : [resolveEditionKeyFromAwards({ position, awardKeys: [] })].filter(
              (award): award is CardEditionKey => award !== "NONE"
            ),
      teamResult: resultIndex.get(`${worldCupYear}:${normalizeName(nation)}`) ?? "UNKNOWN",
      host: hosts.get(worldCupYear)?.has(normalizeName(nation)) ?? false,
      debugRealName: internalRawName,
      publicDisplayName: publicSafePlaceholderName({ nation, worldCupYear, position, identityKey: key }),
      isLocalDebugOnly: true,
      hostCountryLabel: hostLabels.get(worldCupYear)?.label ?? "UNKNOWN HOST",
      hostCountryCode: hostLabels.get(worldCupYear)?.code ?? "UNK",
      hostResolutionSource: hostLabels.get(worldCupYear)?.source ?? "fallback",
      hostResolutionWarning: hostLabels.has(worldCupYear)
        ? hostLabels.get(worldCupYear)!.warning
        : `host_country_unresolved:${worldCupYear}`,
      tournamentCount: 1,
      samePlayerEditionCount: 1,
      seed: options.seed ?? "rating-lab"
    };
    seen.set(key, context);
  }

  const countsByIdentity = new Map<string, number>();
  for (const card of seen.values()) {
    countsByIdentity.set(card.identityKey, (countsByIdentity.get(card.identityKey) ?? 0) + 1);
  }

  const unfilteredCards = [...seen.values()].map((card) => ({
    ...card,
    samePlayerEditionCount: countsByIdentity.get(card.identityKey) ?? 1,
    tournamentCount: countsByIdentity.get(card.identityKey) ?? 1
  }));
  const tournamentFilterSummary = buildTournamentFilterSummary({
    cards: unfilteredCards,
    tournamentInfoByYear,
    includeWomensWorldCups: options.includeWomensWorldCups ?? false
  });
  const allCards = unfilteredCards.filter(
    (card) => options.includeWomensWorldCups || tournamentInfoByYear.get(card.worldCupYear)?.genderOrCategory !== "WOMEN"
  );

  const requiredSourceFilesLoaded =
    playerRows.length > 0 && squadRows.length > 0 && tournamentRows.length > 0 && teamRows.length > 0;

  return {
    cards: selectSample(allCards, options),
    sourceReadiness: {
      playersRowsRead: playerRows.length,
      squadRowsRead: squadRows.length,
      tournamentRowsRead: tournamentRows.length,
      teamRowsRead: teamRows.length,
      standingRowsRead: standingRows.length,
      awardRowsRead: awardRows.length,
      awardWinnerRowsRead: awardWinnerRows.length,
      hostRowsRead: hostRows.length,
      optionalAppearanceRowsRead: appearanceRows.length,
      optionalGoalRowsRead: goalRows.length,
      requiredSourceFilesLoaded,
      sourceWarnings: [...sourceWarnings].sort(),
      tournamentFilterSummary
    }
  };
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

export function positionForRow(row: CsvRow): VisiblePosition {
  const rawPosition = valueFor(row, ["position", "pos", "shirt_position", "positions", "position_name", "position_code"]);
  if (rawPosition) return mapFjelstulPosition(rawPosition);
  if (booleanFor(row, ["goal_keeper", "goalkeeper", "is_goalkeeper"])) return "GK";
  if (booleanFor(row, ["defender", "is_defender"])) return "CB";
  if (booleanFor(row, ["forward", "is_forward"])) return "ST";
  if (booleanFor(row, ["midfielder", "is_midfielder"])) return "CM";
  return "CM";
}

export function playerDisplayNameFromRow(row: CsvRow): string {
  const directName = valueFor(row, ["player_name", "name", "full_name", "known_as"]);
  if (directName) return directName;

  const given = valueFor(row, ["given_name", "given_names", "first_name"]);
  const family = valueFor(row, ["family_name", "surname", "last_name"]);
  const combined = [given, family].filter(Boolean).join(" ").trim();
  return combined || "Unknown Player";
}

export function identityKeyFor(row: CsvRow, fallbackName: string, nation: string): string {
  const sourcePlayerId = valueFor(row, ["player_id", "player", "person_id"]);
  if (sourcePlayerId) return `fjelstul:${sourcePlayerId}`;
  return `fallback:${normalizeName(fallbackName)}:${normalizeName(nation)}`;
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
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])));
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

function pickFirstExisting(files: Map<string, CsvRow[]>, names: readonly string[]): CsvRow[] {
  for (const name of names) {
    const rows = files.get(name);
    if (rows) return rows;
  }
  return [];
}

function addMissingWarnings(
  warnings: Set<string>,
  sources: readonly [filename: string, rows: readonly CsvRow[], code: string][]
): void {
  for (const [, rows, code] of sources) {
    if (rows.length === 0) warnings.add(code);
  }
}

function valueFor(row: CsvRow, keys: readonly string[]): string | undefined {
  const normalizedEntries = new Map(Object.entries(row).map(([key, value]) => [normalizeName(key), value]));
  for (const key of keys) {
    const value = normalizedEntries.get(normalizeName(key));
    if (value && value.trim().length > 0 && !isSemanticMissingValue(value)) return value.trim();
  }
  return undefined;
}

function isSemanticMissingValue(value: string): boolean {
  const normalized = normalizeName(value);
  return normalized === "not applicable" || normalized === "n/a" || normalized === "na" || normalized === "none" || normalized === "null";
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

function buildRowsById(rows: readonly CsvRow[], keys: readonly string[]): Map<string, CsvRow> {
  const byId = new Map<string, CsvRow>();
  for (const row of rows) {
    const id = valueFor(row, keys);
    if (id) byId.set(normalizeName(id), row);
  }
  return byId;
}

function playerRowFor(row: CsvRow, playersById: ReadonlyMap<string, CsvRow>): CsvRow | undefined {
  const playerId = valueFor(row, ["player_id", "player", "person_id"]);
  return playerId ? playersById.get(normalizeName(playerId)) : undefined;
}

function buildTournamentYearById(rows: readonly CsvRow[]): Map<string, number> {
  const byId = new Map<string, number>();
  for (const row of rows) {
    const id = valueFor(row, ["tournament_id", "id"]);
    const year = yearForRow(row, new Map());
    if (id && year) byId.set(normalizeName(id), year);
  }
  return byId;
}

function buildTournamentInfoByYear(rows: readonly CsvRow[]): Map<number, TournamentInfo> {
  const byYear = new Map<number, TournamentInfo>();
  for (const row of rows) {
    const id = valueFor(row, ["tournament_id", "id"]) ?? "";
    const year = yearForRow(row, new Map());
    if (!year) continue;
    const name = valueFor(row, ["tournament_name", "name", "tournament", "competition_name"]) ?? `World Cup ${year}`;
    byYear.set(year, {
      id,
      year,
      name,
      genderOrCategory: tournamentGenderFor(row, name, year)
    });
  }
  return byYear;
}

function tournamentGenderFor(row: CsvRow, name: string, year: number): TournamentInfo["genderOrCategory"] {
  const category = normalizeName(
    valueFor(row, ["gender", "category", "tournament_gender", "competition_gender", "sex"]) ?? name
  );
  if (category.includes("women") || category.includes("female")) return "WOMEN";
  if (category.includes("men") || category.includes("male")) return "MEN";
  if ([1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019].includes(year)) return "WOMEN";
  return "MEN";
}

function buildTournamentFilterSummary({
  cards,
  tournamentInfoByYear,
  includeWomensWorldCups
}: {
  cards: readonly FjelstulCardContext[];
  tournamentInfoByYear: ReadonlyMap<number, TournamentInfo>;
  includeWomensWorldCups: boolean;
}): TournamentFilterRunSummary {
  const cardCountByYear = new Map<number, number>();
  for (const card of cards) cardCountByYear.set(card.worldCupYear, (cardCountByYear.get(card.worldCupYear) ?? 0) + 1);

  const rows = [...cardCountByYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([worldCupYear, cardCount]) => {
      const info = tournamentInfoByYear.get(worldCupYear);
      const isWomen = info?.genderOrCategory === "WOMEN";
      return {
        worldCupYear,
        tournamentId: info?.id ?? "",
        tournamentName: info?.name ?? `World Cup ${worldCupYear}`,
        genderOrCategory: info?.genderOrCategory ?? "UNKNOWN",
        included: includeWomensWorldCups || !isWomen,
        excludedReason: !includeWomensWorldCups && isWomen ? "womens_world_cup_excluded_by_default" : "",
        cardCount
      };
    });

  return {
    mode: includeWomensWorldCups ? "INCLUDE_WOMENS_WORLD_CUPS" : "MEN_ONLY",
    includedMenWorldCupYears: rows
      .filter((row) => row.included && row.genderOrCategory !== "WOMEN")
      .map((row) => row.worldCupYear),
    excludedWomenWorldCupYears: rows
      .filter((row) => !row.included && row.genderOrCategory === "WOMEN")
      .map((row) => row.worldCupYear),
    totalCardsBeforeGenderFilter: cards.length,
    totalCardsAfterGenderFilter: rows.filter((row) => row.included).reduce((sum, row) => sum + row.cardCount, 0),
    rows
  };
}

function buildTeamCodeById(rows: readonly CsvRow[]): Map<string, string> {
  const byId = new Map<string, string>();
  for (const row of rows) {
    const id = valueFor(row, ["team_id", "id"]);
    const code = valueFor(row, ["team_code", "team", "nation", "country_code", "fifa_code"]);
    if (id && code) {
      byId.set(normalizeName(id), code);
      byId.set(normalizeName(code), code);
    }
  }
  return byId;
}

function yearForRow(row: CsvRow, tournamentYearById: ReadonlyMap<string, number>): number | undefined {
  const direct = numberFor(row, ["year", "world_cup_year", "tournament_year", "copa"]);
  if (direct) return direct;
  const tournamentId = valueFor(row, ["tournament_id", "tournament"]);
  return tournamentId ? tournamentYearById.get(normalizeName(tournamentId)) : undefined;
}

function nationForRow(row: CsvRow, teamCodeById: ReadonlyMap<string, string>): string {
  const teamId = valueFor(row, ["team_id", "country_id"]);
  if (teamId) return teamCodeById.get(normalizeName(teamId)) ?? teamId;

  const directCode = valueFor(row, ["team_code", "nation", "squad", "sel", "country_code", "fifa_code"]);
  if (directCode) return directCode;

  const team = valueFor(row, ["team"]);
  if (team) return teamCodeById.get(normalizeName(team)) ?? team;

  const country = valueFor(row, ["country"]);
  if (country) return teamCodeById.get(normalizeName(country)) ?? country;

  return "UNK";
}

function buildPlayerTournamentNationIndex({
  squadRows,
  tournamentYearById,
  teamCodeById
}: {
  squadRows: readonly CsvRow[];
  tournamentYearById: ReadonlyMap<string, number>;
  teamCodeById: ReadonlyMap<string, string>;
}): PlayerTournamentNationIndex {
  const index: PlayerTournamentNationIndex = new Map();
  for (const row of squadRows) {
    const playerId = valueFor(row, ["player_id", "player", "person_id"]);
    const year = yearForRow(row, tournamentYearById);
    if (!playerId || !year) continue;
    const nation = nationForRow(row, teamCodeById);
    if (nation !== "UNK") index.set(playerTournamentNationKey(year, playerId), nation);
  }
  return index;
}

function playerTournamentNationKey(year: number, playerId: string): string {
  return `${year}:${normalizeName(playerId)}`;
}

function nationForMetricRow({
  row,
  year,
  teamCodeById,
  playerTournamentNationIndex,
  warnings
}: {
  row: CsvRow;
  year: number;
  teamCodeById: ReadonlyMap<string, string>;
  playerTournamentNationIndex: ReadonlyMap<string, string>;
  warnings: Set<string>;
}): string {
  const nationFromRow = nationForRow(row, teamCodeById);
  if (nationFromRow !== "UNK") return nationFromRow;

  const playerId = valueFor(row, ["player_id", "player", "person_id"]);
  if (playerId) {
    const indexedNation = playerTournamentNationIndex.get(playerTournamentNationKey(year, playerId));
    if (indexedNation) return indexedNation;
  }

  warnings.add("player_tournament_nation_unresolved");
  return "UNK";
}

function metricKeyFor(row: CsvRow, rawName: string, nation: string, year: number): string {
  const playerId = valueFor(row, ["player_id", "player", "person_id"]);
  return `${year}:${normalizeName(nation)}:${normalizeName(playerId || rawName)}`;
}

function aggregateNumber({
  rows,
  keys,
  fallbackIncrement,
  playersById,
  tournamentYearById,
  teamCodeById,
  playerTournamentNationIndex,
  warnings
}: {
  rows: readonly CsvRow[];
  keys: readonly string[];
  fallbackIncrement: number;
  playersById: ReadonlyMap<string, CsvRow>;
  tournamentYearById: ReadonlyMap<string, number>;
  teamCodeById: ReadonlyMap<string, string>;
  playerTournamentNationIndex: ReadonlyMap<string, string>;
  warnings: Set<string>;
}): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const playerRow = playerRowFor(row, playersById);
    const mergedRow = { ...(playerRow ?? {}), ...row };
    const rawName = playerDisplayNameFromRow(mergedRow);
    const year = yearForRow(mergedRow, tournamentYearById);
    if (!year || rawName === "Unknown Player") continue;
    const nation = nationForMetricRow({ row: mergedRow, year, teamCodeById, playerTournamentNationIndex, warnings });
    if (nation === "UNK") continue;
    const key = metricKeyFor(mergedRow, rawName, nation, year);
    totals.set(key, (totals.get(key) ?? 0) + (numberFor(mergedRow, keys) ?? fallbackIncrement));
  }
  return totals;
}

function buildAwardDefinitionMap(awardRows: readonly CsvRow[]): Map<string, AwardDefinition> {
  const definitions = new Map<string, AwardDefinition>();
  for (const row of awardRows) {
    const id = valueFor(row, ["award_id", "id", "award"]);
    if (!id) continue;
    const label = valueFor(row, ["award_name", "name", "award", "award_label", "type"]) ?? id;
    definitions.set(normalizeName(id), {
      id,
      label,
      editionKey: mapAward(label) ?? mapAward(id)
    });
  }
  return definitions;
}

function aggregateAwardWinners({
  awardRows,
  awardWinnerRows,
  playerRows,
  tournamentRows,
  teamRows,
  playerTournamentNationIndex
}: {
  awardRows: readonly CsvRow[];
  awardWinnerRows: readonly CsvRow[];
  playerRows: readonly CsvRow[];
  tournamentRows: readonly CsvRow[];
  teamRows: readonly CsvRow[];
  playerTournamentNationIndex: ReadonlyMap<string, string>;
}): AwardWinnerIndex {
  const warnings = new Set<string>();
  if (awardRows.length === 0) warnings.add("award_definitions_missing");
  if (awardWinnerRows.length === 0) warnings.add("award_winners_missing");

  const definitions = buildAwardDefinitionMap(awardRows);
  const playersById = buildRowsById(playerRows, ["player_id", "player", "person_id", "id"]);
  const tournamentYearById = buildTournamentYearById(tournamentRows);
  const teamCodeById = buildTeamCodeById(teamRows);
  const awards = new Map<string, CardEditionKey[]>();

  for (const row of awardWinnerRows) {
    const awardId = valueFor(row, ["award_id", "award", "id", "type"]);
    const definition = awardId ? definitions.get(normalizeName(awardId)) : undefined;
    const editionKey = definition?.editionKey ?? mapAward(valueFor(row, ["award_name", "award", "type"]));
    if (!editionKey) {
      warnings.add("award_winner_unresolved_award");
      continue;
    }

    const playerRow = playerRowFor(row, playersById);
    const mergedRow = { ...(playerRow ?? {}), ...row };
    const rawName = playerDisplayNameFromRow(mergedRow);
    const year = yearForRow(mergedRow, tournamentYearById);
    if (!year || rawName === "Unknown Player") {
      warnings.add("award_winner_unresolved_player");
      continue;
    }

    const nation = nationForMetricRow({
      row: mergedRow,
      year,
      teamCodeById,
      playerTournamentNationIndex,
      warnings
    });
    if (nation === "UNK") continue;
    const key = metricKeyFor(mergedRow, rawName, nation, year);
    awards.set(key, [...(awards.get(key) ?? []), editionKey]);
  }

  return { awards, warnings: [...warnings] };
}

function mapAward(rawAward?: string): CardEditionKey | null {
  const normalized = normalizeName(rawAward ?? "");
  if (normalized.includes("golden ball") || normalized === "golden_ball") return "GOLDEN_BALL";
  if (normalized.includes("golden boot") || normalized.includes("top scorer") || normalized === "golden_boot") {
    return "GOLDEN_BOOT";
  }
  if (normalized.includes("golden glove") || normalized.includes("yashin") || normalized === "golden_glove") {
    return "GOLDEN_GLOVE";
  }
  if (normalized.includes("young")) return "BEST_YOUNG_PLAYER";
  return null;
}

function aggregateResults(
  rows: readonly CsvRow[],
  tournamentYearById: ReadonlyMap<string, number>,
  teamCodeById: ReadonlyMap<string, string>
): Map<string, TeamResult> {
  const results = new Map<string, TeamResult>();
  for (const row of rows) {
    const year = yearForRow(row, tournamentYearById);
    const nation = nationForRow(row, teamCodeById);
    if (!year || nation === "UNK") continue;
    const finalRank = numberFor(row, ["final_rank", "rank", "position", "standing"]);
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

function aggregateHosts(
  rows: readonly CsvRow[],
  tournamentYearById: ReadonlyMap<string, number>,
  teamCodeById: ReadonlyMap<string, string>
): Map<number, Set<string>> {
  const hosts = new Map<number, Set<string>>();
  for (const row of rows) {
    const year = yearForRow(row, tournamentYearById);
    const host = nationForRow(
      {
        ...row,
        team_code: valueFor(row, ["host_country_code", "host_team_code", "host", "host_name", "country"]) ?? ""
      },
      teamCodeById
    );
    if (!year || host === "UNK") continue;
    hosts.set(year, new Set([...(hosts.get(year) ?? []), normalizeName(host)]));
  }
  return hosts;
}

function aggregateHostLabels(
  hostRows: readonly CsvRow[],
  tournamentRows: readonly CsvRow[],
  teamRows: readonly CsvRow[],
  tournamentYearById: ReadonlyMap<string, number>,
  teamCodeById: ReadonlyMap<string, string>
): Map<number, HostResolution> {
  const labels = new Map<number, HostResolution>();
  const teamNameById = buildTeamNameById(teamRows);

  for (const row of hostRows) {
    const year = yearForRow(row, tournamentYearById);
    if (!year) continue;
    const hostCode =
      valueFor(row, ["host_country_code", "host_team_code", "team_code", "country_code", "fifa_code"]) ??
      nationForRow(
        {
          ...row,
          team_code: valueFor(row, ["host_country_code", "host_team_code", "host", "host_name", "country", "team_id"]) ?? ""
        },
        teamCodeById
      );
    const hostLabel =
      valueFor(row, ["host_country", "host_country_name", "host_name", "country", "team_name", "name"]) ??
      (hostCode ? teamNameById.get(normalizeName(hostCode)) : undefined) ??
      hostCode;
    if (!hostCode || !hostLabel || hostCode === "UNK") continue;
    const existing = labels.get(year);
    const codes = [...new Set([...(existing?.code.split("/") ?? []), hostCode])].filter(Boolean);
    const names = [...new Set([...(existing?.label.split("/") ?? []), hostLabel])].filter(Boolean);
    labels.set(year, {
      code: codes.join("/").toUpperCase(),
      label: names.join("/").toUpperCase(),
      source: "host_countries.csv",
      warning: null
    });
  }

  for (const row of tournamentRows) {
    const year = yearForRow(row, tournamentYearById);
    if (!year || labels.has(year)) continue;
    const hostLabel = valueFor(row, ["host_country", "host_country_name", "host", "hosts", "country"]);
    if (!hostLabel) continue;
    labels.set(year, {
      code: normalizeName(hostLabel).toUpperCase().replaceAll(" ", "_"),
      label: hostLabel.toUpperCase(),
      source: "tournaments.csv",
      warning: null
    });
  }

  return labels;
}

function buildTeamNameById(rows: readonly CsvRow[]): Map<string, string> {
  const byId = new Map<string, string>();
  for (const row of rows) {
    const id = valueFor(row, ["team_id", "id", "team_code"]);
    const label = valueFor(row, ["team_name", "name", "country", "team"]);
    if (id && label) byId.set(normalizeName(id), label);
  }
  return byId;
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
  const iconicKeys = new Set(iconic.map((card) => `${card.identityKey}:${card.worldCupYear}`));
  const randomPool = filtered.filter((card) => !iconicKeys.has(`${card.identityKey}:${card.worldCupYear}`));
  const randomCount = options.randomCount ?? 100;
  const seed = options.seed ?? "rating-lab";
  const random = [...randomPool]
    .sort((left, right) => deterministicSortScore(seed, left) - deterministicSortScore(seed, right))
    .slice(0, randomCount);

  if (options.sample === "random") return random;
  return [...iconic, ...random].sort(
    (left, right) => deterministicSortScore(`${seed}:combined`, left) - deterministicSortScore(`${seed}:combined`, right)
  );
}

function deterministicSortScore(seed: string | number, card: FjelstulCardContext): number {
  return deterministicUnit(`${seed}:order:${card.identityKey}:${card.worldCupYear}`);
}

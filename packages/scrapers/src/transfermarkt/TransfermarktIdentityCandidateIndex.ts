import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readCsv, writeCsv } from "../shared/CsvWriters.js";
import { normalizeName } from "../shared/ProviderLinks.js";
import type { TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";

export const IDENTITY_CANDIDATE_INDEX_HEADERS = [
  "transfermarkt_player_id",
  "canonical_name",
  "known_names",
  "birth_year",
  "date_of_birth",
  "nationalities",
  "positions",
  "clubs_seen",
  "leagues_seen",
  "seasons_seen",
  "world_cup_years_seen",
  "seen_in_base_players",
  "seen_in_players_overlay",
  "seen_in_squad_cache",
  "seen_in_squad_presence_overlay",
  "seen_in_appearances",
  "seen_in_lineups",
  "seen_in_events",
  "seen_in_transfers",
  "approved_provider_link_exists",
  "identity_confidence",
  "evidence_summary"
] as const;

export type TransfermarktIdentityCandidateIndexRow = Record<(typeof IDENTITY_CANDIDATE_INDEX_HEADERS)[number], string>;

type MutableIdentityCandidate = {
  transfermarktPlayerId: string;
  canonicalName: string;
  knownNames: Set<string>;
  birthYear: string;
  dateOfBirth: string;
  nationalities: Set<string>;
  positions: Set<string>;
  clubsSeen: Set<string>;
  leaguesSeen: Set<string>;
  seasonsSeen: Set<string>;
  worldCupYearsSeen: Set<string>;
  seenInBasePlayers: boolean;
  seenInPlayersOverlay: boolean;
  seenInSquadCache: boolean;
  seenInSquadPresenceOverlay: boolean;
  seenInAppearances: boolean;
  seenInLineups: boolean;
  seenInEvents: boolean;
  seenInTransfers: boolean;
  approvedProviderLinkExists: boolean;
};

export async function buildTransfermarktIdentityCandidateIndex(options: {
  sourceDir: string;
  outputDir: string;
  squadRows?: readonly TransfermarktSquadPlayer[];
  outputPath?: string;
  includeActivityEvidence?: boolean;
}): Promise<TransfermarktIdentityCandidateIndexRow[]> {
  const candidates = new Map<string, MutableIdentityCandidate>();
  const overlayDir = join(options.outputDir, "transfermarkt-overlay");

  await addPlayerRows(candidates, join(options.sourceDir, "players.csv"), "base");
  await addPlayerRows(candidates, join(overlayDir, "players_overlay.csv"), "overlay");
  await addSquadCacheRows(candidates, join(overlayDir, "cache"));
  addInMemorySquadRows(candidates, options.squadRows ?? []);
  await addSquadPresenceRows(candidates, join(overlayDir, "squad_presence_overlay.csv"));
  if (options.includeActivityEvidence) {
    await addActivityRows(candidates, join(options.sourceDir, "appearances.csv"), "appearances");
    await addActivityRows(candidates, join(options.sourceDir, "game_lineups.csv"), "lineups");
    await addActivityRows(candidates, join(options.sourceDir, "game_events.csv"), "events");
    await addActivityRows(candidates, join(options.sourceDir, "transfers.csv"), "transfers");
  }
  await addProviderLinks(candidates, join(options.outputDir, "identity", "provider_player_links.csv"));

  const rows = [...candidates.values()]
    .map(toRow)
    .sort((left, right) => left.canonical_name.localeCompare(right.canonical_name) || left.transfermarkt_player_id.localeCompare(right.transfermarkt_player_id));
  await writeCsv(options.outputPath ?? join(overlayDir, "identity_candidate_index.csv"), IDENTITY_CANDIDATE_INDEX_HEADERS, rows);
  return rows;
}

export function identityCandidateRowsToSquadPlayers(rows: readonly TransfermarktIdentityCandidateIndexRow[]): TransfermarktSquadPlayer[] {
  return rows.flatMap((row) => {
    const seasons = splitList(row.seasons_seen).map(Number).filter(Number.isFinite);
    return seasons.map((season) => ({
      playerId: row.transfermarkt_player_id,
      name: row.canonical_name,
      nationalities: splitList(row.nationalities),
      dateOfBirth: row.date_of_birth || undefined,
      birthYear: row.birth_year ? Number(row.birth_year) : undefined,
      position: splitList(row.positions)[0],
      clubName: splitList(row.clubs_seen)[0],
      leagueId: splitList(row.leagues_seen)[0] ?? "",
      season,
      worldCupYear: splitList(row.world_cup_years_seen).map(Number).find(Number.isFinite)
    }));
  });
}

async function addPlayerRows(candidates: Map<string, MutableIdentityCandidate>, path: string, source: "base" | "overlay"): Promise<void> {
  for (const row of await readCsv(path)) {
    const playerId = row.player_id || row.player;
    const name = row.name || row.player_name || [row.first_name, row.last_name].filter(Boolean).join(" ");
    if (!playerId || !name) continue;
    const candidate = candidateFor(candidates, playerId, name);
    candidate.knownNames.add(name);
    candidate.dateOfBirth ||= row.date_of_birth || "";
    candidate.birthYear ||= yearFromValue(candidate.dateOfBirth) || "";
    addDelimited(candidate.nationalities, row.country_of_citizenship || row.country_of_birth);
    addDelimited(candidate.positions, row.position || row.sub_position);
    addDelimited(candidate.clubsSeen, row.current_club_name);
    addDelimited(candidate.leaguesSeen, row.current_club_domestic_competition_id);
    if (source === "base") candidate.seenInBasePlayers = true;
    else candidate.seenInPlayersOverlay = true;
  }
}

async function addSquadCacheRows(candidates: Map<string, MutableIdentityCandidate>, cacheDir: string): Promise<void> {
  let files: string[] = [];
  try {
    files = await readdir(cacheDir);
  } catch {
    return;
  }
  for (const file of files.filter((item) => item.startsWith("squads_") && item.endsWith(".csv"))) {
    const path = join(cacheDir, file);
    const fileMeta = squadCacheFileMeta(file);
    for (const row of await readCsv(path)) {
      const playerId = row.player_id || row.tm_id || row.id;
      const name = row.name || row.player_name || row.tm_name;
      if (!playerId || !name) continue;
      const candidate = candidateFor(candidates, playerId, name);
      candidate.seenInSquadCache = true;
      candidate.knownNames.add(name);
      addDelimited(candidate.nationalities, row.country_of_citizenship || row.country || row.nation);
      addDelimited(candidate.positions, row.position);
      addDelimited(candidate.clubsSeen, row.current_club_name || row.club || row.squad);
      addDelimited(candidate.leaguesSeen, row.league || fileMeta.leagueId);
      candidate.birthYear ||= row.birth_year || yearFromValue(row.date_of_birth || row.dob) || "";
      candidate.dateOfBirth ||= row.date_of_birth || row.dob || "";
      addValue(candidate.seasonsSeen, row.season || fileMeta.transfermarktSeasonId);
      addValue(candidate.worldCupYearsSeen, fileMeta.worldCupYear);
    }
  }
}

function addInMemorySquadRows(candidates: Map<string, MutableIdentityCandidate>, rows: readonly TransfermarktSquadPlayer[]): void {
  for (const row of rows) {
    const candidate = candidateFor(candidates, row.playerId, row.name);
    candidate.seenInSquadCache = true;
    candidate.knownNames.add(row.name);
    addValues(candidate.nationalities, row.nationalities);
    addValue(candidate.positions, row.position);
    addValue(candidate.clubsSeen, row.clubName);
    addValue(candidate.leaguesSeen, row.leagueId);
    addValue(candidate.seasonsSeen, row.season);
    addValue(candidate.worldCupYearsSeen, row.worldCupYear);
    candidate.birthYear ||= row.birthYear ? String(row.birthYear) : "";
    candidate.dateOfBirth ||= row.dateOfBirth ?? "";
  }
}

async function addSquadPresenceRows(candidates: Map<string, MutableIdentityCandidate>, path: string): Promise<void> {
  for (const row of await readCsv(path)) {
    const playerId = row.transfermarkt_player_id;
    const name = row.name;
    if (!playerId || !name) continue;
    const candidate = candidateFor(candidates, playerId, name);
    candidate.seenInSquadPresenceOverlay = true;
    addDelimited(candidate.nationalities, row.nationalities);
    addValue(candidate.positions, row.position);
    addValue(candidate.clubsSeen, row.club_name);
    addValue(candidate.leaguesSeen, row.competition_id);
    addValue(candidate.seasonsSeen, row.season_id);
    addValue(candidate.worldCupYearsSeen, row.world_cup_year);
    candidate.birthYear ||= row.birth_year ?? "";
  }
}

async function addActivityRows(
  candidates: Map<string, MutableIdentityCandidate>,
  path: string,
  source: "appearances" | "lineups" | "events" | "transfers"
): Promise<void> {
  for (const row of await readCsv(path)) {
    const playerId = row.player_id;
    if (!playerId) continue;
    const candidate = candidateFor(candidates, playerId, row.player_name || row.name || playerId);
    addValue(candidate.seasonsSeen, yearFromValue(row.date || row.transfer_date));
    addValue(candidate.clubsSeen, row.player_club_id || row.club_name || row.from_club_name || row.to_club_name);
    addValue(candidate.leaguesSeen, row.competition_id);
    if (source === "appearances") candidate.seenInAppearances = true;
    if (source === "lineups") candidate.seenInLineups = true;
    if (source === "events") candidate.seenInEvents = true;
    if (source === "transfers") candidate.seenInTransfers = true;
  }
}

async function addProviderLinks(candidates: Map<string, MutableIdentityCandidate>, path: string): Promise<void> {
  for (const row of await readCsv(path)) {
    if (row.target_provider !== "transfermarkt" || !row.target_id) continue;
    const candidate = candidateFor(candidates, row.target_id, row.player_name || row.target_id);
    candidate.approvedProviderLinkExists = row.review_status === "auto_approved" || row.review_status === "manual_approved";
    addValue(candidate.worldCupYearsSeen, row.world_cup_year);
    addValue(candidate.nationalities, row.nation_code);
  }
}

function candidateFor(candidates: Map<string, MutableIdentityCandidate>, playerId: string, name: string): MutableIdentityCandidate {
  const existing = candidates.get(playerId);
  if (existing) {
    if (!existing.canonicalName || normalizeName(existing.canonicalName) === playerId) existing.canonicalName = name;
    return existing;
  }
  const created: MutableIdentityCandidate = {
    transfermarktPlayerId: playerId,
    canonicalName: name,
    knownNames: new Set([name]),
    birthYear: "",
    dateOfBirth: "",
    nationalities: new Set(),
    positions: new Set(),
    clubsSeen: new Set(),
    leaguesSeen: new Set(),
    seasonsSeen: new Set(),
    worldCupYearsSeen: new Set(),
    seenInBasePlayers: false,
    seenInPlayersOverlay: false,
    seenInSquadCache: false,
    seenInSquadPresenceOverlay: false,
    seenInAppearances: false,
    seenInLineups: false,
    seenInEvents: false,
    seenInTransfers: false,
    approvedProviderLinkExists: false
  };
  candidates.set(playerId, created);
  return created;
}

function toRow(candidate: MutableIdentityCandidate): TransfermarktIdentityCandidateIndexRow {
  const evidence = [
    candidate.seenInBasePlayers ? "base_players" : "",
    candidate.seenInPlayersOverlay ? "players_overlay" : "",
    candidate.seenInSquadCache ? "squad_cache" : "",
    candidate.seenInSquadPresenceOverlay ? "squad_presence_overlay" : "",
    candidate.seenInAppearances ? "appearances" : "",
    candidate.seenInLineups ? "lineups" : "",
    candidate.seenInEvents ? "events" : "",
    candidate.seenInTransfers ? "transfers" : "",
    candidate.approvedProviderLinkExists ? "approved_provider_link" : ""
  ].filter(Boolean);
  return {
    transfermarkt_player_id: candidate.transfermarktPlayerId,
    canonical_name: candidate.canonicalName,
    known_names: joinSet(candidate.knownNames),
    birth_year: candidate.birthYear,
    date_of_birth: candidate.dateOfBirth,
    nationalities: joinSet(candidate.nationalities),
    positions: joinSet(candidate.positions),
    clubs_seen: joinSet(candidate.clubsSeen),
    leagues_seen: joinSet(candidate.leaguesSeen),
    seasons_seen: joinSet(candidate.seasonsSeen),
    world_cup_years_seen: joinSet(candidate.worldCupYearsSeen),
    seen_in_base_players: String(candidate.seenInBasePlayers),
    seen_in_players_overlay: String(candidate.seenInPlayersOverlay),
    seen_in_squad_cache: String(candidate.seenInSquadCache),
    seen_in_squad_presence_overlay: String(candidate.seenInSquadPresenceOverlay),
    seen_in_appearances: String(candidate.seenInAppearances),
    seen_in_lineups: String(candidate.seenInLineups),
    seen_in_events: String(candidate.seenInEvents),
    seen_in_transfers: String(candidate.seenInTransfers),
    approved_provider_link_exists: String(candidate.approvedProviderLinkExists),
    identity_confidence: candidate.approvedProviderLinkExists ? "HIGH" : evidence.length >= 2 ? "MEDIUM" : "LOW",
    evidence_summary: evidence.join("|")
  };
}

function squadCacheFileMeta(file: string): { leagueId: string; worldCupYear: string; transfermarktSeasonId: string } {
  const modern = file.match(/^squads_(.+)_wc(\d{4})_tm(\d{4})\.csv$/u);
  if (modern) return { leagueId: modern[1]!, worldCupYear: modern[2]!, transfermarktSeasonId: modern[3]! };
  const legacy = file.match(/^squads_(.+)_(\d{4})\.csv$/u);
  return { leagueId: legacy?.[1] ?? "", worldCupYear: "", transfermarktSeasonId: legacy?.[2] ?? "" };
}

function yearFromValue(value?: string): string {
  const match = value?.match(/\b(18|19|20)\d{2}\b/u);
  return match?.[0] ?? "";
}

function addDelimited(target: Set<string>, value?: string): void {
  addValues(target, splitList(value ?? ""));
}

function addValues(target: Set<string>, values: readonly (string | number | undefined)[]): void {
  for (const value of values) addValue(target, value);
}

function addValue(target: Set<string>, value?: string | number): void {
  if (value === undefined || value === null || value === "") return;
  target.add(String(value));
}

function joinSet(values: Set<string>): string {
  return [...values].filter(Boolean).sort().join("|");
}

function splitList(value: string): string[] {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

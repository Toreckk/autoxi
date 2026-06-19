import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readCsv, writeCsv } from "../shared/CsvWriters.js";
import { normalizeName } from "../shared/ProviderLinks.js";
import type { TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { loadTransfermarktProfileIdentityOverlay, profileIdentityIsSuccessful } from "./TransfermarktProfileIdentity.js";

export const IDENTITY_CANDIDATE_INDEX_HEADERS = [
  "transfermarkt_player_id",
  "canonical_name",
  "known_names",
  "normalized_names",
  "birth_year",
  "date_of_birth",
  "nationalities",
  "positions",
  "broad_position_family",
  "clubs_seen",
  "competitions_seen",
  "transfermarkt_seasons_seen",
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
  "evidence_families",
  "identity_field_sources",
  "identity_repaired_from_profile",
  "profile_cache_status",
  "profile_failure_reason",
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
  fieldSources: Map<string, Set<string>>;
  identityRepairedFromProfile: boolean;
  profileCacheStatus: Set<string>;
  profileFailureReason: Set<string>;
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
  await addProfileIdentityRows(candidates, options.outputDir);
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
    const seasons = splitList(row.transfermarkt_seasons_seen || row.seasons_seen).map(Number).filter(Number.isFinite);
    return seasons.map((season) => ({
      playerId: row.transfermarkt_player_id,
      name: row.canonical_name,
      nationalities: splitList(row.nationalities),
      dateOfBirth: row.date_of_birth || undefined,
      birthYear: row.birth_year ? Number(row.birth_year) : undefined,
      position: splitList(row.positions)[0],
      clubName: splitList(row.clubs_seen)[0],
      profileUrl: "",
      profileSlug: "",
      leagueId: splitList(row.competitions_seen || row.leagues_seen)[0] ?? "",
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
    setValue(candidate, "date_of_birth", "players", row.date_of_birth || "");
    setValue(candidate, "birth_year", "players", yearFromValue(candidate.dateOfBirth) || "");
    addDelimited(candidate, "nationalities", "players", row.country_of_citizenship || row.country_of_birth);
    addDelimited(candidate, "positions", "players", row.position || row.sub_position);
    addDelimited(candidate, "clubs_seen", "players", row.current_club_name);
    addDelimited(candidate, "competitions_seen", "players", row.current_club_domestic_competition_id);
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
      addDelimited(candidate, "nationalities", "squad_cache", row.country_of_citizenship || row.country || row.nation);
      addDelimited(candidate, "positions", "squad_cache", row.position);
      addDelimited(candidate, "clubs_seen", "squad_cache", row.current_club_name || row.club || row.squad);
      addDelimited(candidate, "competitions_seen", "squad_cache", row.league || fileMeta.leagueId);
      setValue(candidate, "birth_year", "squad_cache", row.birth_year || yearFromValue(row.date_of_birth || row.dob) || "");
      setValue(candidate, "date_of_birth", "squad_cache", row.date_of_birth || row.dob || "");
      addValueToSet(candidate.seasonsSeen, row.season || fileMeta.transfermarktSeasonId);
      addValueToSet(candidate.worldCupYearsSeen, fileMeta.worldCupYear);
    }
  }
}

function addInMemorySquadRows(candidates: Map<string, MutableIdentityCandidate>, rows: readonly TransfermarktSquadPlayer[]): void {
  for (const row of rows) {
    const candidate = candidateFor(candidates, row.playerId, row.name);
    candidate.seenInSquadCache = true;
    candidate.knownNames.add(row.name);
    addValues(candidate, "nationalities", "squad_cache", row.nationalities);
    addValue(candidate, "positions", "squad_cache", row.position);
    addValue(candidate, "clubs_seen", "squad_cache", row.clubName);
    addValue(candidate, "competitions_seen", "squad_cache", row.leagueId);
    addValueToSet(candidate.seasonsSeen, row.season);
    addValueToSet(candidate.worldCupYearsSeen, row.worldCupYear);
    setValue(candidate, "birth_year", "squad_cache", row.birthYear ? String(row.birthYear) : "");
    setValue(candidate, "date_of_birth", "squad_cache", row.dateOfBirth ?? "");
  }
}

async function addSquadPresenceRows(candidates: Map<string, MutableIdentityCandidate>, path: string): Promise<void> {
  for (const row of await readCsv(path)) {
    const playerId = row.transfermarkt_player_id;
    const name = row.name;
    if (!playerId || !name) continue;
    const candidate = candidateFor(candidates, playerId, name);
    candidate.seenInSquadPresenceOverlay = true;
    addDelimited(candidate, "nationalities", "squad_presence_overlay", row.nationalities);
    addValue(candidate, "positions", "squad_presence_overlay", row.position);
    addValue(candidate, "clubs_seen", "squad_presence_overlay", row.club_name);
    addValue(candidate, "competitions_seen", "squad_presence_overlay", row.competition_id);
    addValueToSet(candidate.seasonsSeen, row.season_id);
    addValueToSet(candidate.worldCupYearsSeen, row.world_cup_year);
    setValue(candidate, "birth_year", "squad_presence_overlay", row.birth_year ?? "");
  }
}

async function addProfileIdentityRows(candidates: Map<string, MutableIdentityCandidate>, outputDir: string): Promise<void> {
  for (const row of await loadTransfermarktProfileIdentityOverlay(outputDir)) {
    const playerId = row.transfermarkt_player_id;
    const name = row.canonical_name || playerId;
    if (!playerId || !name) continue;
    const candidate = candidateFor(candidates, playerId, name);
    candidate.knownNames.add(name);
    candidate.profileCacheStatus.add(row.cache_status || "unknown");
    if (row.failure_reason) candidate.profileFailureReason.add(row.failure_reason);
    if (!profileIdentityIsSuccessful(row)) continue;
    const repairedBefore = {
      nationality: candidate.nationalities.size === 0,
      birthYear: !candidate.birthYear,
      dateOfBirth: !candidate.dateOfBirth,
      position: candidate.positions.size === 0,
      club: candidate.clubsSeen.size === 0
    };
    addDelimited(candidate, "nationalities", "profile_identity_overlay", row.nationalities || row.citizenships || row.country_of_birth);
    addDelimited(candidate, "positions", "profile_identity_overlay", row.main_position || row.alternate_positions);
    addValue(candidate, "clubs_seen", "profile_identity_overlay", row.current_club);
    setValue(candidate, "date_of_birth", "profile_identity_overlay", row.date_of_birth);
    setValue(candidate, "birth_year", "profile_identity_overlay", row.birth_year || yearFromValue(row.date_of_birth));
    candidate.identityRepairedFromProfile ||= (
      (repairedBefore.nationality && candidate.nationalities.size > 0) ||
      (repairedBefore.birthYear && Boolean(candidate.birthYear)) ||
      (repairedBefore.dateOfBirth && Boolean(candidate.dateOfBirth)) ||
      (repairedBefore.position && candidate.positions.size > 0) ||
      (repairedBefore.club && candidate.clubsSeen.size > 0)
    );
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
    addValueToSet(candidate.seasonsSeen, yearFromValue(row.date || row.transfer_date));
    addValue(candidate, "clubs_seen", source, row.player_club_id || row.club_name || row.from_club_name || row.to_club_name);
    addValue(candidate, "competitions_seen", source, row.competition_id);
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
    addValueToSet(candidate.worldCupYearsSeen, row.world_cup_year);
    addValue(candidate, "nationalities", "approved_provider_link", row.nation_code);
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
    approvedProviderLinkExists: false,
    fieldSources: new Map(),
    identityRepairedFromProfile: false,
    profileCacheStatus: new Set(),
    profileFailureReason: new Set()
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
  const competitionIds = joinSet(candidate.leaguesSeen);
  const seasonIds = joinSet(candidate.seasonsSeen);
  return {
    transfermarkt_player_id: candidate.transfermarktPlayerId,
    canonical_name: candidate.canonicalName,
    known_names: joinSet(candidate.knownNames),
    normalized_names: joinSet(new Set([...candidate.knownNames].map(normalizeName))),
    birth_year: candidate.birthYear,
    date_of_birth: candidate.dateOfBirth,
    nationalities: joinSet(candidate.nationalities),
    positions: joinSet(candidate.positions),
    broad_position_family: broadPositionFamily([...candidate.positions].join(" ")),
    clubs_seen: joinSet(candidate.clubsSeen),
    competitions_seen: competitionIds,
    transfermarkt_seasons_seen: seasonIds,
    leagues_seen: competitionIds,
    seasons_seen: seasonIds,
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
    evidence_families: evidenceFamilies(candidate).join("|"),
    identity_field_sources: fieldSourcesSummary(candidate),
    identity_repaired_from_profile: String(candidate.identityRepairedFromProfile),
    profile_cache_status: joinSet(candidate.profileCacheStatus),
    profile_failure_reason: joinSet(candidate.profileFailureReason),
    evidence_summary: evidence.join("|")
  };
}

function evidenceFamilies(candidate: MutableIdentityCandidate): string[] {
  return [
    candidate.knownNames.size > 0 ? "name" : "",
    candidate.nationalities.size > 0 ? "nation" : "",
    candidate.birthYear || candidate.dateOfBirth ? "birth" : "",
    candidate.positions.size > 0 ? "position" : "",
    candidate.seasonsSeen.size > 0 || candidate.worldCupYearsSeen.size > 0 ? "season_context" : "",
    candidate.clubsSeen.size > 0 ? "club_context" : "",
    candidate.transfermarktPlayerId ? "provider_id" : "",
    candidate.approvedProviderLinkExists ? "approved_link" : ""
  ].filter(Boolean);
}

function broadPositionFamily(value: string): string {
  const normalized = normalizeName(value);
  if (/keeper|goalkeeper|\bgk\b/u.test(normalized)) return "GK";
  if (/back|defender|defence|defense|centre back|center back|\bcb\b|\blb\b|\brb\b/u.test(normalized)) return "DEF";
  if (/midfield|\bcm\b|\bdm\b|\bam\b/u.test(normalized)) return "MID";
  if (/forward|striker|winger|attack|\bst\b|\bfw\b/u.test(normalized)) return "FWD";
  return "";
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

function addDelimited(candidate: MutableIdentityCandidate, field: string, source: string, value?: string): void {
  addValues(candidate, field, source, splitList(value ?? ""));
}

function addValues(candidate: MutableIdentityCandidate, field: string, source: string, values: readonly (string | number | undefined)[]): void {
  for (const value of values) addValue(candidate, field, source, value);
}

function addValueToSet(target: Set<string>, value?: string | number): void {
  if (value === undefined || value === null || value === "") return;
  target.add(String(value));
}

function addValue(candidate: MutableIdentityCandidate, field: string, source: string, value?: string | number): void {
  if (value === undefined || value === null || value === "") return;
  const target = fieldSet(candidate, field);
  target.add(String(value));
  noteFieldSource(candidate, field, source);
}

function setValue(candidate: MutableIdentityCandidate, field: "birth_year" | "date_of_birth", source: string, value?: string): void {
  if (!value) return;
  if (field === "birth_year" && !candidate.birthYear) {
    candidate.birthYear = value;
    noteFieldSource(candidate, field, source);
  }
  if (field === "date_of_birth" && !candidate.dateOfBirth) {
    candidate.dateOfBirth = value;
    noteFieldSource(candidate, field, source);
  }
}

function fieldSet(candidate: MutableIdentityCandidate, field: string): Set<string> {
  if (field === "nationalities") return candidate.nationalities;
  if (field === "positions") return candidate.positions;
  if (field === "clubs_seen") return candidate.clubsSeen;
  if (field === "competitions_seen") return candidate.leaguesSeen;
  throw new Error(`Unknown identity field ${field}`);
}

function noteFieldSource(candidate: MutableIdentityCandidate, field: string, source: string): void {
  const sources = candidate.fieldSources.get(field) ?? new Set<string>();
  sources.add(source);
  candidate.fieldSources.set(field, sources);
}

function fieldSourcesSummary(candidate: MutableIdentityCandidate): string {
  return [...candidate.fieldSources.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, sources]) => `${field}:${joinSet(sources)}`)
    .join("|");
}

function joinSet(values: Set<string>): string {
  return [...values].filter(Boolean).sort().join("|");
}

function splitList(value: string): string[] {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

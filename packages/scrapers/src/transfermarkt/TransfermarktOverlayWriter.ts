import { readCsv, writeCsv, type CsvRow } from "../shared/CsvWriters.js";
import { PROVIDER_LINK_HEADERS, providerLinkKey, type ProviderPlayerLinkRow } from "../shared/ProviderLinks.js";
import type { TransfermarktCandidateMatch } from "./TransfermarktCandidateMatcher.js";

export const TRANSFERMARKT_PLAYER_HEADERS = [
  "player_id",
  "name",
  "country_of_citizenship",
  "date_of_birth",
  "position",
  "sub_position",
  "current_club_name",
  "current_club_domestic_competition_id",
  "source",
  "enrichment_round",
  "match_score"
] as const;

export const NEEDS_REVIEW_HEADERS = [
  "request_key",
  "provider",
  "request_type",
  "canonical_player_id",
  "player_name",
  "nation_code",
  "world_cup_year",
  "candidate_provider_id",
  "candidate_name",
  "candidate_nation",
  "candidate_birth_year",
  "candidate_team",
  "candidate_competition",
  "candidate_season",
  "match_score",
  "match_method",
  "reason",
  "evidence",
  "review_status"
] as const;

export const SQUAD_PRESENCE_OVERLAY_HEADERS = [
  "transfermarkt_player_id",
  "name",
  "season_id",
  "world_cup_year",
  "competition_id",
  "club_id",
  "club_name",
  "position",
  "birth_year",
  "nationalities",
  "source",
  "enrichment_round",
  "match_score",
  "review_status"
] as const;

export async function writeTransfermarktOverlays(options: {
  playersOverlayPath: string;
  squadPresenceOverlayPath?: string;
  providerLinksPath: string;
  needsReviewPath: string;
  roundId: string;
  matches: readonly TransfermarktCandidateMatch[];
}): Promise<{ playersWritten: number; linksWritten: number; needsReviewWritten: number; squadPresenceWritten: number }> {
  const approved = options.matches.filter((match) => match.status === "auto_approved");
  const needsReview = options.matches.filter((match) => match.status === "needs_review");
  const contextMatches = options.matches.filter((match) => match.status === "auto_approved" || match.status === "needs_review");
  const existingPlayers = await readCsv(options.playersOverlayPath);
  const playerRows = new Map(existingPlayers.map((row) => [row.player_id, row]));
  for (const match of approved) {
    playerRows.set(match.candidate.playerId, {
      player_id: match.candidate.playerId,
      name: match.candidate.name,
      country_of_citizenship: match.candidate.nationalities.join("|"),
      date_of_birth: match.candidate.dateOfBirth ?? "",
      position: match.candidate.position ?? "",
      sub_position: "",
      current_club_name: match.candidate.clubName ?? "",
      current_club_domestic_competition_id: match.candidate.leagueId,
      source: "transfermarkt_enrichment",
      enrichment_round: options.roundId,
      match_score: String(match.score)
    });
  }
  await writeCsv(options.playersOverlayPath, TRANSFERMARKT_PLAYER_HEADERS, [...playerRows.values()]);

  if (options.squadPresenceOverlayPath) {
    const existingPresence = await readCsv(options.squadPresenceOverlayPath);
    const presenceRows = new Map<string, CsvRow>(
      existingPresence.flatMap((row) =>
        row.transfermarkt_player_id && row.world_cup_year && row.season_id && row.competition_id
          ? [[squadPresenceKey(row), row] as const]
          : []
      )
    );
    for (const match of contextMatches) {
      const row = {
        transfermarkt_player_id: match.candidate.playerId,
        name: match.candidate.name,
        season_id: match.candidate.season,
        world_cup_year: match.request.worldCupYear,
        competition_id: match.candidate.leagueId,
        club_id: "",
        club_name: match.candidate.clubName ?? "",
        position: match.candidate.position ?? "",
        birth_year: match.candidate.birthYear ?? "",
        nationalities: match.candidate.nationalities.join("|"),
        source: "transfermarkt_squad_presence",
        enrichment_round: options.roundId,
        match_score: String(match.score),
        review_status: match.status
      };
      presenceRows.set(squadPresenceKey(row), row);
    }
    await writeCsv(options.squadPresenceOverlayPath, SQUAD_PRESENCE_OVERLAY_HEADERS, [...presenceRows.values()]);
  }

  const existingLinks = (await readCsv(options.providerLinksPath)) as ProviderPlayerLinkRow[];
  const links = new Map(existingLinks.map((row) => [providerLinkKey(row), row]));
  for (const match of approved) {
    const row: ProviderPlayerLinkRow = {
      subject_provider: "fjelstul",
      subject_id: match.request.ratingSubjectId,
      target_provider: "transfermarkt",
      target_id: match.candidate.playerId,
      player_name: match.request.name,
      nation_code: match.request.nation,
      world_cup_year: match.request.worldCupYear,
      confidence: "HIGH",
      link_method: "transfermarkt_squad_cache",
      evidence: match.reasons.join("|"),
      review_status: "auto_approved"
    };
    links.set(providerLinkKey(row), row);
  }
  await writeCsv(options.providerLinksPath, PROVIDER_LINK_HEADERS, [...links.values()]);

  await writeCsv(
    options.needsReviewPath,
    NEEDS_REVIEW_HEADERS,
    needsReview.map((match) => ({
      request_key: match.request.requestKey,
      provider: "transfermarkt",
      request_type: "TRANSFERMARKT_SEARCH",
      canonical_player_id: match.request.canonicalPlayerId,
      player_name: match.request.name,
      nation_code: match.request.nation,
      world_cup_year: match.request.worldCupYear,
      candidate_provider_id: match.candidate.playerId,
      candidate_name: match.candidate.name,
      candidate_nation: match.candidate.nationalities.join("|"),
      candidate_birth_year: match.candidate.birthYear ?? "",
      candidate_team: match.candidate.clubName ?? "",
      candidate_competition: match.candidate.leagueId,
      candidate_season: match.candidate.season,
      match_score: match.score,
      match_method: match.reasons.join("|"),
      reason: "candidate_requires_review",
      evidence: JSON.stringify(match.hardContradictions),
      review_status: "needs_review"
    }))
  );

  return {
    playersWritten: approved.length,
    linksWritten: approved.length,
    needsReviewWritten: needsReview.length,
    squadPresenceWritten: contextMatches.length
  };
}

function squadPresenceKey(row: Record<string, string | number | boolean | null | undefined>): string {
  return [
    row.transfermarkt_player_id ?? "",
    row.world_cup_year ?? "",
    row.season_id ?? "",
    row.competition_id ?? "",
    row.review_status ?? ""
  ].join(":");
}

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

export const APPEARANCES_OVERLAY_HEADERS = [
  "appearance_id",
  "game_id",
  "player_id",
  "player_club_id",
  "player_current_club_id",
  "date",
  "player_name",
  "competition_id",
  "yellow_cards",
  "red_cards",
  "goals",
  "assists",
  "minutes_played",
  "source",
  "enrichment_round",
  "match_score"
] as const;

export async function writeTransfermarktOverlays(options: {
  playersOverlayPath: string;
  appearancesOverlayPath?: string;
  providerLinksPath: string;
  needsReviewPath: string;
  roundId: string;
  matches: readonly TransfermarktCandidateMatch[];
}): Promise<{ playersWritten: number; linksWritten: number; needsReviewWritten: number }> {
  const approved = options.matches.filter((match) => match.status === "auto_approved");
  const needsReview = options.matches.filter((match) => match.status === "needs_review");
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

  if (options.appearancesOverlayPath) {
    const existingAppearances = await readCsv(options.appearancesOverlayPath);
    const appearanceRows = new Map<string, CsvRow>(
      existingAppearances.flatMap((row) => (row.appearance_id ? [[row.appearance_id, row] as const] : []))
    );
    for (const match of approved) {
      const appearanceId = `transfermarkt_enrichment_${match.candidate.playerId}_${match.candidate.season}_${options.roundId}`;
      appearanceRows.set(appearanceId, {
        appearance_id: appearanceId,
        game_id: `transfermarkt_enrichment_${match.candidate.leagueId}_${match.candidate.season}`,
        player_id: match.candidate.playerId,
        player_club_id: "",
        player_current_club_id: "",
        date: `${match.candidate.season}-07-01`,
        player_name: match.candidate.name,
        competition_id: match.candidate.leagueId,
        yellow_cards: "0",
        red_cards: "0",
        goals: "0",
        assists: "0",
        minutes_played: "1",
        source: "transfermarkt_squad_presence",
        enrichment_round: options.roundId,
        match_score: String(match.score)
      });
    }
    await writeCsv(options.appearancesOverlayPath, APPEARANCES_OVERLAY_HEADERS, [...appearanceRows.values()]);
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

  return { playersWritten: approved.length, linksWritten: approved.length, needsReviewWritten: needsReview.length };
}

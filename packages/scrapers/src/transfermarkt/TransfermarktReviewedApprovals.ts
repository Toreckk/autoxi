import { dirname, join } from "node:path";
import { readCsv, writeCsv, type CsvRow } from "../shared/CsvWriters.js";
import { PROVIDER_LINK_HEADERS, providerLinkKey, type ProviderPlayerLinkRow } from "../shared/ProviderLinks.js";
import { SQUAD_PRESENCE_OVERLAY_HEADERS, TRANSFERMARKT_PLAYER_HEADERS } from "./TransfermarktOverlayWriter.js";

export type ApplyReviewedTransfermarktApprovalsOptions = {
  outputDir: string;
  needsReviewPath?: string;
  roundId?: string;
};

export type ApplyReviewedTransfermarktApprovalsResult = {
  approvedRowsRead: number;
  playersWritten: number;
  squadPresenceWritten: number;
  linksWritten: number;
};

export async function applyReviewedTransfermarktApprovals(
  options: ApplyReviewedTransfermarktApprovalsOptions
): Promise<ApplyReviewedTransfermarktApprovalsResult> {
  const needsReviewPath = options.needsReviewPath ?? join(options.outputDir, "enrichment", "enrichment_needs_review.csv");
  const approved = (await readCsv(needsReviewPath)).filter((row) => row.review_status === "manual_approved");
  const overlayDir = join(options.outputDir, "transfermarkt-overlay");
  const playersOverlayPath = join(overlayDir, "players_overlay.csv");
  const squadPresenceOverlayPath = join(overlayDir, "squad_presence_overlay.csv");
  const providerLinksPath = join(options.outputDir, "identity", "provider_player_links.csv");
  const roundId = options.roundId ?? "manual-review";

  const existingPlayers = await readCsv(playersOverlayPath);
  const players = new Map<string, CsvRow>(existingPlayers.flatMap((row) => (row.player_id ? [[row.player_id, row] as const] : [])));
  const existingSquadPresence = await readCsv(squadPresenceOverlayPath);
  const squadPresence = new Map<string, CsvRow>(
    existingSquadPresence.flatMap((row) =>
      row.transfermarkt_player_id && row.world_cup_year && row.season_id && row.competition_id
        ? [[squadPresenceKey(row), row] as const]
        : []
    )
  );
  const existingLinks = (await readCsv(providerLinksPath)) as ProviderPlayerLinkRow[];
  const links = new Map(existingLinks.map((row) => [providerLinkKey(row), row]));

  for (const row of approved) {
    const playerId = row.candidate_provider_id;
    const season = Number(row.candidate_season || row.world_cup_year);
    if (!playerId || !Number.isFinite(season)) continue;
    players.set(playerId, {
      player_id: playerId,
      name: row.candidate_name || row.player_name,
      country_of_citizenship: row.candidate_nation || row.nation_code,
      date_of_birth: row.candidate_birth_year ? `${row.candidate_birth_year}-01-01` : "",
      position: "",
      sub_position: "",
      current_club_name: row.candidate_team,
      current_club_domestic_competition_id: row.candidate_competition,
      source: "transfermarkt_manual_review",
      enrichment_round: roundId,
      match_score: row.match_score
    });

    const presenceRow = {
      transfermarkt_player_id: playerId,
      name: row.candidate_name || row.player_name,
      season_id: season,
      world_cup_year: row.world_cup_year || season,
      competition_id: row.candidate_competition,
      club_id: "",
      club_name: row.candidate_team,
      position: "",
      birth_year: row.candidate_birth_year,
      nationalities: row.candidate_nation || row.nation_code,
      source: "transfermarkt_squad_presence_manual_review",
      enrichment_round: roundId,
      match_score: row.match_score,
      review_status: "manual_approved"
    };
    squadPresence.set(squadPresenceKey(presenceRow), presenceRow);

    const link: ProviderPlayerLinkRow = {
      subject_provider: "fjelstul",
      subject_id: row.canonical_player_id || (row.request_key ?? "").replace("transfermarkt:search:", ""),
      target_provider: "transfermarkt",
      target_id: playerId,
      player_name: row.player_name ?? "",
      nation_code: row.nation_code ?? "",
      world_cup_year: season,
      confidence: "HIGH",
      link_method: "transfermarkt_manual_review",
      evidence: row.match_method ?? "",
      review_status: "manual_approved"
    };
    links.set(providerLinkKey(link), link);
  }

  await writeCsv(playersOverlayPath, TRANSFERMARKT_PLAYER_HEADERS, [...players.values()]);
  await writeCsv(squadPresenceOverlayPath, SQUAD_PRESENCE_OVERLAY_HEADERS, [...squadPresence.values()]);
  await writeCsv(providerLinksPath, PROVIDER_LINK_HEADERS, [...links.values()]);

  return {
    approvedRowsRead: approved.length,
    playersWritten: approved.length,
    squadPresenceWritten: approved.length,
    linksWritten: approved.length
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

import type { RatingLabSummary } from "../domain/types.js";
import { selectPreviewCards } from "./selectPreviewCards.js";

export type PreviewImportEstimate = {
  cardsToWrite: number;
  nationsToWrite: number;
  editionsToWrite: number;
  sourcePlayersToWrite: number;
  playerIdentitiesToWrite: number;
  aliasesToWrite: number;
  outfieldStatsRows: number;
  goalkeeperStatsRows: number;
  estimatedTotalRows: number;
  estimatedStorageMb: number;
};

export function estimatePreviewImportSize(summary: RatingLabSummary, maxCards = 500): PreviewImportEstimate {
  const selected = selectPreviewCards(summary, maxCards).map((selection) => selection.card);
  const cardsToWrite = selected.length;
  const nationsToWrite = new Set(selected.map((card) => card.nation)).size;
  const editionsToWrite = new Set(selected.map((card) => card.worldCupYear)).size;
  const goalkeeperStatsRows = selected.filter((card) => card.position === "GK").length;
  const outfieldStatsRows = cardsToWrite - goalkeeperStatsRows;
  const sourcePlayersToWrite = cardsToWrite;
  const playerIdentitiesToWrite = cardsToWrite;
  const aliasesToWrite = cardsToWrite;
  const estimatedTotalRows =
    cardsToWrite +
    nationsToWrite +
    editionsToWrite +
    sourcePlayersToWrite +
    playerIdentitiesToWrite +
    aliasesToWrite +
    outfieldStatsRows +
    goalkeeperStatsRows +
    1;

  return {
    cardsToWrite,
    nationsToWrite,
    editionsToWrite,
    sourcePlayersToWrite,
    playerIdentitiesToWrite,
    aliasesToWrite,
    outfieldStatsRows,
    goalkeeperStatsRows,
    estimatedTotalRows,
    estimatedStorageMb: Number(((estimatedTotalRows * 2) / 1024).toFixed(2))
  };
}

export function estimateExceedsNeonFreePreviewLimits(
  estimate: PreviewImportEstimate,
  options: { maxCards: number; allowOverride?: boolean }
): string[] {
  const failures: string[] = [];
  if (options.maxCards > 1000 && !options.allowOverride) failures.push("maxCards exceeds hard cap 1000");
  if (estimate.estimatedTotalRows > 5000 && !options.allowOverride) failures.push("estimated rows exceed 5000");
  if (estimate.estimatedStorageMb > 25 && !options.allowOverride) failures.push("estimated storage exceeds 25 MB");
  if (estimate.estimatedStorageMb > 50) failures.push("estimated storage exceeds absolute 50 MB hard cap");
  return failures;
}

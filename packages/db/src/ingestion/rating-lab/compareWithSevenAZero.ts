import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  RatingLabCardReport,
  SevenAZeroComparison,
  SevenAZeroComparisonSummary,
  SevenAZeroSquadFile
} from "./types.js";
import { normalizeName } from "./utils.js";

export function isValidOverallRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 40 && value <= 100;
}

export async function loadSevenAZeroLocalJsonComparisons(sourceDir?: string): Promise<SevenAZeroComparison[]> {
  if (!sourceDir) return [];
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const comparisons: SevenAZeroComparison[] = [];
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith(".json"))) {
    const parsed = JSON.parse(await readFile(join(sourceDir, entry.name), "utf8")) as SevenAZeroSquadFile;
    for (const player of parsed.squad ?? []) {
      if (!isValidOverallRating(player.f)) continue;
      comparisons.push({
        normalizedName: normalizeName(player.name),
        internalName: player.name,
        nation: player.sel ?? parsed.sel,
        worldCupYear: player.copa ?? parsed.copa,
        rating: player.f
      });
    }
  }
  return comparisons;
}

export function findSevenAZeroComparison(
  card: { internalRawName: string; nation: string; worldCupYear: number },
  comparisons: readonly SevenAZeroComparison[]
): SevenAZeroComparison | undefined {
  const normalizedName = normalizeName(card.internalRawName);
  const nation = normalizeName(card.nation);
  return comparisons.find(
    (comparison) =>
      comparison.worldCupYear === card.worldCupYear &&
      normalizeName(comparison.nation) === nation &&
      namesMatch(normalizedName, comparison.normalizedName)
  );
}

export function summarizeSevenAZeroComparison(cards: readonly RatingLabCardReport[]): SevenAZeroComparisonSummary | null {
  const matched = cards.filter((card) => card.sevenAZeroRating !== null && card.sevenAZeroDelta !== null);
  const unmatchedPlayers = cards.filter((card) => card.sevenAZeroRating === null).length;
  if (matched.length === 0) return null;
  const absDeltas = matched.map((card) => Math.abs(card.sevenAZeroDelta ?? 0)).sort((left, right) => left - right);
  const signed = [...matched].sort((left, right) => (right.sevenAZeroDelta ?? 0) - (left.sevenAZeroDelta ?? 0));

  return {
    matchedPlayers: matched.length,
    unmatchedPlayers,
    averageAbsoluteDelta: average(absDeltas),
    medianAbsoluteDelta: percentile(absDeltas, 0.5),
    deltaP90: percentile(absDeltas, 0.9),
    largestPositiveDeltas: signed.slice(0, 20),
    largestNegativeDeltas: signed.slice(-20).reverse()
  };
}

function namesMatch(left: string, right: string): boolean {
  return left === right || left.includes(right) || right.includes(left);
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
  return values[index] ?? null;
}

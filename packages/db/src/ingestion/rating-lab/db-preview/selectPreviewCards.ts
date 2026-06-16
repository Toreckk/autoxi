import type { RatingLabCardSnapshot, RatingLabSummary } from "../domain/types.js";

export type PreviewCardSelection = {
  card: RatingLabCardSnapshot;
  reasons: string[];
};

const tierRank: Record<string, number> = {
  ICON: 7,
  HERO: 6,
  WORLD_CLASS: 5,
  STAR: 4,
  KEY_PLAYER: 3,
  STARTER: 2,
  SQUAD_PLAYER: 1
};

export function selectPreviewCards(summary: RatingLabSummary, maxCards = 500): PreviewCardSelection[] {
  const limit = Math.max(0, maxCards);
  const worldClassRank = tierRank.WORLD_CLASS ?? 5;
  const selected = new Map<string, PreviewCardSelection>();
  const sortedByRating = [...summary.cardSnapshots].sort(
    (left, right) => right.overall - left.overall || (tierRank[right.tier] ?? 0) - (tierRank[left.tier] ?? 0)
  );

  for (const anomaly of summary.anomalyDetails) {
    const card = summary.cardSnapshots.find(
      (snapshot) =>
        snapshot.internalRawName === anomaly.internalRawName &&
        snapshot.worldCupYear === anomaly.worldCupYear &&
        snapshot.nation === anomaly.nation
    );
    if (card) addSelection(selected, card, `anomaly:${anomaly.code}`);
  }

  for (const card of sortedByRating.filter((snapshot) => (tierRank[snapshot.tier] ?? 0) >= worldClassRank)) {
    addSelection(selected, card, "top-rated");
  }

  for (const card of sortedByRating.filter((snapshot) => snapshot.position === "GK")) {
    addSelection(selected, card, "goalkeeper-sample");
  }

  for (const card of onePerGroup(sortedByRating, (snapshot) => Math.floor(snapshot.worldCupYear / 10).toString())) {
    addSelection(selected, card, "decade-coverage");
  }

  for (const card of onePerGroup(sortedByRating, (snapshot) => snapshot.position)) {
    addSelection(selected, card, "position-coverage");
  }

  for (const card of sortedByRating) {
    addSelection(selected, card, "rating-fill");
    if (selected.size >= limit) break;
  }

  return [...selected.values()].slice(0, limit);
}

function addSelection(
  selected: Map<string, PreviewCardSelection>,
  card: RatingLabCardSnapshot,
  reason: string
): void {
  const existing = selected.get(card.key);
  if (existing) {
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    return;
  }
  selected.set(card.key, { card, reasons: [reason] });
}

function onePerGroup<T>(items: readonly T[], groupKey: (item: T) => string): T[] {
  const selected = new Map<string, T>();
  for (const item of items) {
    const key = groupKey(item);
    if (!selected.has(key)) selected.set(key, item);
  }
  return [...selected.values()];
}

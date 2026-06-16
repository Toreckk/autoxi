import type { RatingDistributionDiagnostics, RatingLabCardReport, DistributionGroup } from "../types.js";

export function resolveRatingDistributionDiagnostics(cards: readonly RatingLabCardReport[]): RatingDistributionDiagnostics {
  const sortedRatings = [...new Set(cards.map((card) => card.overall))].sort((left, right) => right - left);
  const buckets = sortedRatings.map((rating) => {
    const matches = cards.filter((card) => card.overall === rating);
    return {
      rating,
      count: matches.length,
      percentage: percentage(matches.length, cards.length),
      examples: matches
        .slice()
        .sort((left, right) => left.publicPlaceholderName.localeCompare(right.publicPlaceholderName))
        .slice(0, 5)
        .map((card) => `${card.publicPlaceholderName} (${card.nation} ${card.worldCupYear})`)
    };
  });

  return {
    totalCards: cards.length,
    buckets,
    count90Plus: countAtLeast(cards, 90),
    count95Plus: countAtLeast(cards, 95),
    count98Plus: countAtLeast(cards, 98),
    count99: cards.filter((card) => card.overall === 99).length,
    percentage90Plus: percentage(countAtLeast(cards, 90), cards.length),
    percentage95Plus: percentage(countAtLeast(cards, 95), cards.length),
    percentage98Plus: percentage(countAtLeast(cards, 98), cards.length),
    percentage99: percentage(cards.filter((card) => card.overall === 99).length, cards.length),
    byWorldCupYear: groupDistribution(cards, (card) => String(card.worldCupYear)),
    byDecade: groupDistribution(cards, (card) => `${Math.floor(card.worldCupYear / 10) * 10}s`),
    byPosition: groupDistribution(cards, (card) => card.position),
    byPrimarySource: groupDistribution(cards, (card) => card.primarySource),
    byConfidence: groupDistribution(cards, (card) => card.confidence)
  };
}

function groupDistribution(cards: readonly RatingLabCardReport[], keyFor: (card: RatingLabCardReport) => string): DistributionGroup[] {
  const groups = new Map<string, RatingLabCardReport[]>();
  for (const card of cards) {
    const key = keyFor(card);
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  return [...groups.entries()]
    .map(([key, groupCards]) => ({
      key,
      totalCards: groupCards.length,
      count90Plus: countAtLeast(groupCards, 90),
      count95Plus: countAtLeast(groupCards, 95),
      count99: groupCards.filter((card) => card.overall === 99).length
    }))
    .sort((left, right) => right.totalCards - left.totalCards || left.key.localeCompare(right.key));
}

function countAtLeast(cards: readonly RatingLabCardReport[], rating: number): number {
  return cards.filter((card) => card.overall >= rating).length;
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(2));
}

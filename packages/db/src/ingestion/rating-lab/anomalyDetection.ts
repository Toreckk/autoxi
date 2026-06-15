import { deriveTier } from "@autoxi/domain";
import type { RatingLabAnomaly, RatingLabCardReport } from "./types.js";
import { normalizeName } from "./utils.js";

export function detectAnomalyDetails(cards: readonly RatingLabCardReport[]): RatingLabAnomaly[] {
  const anomalies: RatingLabAnomaly[] = [];
  const byTournament = groupBy(cards, (card) => String(card.worldCupYear));
  const byTournamentTeam = groupBy(cards, (card) => `${card.worldCupYear}:${normalizeName(card.nation)}`);
  const byName = groupBy(cards, (card) => normalizeName(card.internalRawName));

  for (const card of cards) {
    if (card.primarySource === "FJELSTUL_GENERATED" && card.overall >= 90) {
      anomalies.push(anomaly(card, "unknown_high_rating", "WARNING", "Generated-only player is above 90."));
    }
    if (card.primarySource === "FJELSTUL_GENERATED" && card.appearances <= 0 && card.overall >= 94) {
      anomalies.push(anomaly(card, "generated_only_no_appearance_94_plus", "HARD_FAIL", "Generated-only no-appearance player is 94+."));
    }
    if (card.appearances <= 0 && card.awards.length === 0 && card.goals <= 0 && card.overall > 88) {
      anomalies.push(anomaly(card, "no_appearance_high_rating", "WARNING", "Player has no appearance/goals/awards and is above 88."));
    }
    if (card.overallStatDelta > 4) {
      anomalies.push(anomaly(card, "overall_stat_delta_gt_4", "WARNING", "Overall/stat estimate delta is above 4."));
    }
  }

  for (const tournamentCards of Object.values(byTournament)) {
    const topThree = [...tournamentCards].sort((left, right) => right.overall - left.overall).slice(0, 3);
    for (const card of topThree.filter((candidate) => candidate.primarySource === "FJELSTUL_GENERATED")) {
      anomalies.push(anomaly(card, "generated_only_top3_tournament", "HARD_FAIL", "Generated-only player appears in tournament top 3."));
    }
    const heroIconCount = tournamentCards.filter((card) => card.tier === "HERO" || card.tier === "ICON").length;
    if (heroIconCount > 8) {
      for (const card of tournamentCards.filter((candidate) => candidate.tier === "HERO" || candidate.tier === "ICON")) {
        anomalies.push(anomaly(card, "tournament_rating_distribution_outlier", "WARNING", "Tournament has too many Hero/Icon cards."));
      }
    }
  }

  for (const teamCards of Object.values(byTournamentTeam)) {
    const ninetyPlus = teamCards.filter((card) => card.overall >= 90);
    if (ninetyPlus.length > 5) {
      for (const card of ninetyPlus) {
        anomalies.push(anomaly(card, "team_rating_distribution_outlier", "WARNING", "Team has too many 90+ players."));
      }
    }
  }

  for (const nameCards of Object.values(byName)) {
    const years = new Set(nameCards.map((card) => card.worldCupYear));
    const nations = new Set(nameCards.map((card) => normalizeName(card.nation)));
    if (years.size >= 5) {
      for (const card of nameCards) {
        anomalies.push(anomaly(card, "too_many_world_cup_editions", "WARNING", "Same normalized player appears in unusually many editions."));
      }
    }
    if (nations.size > 1 && nameCards.length > 1) {
      for (const card of nameCards) {
        anomalies.push(anomaly(card, "possible_duplicate_identity", "WARNING", "Same normalized player name maps across multiple nations."));
      }
    }
  }

  return dedupeAnomalies(anomalies);
}

export function detectAnomalies(cards: readonly RatingLabCardReport[]): RatingLabCardReport[] {
  const details = detectAnomalyDetails(cards);
  const byCard = new Map<string, RatingLabCardReport>();
  for (const detail of details) {
    const card = cards.find(
      (candidate) =>
        candidate.internalRawName === detail.internalRawName &&
        candidate.worldCupYear === detail.worldCupYear &&
        candidate.nation === detail.nation
    );
    if (!card) continue;
    const existing = byCard.get(cardKey(card));
    const warnings = new Set((existing?.warnings ?? card.warnings).split("|").filter(Boolean));
    warnings.add(detail.code);
    byCard.set(cardKey(card), { ...card, warnings: [...warnings].join("|"), tier: deriveTier(card.overall) });
  }
  return [...byCard.values()].sort((left, right) => right.overall - left.overall);
}

function anomaly(
  card: RatingLabCardReport,
  code: string,
  severity: RatingLabAnomaly["severity"],
  reason: string
): RatingLabAnomaly {
  return {
    code,
    severity,
    internalRawName: card.internalRawName,
    worldCupYear: card.worldCupYear,
    nation: card.nation,
    overall: card.overall,
    reason
  };
}

function dedupeAnomalies(anomalies: readonly RatingLabAnomaly[]): RatingLabAnomaly[] {
  const seen = new Set<string>();
  return anomalies.filter((anomaly) => {
    const key = `${anomaly.code}:${anomaly.internalRawName}:${anomaly.worldCupYear}:${anomaly.nation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const value = key(item);
    groups[value] = [...(groups[value] ?? []), item];
  }
  return groups;
}

function cardKey(card: RatingLabCardReport): string {
  return `${card.internalRawName}:${card.worldCupYear}:${card.nation}`;
}

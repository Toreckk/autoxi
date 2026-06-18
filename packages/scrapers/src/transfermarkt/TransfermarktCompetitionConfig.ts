import { readFile } from "node:fs/promises";

export type LeagueExpansionRound = {
  id: string;
  description: string;
  leagues: string[];
  years: "worldCupYearOnly";
  onlyStillMissing?: boolean;
};

export type LeagueExpansionPlan = {
  rounds: LeagueExpansionRound[];
};

export const DEFAULT_ROUND_1: LeagueExpansionRound = {
  id: "round-1-core",
  description: "Top 5 Europe + Brazil + Argentina",
  leagues: ["GB1", "ES1", "IT1", "L1", "FR1", "BRA1", "AR1"],
  years: "worldCupYearOnly"
};

export async function loadLeagueExpansionPlan(path?: string): Promise<LeagueExpansionPlan> {
  if (!path) return { rounds: [DEFAULT_ROUND_1] };
  try {
    return parseLeagueExpansionPlan(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return { rounds: [DEFAULT_ROUND_1] };
  }
}

export function roundById(plan: LeagueExpansionPlan, roundId: string): LeagueExpansionRound {
  return plan.rounds.find((round) => round.id === roundId) ?? DEFAULT_ROUND_1;
}

function parseLeagueExpansionPlan(value: unknown): LeagueExpansionPlan {
  if (!value || typeof value !== "object" || !Array.isArray((value as { rounds?: unknown }).rounds)) return { rounds: [DEFAULT_ROUND_1] };
  const rounds = (value as { rounds: unknown[] }).rounds.flatMap((round) => {
    if (!round || typeof round !== "object") return [];
    const candidate = round as Partial<LeagueExpansionRound>;
    if (!candidate.id || !candidate.description || !Array.isArray(candidate.leagues)) return [];
    return [{
      id: candidate.id,
      description: candidate.description,
      leagues: candidate.leagues.filter((league): league is string => typeof league === "string" && league.length > 0),
      years: "worldCupYearOnly" as const,
      onlyStillMissing: Boolean(candidate.onlyStillMissing)
    }];
  });
  return { rounds: rounds.length > 0 ? rounds : [DEFAULT_ROUND_1] };
}

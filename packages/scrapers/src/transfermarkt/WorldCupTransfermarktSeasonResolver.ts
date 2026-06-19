import {
  seasonModelForCompetition,
  tournamentTimingForWorldCup,
  type TransfermarktCompetitionSeasonConfig,
  type TransfermarktCompetitionSeasonModel
} from "./TransfermarktCompetitionSeasonModel.js";

export type TransfermarktCompetitionSeasonPlan = {
  worldCupYear: number;
  competitionId: string;
  seasonModel: TransfermarktCompetitionSeasonModel;
  primarySeasonId: number;
  secondarySeasonIds: number[];
  allSeasonIds: number[];
  reason: string;
  warnings: string[];
};

export type TransfermarktSeasonPlan = Pick<
  TransfermarktCompetitionSeasonPlan,
  "worldCupYear" | "primarySeasonId" | "secondarySeasonIds" | "reason"
>;

export function resolveWorldCupTransfermarktCompetitionSeasonPlan(
  worldCupYear: number,
  competitionId: string,
  config?: TransfermarktCompetitionSeasonConfig
): TransfermarktCompetitionSeasonPlan {
  const seasonModel = seasonModelForCompetition(competitionId, config);
  const timing = tournamentTimingForWorldCup(worldCupYear, config);
  const warnings: string[] = [];
  let primarySeasonId: number;
  let secondarySeasonIds: number[];
  let reason: string;

  if (seasonModel === "UNKNOWN") {
    primarySeasonId = worldCupYear - 1;
    secondarySeasonIds = [worldCupYear];
    warnings.push(`unknown_competition_season_model:${competitionId}`);
    reason = `${competitionId} has no verified Transfermarkt season model; scanning adjacent World Cup seasons.`;
  } else if (timing === "WINTER") {
    primarySeasonId = worldCupYear;
    secondarySeasonIds = [worldCupYear - 1];
    reason = `${worldCupYear} was a winter World Cup; ${competitionId} primary Transfermarkt season is ${worldCupYear}.`;
  } else if (seasonModel === "CALENDAR_YEAR") {
    primarySeasonId = worldCupYear;
    secondarySeasonIds = [worldCupYear - 1];
    reason = `${competitionId} is configured as a calendar-year competition for summer World Cup ${worldCupYear}.`;
  } else {
    primarySeasonId = worldCupYear - 1;
    secondarySeasonIds = [worldCupYear];
    reason = `${competitionId} is configured as a cross-year European-style competition for summer World Cup ${worldCupYear}.`;
  }

  return {
    worldCupYear,
    competitionId,
    seasonModel,
    primarySeasonId,
    secondarySeasonIds,
    allSeasonIds: uniqueSeasonIds([primarySeasonId, ...secondarySeasonIds]),
    reason,
    warnings
  };
}

export function resolveWorldCupTransfermarktSeasonPlan(worldCupYear: number): TransfermarktSeasonPlan {
  const plan = resolveWorldCupTransfermarktCompetitionSeasonPlan(worldCupYear, "EUROPE_DEFAULT", {
    competitionSeasonModelOverrides: { EUROPE_DEFAULT: "EUROPE_CROSS_YEAR" }
  });
  return {
    worldCupYear: plan.worldCupYear,
    primarySeasonId: plan.primarySeasonId,
    secondarySeasonIds: plan.secondarySeasonIds,
    reason: plan.reason
  };
}

export function transfermarktSeasonIdsForWorldCup(
  worldCupYear: number,
  competitionId?: string,
  config?: TransfermarktCompetitionSeasonConfig
): number[] {
  if (!competitionId) {
    const plan = resolveWorldCupTransfermarktSeasonPlan(worldCupYear);
    return uniqueSeasonIds([plan.primarySeasonId, ...plan.secondarySeasonIds]);
  }
  return resolveWorldCupTransfermarktCompetitionSeasonPlan(worldCupYear, competitionId, config).allSeasonIds;
}

function uniqueSeasonIds(values: readonly number[]): number[] {
  return [...new Set(values)].filter(Number.isFinite);
}

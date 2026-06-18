export type TransfermarktSeasonPlan = {
  worldCupYear: number;
  primarySeasonId: number;
  secondarySeasonIds: number[];
  reason: string;
};

const WINTER_WORLD_CUP_PRIMARY_SEASONS: Record<number, TransfermarktSeasonPlan> = {
  2022: {
    worldCupYear: 2022,
    primarySeasonId: 2022,
    secondarySeasonIds: [2021],
    reason: "2022 was a winter World Cup; the tournament happened during the 2022/23 European season."
  }
};

export function resolveWorldCupTransfermarktSeasonPlan(worldCupYear: number): TransfermarktSeasonPlan {
  const override = WINTER_WORLD_CUP_PRIMARY_SEASONS[worldCupYear];
  if (override) return override;
  return {
    worldCupYear,
    primarySeasonId: worldCupYear - 1,
    secondarySeasonIds: [worldCupYear],
    reason: `${worldCupYear} was a summer World Cup; the relevant pre-tournament European club season is ${worldCupYear - 1}/${String(worldCupYear).slice(-2)}.`
  };
}

export function transfermarktSeasonIdsForWorldCup(worldCupYear: number): number[] {
  const plan = resolveWorldCupTransfermarktSeasonPlan(worldCupYear);
  return [plan.primarySeasonId, ...plan.secondarySeasonIds];
}

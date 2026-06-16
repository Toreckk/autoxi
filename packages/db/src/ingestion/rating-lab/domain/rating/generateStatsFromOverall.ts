import type { CardRole, GoalkeeperCardStatsDto, OutfieldCardStatsDto, VisiblePosition } from "@autoxi/domain";
import { estimateOverallFromStats } from "./estimateOverallFromStats.js";
import { clamp, deterministicInt, roundClamp } from "../../utils.js";

export function generateStatsFromOverall({
  overall,
  position,
  role,
  archetype,
  seed
}: {
  overall: number;
  position: VisiblePosition;
  role?: CardRole;
  archetype?: string;
  seed: string;
}): OutfieldCardStatsDto | GoalkeeperCardStatsDto {
  const profileSeed = `${seed}:${position}:${role ?? ""}:${archetype ?? ""}:${overall}`;
  if (position === "GK") {
    return tuneStatsToOverall(
      position,
      {
        profile: "GOALKEEPER",
        diving: shapedStat(overall, 2, `${profileSeed}:diving`),
        handling: shapedStat(overall, 0, `${profileSeed}:handling`),
        kicking: shapedStat(overall, -6, `${profileSeed}:kicking`),
        reflexes: shapedStat(overall, 3, `${profileSeed}:reflexes`),
        speed: shapedStat(overall, -18, `${profileSeed}:speed`),
        positioning: shapedStat(overall, 1, `${profileSeed}:positioning`)
      },
      overall
    );
  }

  return tuneStatsToOverall(position, {
    profile: "OUTFIELD",
    pace: shapedStat(overall, outfieldShape(position, "pace"), `${profileSeed}:pace`),
    shooting: shapedStat(overall, outfieldShape(position, "shooting"), `${profileSeed}:shooting`),
    passing: shapedStat(overall, outfieldShape(position, "passing"), `${profileSeed}:passing`),
    dribbling: shapedStat(overall, outfieldShape(position, "dribbling"), `${profileSeed}:dribbling`),
    defending: shapedStat(overall, outfieldShape(position, "defending"), `${profileSeed}:defending`),
    physical: shapedStat(overall, outfieldShape(position, "physical"), `${profileSeed}:physical`)
  }, overall);
}

function shapedStat(overall: number, shape: number, seed: string): number {
  return roundClamp(overall + shape + deterministicInt(seed, -3, 3), 0, 99);
}

function outfieldShape(
  position: VisiblePosition,
  stat: keyof Omit<OutfieldCardStatsDto, "profile">
): number {
  const shapes: Record<Exclude<VisiblePosition, "GK">, Record<keyof Omit<OutfieldCardStatsDto, "profile">, number>> = {
    CB: { pace: -7, shooting: -22, passing: -5, dribbling: -10, defending: 8, physical: 7 },
    LB: { pace: 6, shooting: -16, passing: -2, dribbling: 0, defending: 4, physical: 1 },
    RB: { pace: 6, shooting: -16, passing: -2, dribbling: 0, defending: 4, physical: 1 },
    CDM: { pace: -5, shooting: -11, passing: 4, dribbling: -1, defending: 5, physical: 5 },
    CM: { pace: -4, shooting: -5, passing: 7, dribbling: 4, defending: 0, physical: 0 },
    CAM: { pace: 0, shooting: 4, passing: 7, dribbling: 8, defending: -22, physical: -5 },
    LM: { pace: 8, shooting: 1, passing: 3, dribbling: 7, defending: -12, physical: -3 },
    RM: { pace: 8, shooting: 1, passing: 3, dribbling: 7, defending: -12, physical: -3 },
    LW: { pace: 10, shooting: 4, passing: 0, dribbling: 8, defending: -18, physical: -4 },
    RW: { pace: 10, shooting: 4, passing: 0, dribbling: 8, defending: -18, physical: -4 },
    ST: { pace: 4, shooting: 9, passing: -8, dribbling: 3, defending: -25, physical: 4 }
  };
  return position === "GK" ? 0 : shapes[position][stat];
}

function tuneStatsToOverall<T extends OutfieldCardStatsDto | GoalkeeperCardStatsDto>(
  position: VisiblePosition,
  stats: T,
  targetOverall: number
): T {
  let tuned = { ...stats } as T;
  let estimate = estimateOverallFromStats({ position, stats: tuned });
  let guard = 0;

  while (Math.abs(estimate - targetOverall) > 4 && guard < 10) {
    const direction = estimate < targetOverall ? 1 : -1;
    tuned = bumpWeightedStats(tuned, direction);
    estimate = estimateOverallFromStats({ position, stats: tuned });
    guard += 1;
  }

  return tuned;
}

function bumpWeightedStats<T extends OutfieldCardStatsDto | GoalkeeperCardStatsDto>(stats: T, direction: number): T {
  const result = { ...stats } as Record<string, unknown>;
  for (const [key, value] of Object.entries(stats)) {
    if (key === "profile") continue;
    result[key] = roundClamp(Number(value) + direction, 0, 99);
  }
  return result as T;
}

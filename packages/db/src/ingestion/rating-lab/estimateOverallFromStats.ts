import type { GoalkeeperCardStatsDto, OutfieldCardStatsDto, VisiblePosition } from "@autoxi/domain";
import { roundClamp } from "./utils.js";

export function estimateOverallFromStats({
  position,
  stats
}: {
  position: VisiblePosition;
  stats: OutfieldCardStatsDto | GoalkeeperCardStatsDto;
}): number {
  if (stats.profile === "GOALKEEPER") {
    return roundClamp(
      stats.diving * 0.22 +
        stats.handling * 0.18 +
        stats.kicking * 0.1 +
        stats.reflexes * 0.24 +
        stats.speed * 0.08 +
        stats.positioning * 0.18,
      0,
      99
    );
  }

  const weights = outfieldWeights(position);
  return roundClamp(
    stats.pace * weights.pace +
      stats.shooting * weights.shooting +
      stats.passing * weights.passing +
      stats.dribbling * weights.dribbling +
      stats.defending * weights.defending +
      stats.physical * weights.physical,
    0,
    99
  );
}

function outfieldWeights(position: VisiblePosition): Record<keyof Omit<OutfieldCardStatsDto, "profile">, number> {
  switch (position) {
    case "CB":
      return { pace: 0.1, shooting: 0.04, passing: 0.12, dribbling: 0.08, defending: 0.38, physical: 0.28 };
    case "LB":
    case "RB":
      return { pace: 0.2, shooting: 0.06, passing: 0.14, dribbling: 0.14, defending: 0.28, physical: 0.18 };
    case "CDM":
      return { pace: 0.1, shooting: 0.08, passing: 0.23, dribbling: 0.14, defending: 0.25, physical: 0.2 };
    case "CM":
      return { pace: 0.11, shooting: 0.12, passing: 0.28, dribbling: 0.2, defending: 0.14, physical: 0.15 };
    case "CAM":
      return { pace: 0.12, shooting: 0.18, passing: 0.28, dribbling: 0.28, defending: 0.04, physical: 0.1 };
    case "LM":
    case "RM":
    case "LW":
    case "RW":
      return { pace: 0.26, shooting: 0.18, passing: 0.18, dribbling: 0.26, defending: 0.04, physical: 0.08 };
    case "ST":
      return { pace: 0.18, shooting: 0.34, passing: 0.1, dribbling: 0.18, defending: 0.03, physical: 0.17 };
    case "GK":
      return { pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0 };
  }
}

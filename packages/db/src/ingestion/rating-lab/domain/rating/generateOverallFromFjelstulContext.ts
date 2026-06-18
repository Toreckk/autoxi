import type { CardEditionKey } from "@autoxi/domain";
import type { FjelstulCardContext, GeneratedOverallResult, RatingModifier } from "../types.js";
import { clamp, deterministicInt, roundClamp } from "../../utils.js";
import { prePhase1BCalibrationConfig } from "./ratingFormulaPresets.js";
import type { RatingFormulaConfig } from "./ratingFormulaConfig.js";

const AWARD_FLOORS: Partial<Record<CardEditionKey, number>> = {
  GOLDEN_BALL: 95,
  GOLDEN_BOOT: 92,
  GOLDEN_GLOVE: 90,
  BEST_YOUNG_PLAYER: 87
};

export function awardFloorForAwards(awards: readonly CardEditionKey[]): number | null {
  const floors = awards.map((award) => AWARD_FLOORS[award]).filter((floor): floor is number => floor !== undefined);
  return floors.length > 0 ? Math.max(...floors) : null;
}

export function generateOverallFromFjelstulContext(
  context: FjelstulCardContext,
  config: RatingFormulaConfig = prePhase1BCalibrationConfig
): GeneratedOverallResult {
  const modifiers: RatingModifier[] = [];
  const reasons: string[] = [];
  const appearances = context.appearances ?? 0;
  const goals = context.goals ?? 0;
  const minutes = context.minutes ?? 0;
  const seed = `${context.seed}:${context.identityKey}:${context.worldCupYear}`;

  let base: number;
  if (!context.squadPresence || appearances <= 0) {
    base = deterministicInt(`${seed}:squad-only`, 55, 70);
    reasons.push("squad-only or no recorded appearance");
  } else if (minutes >= 450 || appearances >= 6 || goals >= 4 || context.captain) {
    base = deterministicInt(`${seed}:key`, 74, 86);
    reasons.push("key contributor context");
  } else if (minutes >= 240 || appearances >= 3) {
    base = deterministicInt(`${seed}:regular`, 66, 80);
    reasons.push("regular tournament role");
  } else {
    base = deterministicInt(`${seed}:appeared`, 60, 74);
    reasons.push("appeared in tournament");
  }

  let overall = base;
  modifiers.push({ key: "base_role_bucket", value: base, reason: reasons[0] ?? "base rating bucket" });

  const addModifier = (key: string, value: number, reason: string): void => {
    if (value === 0) return;
    modifiers.push({ key, value, reason });
    overall += value;
    reasons.push(reason);
  };

  switch (context.teamResult) {
    case "CHAMPION":
      addModifier("team_result_champion", deterministicInt(`${seed}:champion`, 5, 8), "champion squad boost");
      break;
    case "RUNNER_UP":
      addModifier("team_result_runner_up", deterministicInt(`${seed}:runner-up`, 4, 6), "runner-up squad boost");
      break;
    case "THIRD":
    case "FOURTH":
      addModifier("team_result_semifinalist", deterministicInt(`${seed}:semi`, 2, 4), "semifinalist squad boost");
      break;
    default:
      break;
  }

  if (context.host) addModifier("host_status", deterministicInt(`${seed}:host`, 0, 1), "host status minor boost");
  if (context.captain) addModifier("captain", 2, "captaincy signal");
  if (context.samePlayerEditionCount >= 2) {
    addModifier(
      "repeat_world_cups",
      clamp(context.samePlayerEditionCount - 1, 1, 3),
      "repeat World Cup squad presence"
    );
  }

  if (goals > 0) {
    const positionMultiplier = context.position === "ST" || context.position === "LW" || context.position === "RW" ? 1 : 1.25;
    addModifier("goals", Math.min(8, Math.ceil(goals * positionMultiplier)), "goal contribution boost");
  }

  const strongIndividualSignal = context.awards.length > 0 || context.captain || goals >= 4 || minutes >= 450 || appearances >= 6;
  const cap = generatedRatingCap({ appearances, goals, awards: context.awards, strongIndividualSignal, config });
  if (cap !== null && overall > cap) {
    const reason =
      cap <= 78
        ? "generated_cap_no_signal"
        : cap <= 84
          ? "generated_cap_limited_signal"
          : "high_rating_requires_strong_signal";
    modifiers.push({ key: reason, value: cap - overall, reason });
    overall = cap;
    reasons.push(reason);
  }

  const awardFloor = awardFloorForAwards(context.awards);
  if (awardFloor !== null && overall < awardFloor) {
    modifiers.push({ key: "award_floor", value: awardFloor - overall, reason: "award winner minimum rating floor" });
    overall = awardFloor;
    reasons.push("award winner floor applied");
  }
  const awardCap = generatedAwardCapForAwards(context.awards, config);
  if (awardCap !== null && overall > awardCap) {
    modifiers.push({ key: "generated_award_cap", value: awardCap - overall, reason: "generated award rating cap" });
    overall = awardCap;
    reasons.push("generated award cap applied");
  }

  overall = roundClamp(overall, 55, 99);

  const confidence =
    context.awards.length > 0 || context.captain || minutes >= 450 || appearances >= 6
      ? "MEDIUM"
      : appearances > 0 || context.teamResult !== "UNKNOWN"
        ? "MEDIUM"
        : "LOW";

  return {
    overall,
    confidence,
    reasons,
    modifiers
  };
}

function generatedAwardCapForAwards(awards: readonly CardEditionKey[], config: RatingFormulaConfig): number | null {
  if (awards.includes("GOLDEN_BALL")) return capBelowAbsoluteClamp(config.caps.generatedGoldenBallMax);
  if (awards.includes("GOLDEN_BOOT")) return capBelowAbsoluteClamp(config.caps.generatedGoldenBootMax);
  if (awards.includes("GOLDEN_GLOVE")) return capBelowAbsoluteClamp(config.caps.generatedGoldenGloveMax);
  if (awards.includes("BEST_YOUNG_PLAYER")) return capBelowAbsoluteClamp(config.caps.generatedBestYoungPlayerMax);
  return null;
}

function capBelowAbsoluteClamp(value: number): number | null {
  return value < 99 ? value : null;
}

function generatedRatingCap({
  appearances,
  goals,
  awards,
  strongIndividualSignal,
  config
}: {
  appearances: number;
  goals: number;
  awards: readonly CardEditionKey[];
  strongIndividualSignal: boolean;
  config: RatingFormulaConfig;
}): number | null {
  if (awards.length > 0) return null;
  if (appearances <= 0 && goals <= 0) return config.caps.noSignalGeneratedMax;
  if (appearances > 0 && goals <= 0 && !strongIndividualSignal) return config.caps.limitedSignalGeneratedMax;
  if (!strongIndividualSignal) return config.caps.generatedOnlyNoStrongSignalMax;
  return null;
}

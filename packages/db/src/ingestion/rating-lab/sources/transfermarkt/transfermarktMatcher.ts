import type { FjelstulCardContext } from "../../domain/types.js";
import { normalizeName } from "../../utils.js";
import type { TransfermarktMatchCandidate, TransfermarktPlayerSeason } from "./transfermarktTypes.js";

export function matchTransfermarktPlayer(
  context: FjelstulCardContext,
  records: readonly TransfermarktPlayerSeason[]
): TransfermarktMatchCandidate[] {
  const contextName = normalizeName(context.internalRawName);
  return records
    .map((record) => {
      const reasons: string[] = [];
      let score = 0;
      if (contextName === record.normalizedName) {
        score += 70;
        reasons.push("exact_name");
      } else if (contextName.includes(record.normalizedName) || record.normalizedName.includes(contextName)) {
        score += 45;
        reasons.push("partial_name");
      } else if (tokenOverlapScore(contextName, record.normalizedName) >= 0.67) {
        score += 45;
        reasons.push("token_name");
      }
      if (record.nation && normalizeName(record.nation) === normalizeName(context.nation)) {
        score += 20;
        reasons.push("nation");
      }
      if (Math.abs(record.seasonYear - context.worldCupYear) <= 1) {
        score += 10;
        reasons.push("season_near_world_cup");
      }
      return {
        context,
        record,
        score,
        confidence: score >= 90 ? "HIGH" : score >= 65 ? "MEDIUM" : "LOW",
        reasons
      } satisfies TransfermarktMatchCandidate;
    })
    .filter((candidate) => candidate.score >= 45)
    .sort((left, right) => right.score - left.score);
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

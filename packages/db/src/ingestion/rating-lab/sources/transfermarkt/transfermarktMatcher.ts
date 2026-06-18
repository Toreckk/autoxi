import type { FjelstulCardContext } from "../../domain/types.js";
import { normalizeName } from "../../utils.js";
import { createStaticNationAliasIndex, normalizeNationToCode, type NationAliasIndex } from "../nations/normalizeNation.js";
import type { TransfermarktMatchCandidate, TransfermarktPlayerSeason } from "./transfermarktTypes.js";

export function matchTransfermarktPlayer(
  context: FjelstulCardContext,
  records: readonly TransfermarktPlayerSeason[],
  options: { nationAliasIndex?: NationAliasIndex } = {}
): TransfermarktMatchCandidate[] {
  const contextName = normalizeName(context.internalRawName);
  const nationAliasIndex = options.nationAliasIndex ?? createStaticNationAliasIndex();
  return records
    .map((record) => {
      const reasons: string[] = [];
      let score = 0;
      let matchNameStatus = "NO_MATCH";
      if (contextName === record.normalizedName) {
        score += 70;
        reasons.push("exact_name");
        matchNameStatus = "EXACT";
      } else if (contextName.includes(record.normalizedName) || record.normalizedName.includes(contextName)) {
        score += 45;
        reasons.push("partial_name");
        matchNameStatus = "PARTIAL";
      } else if (tokenOverlapScore(contextName, record.normalizedName) >= 0.67) {
        score += 45;
        reasons.push("token_name");
        matchNameStatus = "TOKEN";
      }
      const matchNationStatus = record.nation
        ? nationMatches(record.nation, context.nation, nationAliasIndex)
          ? "MATCH"
          : "MISMATCH"
        : "MISSING";
      if (record.nation && matchNationStatus === "MATCH") {
        score += 20;
        reasons.push("nation");
      }
      const matchBirthYearStatus = birthYearStatus(context, record);
      const matchPositionStatus = positionStatus(context, record);
      if (Math.abs(record.seasonYear - context.worldCupYear) <= 1) {
        score += 10;
        reasons.push("season_near_world_cup");
      }
      const confidence = score >= 90 ? "HIGH" : score >= 65 ? "MEDIUM" : "LOW";
      return {
        context,
        record,
        score,
        confidence,
        reasons,
        transfermarktPlayerId: record.playerId,
        matchNameStatus,
        matchNationStatus,
        matchBirthYearStatus,
        matchPositionStatus,
        matchFailureReason: matchFailureReason({ score, matchNameStatus, matchNationStatus, record }),
        matchedOn: reasons.join("|")
      } satisfies TransfermarktMatchCandidate;
    })
    .filter((candidate) => candidate.score >= 45)
    .sort((left, right) => right.score - left.score);
}

function nationMatches(left: string, right: string, nationAliasIndex: NationAliasIndex): boolean {
  const leftCode = normalizeNationToCode(left, nationAliasIndex);
  const rightCode = normalizeNationToCode(right, nationAliasIndex);
  return leftCode !== null && rightCode !== null && leftCode === rightCode;
}

function birthYearStatus(context: FjelstulCardContext, record: TransfermarktPlayerSeason): string {
  if (!context.birthYear || !record.birthYear) return "MISSING";
  return context.birthYear === record.birthYear ? "MATCH" : "MISMATCH";
}

function positionStatus(context: FjelstulCardContext, record: TransfermarktPlayerSeason): string {
  const position = normalizeName([record.position, record.subPosition].filter(Boolean).join(" "));
  if (!position) return "MISSING";
  const contextPosition = normalizeName(context.position);
  if (position.includes(contextPosition)) return "MATCH";
  if (context.position === "GK" && position.includes("goalkeeper")) return "MATCH";
  if (context.position !== "GK" && !position.includes("goalkeeper")) return "COMPATIBLE";
  return "MISMATCH";
}

function matchFailureReason({
  score,
  matchNameStatus,
  matchNationStatus,
  record
}: {
  score: number;
  matchNameStatus: string;
  matchNationStatus: string;
  record: TransfermarktPlayerSeason;
}): string {
  if (!record.playerId) return "missing_transfermarkt_player_id";
  if (matchNameStatus === "NO_MATCH") return "name_no_candidate";
  if (matchNationStatus === "MISMATCH") return "nation_mismatch";
  if (score < 65) return "insufficient_match_score";
  if (score < 90) return "medium_confidence_identity";
  return "";
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

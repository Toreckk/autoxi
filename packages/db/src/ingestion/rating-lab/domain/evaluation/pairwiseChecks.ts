import { findBenchmarkCandidates } from "./benchmarkRanges.js";
import type { BenchmarkStatus, PairwiseRatingCheckResult, RatingLabCardReport } from "../types.js";

export type PairwiseRatingCheck = {
  id: string;
  higher: {
    nameSearch: string;
    aliases?: readonly string[];
    nationCode?: string;
    worldCupYear: number;
  };
  lower: {
    nameSearch: string;
    aliases?: readonly string[];
    nationCode?: string;
    worldCupYear: number;
  };
  minGap?: number;
  severity: "HARD_FAIL" | "WARNING";
  reason: string;
};

export const PAIRWISE_RATING_CHECKS = [
  {
    id: "romario-1994-above-bebeto-1994",
    higher: { nameSearch: "Romario", aliases: ["Romário"], nationCode: "BRA", worldCupYear: 1994 },
    lower: { nameSearch: "Bebeto", nationCode: "BRA", worldCupYear: 1994 },
    minGap: 1,
    severity: "WARNING",
    reason: "Romario 1994 should usually sit above Bebeto 1994."
  },
  {
    id: "yashin-1966-above-bannikov-1966",
    higher: { nameSearch: "Yashin", aliases: ["Lev Yashin"], nationCode: "URS", worldCupYear: 1966 },
    lower: { nameSearch: "Bannikov", nationCode: "URS", worldCupYear: 1966 },
    minGap: 8,
    severity: "WARNING",
    reason: "Yashin 1966 should be clearly above Bannikov 1966."
  },
  {
    id: "maradona-1986-above-kempes-1982",
    higher: { nameSearch: "Maradona", aliases: ["Diego Maradona"], nationCode: "ARG", worldCupYear: 1986 },
    lower: { nameSearch: "Kempes", nationCode: "ARG", worldCupYear: 1982 },
    minGap: 2,
    severity: "WARNING",
    reason: "Cross-edition comparison is tricky, but Maradona 1986 should usually clear Kempes 1982."
  },
  {
    id: "zidane-1998-above-deschamps-1998",
    higher: { nameSearch: "Zidane", aliases: ["Zinedine Zidane"], nationCode: "FRA", worldCupYear: 1998 },
    lower: { nameSearch: "Deschamps", nationCode: "FRA", worldCupYear: 1998 },
    minGap: 4,
    severity: "WARNING",
    reason: "Zidane 1998 should rate above France 1998 midfield role players."
  },
  {
    id: "ronaldo-2002-above-brazil-2002-attacker-reference",
    higher: { nameSearch: "Ronaldo", aliases: ["Ronaldo Nazario"], nationCode: "BRA", worldCupYear: 2002 },
    lower: { nameSearch: "Rivaldo", nationCode: "BRA", worldCupYear: 2002 },
    minGap: 1,
    severity: "WARNING",
    reason: "Ronaldo 2002 should usually be above most Brazil 2002 attackers."
  }
] as const satisfies readonly PairwiseRatingCheck[];

export function evaluatePairwiseChecks(cards: readonly RatingLabCardReport[]): PairwiseRatingCheckResult[] {
  return PAIRWISE_RATING_CHECKS.map((check) => evaluatePairwiseCheck(check, cards));
}

export function evaluatePairwiseCheck(
  check: PairwiseRatingCheck,
  cards: readonly RatingLabCardReport[]
): PairwiseRatingCheckResult {
  const higherCandidates = findBenchmarkCandidates(toBenchmarkLike(check.higher), cards);
  const lowerCandidates = findBenchmarkCandidates(toBenchmarkLike(check.lower), cards);
  const candidateNames = [...higherCandidates, ...lowerCandidates].map((candidate) => candidate.internalRawName);
  if (higherCandidates.length === 0 || lowerCandidates.length === 0) {
    return pairwiseResult(check, "MISSING", null, null, null, candidateNames);
  }
  if (higherCandidates.length > 1 || lowerCandidates.length > 1) {
    return pairwiseResult(check, "AMBIGUOUS", null, null, null, candidateNames);
  }

  const higher = higherCandidates[0]!;
  const lower = lowerCandidates[0]!;
  const minGap = check.minGap ?? 0;
  const actualGap = higher.overall - lower.overall;
  const status: BenchmarkStatus = actualGap >= minGap ? "PASS" : check.severity === "HARD_FAIL" ? "FAIL" : "WARN";
  return pairwiseResult(check, status, higher.overall, lower.overall, actualGap, candidateNames);
}

function pairwiseResult(
  check: PairwiseRatingCheck,
  status: BenchmarkStatus,
  higherRating: number | null,
  lowerRating: number | null,
  actualGap: number | null,
  candidateNames: readonly string[]
): PairwiseRatingCheckResult {
  return {
    id: check.id,
    status,
    severity: check.severity,
    higherName: check.higher.nameSearch,
    lowerName: check.lower.nameSearch,
    higherRating,
    lowerRating,
    actualGap,
    expectedMinGap: check.minGap ?? 0,
    reason: check.reason,
    candidateNames
  };
}

function toBenchmarkLike(input: PairwiseRatingCheck["higher"]) {
  return {
    id: "pairwise-match",
    nameSearch: input.nameSearch,
    aliases: input.aliases,
    worldCupYear: input.worldCupYear,
    nationCode: input.nationCode,
    expectedRatingMin: 0,
    expectedRatingMax: 99,
    benchmarkType: "ROLE_PLAYER_RANGE" as const,
    reason: "pairwise match"
  };
}

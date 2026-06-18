import { nameScore } from "../shared/MatchScoring.js";
import { normalizeName } from "../shared/ProviderLinks.js";
import { resolveWorldCupTransfermarktSeasonPlan, transfermarktSeasonIdsForWorldCup } from "./WorldCupTransfermarktSeasonResolver.js";

export type TransfermarktMissingPlayer = {
  requestKey: string;
  ratingSubjectId: string;
  canonicalPlayerId: string;
  name: string;
  aliases: string[];
  nation: string;
  worldCupYear: number;
  position: string;
  birthYear?: number | null;
  dateOfBirth?: string | null;
  transfermarktId?: string | null;
  localIdEvidence?: boolean;
};

export type TransfermarktSquadPlayer = {
  playerId: string;
  name: string;
  nationalities: string[];
  dateOfBirth?: string;
  birthYear?: number;
  position?: string;
  clubName?: string;
  leagueId: string;
  season: number;
  worldCupYear?: number;
};

export type TransfermarktCandidateMatch = {
  request: TransfermarktMissingPlayer;
  candidate: TransfermarktSquadPlayer;
  score: number;
  status: "auto_approved" | "needs_review" | "rejected";
  reasons: string[];
  hardContradictions: string[];
};

export function matchTransfermarktCandidates(
  requests: readonly TransfermarktMissingPlayer[],
  candidates: readonly TransfermarktSquadPlayer[]
): TransfermarktCandidateMatch[] {
  const matches: TransfermarktCandidateMatch[] = [];
  for (const request of requests) {
    const scored = candidates
      .filter((candidate) => transfermarktSeasonIdsForWorldCup(request.worldCupYear).includes(candidate.season))
      .map((candidate) => scoreCandidate(request, candidate))
      .filter((match) => match.score >= 50 || match.hardContradictions.length > 0)
      .sort((left, right) => right.score - left.score);
    const uniqueScored = uniqueBestIdentityMatches(scored);
    const topScore = uniqueScored[0]?.score ?? 0;
    const topIdentityCount = new Set(uniqueScored.filter((match) => match.score === topScore).map((match) => match.candidate.playerId)).size;
    for (const match of uniqueScored) {
      if (match.hardContradictions.length > 0 || match.score < 70) match.status = "rejected";
      else if (match.score >= 90 && topIdentityCount === 1 && evidenceFamilyCount(match.reasons) >= 3) match.status = "auto_approved";
      else match.status = "needs_review";
      matches.push(match);
    }
  }
  return matches;
}

function uniqueBestIdentityMatches(matches: readonly TransfermarktCandidateMatch[]): TransfermarktCandidateMatch[] {
  const byPlayerId = new Map<string, TransfermarktCandidateMatch>();
  for (const match of matches) {
    if (!byPlayerId.has(match.candidate.playerId)) byPlayerId.set(match.candidate.playerId, match);
  }
  return [...byPlayerId.values()];
}

export function scoreCandidate(request: TransfermarktMissingPlayer, candidate: TransfermarktSquadPlayer): TransfermarktCandidateMatch {
  const reasons: string[] = [];
  const hardContradictions: string[] = [];
  let score = 0;

  if (request.transfermarktId && request.transfermarktId === candidate.playerId) {
    score += 20;
    reasons.push("local_id_evidence");
  } else if (request.localIdEvidence) {
    score += 10;
    reasons.push("local_id_evidence_present");
  }

  const name = nameScore([request.name, ...request.aliases], candidate.name);
  score += name.score;
  reasons.push(name.reason);
  const hasExactFullNameMatch = name.reason === "name_exact" && !isSingleTokenName(request.name);
  if (hasExactFullNameMatch) {
    score += 10;
    reasons.push("full_name_exact_bonus");
  }

  const requestNation = normalizeNation(request.nation);
  const candidateNations = candidate.nationalities.map(normalizeNation);
  if (requestNation && candidateNations.includes(requestNation)) {
    score += 25;
    reasons.push("nationality_match");
  } else if (candidateNations.length > 0) {
    hardContradictions.push("nationality_contradiction");
  }

  const requestBirthYear = request.birthYear ?? yearFromDate(request.dateOfBirth ?? "");
  const candidateBirthYear = candidate.birthYear ?? yearFromDate(candidate.dateOfBirth ?? "");
  if (requestBirthYear && candidateBirthYear) {
    if (Math.abs(requestBirthYear - candidateBirthYear) > 1) hardContradictions.push("birth_year_contradiction");
    else {
      score += requestBirthYear === candidateBirthYear ? 25 : 15;
      reasons.push(requestBirthYear === candidateBirthYear ? "birth_year_exact" : "birth_year_near");
    }
  } else if (!requestBirthYear && candidateBirthYear) {
    score += 10;
    reasons.push("candidate_birth_year_present");
  }

  const hasPlausiblePosition = positionPlausible(request.position, candidate.position ?? "");
  if (hasPlausiblePosition) {
    score += 10;
    reasons.push("position_plausible");
  }

  const seasonPlan = resolveWorldCupTransfermarktSeasonPlan(request.worldCupYear);
  if (candidate.season === seasonPlan.primarySeasonId) {
    score += 10;
    reasons.push("primary_transfermarkt_season_context");
  } else if (seasonPlan.secondarySeasonIds.includes(candidate.season)) {
    score += 5;
    reasons.push("secondary_transfermarkt_season_context");
  }

  const hasSeasonContext = candidate.season === seasonPlan.primarySeasonId || seasonPlan.secondarySeasonIds.includes(candidate.season);
  const hasExactSingleTokenNameMatch = name.reason === "name_exact" && isSingleTokenName(request.name);
  if (hasExactFullNameMatch && candidateBirthYear && hasPlausiblePosition && hasSeasonContext) {
    score += 10;
    reasons.push("supported_full_name_profile_bonus");
  }
  if (hasExactSingleTokenNameMatch && requestNation && candidateNations.includes(requestNation) && candidateBirthYear && hasPlausiblePosition && hasSeasonContext) {
    score += 15;
    reasons.push("supported_one_token_profile_bonus");
  }

  return { request, candidate, score: Math.min(score, 100), status: "needs_review", reasons, hardContradictions };
}

function evidenceFamilyCount(reasons: readonly string[]): number {
  return [
    reasons.some((reason) => reason.includes("name")),
    reasons.some((reason) => reason.includes("nationality")),
    reasons.some((reason) => reason.includes("birth_year") || reason.includes("candidate_birth_year")),
    reasons.some((reason) => reason.includes("position")),
    reasons.some((reason) => reason.includes("season_context")),
    reasons.some((reason) => reason.includes("local_id") || reason.includes("provider_link"))
  ].filter(Boolean).length;
}

const NATION_ALIASES: Record<string, string> = {
  ARG: "ARGENTINA",
  ARGENTINA: "ARGENTINA",
  BRA: "BRAZIL",
  BRASIL: "BRAZIL",
  BRAZIL: "BRAZIL",
  DEU: "GERMANY",
  GER: "GERMANY",
  GERMANY: "GERMANY",
  ESP: "SPAIN",
  SPAIN: "SPAIN",
  FRA: "FRANCE",
  FRANCE: "FRANCE",
  ITA: "ITALY",
  ITALY: "ITALY",
  PRT: "PORTUGAL",
  POR: "PORTUGAL",
  PORTUGAL: "PORTUGAL",
  RUS: "RUSSIA",
  RUSSIA: "RUSSIA"
};

function normalizeNation(value: string): string {
  const normalized = normalizeName(value).toUpperCase();
  return NATION_ALIASES[normalized] ?? normalized;
}

function isSingleTokenName(name: string): boolean {
  return normalizeName(name).split(" ").filter(Boolean).length === 1;
}

function yearFromDate(value: string): number | null {
  const match = value.match(/\b(18|19|20)\d{2}\b/u);
  return match ? Number(match[0]) : null;
}

function positionPlausible(requestPosition: string, candidatePosition: string): boolean {
  const left = normalizeName(requestPosition);
  const right = normalizeName(candidatePosition);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  if (left === "st" && /forward|centre forward|striker/u.test(right)) return true;
  if (left === "cm" && /midfield/u.test(right)) return true;
  if (left === "gk" && /keeper|goalkeeper/u.test(right)) return true;
  return false;
}

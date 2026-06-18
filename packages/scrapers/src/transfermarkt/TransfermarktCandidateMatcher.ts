import { nameScore } from "../shared/MatchScoring.js";
import { normalizeName } from "../shared/ProviderLinks.js";

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
      .filter((candidate) => candidate.season === request.worldCupYear)
      .map((candidate) => scoreCandidate(request, candidate))
      .filter((match) => match.score >= 50 || match.hardContradictions.length > 0)
      .sort((left, right) => right.score - left.score);
    const topScore = scored[0]?.score ?? 0;
    const topCount = scored.filter((match) => match.score === topScore).length;
    for (const match of scored) {
      if (match.hardContradictions.length > 0 || match.score < 70) match.status = "rejected";
      else if (match.score >= 90 && topCount === 1) match.status = "auto_approved";
      else match.status = "needs_review";
      matches.push(match);
    }
  }
  return matches;
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

  if (candidate.season === request.worldCupYear) {
    score += 5;
    reasons.push("same_world_cup_year_season");
  }

  if (hasExactFullNameMatch && candidateBirthYear && hasPlausiblePosition && candidate.season === request.worldCupYear) {
    score += 10;
    reasons.push("supported_full_name_profile_bonus");
  }

  return { request, candidate, score: Math.min(score, 100), status: "needs_review", reasons, hardContradictions };
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

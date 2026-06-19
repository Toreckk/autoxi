import { nameScore } from "../shared/MatchScoring.js";
import { normalizeName } from "../shared/ProviderLinks.js";
import type { TransfermarktCompetitionSeasonConfig } from "./TransfermarktCompetitionSeasonModel.js";
import { resolveWorldCupTransfermarktCompetitionSeasonPlan, transfermarktSeasonIdsForWorldCup } from "./WorldCupTransfermarktSeasonResolver.js";

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
  evidenceFamiliesPresent: string[];
  evidenceFamiliesMissing: string[];
  autoApprovedReason: string;
  needsReviewReason: string;
  rejectedReason: string;
};

export function matchTransfermarktCandidates(
  requests: readonly TransfermarktMissingPlayer[],
  candidates: readonly TransfermarktSquadPlayer[],
  options: { seasonConfig?: TransfermarktCompetitionSeasonConfig } = {}
): TransfermarktCandidateMatch[] {
  const matches: TransfermarktCandidateMatch[] = [];
  for (const request of requests) {
    const scored = candidates
      .filter((candidate) => transfermarktSeasonIdsForWorldCup(request.worldCupYear, candidate.leagueId, options.seasonConfig).includes(candidate.season))
      .map((candidate) => scoreCandidate(request, candidate, options))
      .filter((match) => match.score >= 50 || match.hardContradictions.length > 0)
      .sort((left, right) => right.score - left.score);
    const uniqueScored = uniqueBestIdentityMatches(scored);
    const topScore = uniqueScored[0]?.score ?? 0;
    const topIdentityCount = new Set(uniqueScored.filter((match) => match.score === topScore).map((match) => match.candidate.playerId)).size;
    for (const match of uniqueScored) {
      const oneTokenReviewReason = oneTokenMissingEvidenceReason(match);
      if (match.hardContradictions.length > 0) {
        match.status = "rejected";
        match.rejectedReason = match.hardContradictions[0] ?? "insufficient_match_score";
      } else if (oneTokenReviewReason) {
        match.status = "needs_review";
        match.needsReviewReason = oneTokenReviewReason;
      } else if (match.score < 70) {
        match.status = "rejected";
        match.rejectedReason = "insufficient_match_score";
      } else if (match.score >= 90 && topIdentityCount === 1 && match.evidenceFamiliesPresent.length >= 3) {
        match.status = "auto_approved";
        match.autoApprovedReason = `score_${match.score}_unique_multi_family_match`;
      } else {
        match.status = "needs_review";
        match.needsReviewReason = topIdentityCount > 1 ? "multiple_plausible_candidates" : match.score < 90 ? "score_below_auto_approval_threshold" : "insufficient_evidence_families";
      }
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

export function scoreCandidate(
  request: TransfermarktMissingPlayer,
  candidate: TransfermarktSquadPlayer,
  options: { seasonConfig?: TransfermarktCompetitionSeasonConfig } = {}
): TransfermarktCandidateMatch {
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

  const seasonPlan = resolveWorldCupTransfermarktCompetitionSeasonPlan(request.worldCupYear, candidate.leagueId, options.seasonConfig);
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

  const finalReasons = [...reasons, ...seasonPlan.warnings];
  const evidenceFamiliesPresent = evidenceFamilies(finalReasons);
  return {
    request,
    candidate,
    score: Math.min(score, 100),
    status: "needs_review",
    reasons: finalReasons,
    hardContradictions,
    evidenceFamiliesPresent,
    evidenceFamiliesMissing: missingEvidenceFamilies(evidenceFamiliesPresent),
    autoApprovedReason: "",
    needsReviewReason: "",
    rejectedReason: ""
  };
}

function evidenceFamilies(reasons: readonly string[]): string[] {
  return [
    reasons.some((reason) => reason.includes("name")) ? "name" : "",
    reasons.some((reason) => reason.includes("nationality")) ? "nation" : "",
    reasons.some((reason) => reason.includes("birth_year") || reason.includes("candidate_birth_year")) ? "birth" : "",
    reasons.some((reason) => reason.includes("position")) ? "position" : "",
    reasons.some((reason) => reason.includes("season_context")) ? "season_context" : "",
    reasons.some((reason) => reason.includes("local_id")) ? "provider_id" : "",
    reasons.some((reason) => reason.includes("provider_link")) ? "approved_link" : ""
  ].filter(Boolean);
}

function missingEvidenceFamilies(present: readonly string[]): string[] {
  return ["name", "nation", "birth", "position", "season_context"].filter((family) => !present.includes(family));
}

function oneTokenMissingEvidenceReason(match: TransfermarktCandidateMatch): string {
  if (!isSingleTokenName(match.request.name)) return "";
  const required = ["name", "nation", "birth", "position", "season_context"];
  const missing = required.filter((family) => !match.evidenceFamiliesPresent.includes(family));
  if (missing.length > 0) return `one_token_missing_required_evidence:${missing.join("|")}`;
  return "";
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
  if (left === "st" && /winger|attack/u.test(right)) return true;
  if (left === "cm" && /midfield/u.test(right)) return true;
  if (left === "gk" && /keeper|goalkeeper/u.test(right)) return true;
  return false;
}

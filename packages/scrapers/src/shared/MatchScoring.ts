import { normalizeName } from "./ProviderLinks.js";

export type MatchScoreBreakdown = {
  score: number;
  reasons: string[];
  hardContradictions: string[];
};

export function nameScore(targetNames: readonly string[], candidateName: string): { score: number; reason: string } {
  const candidate = normalizeName(candidateName);
  for (const targetName of targetNames) {
    const target = normalizeName(targetName);
    if (target && target === candidate) return { score: 35, reason: "name_exact" };
  }
  const bestOverlap = Math.max(0, ...targetNames.map((name) => tokenOverlap(normalizeName(name), candidate)));
  if (bestOverlap >= 0.85) return { score: 28, reason: "name_high_overlap" };
  if (bestOverlap >= 0.67) return { score: 18, reason: "name_medium_overlap" };
  return { score: 0, reason: "name_weak" };
}

export function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

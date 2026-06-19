export function estimateTransfermarktLeagueStrengthAdjustment(leagueName?: string): number {
  if (!leagueName) return 0;
  const league = leagueName.toLowerCase();
  if (league.includes("premier league") || league.includes("la liga") || league.includes("serie a")) return 1;
  if (league.includes("bundesliga") || league.includes("ligue 1")) return 0.5;
  return 0;
}

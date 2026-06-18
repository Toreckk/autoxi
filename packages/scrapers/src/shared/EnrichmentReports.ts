export type CoverageSummary = {
  totalWorldCupCards: number;
  cardsWithTransfermarktData: number;
  cardsWithoutTransfermarktData: number;
  transfermarktCoveragePercent: number;
  beforePassCardsWithTransfermarktData?: number;
  afterPassCardsWithTransfermarktData?: number;
  improvedCardCount?: number;
  improvedCoveragePercent?: number;
  newProviderLinksApproved?: number;
  newOverlayPlayersWritten?: number;
  needsReviewCount?: number;
  failureCount?: number;
};

export function coveragePercent(withData: number, total: number): number {
  return total === 0 ? 0 : Math.round((withData / total) * 1000) / 10;
}

export function buildCoverageSummary(total: number, withData: number, extras: Partial<CoverageSummary> = {}): CoverageSummary {
  return {
    totalWorldCupCards: total,
    cardsWithTransfermarktData: withData,
    cardsWithoutTransfermarktData: Math.max(0, total - withData),
    transfermarktCoveragePercent: coveragePercent(withData, total),
    ...extras
  };
}

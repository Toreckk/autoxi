import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RatingLabAnomaly, RatingLabCardSnapshot, RatingLabSummary } from "../domain/types.js";

export type RatingLabPreviewOptions = {
  summary: RatingLabSummary;
  outputPath: string;
};

export async function writeRatingLabPreviewHtml({ summary, outputPath }: RatingLabPreviewOptions): Promise<string> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderRatingLabPreviewHtml(summary, await latestProfileRepairDiagnostics(dirname(outputPath))), "utf8");
  return outputPath;
}

export function defaultPreviewPathForReport(reportPath: string): string {
  return join(dirname(reportPath), "rating-lab-preview.html");
}

type ProfileRepairDiagnostics = {
  profileRepairEnabled?: boolean;
  profileRepairWorklistCount?: number;
  profileIdentityAttemptCount?: number;
  profileIdentityFetchAttemptedCount?: number;
  profileIdentitySuccessCount?: number;
  profileIdentityFailureCount?: number;
  profileIdentityFetchSkippedCount?: number;
};

export function renderRatingLabPreviewHtml(summary: RatingLabSummary, profileRepairDiagnostics?: ProfileRepairDiagnostics): string {
  const cards = summary.cardSnapshots;
  const topByTournament = Object.values(groupBy(cards, (card) => String(card.worldCupYear))).flatMap((yearCards) =>
    [...yearCards].sort((left, right) => right.overall - left.overall).slice(0, 25)
  );
  const icons = cards.filter((card) => card.tier === "ICON" || card.tier === "HERO");
  const generatedOnlyOutliers = cards
    .filter((card) => card.primarySource === "FJELSTUL_GENERATED" && card.overall >= 88)
    .sort((left, right) => right.overall - left.overall);
  const goalkeepers = cards.filter((card) => card.position === "GK").slice(0, 80);
  const pre1966 = cards.filter((card) => card.worldCupYear < 1966).slice(0, 80);
  const modern = cards.filter((card) => card.worldCupYear >= 2002).slice(0, 80);
  const distribution = summary.distributionDiagnostics;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rating Lab Preview</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Segoe UI, Arial, sans-serif; background: #f6f7f9; color: #18202a; }
    body { margin: 0; }
    header { background: #102235; color: white; padding: 24px 32px; }
    main { padding: 24px 32px 48px; }
    h1, h2 { margin: 0 0 12px; }
    h2 { margin-top: 32px; }
    .meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
    .pill { border-radius: 999px; padding: 6px 10px; background: #e9edf2; font-size: 12px; font-weight: 700; }
    header .pill { background: rgba(255,255,255,.14); }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d9e0e8; }
    th, td { border-bottom: 1px solid #e7ecf1; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f7; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    tr:hover td { background: #fbfcfd; }
    .warn { color: #8a5300; font-weight: 700; }
    .fail { color: #b3261e; font-weight: 700; }
    .muted { color: #64748b; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .panel { background: white; border: 1px solid #d9e0e8; padding: 14px; }
    .panel strong { display: block; font-size: 22px; margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>Rating Lab Preview</h1>
    <div class="meta">
      <span class="pill">${escapeHtml(summary.confidenceGateStatus)}</span>
      <span class="pill">${summary.totalCardsSampled} sampled cards</span>
      <span class="pill">seed ${escapeHtml(summary.seed)}</span>
      <span class="pill">${escapeHtml(summary.sampleMode)}</span>
      <span class="pill">${escapeHtml(summary.formulaVersion ?? "formula unknown")}</span>
      <span class="pill">${escapeHtml(summary.formulaConfigPath ?? "config path unknown")}</span>
      <span class="pill">${escapeHtml(summary.selectedDistributionStrategy ?? "RAW_EVIDENCE")}</span>
      <span class="pill">local/debug names enabled</span>
    </div>
  </header>
  <main>
    <section class="grid">
      ${metric("Cards resolved", summary.cardsResolved)}
      ${metric("Generated only", summary.cardsGeneratedOnly)}
      ${metric("Manual curated", summary.cardsWithManualCurated)}
      ${metric("7a0 manual matched", summary.sevenAZeroManualMatched)}
      ${metric("7a0 avg delta", summary.sevenAZeroManualAverageAbsoluteDelta ?? "n/a")}
      ${metric("7a0 p90 delta", summary.sevenAZeroManualDeltaP90 ?? "n/a")}
      ${metric("90+ cards", distribution?.count90Plus ?? "n/a")}
      ${metric("95+ cards", distribution?.count95Plus ?? "n/a")}
      ${metric("99 cards", distribution?.count99 ?? "n/a")}
    </section>
    ${transfermarktCoverageSection(summary, profileRepairDiagnostics)}
    ${sourceAvailabilitySection(summary)}
    ${distributionSection(summary)}
    ${sourceBlendSection(cards)}
    ${listSection("Gate Reasons", summary.confidenceGateReasons)}
    ${cardSection("Top Cards By Tournament", topByTournament)}
    ${cardSection("Icons And Heroes", icons)}
    ${cardSection("Award Winners", cards.filter((card) => card.reasons.includes("award winner")))}
    ${cardSection("Generated-Only Outliers", generatedOnlyOutliers)}
    ${anomalySection("Anomalies", summary.anomalyDetails)}
    ${listSection("7a0 Manual Reference Deltas", [
      `pass=${summary.sevenAZeroManualPass}`,
      `warn=${summary.sevenAZeroManualWarn}`,
      `fail=${summary.sevenAZeroManualFail}`,
      `missing=${summary.sevenAZeroManualMissing}`,
      `ambiguous=${summary.sevenAZeroManualAmbiguous}`,
      `averageAbsDelta=${summary.sevenAZeroManualAverageAbsoluteDelta ?? "n/a"}`,
      `p90=${summary.sevenAZeroManualDeltaP90 ?? "n/a"}`
    ])}
    ${cardSection("Random Sample", cards.slice(0, 100))}
    ${cardSection("Goalkeepers", goalkeepers)}
    ${cardSection("Pre-1966 Sample", pre1966)}
    ${cardSection("Modern Sample", modern)}
  </main>
</body>
</html>`;
}

function transfermarktCoverageSection(summary: RatingLabSummary, profileRepairDiagnostics?: ProfileRepairDiagnostics): string {
  const cards = summary.cardSnapshots;
  const identity = cards.filter((card) => card.transfermarktIdentityCoverage);
  const context = cards.filter((card) => card.transfermarktContextCoverage);
  const ratingEvidence = cards.filter((card) => card.transfermarktRatingEvidenceCoverage);
  const applied = cards.filter((card) => card.transfermarktAppliedRatingCoverage);
  const missing = cards.filter((card) => !card.transfermarktIdentityCoverage);
  const highPriority = cards.filter(isHighPriorityTransfermarktCard);
  const oneToken = cards.filter((card) => isSingleTokenName(card.debugRealName ?? card.internalRawName));
  const oneTokenHighPriority = highPriority.filter((card) => isSingleTokenName(card.debugRealName ?? card.internalRawName));
  const mergeWarnings = mergeReadinessWarnings(cards);
  const byYearRows = Object.entries(groupBy(cards, (card) => String(card.worldCupYear)))
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([year, yearCards]) => coverageRow(year, yearCards))
    .join("");
  const byTierRows = Object.entries(groupBy(cards, (card) => card.tier))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tier, tierCards]) => coverageRow(tier, tierCards))
    .join("");
  const stillMissing = missing
    .filter((card) => card.tier === "ICON" || card.tier === "HERO" || card.overall >= 90)
    .sort((left, right) => right.overall - left.overall)
    .slice(0, 30);
  return `<section>
    <h2>Transfermarkt Coverage</h2>
    <section class="grid">
      ${metric("Identity coverage", `${identity.length} / ${cards.length} (${percent(identity.length, cards.length)}%)`)}
      ${metric("Context coverage", `${context.length} / ${cards.length} (${percent(context.length, cards.length)}%)`)}
      ${metric("Rating evidence coverage", `${ratingEvidence.length} / ${cards.length} (${percent(ratingEvidence.length, cards.length)}%)`)}
      ${metric("Applied rating coverage", `${applied.length} / ${cards.length} (${percent(applied.length, cards.length)}%)`)}
      ${metric("Missing identity", missing.length)}
      ${metric("Needs real season stats", cards.filter((card) => card.transfermarktIdentityCoverage && !card.transfermarktRatingEvidenceCoverage).length)}
    </section>
    ${transfermarktIdentityFunnelPreview(cards, profileRepairDiagnostics)}
    <h2>High-Priority Transfermarkt Identity Status</h2>
    <section class="grid">
      ${metric("High-priority identity", `${highPriority.filter((card) => card.transfermarktIdentityCoverage).length} / ${highPriority.length} (${percent(highPriority.filter((card) => card.transfermarktIdentityCoverage).length, highPriority.length)}%)`)}
      ${metric("High-priority missing", highPriority.filter((card) => !card.transfermarktIdentityCoverage).length)}
      ${metric("Identity-only high-priority", highPriority.filter((card) => card.transfermarktIdentityCoverage && !card.transfermarktRatingEvidenceCoverage).length)}
    </section>
    <h2>One-Token Name Auto-Detection Status</h2>
    <section class="grid">
      ${metric("One-token identity", `${oneToken.filter((card) => card.transfermarktIdentityCoverage).length} / ${oneToken.length} (${percent(oneToken.filter((card) => card.transfermarktIdentityCoverage).length, oneToken.length)}%)`)}
      ${metric("High-priority one-token identity", `${oneTokenHighPriority.filter((card) => card.transfermarktIdentityCoverage).length} / ${oneTokenHighPriority.length} (${percent(oneTokenHighPriority.filter((card) => card.transfermarktIdentityCoverage).length, oneTokenHighPriority.length)}%)`)}
    </section>
    <h2>Merge Readiness</h2>
    <section class="grid">
      ${metric("Status", mergeWarnings.length === 0 ? "ready" : "not ready")}
      ${metric("Warnings", mergeWarnings.length)}
      ${metric("Fake rating evidence", fakeRatingEvidenceCount(cards))}
    </section>
    ${listSection("Merge Readiness Reasons", mergeWarnings)}
    <h2>Coverage By World Cup Year</h2>
    <table><thead><tr><th>Year</th><th>Total</th><th>Identity</th><th>Context</th><th>Rating Evidence</th><th>Applied</th></tr></thead><tbody>${byYearRows}</tbody></table>
    <h2>Coverage By Tier</h2>
    <table><thead><tr><th>Tier</th><th>Total</th><th>Identity</th><th>Context</th><th>Rating Evidence</th><th>Applied</th></tr></thead><tbody>${byTierRows}</tbody></table>
    ${cardSection("Top Still-Missing High-Priority Players", stillMissing)}
  </section>`;
}

function transfermarktIdentityFunnelPreview(cards: readonly RatingLabCardSnapshot[], profileRepairDiagnostics?: ProfileRepairDiagnostics): string {
  const missing = cards.filter((card) => !card.transfermarktIdentityCoverage);
  const highPriorityMissing = missing.filter(isHighPriorityTransfermarktCard);
  const oneTokenHighPriorityMissing = highPriorityMissing.filter((card) => isSingleTokenName(card.debugRealName ?? card.internalRawName));
  const contextOnly = cards.filter((card) => card.transfermarktContextCoverage && !card.transfermarktRatingEvidenceCoverage);
  const blockers = highPriorityMissing
    .sort((left, right) => right.overall - left.overall)
    .slice(0, 25);
  return `<h2>Transfermarkt Identity Funnel</h2>
    <section class="grid">
      ${metric("Missing identity cards", missing.length)}
      ${metric("Exported for enrichment", "see funnel report")}
      ${metric("Found in squad cache", contextOnly.length)}
      ${metric("Profile enriched", "see profile cache")}
      ${metric("Auto-approved", cards.filter((card) => card.transfermarktIdentityCoverage).length)}
      ${metric("Needs review", highPriorityMissing.length)}
      ${metric("Still missing", missing.length)}
    </section>
    <h2>Profile Repair</h2>
    <section class="grid">
      ${metric("Profile repair enabled", String(profileRepairDiagnostics?.profileRepairEnabled ?? false))}
      ${metric("Profile repair worklist", profileRepairDiagnostics?.profileRepairWorklistCount ?? "n/a")}
      ${metric("Profile attempts", profileRepairDiagnostics?.profileIdentityAttemptCount ?? "n/a")}
      ${metric("Profile successes", profileRepairDiagnostics?.profileIdentitySuccessCount ?? "n/a")}
      ${metric("Profile failures", profileRepairDiagnostics?.profileIdentityFailureCount ?? "n/a")}
      ${metric("Profile skipped", profileRepairDiagnostics?.profileIdentityFetchSkippedCount ?? "n/a")}
    </section>
    ${!profileRepairDiagnostics?.profileRepairEnabled ? listSection("Profile Repair Status", ["Profile repair was not run. Identity coverage may be limited by missing nationality/date-of-birth fields."]) : ""}
    <h2>Top High-Priority Identity Blockers</h2>
    ${identityBlockersTable(blockers)}
    <h2>One-token high-priority blockers</h2>
    ${cardSection("One-token high-priority missing identity", oneTokenHighPriorityMissing)}
    <h2>Profile enrichment failures</h2>
    ${listSection("Profile enrichment failures", ["See rating-lab-transfermarkt-identity-funnel-summary for profileIdentityFailureCount."])}
    <h2>Squad cache field quality</h2>
    ${listSection("Squad cache field quality", ["See rating-lab-transfermarkt-squad-cache-field-quality for per-cache field completeness."])}`;
}

async function latestProfileRepairDiagnostics(reportDir: string): Promise<ProfileRepairDiagnostics | undefined> {
  const files = (await readdir(reportDir).catch(() => [])).filter((file) => file.startsWith("rating-lab-transfermarkt-identity-funnel-summary-") && file.endsWith(".json")).sort();
  const latest = files.at(-1);
  if (!latest) return undefined;
  const raw = await readFile(join(reportDir, latest), "utf8").catch(() => "");
  if (!raw) return undefined;
  return JSON.parse(raw) as ProfileRepairDiagnostics;
}

function identityBlockersTable(cards: readonly RatingLabCardSnapshot[]): string {
  if (cards.length === 0) return empty();
  const rows = cards
    .map(
      (card) => `<tr>
        <td>${escapeHtml(card.debugRealName ?? card.internalRawName)}</td>
        <td>${escapeHtml(card.nation)}</td>
        <td>${card.worldCupYear}</td>
        <td>${escapeHtml(card.tier)}</td>
        <td>${escapeHtml(card.position)}</td>
        <td>${escapeHtml(card.transfermarktPlayerId ?? "")}</td>
        <td>${escapeHtml(card.transfermarktPlayerId ? card.debugRealName ?? card.internalRawName : "")}</td>
        <td>${escapeHtml(card.transfermarktCoverage === null ? "" : String(card.transfermarktCoverage ?? ""))}</td>
        <td>${escapeHtml(card.transfermarktSignalsMissing ?? "")}</td>
        <td>${escapeHtml(card.transfermarktMatchFailureReason ?? "")}</td>
        <td>${escapeHtml(card.transfermarktPlayerId ? "import_real_transfermarkt_season_stats_or_market_values" : "run_transfermarkt_identity_enrichment")}</td>
      </tr>`
    )
    .join("");
  return `<table><thead><tr><th>Name</th><th>Nation</th><th>Year</th><th>Tier</th><th>Position</th><th>Best Candidate ID</th><th>Best Candidate Name</th><th>Best Candidate Score</th><th>Missing Fields</th><th>Needs Review Reason</th><th>Recommended Next Step</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function coverageRow(label: string, cards: readonly RatingLabCardSnapshot[]): string {
  const identity = cards.filter((card) => card.transfermarktIdentityCoverage).length;
  const context = cards.filter((card) => card.transfermarktContextCoverage).length;
  const ratingEvidence = cards.filter((card) => card.transfermarktRatingEvidenceCoverage).length;
  const applied = cards.filter((card) => card.transfermarktAppliedRatingCoverage).length;
  return `<tr><td>${escapeHtml(label)}</td><td>${cards.length}</td><td>${identity} (${percent(identity, cards.length)}%)</td><td>${context} (${percent(context, cards.length)}%)</td><td>${ratingEvidence} (${percent(ratingEvidence, cards.length)}%)</td><td>${applied} (${percent(applied, cards.length)}%)</td></tr>`;
}

function metric(label: string, value: string | number): string {
  return `<div class="panel"><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function cardSection(title: string, cards: readonly RatingLabCardSnapshot[]): string {
  return `<section><h2>${escapeHtml(title)}</h2>${cards.length === 0 ? empty() : cardTable(cards)}</section>`;
}

function anomalySection(title: string, anomalies: readonly RatingLabAnomaly[]): string {
  if (anomalies.length === 0) return `<section><h2>${escapeHtml(title)}</h2>${empty()}</section>`;
  const rows = anomalies
    .map(
      (anomaly) => `<tr>
        <td class="${anomaly.severity === "HARD_FAIL" ? "fail" : "warn"}">${escapeHtml(anomaly.severity)}</td>
        <td>${escapeHtml(anomaly.code)}</td>
        <td>${escapeHtml(anomaly.internalRawName)}</td>
        <td>${escapeHtml(`${anomaly.nation} ${anomaly.worldCupYear}`)}</td>
        <td>${escapeHtml(String(anomaly.overall))}</td>
        <td>${escapeHtml(anomaly.reason)}</td>
      </tr>`
    )
    .join("");
  return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr><th>Severity</th><th>Code</th><th>Dev Raw Name</th><th>Edition</th><th>Overall</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function cardTable(cards: readonly RatingLabCardSnapshot[]): string {
  const rows = cards
    .map(
      (card) => `<tr>
        <td>${escapeHtml(displayName(card))}</td>
        <td>${escapeHtml(card.publicDisplayName ?? card.publicPlaceholderName)}</td>
        <td><span class="muted">dev-only:</span> ${escapeHtml(card.debugRealName ?? card.internalRawName)}</td>
        <td>${escapeHtml(card.hostCountryLabel ?? "UNKNOWN HOST")}</td>
        <td>${escapeHtml(card.nation)}</td>
        <td>${card.worldCupYear}</td>
        <td>${escapeHtml(card.position)}</td>
        <td>${escapeHtml(isSingleTokenName(card.debugRealName ?? card.internalRawName) ? "true" : "false")}</td>
        <td><strong>${card.overall}</strong></td>
        <td>${escapeHtml(card.tier)}</td>
        <td>${escapeHtml(card.primarySource)}</td>
        <td>${escapeHtml(card.confidence)}</td>
        <td>${escapeHtml(card.transfermarktIdentityConfidence ?? "NONE")}</td>
        <td>${escapeHtml(card.transfermarktContextCoverage ? "present" : "none")}</td>
        <td>${escapeHtml(card.transfermarktRatingEvidenceCoverage ? "present" : card.transfermarktRatingEvidenceReason ?? "missing")}</td>
        <td>${escapeHtml(card.transfermarktAppliedRatingCoverage ? "true" : "false")}</td>
        <td>${escapeHtml(card.transfermarktRatingEvidenceCoverage ? `${card.transfermarktRating ?? "n/a"} / ${card.worldCupPerformanceRating ?? "n/a"}` : "n/a")}</td>
        <td>${escapeHtml(card.transfermarktRatingEvidenceCoverage ? `${card.transfermarktEffectiveWeight ?? 0} / ${card.worldCupEffectiveWeight ?? 0}` : "n/a")}</td>
        <td>${escapeHtml(card.transfermarktPlayerId ?? "")}</td>
        <td>${escapeHtml(card.transfermarktMatchConfidence ?? "NONE")}</td>
        <td>${escapeHtml(String(card.transfermarktCoverage ?? ""))}</td>
        <td>${escapeHtml(card.transfermarktSignalsAvailable ?? "")}</td>
        <td>${escapeHtml(card.transfermarktMatchFailureReason ?? "")}</td>
        <td>${escapeHtml(String(card.rawEvidenceOverall ?? ""))}</td>
        <td>${escapeHtml(card.evidenceSummary ?? "")}</td>
        <td>${escapeHtml(card.comparisonSummary ?? "")}</td>
        <td>${escapeHtml(card.warnings)}</td>
        <td>${escapeHtml(card.reasons)}</td>
      </tr>`
    )
    .join("");
  return `<table><thead><tr><th>Name</th><th>Public Name</th><th>Debug Real Name</th><th>Host</th><th>Nation</th><th>Year</th><th>Pos</th><th>One Token</th><th>Overall</th><th>Tier</th><th>Source</th><th>Confidence</th><th>TM Identity</th><th>TM Context</th><th>TM Rating Evidence</th><th>TM Applied</th><th>TM / WC Rating</th><th>TM / WC Weight</th><th>TM Player ID</th><th>TM Match</th><th>TM Coverage</th><th>TM Evidence Families</th><th>TM Rejected Reason</th><th>Raw</th><th>Evidence</th><th>Comparisons</th><th>Warnings</th><th>Reasons</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function percent(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

function displayName(card: RatingLabCardSnapshot): string {
  return card.isLocalDebugOnly && card.debugRealName ? card.debugRealName : card.publicDisplayName ?? card.publicPlaceholderName;
}

function isSingleTokenName(name: string): boolean {
  return name.trim().split(/\s+/u).filter(Boolean).length === 1;
}

function sourceBlendSection(cards: readonly RatingLabCardSnapshot[]): string {
  const transfermarktApplied = cards
    .filter((card) => (card.transfermarktEffectiveWeight ?? 0) > 0)
    .sort((left, right) => Math.abs((right.finalBlendedRating ?? right.overall) - (right.worldCupPerformanceRating ?? right.overall)) - Math.abs((left.finalBlendedRating ?? left.overall) - (left.worldCupPerformanceRating ?? left.overall)))
    .slice(0, 50);
  const fjelstulOnly = cards
    .filter((card) => (card.transfermarktEffectiveWeight ?? 0) <= 0)
    .sort((left, right) => right.overall - left.overall)
    .slice(0, 50);
  const lowConfidenceElites = cards
    .filter((card) => card.overall >= 90 && card.confidence !== "HIGH")
    .slice(0, 50);
  return [
    cardSection("Source Blend Breakdown", transfermarktApplied),
    cardSection("Top Cards Still Fjelstul-Only", fjelstulOnly),
    cardSection("Low-Confidence Elite Cards", lowConfidenceElites)
  ].join("");
}

function sourceAvailabilitySection(summary: RatingLabSummary): string {
  const rows = summary.sourceAvailability ?? [];
  if (rows.length === 0) return "";
  const body = rows
    .map(
      (source) => `<tr>
        <td>${escapeHtml(source.label)}</td>
        <td>${escapeHtml(source.status)}</td>
        <td>${escapeHtml(source.mode)}</td>
        <td>${escapeHtml(source.affectsRating ? "yes" : "no")}</td>
        <td>${escapeHtml(source.path ?? "")}</td>
        <td>${escapeHtml(source.warnings.join("|"))}</td>
      </tr>`
    )
    .join("");
  return `<section><h2>Source Availability</h2><table><thead><tr><th>Source</th><th>Status</th><th>Mode</th><th>Affects Rating</th><th>Path</th><th>Warnings</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

function isHighPriorityTransfermarktCard(card: RatingLabCardSnapshot): boolean {
  return (
    card.tier === "ICON" ||
    card.tier === "HERO" ||
    card.tier === "WORLD_CLASS" ||
    card.overall >= 87 ||
    Boolean(card.awards)
  );
}

function mergeReadinessWarnings(cards: readonly RatingLabCardSnapshot[]): string[] {
  const highPriorityModern = cards.filter((card) => card.worldCupYear >= 1994 && isHighPriorityTransfermarktCard(card));
  const oneTokenHighPriorityModern = highPriorityModern.filter((card) => isSingleTokenName(card.debugRealName ?? card.internalRawName));
  const cards2002 = cards.filter((card) => card.worldCupYear === 2002);
  return [
    fakeRatingEvidenceCount(cards) > 0 ? "fakeRatingEvidenceCount must be 0" : "",
    highPriorityModern.length > 0 && percent(highPriorityModern.filter((card) => card.transfermarktIdentityCoverage).length, highPriorityModern.length) < 90
      ? "high-priority modern identity coverage below 90%"
      : "",
    oneTokenHighPriorityModern.length > 0 && percent(oneTokenHighPriorityModern.filter((card) => card.transfermarktIdentityCoverage).length, oneTokenHighPriorityModern.length) < 80
      ? "one-token high-priority modern identity coverage below 80%"
      : "",
    cards2002.length > 0 && cards2002.filter((card) => card.transfermarktIdentityCoverage).length <= 1
      ? "2002 identity coverage is not materially higher than 1 card"
      : ""
  ].filter(Boolean);
}

function fakeRatingEvidenceCount(cards: readonly RatingLabCardSnapshot[]): number {
  return cards.filter(
    (card) =>
      card.transfermarktRatingEvidenceCoverage &&
      /transfermarkt_squad_presence/iu.test(`${card.evidenceSummary ?? ""}|${card.transfermarktSignalsAvailable ?? ""}|${card.transfermarktRatingEvidenceReason ?? ""}`)
  ).length;
}

function distributionSection(summary: RatingLabSummary): string {
  const diagnostics = summary.distributionDiagnostics;
  if (!diagnostics) return "";
  const buckets = diagnostics.buckets
    .slice(0, 20)
    .map(
      (bucket) => `<tr>
        <td>${bucket.rating}</td>
        <td>${bucket.count}</td>
        <td>${bucket.percentage}%</td>
        <td>${escapeHtml(bucket.examples.join("|"))}</td>
      </tr>`
    )
    .join("");
  const groupRows = diagnostics.byWorldCupYear
    .slice(0, 30)
    .map(
      (group) => `<tr>
        <td>${escapeHtml(group.key)}</td>
        <td>${group.totalCards}</td>
        <td>${group.count90Plus}</td>
        <td>${group.count95Plus}</td>
        <td>${group.count99}</td>
      </tr>`
    )
    .join("");
  return `<section><h2>Elite Distribution</h2><table><thead><tr><th>Rating</th><th>Count</th><th>%</th><th>Examples</th></tr></thead><tbody>${buckets}</tbody></table><h2>Elite Distribution By Year</h2><table><thead><tr><th>Year</th><th>Total</th><th>90+</th><th>95+</th><th>99</th></tr></thead><tbody>${groupRows}</tbody></table></section>`;
}

function listSection(title: string, items: readonly string[]): string {
  const list = items.length === 0 ? "<li>None</li>" : items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section><h2>${escapeHtml(title)}</h2><ul>${list}</ul></section>`;
}

function empty(): string {
  return `<p class="muted">No rows.</p>`;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const value = key(item);
    groups[value] = [...(groups[value] ?? []), item];
  }
  return groups;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

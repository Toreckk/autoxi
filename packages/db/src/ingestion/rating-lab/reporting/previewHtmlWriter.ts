import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RatingLabAnomaly, RatingLabCardSnapshot, RatingLabSummary } from "../domain/types.js";

export type RatingLabPreviewOptions = {
  summary: RatingLabSummary;
  outputPath: string;
};

export async function writeRatingLabPreviewHtml({ summary, outputPath }: RatingLabPreviewOptions): Promise<string> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderRatingLabPreviewHtml(summary), "utf8");
  return outputPath;
}

export function defaultPreviewPathForReport(reportPath: string): string {
  return join(dirname(reportPath), "rating-lab-preview.html");
}

export function renderRatingLabPreviewHtml(summary: RatingLabSummary): string {
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
      <span class="pill">${escapeHtml(summary.selectedDistributionStrategy ?? "RAW_EVIDENCE")}</span>
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
    ${sourceAvailabilitySection(summary)}
    ${distributionSection(summary)}
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
        <td>${escapeHtml(card.publicPlaceholderName)}</td>
        <td><span class="muted">dev-only:</span> ${escapeHtml(card.internalRawName)}</td>
        <td>${escapeHtml(card.nation)}</td>
        <td>${card.worldCupYear}</td>
        <td>${escapeHtml(card.position)}</td>
        <td><strong>${card.overall}</strong></td>
        <td>${escapeHtml(card.tier)}</td>
        <td>${escapeHtml(card.primarySource)}</td>
        <td>${escapeHtml(card.confidence)}</td>
        <td>${escapeHtml(String(card.rawEvidenceOverall ?? ""))}</td>
        <td>${escapeHtml(card.evidenceSummary ?? "")}</td>
        <td>${escapeHtml(card.comparisonSummary ?? "")}</td>
        <td>${escapeHtml(card.warnings)}</td>
        <td>${escapeHtml(card.reasons)}</td>
      </tr>`
    )
    .join("");
  return `<table><thead><tr><th>Public Name</th><th>Internal Raw Name</th><th>Nation</th><th>Year</th><th>Pos</th><th>Overall</th><th>Tier</th><th>Source</th><th>Confidence</th><th>Raw</th><th>Evidence</th><th>Comparisons</th><th>Warnings</th><th>Reasons</th></tr></thead><tbody>${rows}</tbody></table>`;
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

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runRatingLab, type CliOptions } from "../../cli/runRatingLab.js";
import { resolveRatingLabSourcePaths } from "../../config/ratingLabSourcePaths.js";
import { readCsvRows } from "../../sources/csvUtils.js";
import type { RatingLabCardReport } from "../../domain/types.js";
import { writeCsv } from "./enrichmentCsv.js";
import { DEFAULT_ENRICHMENT_INPUT_PATH, repoPath } from "./enrichmentPaths.js";
import {
  discoverLocalTransfermarktPlayerIds,
  findLocalTransfermarktIdEvidence,
  localDiscoveryReportRows,
  type TransfermarktLocalIdDiscovery
} from "./transfermarktLocalIdDiscovery.js";

export const TRANSFERMARKT_ENRICHMENT_CANDIDATE_CATEGORIES = [
  "TRANSFERMARKT_PROFILE_MISSING",
  "TRANSFERMARKT_VALUATIONS_MISSING",
  "TRANSFERMARKT_APPEARANCES_MISSING",
  "TRANSFERMARKT_LOW_SIGNAL",
  "TRANSFERMARKT_MATCH_NONE",
  "TRANSFERMARKT_MATCH_MEDIUM_REVIEW",
  "TRANSFERMARKT_IMPORTANT_FJELSTUL_ONLY",
  "ELITE_BENCHMARK_MISSING_EXTERNAL_ID"
] as const;

export type EnrichmentCandidateCategory = (typeof TRANSFERMARKT_ENRICHMENT_CANDIDATE_CATEGORIES)[number];

export type ExportEnrichmentOptions = {
  maxRequests?: number;
  minPriority?: number;
  onlyCategory?: EnrichmentCandidateCategory;
  onlyProvider?: "transfermarkt";
  dryRun?: boolean;
  scope?: "sample" | "full-men-world-cup" | "priority-elite" | "missing-only" | "refresh-future";
  outputPath?: string;
  outputDir?: string;
  reportPath?: string;
  transfermarktSourceDir?: string;
  refreshRatingLab?: boolean;
  localDiscoveryMaxRowsPerFile?: number;
  force?: boolean;
  ratingLabOptions?: Partial<CliOptions>;
};

export type EnrichmentCandidateReportRow = {
  ratingSubjectId: string;
  fjelstulPlayerId: string;
  sourceName: string;
  debugRealName: string;
  nationCode: string;
  worldCupYear: number;
  position: string;
  birthYear: number | null;
  currentRating: number;
  currentRatingSource: string;
  transfermarktMatchConfidence: string;
  transfermarktPlayerId: string;
  fbrefPlayerId: string;
  candidateCategory: EnrichmentCandidateCategory;
  priority: number;
  reason: string;
  localTransfermarktIdEvidence: string;
  needsTransfermarktProfile: boolean;
  needsTransfermarktValuations: boolean;
  needsFbrefLink: boolean;
  needsFbrefStats: boolean;
};

const CANDIDATE_COLUMNS = [
  "ratingSubjectId",
  "fjelstulPlayerId",
  "sourceName",
  "debugRealName",
  "nationCode",
  "worldCupYear",
  "position",
  "birthYear",
  "currentRating",
  "currentRatingSource",
  "transfermarktMatchConfidence",
  "transfermarktPlayerId",
  "fbrefPlayerId",
  "candidateCategory",
  "priority",
  "reason",
  "localTransfermarktIdEvidence",
  "needsTransfermarktProfile",
  "needsTransfermarktValuations",
  "needsFbrefLink",
  "needsFbrefStats"
] as const;

const DISCOVERY_COLUMNS = [
  "transfermarktPlayerId",
  "namesSeen",
  "seenInPlayers",
  "seenInValuations",
  "seenInAppearances",
  "seenInLineups",
  "seenInEvents",
  "seenInTransfers",
  "seasonsSeen",
  "countriesSeen",
  "positionsSeen",
  "profileMissing",
  "valuationMissing",
  "evidenceSummary"
] as const;

export async function exportEnrichmentRequests(options: ExportEnrichmentOptions = {}): Promise<{
  inputPath: string;
  candidatesPath: string;
  discoveryPath: string;
  requestCount: number;
  dryRun: boolean;
}> {
  const outputDir = repoPath(options.outputDir ?? "data/import-reports/rating-lab");
  const outputPath = repoPath(options.outputPath ?? DEFAULT_ENRICHMENT_INPUT_PATH);
  const reportPath = await ensureRatingLabReport(options);
  const sourcePaths = resolveRatingLabSourcePaths();
  const transfermarktDir = options.transfermarktSourceDir ??
    (sourcePaths.sources.transfermarkt.available ? sourcePaths.sources.transfermarkt.path : undefined);
  const cards = await readCardReportRows(reportPath);
  const localIds = await discoverLocalTransfermarktPlayerIds(transfermarktDir, {
    targetNames: cards.map((card) => card.debugRealName || card.internalRawName),
    maxRowsPerFile: options.localDiscoveryMaxRowsPerFile ?? Number(process.env.TRANSFERMARKT_ENRICHMENT_LOCAL_DISCOVERY_MAX_ROWS_PER_FILE ?? 250_000)
  });
  const candidates = buildCandidateRows(cards, localIds, options);
  const limitedRows = candidates.slice(0, options.maxRequests ?? Number(process.env.TRANSFERMARKT_ENRICHMENT_MAX_REQUESTS_PER_RUN ?? 100));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const candidatesPath = join(outputDir, `rating-lab-enrichment-candidates-${timestamp}.csv`);
  const discoveryPath = join(outputDir, `rating-lab-transfermarkt-local-id-discovery-${timestamp}.csv`);

  await writeCsv(candidatesPath, limitedRows, CANDIDATE_COLUMNS);
  await writeCsv(discoveryPath, localDiscoveryReportRows(localIds), DISCOVERY_COLUMNS);
  if (!options.dryRun) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${limitedRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  }

  return {
    inputPath: outputPath,
    candidatesPath,
    discoveryPath,
    requestCount: limitedRows.length,
    dryRun: Boolean(options.dryRun)
  };
}

function buildCandidateRows(
  cards: readonly RatingLabCardReport[],
  localIds: readonly TransfermarktLocalIdDiscovery[],
  options: ExportEnrichmentOptions
): EnrichmentCandidateReportRow[] {
  const rows: EnrichmentCandidateReportRow[] = [];
  for (const card of cards.filter((candidate) => inScope(candidate, options.scope))) {
    const evidence = card.transfermarktPlayerId
      ? localIds.find((row) => row.playerId === card.transfermarktPlayerId)
      : findLocalTransfermarktIdEvidence(localIds, card.debugRealName || card.internalRawName, card.nation);
    const important = isImportant(card);
    const lowSignal = card.transfermarktSignalsMissing.split("|").filter(Boolean).length >= 2 || (card.transfermarktCoverage ?? 0) < 0.25;
    const needsProfile = Boolean(evidence && !evidence.seenInPlayers);
    const needsValuation = Boolean(evidence && !evidence.seenInValuations);

    const category: EnrichmentCandidateCategory | null =
      needsProfile ? "TRANSFERMARKT_PROFILE_MISSING" :
      needsValuation ? "TRANSFERMARKT_VALUATIONS_MISSING" :
      card.transfermarktMatchConfidence === "NONE" ? (important ? "TRANSFERMARKT_IMPORTANT_FJELSTUL_ONLY" : "TRANSFERMARKT_MATCH_NONE") :
      card.transfermarktMatchConfidence === "MEDIUM" ? "TRANSFERMARKT_MATCH_MEDIUM_REVIEW" :
      lowSignal ? "TRANSFERMARKT_LOW_SIGNAL" :
      important && !card.transfermarktPlayerId ? "ELITE_BENCHMARK_MISSING_EXTERNAL_ID" :
      null;

    if (category) {
      rows.push(candidateRow(card, category, priority(card, category), evidence, {
        needsTransfermarktProfile: needsProfile || !card.transfermarktPlayerId,
        needsTransfermarktValuations: needsValuation || lowSignal,
        needsFbrefLink: false,
        needsFbrefStats: false
      }));
    }

  }
  return rows
    .filter((row) => !options.onlyCategory || row.candidateCategory === options.onlyCategory)
    .filter((row) => row.priority >= (options.minPriority ?? 0))
    .sort((left, right) => right.priority - left.priority);
}

function candidateRow(
  card: RatingLabCardReport,
  candidateCategory: EnrichmentCandidateCategory,
  priorityValue: number,
  localEvidence: TransfermarktLocalIdDiscovery | undefined,
  flags: Pick<
    EnrichmentCandidateReportRow,
    "needsTransfermarktProfile" | "needsTransfermarktValuations" | "needsFbrefLink" | "needsFbrefStats"
  >
): EnrichmentCandidateReportRow {
  return {
    ratingSubjectId: subjectIdFromCard(card),
    fjelstulPlayerId: fjelstulIdFromCard(card),
    sourceName: card.internalRawName,
    debugRealName: card.debugRealName || card.internalRawName,
    nationCode: card.nation,
    worldCupYear: card.worldCupYear,
    position: card.position,
    birthYear: card.birthYear ?? null,
    currentRating: card.overall,
    currentRatingSource: card.primarySource,
    transfermarktMatchConfidence: card.transfermarktMatchConfidence,
    transfermarktPlayerId: card.transfermarktPlayerId || "",
    fbrefPlayerId: "",
    candidateCategory,
    priority: priorityValue,
    reason: reasonFor(card, candidateCategory, localEvidence),
    localTransfermarktIdEvidence: localEvidence ? `tm:${localEvidence.playerId}:${filesForEvidence(localEvidence).join("|")}` : "",
    ...flags
  };
}

async function ensureRatingLabReport(options: ExportEnrichmentOptions): Promise<string> {
  if (options.reportPath) return options.reportPath;
  const defaultOutputDir = repoPath("data/import-reports/rating-lab");
  if (!options.refreshRatingLab) {
    const latest = await latestBreakdownPath(defaultOutputDir).catch(() => null);
    if (latest) return latest;
  }
  if (options.ratingLabOptions?.outputDir) {
    await runRatingLab({
      ...defaultRatingLabOptions(),
      ...options.ratingLabOptions,
      sample: scopeToSample(options.scope)
    });
    return latestBreakdownPath(options.ratingLabOptions.outputDir);
  }
  const paths = await runRatingLab({ ...defaultRatingLabOptions(), sample: scopeToSample(options.scope) });
  const reportPath = paths.find((path) => path.includes("rating-lab-rating-breakdown-"));
  if (!reportPath) throw new Error("Rating lab did not produce a rating breakdown CSV.");
  return reportPath;
}

function defaultRatingLabOptions(): CliOptions {
  return {
    sample: "iconic-plus-random",
    randomCount: 300,
    seed: "42",
    outputDir: repoPath("data/import-reports/rating-lab"),
    preset: "pre-phase-1b-calibration"
  };
}

function scopeToSample(scope: ExportEnrichmentOptions["scope"]): CliOptions["sample"] {
  return scope === "full-men-world-cup" ? "all" : "iconic-plus-random";
}

async function latestBreakdownPath(outputDir: string): Promise<string> {
  const files = (await readdir(outputDir)).filter((file) => file.startsWith("rating-lab-rating-breakdown-") && file.endsWith(".csv")).sort();
  const latest = files.at(-1);
  if (!latest) throw new Error(`No rating-lab rating breakdown CSV found in ${outputDir}.`);
  return join(outputDir, latest);
}

async function readCardReportRows(path: string): Promise<RatingLabCardReport[]> {
  const rows = await readCsvRows(path);
  return rows.map((row) => ({
    ...row,
    worldCupYear: Number(row.worldCupYear),
    overall: Number(row.overall),
    transfermarktCoverage: row.transfermarktCoverage ? Number(row.transfermarktCoverage) : null,
    sevenAZeroDelta: row.sevenAZeroDelta ? Number(row.sevenAZeroDelta) : null,
    rating99Eligible: row.rating99Eligible === "true",
    awardMaxCapApplied: row.awardMaxCapApplied === "true",
    absoluteClampApplied: row.absoluteClampApplied === "true",
    manualTransfermarktOverrideApplied: row.manualTransfermarktOverrideApplied === "true"
  })) as RatingLabCardReport[];
}

function priority(card: RatingLabCardReport, category: EnrichmentCandidateCategory): number {
  let score = card.overall >= 95 ? 95 : card.overall >= 90 ? 88 : card.overall >= 85 ? 78 : 55;
  if (card.tier === "ICON" || card.rating99Eligible) score += 8;
  if (card.awards) score += 6;
  if (card.sevenAZeroDelta !== null) score += Math.min(10, Math.abs(card.sevenAZeroDelta));
  if (category.includes("MISSING") || category.includes("NONE")) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function inScope(card: RatingLabCardReport, scope: ExportEnrichmentOptions["scope"]): boolean {
  if (scope === "priority-elite") return isImportant(card);
  if (scope === "refresh-future") return card.worldCupYear >= 2026;
  return true;
}

function isImportant(card: RatingLabCardReport): boolean {
  return card.overall >= 90 || card.tier === "ICON" || Boolean(card.awards) || card.rating99Eligible || Math.abs(card.sevenAZeroDelta ?? 0) >= 6;
}

function subjectIdFromCard(card: RatingLabCardReport): string {
  return `${card.nation}-${card.worldCupYear}-${(card.debugRealName || card.internalRawName).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function fjelstulIdFromCard(card: RatingLabCardReport): string {
  return card.cardKey.replace(/:\d{4}$/, "");
}

function filesForEvidence(evidence: TransfermarktLocalIdDiscovery | undefined): string[] {
  if (!evidence) return [];
  return [
    evidence.seenInPlayers ? "players.csv" : "",
    evidence.seenInValuations ? "player_valuations.csv" : "",
    evidence.seenInAppearances ? "appearances.csv" : "",
    evidence.seenInLineups ? "game_lineups.csv" : "",
    evidence.seenInEvents ? "game_events.csv" : "",
    evidence.seenInTransfers ? "transfers.csv" : ""
  ].filter(Boolean);
}

function reasonFor(
  card: RatingLabCardReport,
  category: EnrichmentCandidateCategory,
  localEvidence: TransfermarktLocalIdDiscovery | undefined
): string {
  if (localEvidence && !localEvidence.seenInPlayers) return "Transfermarkt player_id appears locally but profile rows are missing.";
  if (localEvidence && !localEvidence.seenInValuations) return "Transfermarkt player_id appears locally but valuation rows are missing.";
  if (card.transfermarktMatchConfidence === "NONE") return "Rating subject has no Transfermarkt match in the current local source rows.";
  return `Rating subject has weak external evidence: ${category}.`;
}

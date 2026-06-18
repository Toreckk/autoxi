import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readCsv, runTransfermarktCoverageExpansion, TransfermarktWebScraper, writeCsv } from "@autoxi/scrapers";
import { isCliEntrypoint } from "./cliEntrypoint.js";

export async function runTransfermarktEnrich(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const outputDir = resolve(cwd, "data/sources");
  const reportDir = resolve(cwd, "data/import-reports/rating-lab");
  const candidatesArg = typeof args.candidates === "string" ? args.candidates : undefined;
  const candidatesPath = resolve(cwd, candidatesArg ?? (await latestCandidatesPath(reportDir)));
  const userAgent = process.env.TRANSFERMARKT_USER_AGENT ?? process.env.USER_AGENT ?? "";
  const result = await runTransfermarktCoverageExpansion({
    repoRoot: cwd,
    candidatesPath,
    sourceDir: resolve(cwd, "data/sources/transfermarkt"),
    outputDir,
    planPath: resolve(cwd, "data/sources/enrichment/league-expansion-plan.json"),
    roundId: typeof args.round === "string" ? args.round : "round-1-core",
    worldCupYear: typeof args.worldCupYear === "string" ? Number(args.worldCupYear) : undefined,
    dryRun: args.dryRun === true,
    forceRefresh: args.forceRefresh === true,
    maxLeagues: typeof args.maxLeagues === "string" ? Number(args.maxLeagues) : undefined,
    squadProvider:
      args.dryRun === true || !userAgent
        ? undefined
        : new TransfermarktWebScraper({
            userAgent,
            rateLimitMs: Number(process.env.TRANSFERMARKT_RATE_LIMIT_MS ?? 2500)
          })
  });
  await mkdir(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const reportPath = join(reportDir, `rating-lab-transfermarkt-coverage-summary-${timestamp}.json`);
  await writeFile(reportPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  const csvReports = await writeTransfermarktEnrichmentReports({
    reportDir,
    timestamp,
    candidatesPath,
    result
  });
  return [
    args.dryRun ? "Transfermarkt enrichment dry run completed." : "Transfermarkt enrichment completed.",
    `Round: ${result.roundId} (${result.roundDescription})`,
    `Candidates: ${result.missingPlayerCount}`,
    `Years: ${result.yearsScanned.join(", ") || "none"}`,
    `Transfermarkt seasons: ${result.transfermarktSeasonsScanned.join(", ") || "none"}`,
    `Leagues: ${result.leaguesScanned.join(", ")}`,
    `Cache: ${result.cacheHits} hits, ${result.cacheMisses} misses`,
    `Matches: ${result.playersApproved} approved, ${result.playersNeedsReview} need review`,
    `Report: ${reportPath}`,
    `CSV reports: ${csvReports.map((path) => path.split(/[\\/]/u).at(-1)).join(", ")}`
  ].join("\n");
}

type TransfermarktEnrichmentCliResult = Awaited<ReturnType<typeof runTransfermarktCoverageExpansion>>;

async function writeTransfermarktEnrichmentReports({
  reportDir,
  timestamp,
  candidatesPath,
  result
}: {
  reportDir: string;
  timestamp: string;
  candidatesPath: string;
  result: TransfermarktEnrichmentCliResult;
}): Promise<string[]> {
  const candidateRows = (await readCsv(candidatesPath)).filter(
    (row) => row.candidateCategory?.startsWith("TRANSFERMARKT") || row.needsTransfermarktProfile === "true" || row.needsTransfermarktValuations === "true"
  );
  const byYear = summarizeCandidatesBy(candidateRows, "worldCupYear").map((row) => ({
    worldCupYear: row.key,
    totalCards: row.total,
    withTransfermarktData: 0,
    withoutTransfermarktData: row.total,
    coveragePercent: 0,
    newMatchesThisRun: 0,
    stillMissingHighPriority: row.highPriority
  }));
  const byTier = summarizeCandidatesBy(candidateRows, "priorityTier").map((row) => ({
    tier: row.key || "unknown",
    totalCards: row.total,
    withTransfermarktData: 0,
    withoutTransfermarktData: row.total,
    coveragePercent: 0
  }));
  const byRound = [
    {
      roundId: result.roundId,
      roundDescription: result.roundDescription,
      leaguesScanned: result.leaguesScanned.join("|"),
      yearsScanned: result.yearsScanned.join("|"),
      transfermarktSeasonsScanned: result.transfermarktSeasonsScanned.join("|"),
      beforeCoveragePercent: result.coverageSummary.transfermarktCoveragePercent,
      afterCoveragePercent: result.coverageSummary.transfermarktCoveragePercent,
      coverageDelta: 0,
      playersFound: result.playersFound,
      playersApproved: result.playersApproved,
      playersNeedsReview: result.playersNeedsReview,
      playersStillMissing: result.missingPlayerCount - result.playersApproved,
      cacheHits: result.cacheHits,
      cacheMisses: result.cacheMisses,
      dryRun: result.dryRun
    }
  ];
  const outputs = [
    join(reportDir, `rating-lab-transfermarkt-coverage-by-year-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-coverage-by-tier-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-coverage-by-round-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-enrichment-candidates-${timestamp}.csv`),
    join(reportDir, `rating-lab-transfermarkt-squad-cache-${timestamp}.csv`)
  ];
  await writeCsv(outputs[0]!, ["worldCupYear", "totalCards", "withTransfermarktData", "withoutTransfermarktData", "coveragePercent", "newMatchesThisRun", "stillMissingHighPriority"], byYear);
  await writeCsv(outputs[1]!, ["tier", "totalCards", "withTransfermarktData", "withoutTransfermarktData", "coveragePercent"], byTier);
  await writeCsv(
    outputs[2]!,
    [
      "roundId",
      "roundDescription",
      "leaguesScanned",
      "yearsScanned",
      "transfermarktSeasonsScanned",
      "beforeCoveragePercent",
      "afterCoveragePercent",
      "coverageDelta",
      "playersFound",
      "playersApproved",
      "playersNeedsReview",
      "playersStillMissing",
      "cacheHits",
      "cacheMisses",
      "dryRun"
    ],
    byRound
  );
  await writeCsv(outputs[3]!, Object.keys(candidateRows[0] ?? { candidateCategory: "" }), candidateRows);
  await writeCsv(
    outputs[4]!,
    ["roundId", "leagueId", "worldCupYear", "transfermarktSeasonId", "cacheStatus"],
    result.yearsScanned.flatMap((worldCupYear) =>
      result.transfermarktSeasonsScanned.map((transfermarktSeasonId) =>
        result.leaguesScanned.map((leagueId) => ({
          roundId: result.roundId,
          leagueId,
          worldCupYear,
          transfermarktSeasonId,
          cacheStatus: "miss_or_refresh_needed"
        }))
      ).flat()
    )
  );
  return outputs;
}

function summarizeCandidatesBy(rows: readonly Record<string, string>[], key: string): { key: string; total: number; highPriority: number }[] {
  const groups = new Map<string, { key: string; total: number; highPriority: number }>();
  for (const row of rows) {
    const groupKey = row[key] ?? "";
    const group = groups.get(groupKey) ?? { key: groupKey, total: 0, highPriority: 0 };
    group.total += 1;
    const priorityScore = Number(row.priorityScore ?? 0);
    if (priorityScore >= 90 || row.priorityTier === "elite") group.highPriority += 1;
    groups.set(groupKey, group);
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function parseArgs(argv: readonly string[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, char: string) => char.toUpperCase());
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else values[key] = true;
  }
  return values;
}

async function latestCandidatesPath(reportDir: string): Promise<string> {
  const files = (await readdir(reportDir)).filter((file) => file.startsWith("rating-lab-enrichment-candidates-") && file.endsWith(".csv")).sort();
  const latest = files.at(-1);
  if (!latest) throw new Error("No rating-lab enrichment candidate CSV found. Run pnpm db:rating-lab:export-enrichment first.");
  return join(reportDir, latest);
}

if (isCliEntrypoint(import.meta.url)) {
  runTransfermarktEnrich()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

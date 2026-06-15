import { writeFile, readFile } from "node:fs/promises";
import { compareRatingLabReports } from "./compareRatingLabReports.js";
import type { RatingLabSummary } from "./types.js";

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.baseline || !args.current) throw new Error("Missing required --baseline and --current.");
  const baseline = JSON.parse(await readFile(args.baseline, "utf8")) as RatingLabSummary;
  const current = JSON.parse(await readFile(args.current, "utf8")) as RatingLabSummary;
  const diff = compareRatingLabReports(baseline, current);

  console.log(`Gate status: ${diff.gateStatusChange.baseline} -> ${diff.gateStatusChange.current}`);
  console.log(
    `Coverage: ${diff.coverageChange.baselineCardsResolvedPct}% -> ${diff.coverageChange.currentCardsResolvedPct}%`
  );
  console.log(`Rating changes: ${diff.ratingChanges.length}`);
  console.log(`Tier changes: ${diff.tierChanges.length}`);
  console.log(`Benchmark status changes: ${diff.benchmarkStatusChanges.length}`);
  console.log(`New anomalies: ${diff.newAnomalies.length}`);
  console.log(`Resolved anomalies: ${diff.resolvedAnomalies.length}`);
  console.log(`Source/provenance changes: ${diff.sourceProvenanceChanges.length}`);

  if (args.jsonOut) {
    await writeFile(args.jsonOut, `${JSON.stringify(diff, null, 2)}\n`, "utf8");
  }
}

function parseArgs(argv: readonly string[]): { baseline?: string; current?: string; jsonOut?: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    }
  }
  return {
    baseline: values.get("baseline"),
    current: values.get("current"),
    jsonOut: values.get("json-out")
  };
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { loadRootEnv } from "../../../env.js";
import { exportEnrichmentRequests, type ExportEnrichmentOptions } from "../enrichment/application/exportEnrichmentRequests.js";
import { isCliEntrypoint } from "./cliEntrypoint.js";

export async function runRatingLabExportEnrichment(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  loadRootEnv();
  const result = await exportEnrichmentRequests(parseArgs(argv));
  return [
    result.dryRun ? "Rating lab enrichment dry run completed." : "Rating lab enrichment requests exported.",
    `Requests: ${result.requestCount}`,
    `JSONL: ${result.dryRun ? "(dry-run, not written)" : result.inputPath}`,
    `Candidates: ${result.candidatesPath}`,
    `Local Transfermarkt ID discovery: ${result.discoveryPath}`
  ].join("\n");
}

function parseArgs(argv: readonly string[]): ExportEnrichmentOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      values.set(key, "true");
    }
  }
  return {
    maxRequests: numberArg(values.get("max-requests")),
    minPriority: numberArg(values.get("min-priority")),
    onlyCategory: values.get("only-category") as ExportEnrichmentOptions["onlyCategory"],
    onlyProvider: values.get("only-provider") as ExportEnrichmentOptions["onlyProvider"],
    provider: values.get("provider") as ExportEnrichmentOptions["provider"],
    dryRun: values.get("dry-run") === "true",
    scope: values.get("scope") as ExportEnrichmentOptions["scope"],
    worldCupYear: numberArg(values.get("world-cup-year")),
    outputPath: values.get("output"),
    force: values.get("force") === "true",
    refreshRatingLab: values.get("refresh-rating-lab") === "true",
    localDiscoveryMaxRowsPerFile: numberArg(values.get("local-discovery-max-rows-per-file"))
  };
}

function numberArg(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

if (isCliEntrypoint(import.meta.url)) {
  runRatingLabExportEnrichment()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

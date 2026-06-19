import { readFile } from "node:fs/promises";
import { defaultPreviewPathForReport, writeRatingLabPreviewHtml } from "../reporting/previewHtmlWriter.js";
import type { RatingLabSummary } from "../domain/types.js";
import { isCliEntrypoint } from "./cliEntrypoint.js";
import { resolveCliPath } from "./cliPaths.js";

export async function runRatingLabPreview(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  const reportPath = resolveCliPath(args.report);
  const summary = JSON.parse(await readFile(reportPath, "utf8")) as RatingLabSummary;
  const outputPath = args.output ? resolveCliPath(args.output) : defaultPreviewPathForReport(reportPath);
  return writeRatingLabPreviewHtml({ summary, outputPath });
}

function parseArgs(argv: readonly string[]): { report: string; output?: string } {
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
  return { report: values.get("report") ?? "data/import-reports/rating-lab/latest-summary.json", output: values.get("output") };
}

if (isCliEntrypoint(import.meta.url)) {
  runRatingLabPreview()
    .then((path) => console.log(`Rating lab preview wrote ${path}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

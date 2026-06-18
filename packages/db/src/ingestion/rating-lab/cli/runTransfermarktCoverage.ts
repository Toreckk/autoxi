import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isCliEntrypoint } from "./cliEntrypoint.js";

export async function runTransfermarktCoverage(): Promise<string> {
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const reportDir = resolve(cwd, "data/import-reports/rating-lab");
  const summaryPath = join(reportDir, await latestSummaryFile(reportDir));
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as {
    totalCardsSampled: number;
    cardSnapshots: Array<{ transfermarktMatchConfidence?: string; tier?: string; worldCupYear?: number }>;
  };
  const withData = summary.cardSnapshots.filter((card) => card.transfermarktMatchConfidence && card.transfermarktMatchConfidence !== "NONE").length;
  const total = summary.cardSnapshots.length || summary.totalCardsSampled;
  const percent = total === 0 ? 0 : Math.round((withData / total) * 1000) / 10;
  const highPriorityMissing = summary.cardSnapshots
    .filter((card) => (card.tier === "ICON" || card.tier === "HERO") && (!card.transfermarktMatchConfidence || card.transfermarktMatchConfidence === "NONE"))
    .length;
  return [
    "Transfermarkt coverage.",
    `Summary: ${summaryPath}`,
    `Current coverage: ${percent}%`,
    `Cards with Transfermarkt data: ${withData} / ${total}`,
    `Missing Transfermarkt data: ${Math.max(0, total - withData)}`,
    `Still-missing high-priority cards: ${highPriorityMissing}`
  ].join("\n");
}

async function latestSummaryFile(reportDir: string): Promise<string> {
  const files = (await readdir(reportDir)).filter((file) => file.startsWith("rating-lab-summary-") && file.endsWith(".json")).sort();
  const latest = files.at(-1) ?? "latest-summary.json";
  return latest;
}

if (isCliEntrypoint(import.meta.url)) {
  runTransfermarktCoverage()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

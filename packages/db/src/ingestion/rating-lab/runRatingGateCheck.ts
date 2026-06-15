import { readFile } from "node:fs/promises";
import { evaluateRatingGates } from "./evaluateRatingGates.js";
import type { RatingLabSummary } from "./types.js";

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.report) throw new Error("Missing required --report.");
  const summary = JSON.parse(await readFile(args.report, "utf8")) as RatingLabSummary;
  const evaluation = evaluateRatingGates(summary);

  console.log(`Rating gate status: ${evaluation.status}`);
  console.log(`Hard failures: ${evaluation.hardFailures.length}`);
  for (const failure of evaluation.hardFailures) console.log(`- ${failure.message}`);
  console.log(`Warnings: ${evaluation.warnings.length}`);
  for (const warning of evaluation.warnings) console.log(`- ${warning.message}`);

  if (!args.noFail && evaluation.status !== "READY_FOR_PHASE_1B") {
    process.exitCode = 1;
  }
}

function parseArgs(argv: readonly string[]): { report?: string; noFail: boolean } {
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
  return { report: values.get("report"), noFail: values.get("no-fail") === "true" };
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

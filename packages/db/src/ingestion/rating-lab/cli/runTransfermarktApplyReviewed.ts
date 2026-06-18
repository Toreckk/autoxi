import { resolve } from "node:path";
import { applyReviewedTransfermarktApprovals } from "@autoxi/scrapers";
import { isCliEntrypoint } from "./cliEntrypoint.js";

export async function runTransfermarktApplyReviewed(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const result = await applyReviewedTransfermarktApprovals({
    outputDir: resolve(cwd, "data/sources"),
    needsReviewPath: typeof args.needsReview === "string" ? resolve(cwd, args.needsReview) : undefined,
    roundId: typeof args.round === "string" ? args.round : "manual-review"
  });
  return [
    "Transfermarkt reviewed approvals applied.",
    `Manual approvals read: ${result.approvedRowsRead}`,
    `Overlay players written: ${result.playersWritten}`,
    `Overlay appearances written: ${result.appearancesWritten}`,
    `Provider links written: ${result.linksWritten}`
  ].join("\n");
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

if (isCliEntrypoint(import.meta.url)) {
  runTransfermarktApplyReviewed()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

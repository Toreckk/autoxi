import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveRatingLabSourcePaths } from "../config/ratingLabSourcePaths.js";
import { profileTransfermarktSource } from "../sources/transfermarkt/transfermarktProfiler.js";
import { isCliEntrypoint } from "./cliEntrypoint.js";
import { resolveCliPath } from "./cliPaths.js";

export async function runRatingLabProfileTransfermarkt(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  const sources = resolveRatingLabSourcePaths({
    overrides: { transfermarkt: args.sourceDir ? resolveCliPath(args.sourceDir) : undefined }
  });
  const sourceDir = args.sourceDir ? resolveCliPath(args.sourceDir) : sources.sources.transfermarkt.path;
  const profile = await profileTransfermarktSource(sourceDir);
  const outputPath = resolveCliPath(args.output ?? join("data/import-reports/rating-lab", "transfermarkt-profile-latest.json"));
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), profile }, null, 2)}\n`, "utf8");
  return outputPath;
}

function parseArgs(argv: readonly string[]): { sourceDir?: string; output?: string } {
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
  return { sourceDir: values.get("source-dir") ?? values.get("transfermarkt-source-dir"), output: values.get("output") };
}

if (isCliEntrypoint(import.meta.url)) {
  runRatingLabProfileTransfermarkt()
    .then((path) => console.log(`Transfermarkt profile wrote ${path}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

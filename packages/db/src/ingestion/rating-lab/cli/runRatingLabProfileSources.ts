import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { profileRegisteredSources } from "../sources/sourceRegistry.js";
import { resolveRatingLabSourcePaths } from "../config/ratingLabSourcePaths.js";
import { isCliEntrypoint } from "./cliEntrypoint.js";
import { resolveCliPath } from "./cliPaths.js";

export async function runRatingLabProfileSources(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  const sources = resolveRatingLabSourcePaths();
  const availability = await profileRegisteredSources(sources);
  const outputPath = resolveCliPath(args.output ?? join("data/import-reports/rating-lab", "source-profile-latest.json"));
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), availability }, null, 2)}\n`, "utf8");
  return outputPath;
}

function parseArgs(argv: readonly string[]): { output?: string } {
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
  return { output: values.get("output") };
}

if (isCliEntrypoint(import.meta.url)) {
  runRatingLabProfileSources()
    .then((path) => console.log(`Rating lab source profile wrote ${path}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

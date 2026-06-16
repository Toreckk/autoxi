import { readFile } from "node:fs/promises";
import { loadRootEnv } from "../../../env.js";
import {
  estimateExceedsNeonFreePreviewLimits,
  estimatePreviewImportSize
} from "../db-preview/estimatePreviewImportSize.js";
import { devPreviewUnavailableMessage, writeDevPreviewCards } from "../db-preview/writeDevPreviewCards.js";
import type { RatingLabSummary } from "../domain/types.js";
import { formatCliError, isCliEntrypoint } from "./cliEntrypoint.js";
import { resolveCliPath } from "./cliPaths.js";

export async function runRatingLabWriteDevPreview(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const args = parseArgs(argv);
  if (!args.report) throw new Error("Missing required --report.");
  if (!args.devOnly) throw new Error("Refusing dev preview without --dev-only.");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing dev preview when NODE_ENV=production.");

  const maxCards = args.maxCards ?? 500;
  if (maxCards <= 0) throw new Error("--max-cards must be greater than 0.");

  const summary = JSON.parse(await readFile(resolveCliPath(args.report), "utf8")) as RatingLabSummary;
  const estimate = estimatePreviewImportSize(summary, maxCards);
  const failures = estimateExceedsNeonFreePreviewLimits(estimate, {
    maxCards,
    allowOverride: args.understandNeonLimits
  });
  if (failures.length > 0) {
    throw new Error(`${failures.join("; ")}. ${devPreviewUnavailableMessage(estimate)}`);
  }

  const estimateText = JSON.stringify(estimate, null, 2);
  if (args.estimateOnly) return `Rating lab dev preview estimate:\n${estimateText}`;

  if (!args.resetRatingLabPreview) throw new Error("Refusing dev preview write without --reset-rating-lab-preview.");
  loadRootEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("Refusing dev preview write without DATABASE_URL. Set it in the shell or root .env.local, then rerun the same command.");
  }

  const result = await writeDevPreviewCards({ summary, maxCards, connectionString: process.env.DATABASE_URL });
  return `Rating lab dev preview wrote ${result.cardsWritten} cards to ${result.sourceImportId}:\n${JSON.stringify(result, null, 2)}`;
}

function parseArgs(argv: readonly string[]): {
  report?: string;
  maxCards?: number;
  devOnly: boolean;
  resetRatingLabPreview: boolean;
  estimateOnly: boolean;
  understandNeonLimits: boolean;
} {
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
  const maxCards = values.has("max-cards") ? Number(values.get("max-cards")) : undefined;
  return {
    report: values.get("report"),
    maxCards: maxCards !== undefined && Number.isFinite(maxCards) ? maxCards : undefined,
    devOnly: values.get("dev-only") === "true",
    resetRatingLabPreview: values.get("reset-rating-lab-preview") === "true",
    estimateOnly: values.get("estimate-only") === "true",
    understandNeonLimits: values.get("i-understand-neon-limits") === "true"
  };
}

if (isCliEntrypoint(import.meta.url)) {
  runRatingLabWriteDevPreview()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(formatCliError(error));
      process.exitCode = 1;
    });
}

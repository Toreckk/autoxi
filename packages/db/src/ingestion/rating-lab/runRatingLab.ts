import { findSevenAZeroComparison, loadSevenAZeroLocalJsonComparisonsWithWarnings } from "./compareWithSevenAZero.js";
import { MANUAL_RATING_FLOORS } from "./iconicTargets.js";
import { loadFjelstulSampleWithReadiness } from "./loadFjelstulSample.js";
import { buildReports, toCardReport, writeRatingLabReports } from "./reportWriter.js";
import { resolveCardRating } from "./resolveCardRating.js";

export type CliOptions = {
  sourceDir: string;
  sevenAZeroDir?: string;
  preset?: "pre-phase-1b-calibration";
  sample: "all" | "iconic-plus-random" | "random";
  randomCount: number;
  seed: string;
  players?: string[];
  worldCupYears?: number[];
  outputDir: string;
};

export async function runRatingLab(options: CliOptions): Promise<string[]> {
  const sevenAZeroLocalJson = await loadSevenAZeroLocalJsonComparisonsWithWarnings(options.sevenAZeroDir);
  const sevenAZeroComparison = sevenAZeroLocalJson.comparisons;
  const { cards: contexts, sourceReadiness } = await loadFjelstulSampleWithReadiness({
    sourceDir: options.sourceDir,
    sample: options.sample,
    randomCount: options.randomCount,
    seed: options.seed,
    players: options.players,
    worldCupYears: options.worldCupYears
  });

  const cards = contexts.map((context) => {
    const resolved = resolveCardRating(context, {
      manualCurated: MANUAL_RATING_FLOORS,
      sevenAZeroComparison
    });
    return toCardReport({
      context,
      resolved,
      sevenAZero: findSevenAZeroComparison(context, sevenAZeroComparison)
    });
  });

  const reports = buildReports({
    cards,
    sourceDir: options.sourceDir,
    sampleMode: options.sample,
    seed: options.seed,
    sourceReadiness: {
      ...sourceReadiness,
      sourceWarnings: [
        ...sourceReadiness.sourceWarnings,
        ...sevenAZeroLocalJson.warnings.map((warning) => warning.code)
      ]
    }
  });

  return writeRatingLabReports({ reports, outputDir: options.outputDir });
}

export function resolveRatingLabPresetOptions(preset?: CliOptions["preset"]): Pick<
  CliOptions,
  "sample" | "randomCount" | "seed"
> {
  if (preset === "pre-phase-1b-calibration") {
    return { sample: "iconic-plus-random", randomCount: 300, seed: "42" };
  }
  return { sample: "iconic-plus-random", randomCount: 100, seed: "rating-lab" };
}

function parseCli(argv: readonly string[]): CliOptions {
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

  const sourceDir = values.get("source-dir");
  if (!sourceDir) throw new Error("Missing required --source-dir.");

  return {
    sourceDir,
    sevenAZeroDir: values.get("seven-a-zero-dir"),
    preset: parsePreset(values.get("preset")),
    sample: parseSample(values.get("sample"), values.get("preset")),
    randomCount: Number(values.get("random-count") ?? resolveRatingLabPresetOptions(parsePreset(values.get("preset"))).randomCount),
    seed: values.get("seed") ?? resolveRatingLabPresetOptions(parsePreset(values.get("preset"))).seed,
    players: csv(values.get("players")),
    worldCupYears: csv(values.get("world-cup-years"))?.map((value) => Number(value)).filter(Number.isFinite),
    outputDir: values.get("output-dir") ?? "data/import-reports/rating-lab"
  };
}

function parsePreset(value?: string): CliOptions["preset"] {
  if (value === "pre-phase-1b-calibration") return value;
  return undefined;
}

function parseSample(value?: string, preset?: string): CliOptions["sample"] {
  if (value === "all" || value === "random" || value === "iconic-plus-random") return value;
  if (preset === "pre-phase-1b-calibration") return "iconic-plus-random";
  return "iconic-plus-random";
}

function csv(value?: string): string[] | undefined {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRatingLab(parseCli(process.argv.slice(2)))
    .then((paths) => {
      console.log(`Rating lab wrote ${paths.length} reports:`);
      for (const path of paths) console.log(`- ${path}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

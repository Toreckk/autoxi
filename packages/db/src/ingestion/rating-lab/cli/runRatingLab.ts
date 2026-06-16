import { runCalibration, type RunCalibrationOptions } from "../application/runCalibration.js";
import { loadRatingFormulaConfigFromFile } from "../config/loadRatingFormulaConfig.js";
import {
  assertFjelstulAvailable,
  formatSourceAvailability,
  resolveRatingLabSourcePaths,
  type RatingLabSourcePathOverrides
} from "../config/ratingLabSourcePaths.js";
import type { RatingFormulaPresetKey } from "../domain/rating/ratingFormulaConfig.js";
import { isCliEntrypoint } from "./cliEntrypoint.js";
import { resolveCliPath } from "./cliPaths.js";

export type CliOptions = Omit<RunCalibrationOptions, "sourceDir" | "formulaConfig" | "sourceAvailability"> & {
  sourceDir?: string;
  formulaConfigPath?: string;
  sevenAZeroDir?: string;
  sourcePathOverrides?: RatingLabSourcePathOverrides;
  preset?: RatingFormulaPresetKey;
};

export async function runRatingLab(options: CliOptions): Promise<string[]> {
  const sourcePaths = resolveRatingLabSourcePaths({ overrides: options.sourcePathOverrides });
  const sourceDir = options.sourceDir ? resolveCliPath(options.sourceDir) : assertFjelstulAvailable(sourcePaths);
  const formulaConfig = await loadRatingFormulaConfigFromFile({
    preset: options.preset,
    overridePath: options.formulaConfigPath ? resolveCliPath(options.formulaConfigPath) : undefined
  });
  return runCalibration({
    ...options,
    sourceDir,
    formulaConfig,
    sourceAvailability: sourcePaths.availability
  });
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

  const preset = parsePreset(values.get("preset")) ?? "pre-phase-1b-calibration";
  const presetOptions = resolveRatingLabPresetOptions(preset);

  return {
    sourceDir: values.get("source-dir") ? resolveCliPath(values.get("source-dir")!) : undefined,
    sourcePathOverrides: {
      fjelstul: values.get("fjelstul-source-dir") ? resolveCliPath(values.get("fjelstul-source-dir")!) : values.get("source-dir"),
      transfermarkt: values.get("transfermarkt-source-dir") ? resolveCliPath(values.get("transfermarkt-source-dir")!) : undefined,
      eaHistorical: values.get("ea-historical-source-dir") ? resolveCliPath(values.get("ea-historical-source-dir")!) : undefined,
      clubElo: values.get("club-elo-source-dir") ? resolveCliPath(values.get("club-elo-source-dir")!) : undefined,
      fbref: values.get("fbref-source-dir") ? resolveCliPath(values.get("fbref-source-dir")!) : undefined,
      statsbomb: values.get("statsbomb-source-dir") ? resolveCliPath(values.get("statsbomb-source-dir")!) : undefined,
      fiveThirtyEight: values.get("fivethirtyeight-source-dir") ? resolveCliPath(values.get("fivethirtyeight-source-dir")!) : undefined,
      annualAwards: values.get("annual-awards-source-dir") ? resolveCliPath(values.get("annual-awards-source-dir")!) : undefined
    },
    sevenAZeroDir: values.get("seven-a-zero-dir") ? resolveCliPath(values.get("seven-a-zero-dir")!) : undefined,
    formulaConfigPath: values.get("formula-config") ? resolveCliPath(values.get("formula-config")!) : undefined,
    preset,
    sample: parseSample(values.get("sample"), preset),
    randomCount: Number(values.get("random-count") ?? presetOptions.randomCount),
    seed: values.get("seed") ?? presetOptions.seed,
    players: csv(values.get("players")),
    worldCupYears: csv(values.get("world-cup-years"))?.map((value) => Number(value)).filter(Number.isFinite),
    outputDir: resolveCliPath(values.get("output-dir") ?? "data/import-reports/rating-lab")
  };
}

function parsePreset(value?: string): CliOptions["preset"] {
  if (value === "pre-phase-1b-calibration" || value === "conservative-historical" || value === "modern-data-heavy") return value;
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

if (isCliEntrypoint(import.meta.url)) {
  const sourcePaths = resolveRatingLabSourcePaths();
  console.log(formatSourceAvailability(sourcePaths.availability));
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

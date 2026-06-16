import { loadRootEnv } from "../../../env.js";
import { runCalibrationLoop, type RunCalibrationLoopOptions } from "../application/runCalibrationLoop.js";
import { loadRatingFormulaConfigFromFile } from "../config/loadRatingFormulaConfig.js";
import { assertFjelstulAvailable, resolveRatingLabSourcePaths, type RatingLabSourcePathOverrides } from "../config/ratingLabSourcePaths.js";
import { formatCliError, isCliEntrypoint } from "./cliEntrypoint.js";
import { resolveCliPath } from "./cliPaths.js";
import { resolveRatingLabPresetOptions, type CliOptions } from "./runRatingLab.js";

type LoopCliOptions = RunCalibrationLoopOptions & {
  formulaConfigPath?: string;
  sourcePathOverrides?: RatingLabSourcePathOverrides;
  preset?: CliOptions["preset"];
  devOnly: boolean;
  resetRatingLabPreview: boolean;
};

export async function runRatingLabLoop(argv: readonly string[] = process.argv.slice(2)): Promise<string> {
  const options = parseCli(argv);
  if (options.writeDevPreview) {
    loadRootEnv();
    if (!options.devOnly) throw new Error("Refusing dev preview write without --dev-only.");
    if (!options.resetRatingLabPreview) throw new Error("Refusing dev preview write without --reset-rating-lab-preview.");
    if (process.env.NODE_ENV === "production") throw new Error("Refusing dev preview write when NODE_ENV=production.");
    if (!process.env.DATABASE_URL) {
      throw new Error("Refusing dev preview write without DATABASE_URL. Set it in the shell or root .env.local, then rerun the same command.");
    }
    options.devPreviewConnectionString = process.env.DATABASE_URL;
  }
  options.formulaConfig = await loadRatingFormulaConfigFromFile({
    preset: options.preset,
    overridePath: options.formulaConfigPath
  });

  const result = await runCalibrationLoop(options);
  const lines = [
    `Rating lab loop completed with gate status ${result.gateStatus}.`,
    `Reports: ${result.reportPaths.length}`,
    `Summary: ${result.summaryPath}`,
    `HTML preview: ${result.previewPath}`,
    `Dev preview estimate: ${result.previewEstimate.cardsToWrite} cards, ${result.previewEstimate.estimatedTotalRows} rows, ${result.previewEstimate.estimatedStorageMb} MB`
  ];

  if (result.gateReasons.length > 0) {
    lines.push("Gate reasons:");
    lines.push(...result.gateReasons.map((reason) => `- ${reason}`));
  }
  if (result.devPreviewWrite) {
    lines.push(`Dev DB preview: wrote ${result.devPreviewWrite.cardsWritten} cards to ${result.devPreviewWrite.sourceImportId}`);
  } else {
    lines.push("Dev DB preview: skipped. Add --write-dev-preview --dev-only --reset-rating-lab-preview to write ingested preview cards.");
  }

  return lines.join("\n");
}

function parseCli(argv: readonly string[]): LoopCliOptions {
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
  const sourcePathOverrides: RatingLabSourcePathOverrides = {
    fjelstul: values.get("fjelstul-source-dir") ? resolveCliPath(values.get("fjelstul-source-dir")!) : values.get("source-dir"),
    transfermarkt: values.get("transfermarkt-source-dir") ? resolveCliPath(values.get("transfermarkt-source-dir")!) : undefined,
    eaHistorical: values.get("ea-historical-source-dir") ? resolveCliPath(values.get("ea-historical-source-dir")!) : undefined,
    clubElo: values.get("club-elo-source-dir") ? resolveCliPath(values.get("club-elo-source-dir")!) : undefined,
    fbref: values.get("fbref-source-dir") ? resolveCliPath(values.get("fbref-source-dir")!) : undefined,
    statsbomb: values.get("statsbomb-source-dir") ? resolveCliPath(values.get("statsbomb-source-dir")!) : undefined,
    fiveThirtyEight: values.get("fivethirtyeight-source-dir") ? resolveCliPath(values.get("fivethirtyeight-source-dir")!) : undefined,
    annualAwards: values.get("annual-awards-source-dir") ? resolveCliPath(values.get("annual-awards-source-dir")!) : undefined
  };
  const sourcePaths = resolveRatingLabSourcePaths({ overrides: sourcePathOverrides });

  return {
    sourceDir: values.get("source-dir") ? resolveCliPath(values.get("source-dir")!) : assertFjelstulAvailable(sourcePaths),
    sourceAvailability: sourcePaths.availability,
    sourcePathOverrides,
    formulaConfigPath: values.get("formula-config") ? resolveCliPath(values.get("formula-config")!) : undefined,
    sevenAZeroDir: values.get("seven-a-zero-dir") ? resolveCliPath(values.get("seven-a-zero-dir")!) : undefined,
    preset,
    sample: parseSample(values.get("sample"), values.get("preset")),
    randomCount: Number(values.get("random-count") ?? presetOptions.randomCount),
    seed: values.get("seed") ?? presetOptions.seed,
    players: csv(values.get("players")),
    worldCupYears: csv(values.get("world-cup-years"))?.map((value) => Number(value)).filter(Number.isFinite),
    outputDir: resolveCliPath(values.get("output-dir") ?? "data/import-reports/rating-lab"),
    previewOutputPath: values.get("preview-output") ? resolveCliPath(values.get("preview-output")!) : undefined,
    maxPreviewCards: values.has("max-preview-cards") ? Number(values.get("max-preview-cards")) : undefined,
    writeDevPreview: values.get("write-dev-preview") === "true",
    devOnly: values.get("dev-only") === "true",
    resetRatingLabPreview: values.get("reset-rating-lab-preview") === "true",
    allowPreviewLimitOverride: values.get("i-understand-neon-limits") === "true"
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
  runRatingLabLoop()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(formatCliError(error));
      process.exitCode = 1;
    });
}

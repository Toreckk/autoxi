import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RatingLabSourceAvailability, RatingSourceKey } from "../domain/types.js";

export type RatingLabSourcePathOverrides = Partial<Record<RatingLabSourcePathKey, string>>;

export type RatingLabSourcePathKey =
  | "fjelstul"
  | "transfermarkt"
  | "eaHistorical"
  | "clubElo"
  | "fbref"
  | "statsbomb"
  | "fiveThirtyEight"
  | "annualAwards"
  | "manual"
  | "sevenAZeroManual";

export type ResolvedRatingLabSources = {
  rootDir: string;
  sources: Record<RatingLabSourcePathKey, ResolvedRatingLabSourcePath>;
  availability: RatingLabSourceAvailability[];
};

export type ResolvedRatingLabSourcePath = {
  key: RatingLabSourcePathKey;
  sourceKey: RatingSourceKey;
  label: string;
  path: string;
  available: boolean;
  required: boolean;
  mode: RatingLabSourceAvailability["mode"];
  affectsRating: boolean;
  envVar: string;
  warnings: string[];
};

const SOURCE_DEFINITIONS: Record<RatingLabSourcePathKey, Omit<ResolvedRatingLabSourcePath, "path" | "available" | "warnings"> & { defaultPath: string }> = {
  fjelstul: {
    key: "fjelstul",
    sourceKey: "FJELSTUL_WORLD_CUP",
    label: "Fjelstul World Cup",
    defaultPath: "fjelstul-worldcup/data-csv",
    required: true,
    mode: "required",
    affectsRating: true,
    envVar: "RATING_LAB_FJELSTUL_SOURCE_DIR"
  },
  transfermarkt: {
    key: "transfermarkt",
    sourceKey: "TRANSFERMARKT",
    label: "Transfermarkt",
    defaultPath: "transfermarkt",
    required: false,
    mode: "optional",
    affectsRating: false,
    envVar: "RATING_LAB_TRANSFERMARKT_SOURCE_DIR"
  },
  eaHistorical: {
    key: "eaHistorical",
    sourceKey: "EA_HISTORICAL",
    label: "EA Historical",
    defaultPath: "ea-fc-ratings",
    required: false,
    mode: "optional",
    affectsRating: false,
    envVar: "RATING_LAB_EA_HISTORICAL_SOURCE_DIR"
  },
  clubElo: {
    key: "clubElo",
    sourceKey: "CLUB_ELO",
    label: "ClubElo",
    defaultPath: "club-elo",
    required: false,
    mode: "optional",
    affectsRating: false,
    envVar: "RATING_LAB_CLUB_ELO_SOURCE_DIR"
  },
  fbref: {
    key: "fbref",
    sourceKey: "FBREF",
    label: "FBref",
    defaultPath: "fbref",
    required: false,
    mode: "optional",
    affectsRating: false,
    envVar: "RATING_LAB_FBREF_SOURCE_DIR"
  },
  statsbomb: {
    key: "statsbomb",
    sourceKey: "STATSBOMB",
    label: "StatsBomb",
    defaultPath: "statsbomb-open-data",
    required: false,
    mode: "optional",
    affectsRating: false,
    envVar: "RATING_LAB_STATSBOMB_SOURCE_DIR"
  },
  fiveThirtyEight: {
    key: "fiveThirtyEight",
    sourceKey: "FIVETHIRTYEIGHT_WORLD_CUP",
    label: "FiveThirtyEight",
    defaultPath: "fivethirtyeight",
    required: false,
    mode: "optional",
    affectsRating: false,
    envVar: "RATING_LAB_FIVETHIRTYEIGHT_SOURCE_DIR"
  },
  annualAwards: {
    key: "annualAwards",
    sourceKey: "ANNUAL_AWARDS",
    label: "Annual awards",
    defaultPath: "annual-awards",
    required: false,
    mode: "optional",
    affectsRating: true,
    envVar: "RATING_LAB_ANNUAL_AWARDS_SOURCE_DIR"
  },
  manual: {
    key: "manual",
    sourceKey: "MANUAL_ANCHORS",
    label: "Manual anchors",
    defaultPath: "manual",
    required: false,
    mode: "built-in",
    affectsRating: true,
    envVar: "RATING_LAB_MANUAL_SOURCE_DIR"
  },
  sevenAZeroManual: {
    key: "sevenAZeroManual",
    sourceKey: "SEVEN_A_ZERO_MANUAL",
    label: "7a0 manual references",
    defaultPath: "seven-a-zero-manual",
    required: false,
    mode: "comparison-only",
    affectsRating: false,
    envVar: "RATING_LAB_SEVEN_A_ZERO_MANUAL_SOURCE_DIR"
  }
};

export function resolveRatingLabSourcePaths(options: {
  overrides?: RatingLabSourcePathOverrides;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): ResolvedRatingLabSources {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.env.INIT_CWD ?? process.cwd();
  const rootDir = resolve(cwd, env.RATING_LAB_SOURCE_ROOT ?? "data/sources");
  const entries = {} as Record<RatingLabSourcePathKey, ResolvedRatingLabSourcePath>;
  for (const key of Object.keys(SOURCE_DEFINITIONS) as RatingLabSourcePathKey[]) {
      const definition = SOURCE_DEFINITIONS[key];
      const configured = options.overrides?.[key] ?? env[definition.envVar];
      const path = resolve(cwd, configured ?? resolve(rootDir, definition.defaultPath));
      const available = key === "manual" || key === "sevenAZeroManual" ? true : existsSync(path);
      const warnings = available || definition.required ? [] : [`${key}_source_unavailable`];
      entries[key] = {
        ...definition,
        path,
        available,
        warnings
      };
  }

  return {
    rootDir,
    sources: entries,
    availability: Object.values(entries).map((source) => ({
      sourceKey: source.sourceKey,
      label: source.label,
      status: source.available ? "available" : "unavailable",
      required: source.required,
      mode: source.mode,
      path: source.path,
      warnings: source.warnings,
      affectsRating: source.affectsRating
    }))
  };
}

export function assertFjelstulAvailable(resolved: ResolvedRatingLabSources): string {
  const fjelstul = resolved.sources.fjelstul;
  if (fjelstul.available) return fjelstul.path;
  throw new Error(
    [
      "Fjelstul source not found.",
      "Expected: data/sources/fjelstul-worldcup/data-csv",
      "Set RATING_LAB_FJELSTUL_SOURCE_DIR or pass --fjelstul-source-dir."
    ].join("\n")
  );
}

export function formatSourceAvailability(availability: readonly RatingLabSourceAvailability[]): string {
  return [
    "Rating lab source availability:",
    ...availability.map((source) => {
      const suffix = source.mode === "comparison-only" ? ", comparison-only" : source.mode === "built-in" ? " (built-in or local)" : "";
      return `- ${source.label}: ${source.status}${suffix}`;
    })
  ].join("\n");
}

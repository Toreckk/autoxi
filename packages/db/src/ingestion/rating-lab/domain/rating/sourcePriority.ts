import type { RatingSource } from "../types.js";

export const SOURCE_PRIORITY = [
  "MANUAL_CURATED",
  "EA_HISTORICAL",
  "RETRO_REFERENCE",
  "TRANSFERMARKT",
  "FJELSTUL_WORLD_CUP",
  "FIVETHIRTYEIGHT_WORLD_CUP",
  "STATSBOMB_WORLD_CUP",
  "SEVEN_A_ZERO_COMPARISON",
  "FJELSTUL_GENERATED"
] as const satisfies readonly RatingSource[];

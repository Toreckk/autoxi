import { readFile } from "node:fs/promises";
import {
  mergeRatingFormulaPreset,
  type RatingFormulaConfig,
  type RatingFormulaPresetKey
} from "../domain/rating/ratingFormulaConfig.js";

export async function loadRatingFormulaConfigFromFile(options: {
  preset?: RatingFormulaPresetKey;
  overridePath?: string;
} = {}): Promise<RatingFormulaConfig> {
  if (!options.overridePath) return mergeRatingFormulaPreset(options.preset);
  const override = JSON.parse(await readFile(options.overridePath, "utf8")) as Partial<RatingFormulaConfig>;
  return mergeRatingFormulaPreset(options.preset, override);
}

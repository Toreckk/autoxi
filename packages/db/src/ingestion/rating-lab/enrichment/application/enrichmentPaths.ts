import { resolve } from "node:path";

export function repoPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

export const DEFAULT_ENRICHMENT_INPUT_PATH = "data/work/missing-player-enrichment.jsonl";

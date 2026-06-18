import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileExists, readCsv, writeCsv, type CsvRow } from "./CsvWriters.js";

export type LeagueSeasonKey = {
  leagueId: string;
  season: number;
};

export class ScraperCache {
  constructor(private readonly cacheDir: string) {}

  squadCachePath(key: LeagueSeasonKey): string {
    return join(this.cacheDir, `squads_${key.leagueId}_${key.season}.csv`);
  }

  async hasSquadCache(key: LeagueSeasonKey): Promise<boolean> {
    return fileExists(this.squadCachePath(key));
  }

  async readSquadCache(key: LeagueSeasonKey): Promise<Record<string, string>[]> {
    return readCsv(this.squadCachePath(key));
  }

  async writeSquadCache(key: LeagueSeasonKey, headers: readonly string[], rows: readonly CsvRow[]): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    await writeCsv(this.squadCachePath(key), headers, rows);
  }
}

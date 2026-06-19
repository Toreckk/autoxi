import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileExists, readCsv, writeCsv, type CsvRow } from "./CsvWriters.js";

export type LeagueSeasonKey = {
  leagueId: string;
  season: number;
  worldCupYear?: number;
};

export class ScraperCache {
  constructor(private readonly cacheDir: string) {}

  squadCachePath(key: LeagueSeasonKey): string {
    if (key.worldCupYear) return join(this.cacheDir, `squads_${key.leagueId}_wc${key.worldCupYear}_tm${key.season}.csv`);
    return join(this.cacheDir, `squads_${key.leagueId}_${key.season}.csv`);
  }

  legacySquadCachePath(key: LeagueSeasonKey): string {
    return join(this.cacheDir, `squads_${key.leagueId}_${key.season}.csv`);
  }

  async hasSquadCache(key: LeagueSeasonKey): Promise<boolean> {
    if (await fileExists(this.squadCachePath(key))) return true;
    return key.worldCupYear ? fileExists(this.legacySquadCachePath(key)) : false;
  }

  async readSquadCache(key: LeagueSeasonKey): Promise<Record<string, string>[]> {
    if (await fileExists(this.squadCachePath(key))) return readCsv(this.squadCachePath(key));
    if (key.worldCupYear && (await fileExists(this.legacySquadCachePath(key)))) return readCsv(this.legacySquadCachePath(key));
    return readCsv(this.squadCachePath(key));
  }

  async writeSquadCache(key: LeagueSeasonKey, headers: readonly string[], rows: readonly CsvRow[]): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    await writeCsv(this.squadCachePath(key), headers, rows);
  }
}

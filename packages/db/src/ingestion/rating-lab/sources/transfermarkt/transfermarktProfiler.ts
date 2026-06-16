import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { TransfermarktFileProfile, TransfermarktProfile } from "./transfermarktTypes.js";

export async function profileTransfermarktSource(sourceDir: string): Promise<TransfermarktProfile> {
  const files = await csvFiles(sourceDir);
  const profiles: TransfermarktFileProfile[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    try {
      const profile = await profileCsvFile(join(sourceDir, file), file);
      profiles.push(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`transfermarkt_profile_failed:${file}:${message}`);
    }
  }

  return {
    sourceDir,
    files: profiles,
    totalRows: profiles.reduce((sum, file) => sum + file.rows, 0),
    warnings
  };
}

async function csvFiles(sourceDir: string): Promise<string[]> {
  try {
    const sourceStat = await stat(sourceDir);
    if (!sourceStat.isDirectory()) return [];
    return (await readdir(sourceDir)).filter((file) => file.toLowerCase().endsWith(".csv")).sort();
  } catch {
    return [];
  }
}

async function profileCsvFile(filePath: string, file: string): Promise<TransfermarktFileProfile> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({
    input,
    crlfDelay: Infinity
  });

  let columns: string[] = [];
  let dateColumnIndex = -1;
  let rows = 0;
  let minYear: number | null = null;
  let maxYear: number | null = null;

  for await (const line of lines) {
    if (columns.length === 0) {
      columns = parseCsvLine(line);
      dateColumnIndex = findYearColumnIndex(columns);
      continue;
    }

    if (line.trim().length === 0) continue;

    rows += 1;

    if (dateColumnIndex >= 0) {
      const values = parseCsvLine(line);
      const year = yearFromValue(values[dateColumnIndex]);
      if (year !== null) {
        minYear = minYear === null ? year : Math.min(minYear, year);
        maxYear = maxYear === null ? year : Math.max(maxYear, year);
      }
    }
  }

  return {
    file,
    rows,
    columns,
    minYear,
    maxYear
  };
}

function findYearColumnIndex(columns: readonly string[]): number {
  const preferredColumns = ["year", "season", "season_year", "date", "transfer_date"];

  for (const column of preferredColumns) {
    const index = columns.indexOf(column);
    if (index >= 0) return index;
  }

  return columns.findIndex((column) => {
    const normalized = column.toLowerCase();
    return normalized.includes("date") || normalized.includes("season") || normalized.includes("year");
  });
}

function yearFromValue(value: string | undefined): number | null {
  if (!value) return null;

  const match = String(value).match(/\b(18|19|20)\d{2}\b/);
  if (!match) return null;

  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

/**
 * Lightweight CSV parser for profiling only.
 * It handles quoted commas well enough for headers/date columns,
 * but full ingestion should keep using the real CSV parser.
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
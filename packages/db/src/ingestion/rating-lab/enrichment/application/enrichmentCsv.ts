import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

export type CsvRow = Record<string, string>;

export async function* streamCsvRows(filePath: string): AsyncGenerator<CsvRow> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers: string[] | null = null;

  for await (const line of lines) {
    if (headers === null) {
      headers = parseCsvLine(line).map((header) => header.trim());
      continue;
    }
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    yield Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
  }
}

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  values.push(cell);
  return values;
}

export function toCsv(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function writeCsv(path: string, rows: readonly Record<string, unknown>[], columns: readonly string[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, toCsv(rows, columns), "utf8");
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function valueFor(row: CsvRow, keys: readonly string[]): string | undefined {
  const normalizedEntries = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
  for (const key of keys) {
    const value = normalizedEntries.get(normalizeKey(key));
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export function numberFor(row: CsvRow, keys: readonly string[]): number | null {
  const value = valueFor(row, keys);
  if (!value) return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function yearFromValue(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/\b(18|19|20)\d{2}\b/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

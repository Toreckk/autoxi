import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

export async function writeCsv(path: string, headers: readonly string[], rows: readonly CsvRow[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const allHeaders = [...headers];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!allHeaders.includes(key)) allHeaders.push(key);
    }
  }
  const lines = [allHeaders.join(",")];
  for (const row of rows) {
    lines.push(allHeaders.map((header) => csvCell(row[header])).join(","));
  }
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

export async function readCsv(path: string): Promise<Record<string, string>[]> {
  if (!(await fileExists(path))) return [];
  const text = await readFile(path, "utf8");
  const [headerLine, ...lines] = text.split(/\r?\n/u).filter((line) => line.length > 0);
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

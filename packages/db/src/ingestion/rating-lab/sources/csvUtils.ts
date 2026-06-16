import { readFile } from "node:fs/promises";

export type CsvRow = Record<string, string>;

export async function readCsvRows(path: string): Promise<CsvRow[]> {
  return parseCsv(await readFile(path, "utf8"));
}

export function parseCsv(contents: string): CsvRow[] {
  const rows = parseCsvRecords(contents);
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), (row[index] ?? "").trim()]))
    );
}

function parseCsvRecords(contents: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]!;
    const next = contents[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  return records;
}

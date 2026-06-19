import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseCsv } from "./csvUtils.js";

export type LocalSourceProbe = {
  fileCount: number;
  recordCount: number;
};

export async function probeLocalSource(sourceDir?: string): Promise<LocalSourceProbe> {
  if (!sourceDir) return { fileCount: 0, recordCount: 0 };
  const files = await listFiles(sourceDir);
  let recordCount = 0;
  for (const file of files) {
    if (file.toLowerCase().endsWith(".csv")) {
      try {
        recordCount += parseCsv(await readFile(file, "utf8")).length;
      } catch {
        recordCount += 1;
      }
    } else if (file.toLowerCase().endsWith(".json")) {
      recordCount += 1;
    }
  }
  return { fileCount: files.length, recordCount };
}

async function listFiles(path: string): Promise<string[]> {
  try {
    const pathStat = await stat(path);
    if (pathStat.isFile()) return [path];
    if (!pathStat.isDirectory()) return [];
  } catch {
    return [];
  }

  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(child)));
    if (entry.isFile()) files.push(child);
  }
  return files;
}

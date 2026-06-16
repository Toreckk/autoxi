import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function isCliEntrypoint(metaUrl: string): boolean {
  const entry = process.argv[1];
  return entry ? metaUrl === pathToFileURL(resolve(entry)).href : false;
}

export function formatCliError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const details = errorWithDetails(error);
  return details.length > 0 ? details : error.stack || error.name || "Unknown error";
}

function errorWithDetails(error: Error): string {
  const fields = Object.entries(error as Error & Record<string, unknown>)
    .filter(([key, value]) => key !== "name" && key !== "message" && key !== "stack" && value !== undefined)
    .map(([key, value]) => `${key}: ${formatValue(value)}`);
  const header = [error.name, error.message].filter(Boolean).join(": ");
  return [header, ...fields, error.stack && !header ? error.stack : ""].filter(Boolean).join("\n");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

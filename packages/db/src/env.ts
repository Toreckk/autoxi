import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

let loaded = false;

export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(here, "../../..", ".env.local"),
    resolve(here, "../../../..", ".env.local")
  ];

  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath) {
    config({ path: envPath });
  }
}

export function getDatabaseUrl(kind: "app" | "migration" = "app"): string {
  loadRootEnv();
  const url =
    kind === "migration"
      ? process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
      : process.env.DATABASE_URL;

  if (!url) {
    throw new Error(kind === "migration" ? "DATABASE_MIGRATION_URL or DATABASE_URL is required." : "DATABASE_URL is required.");
  }

  return url;
}

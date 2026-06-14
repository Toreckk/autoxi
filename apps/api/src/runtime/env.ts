import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

let loaded = false;

export function loadApiEnv(): void {
  if (loaded) return;
  loaded = true;

  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}

export function getCorsOrigins(): string[] {
  loadApiEnv();

  return (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  if (getCorsOrigins().includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  }

  return false;
}

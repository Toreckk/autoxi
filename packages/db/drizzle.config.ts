import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(here, "../..", ".env.local");

if (existsSync(rootEnv)) {
  config({ path: rootEnv });
}

const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required for Drizzle commands.");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString
  }
});

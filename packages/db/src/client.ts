import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { getDatabaseUrl } from "./env.js";

export type AutoxiDb = ReturnType<typeof createDb>;

export function createDb(connectionString = getDatabaseUrl("app")) {
  return createDbClient(connectionString).db;
}

export function createDbClient(connectionString = getDatabaseUrl("app")) {
  const client = postgres(connectionString, {
    max: 10,
    prepare: false
  });

  return {
    client,
    db: drizzle(client, { schema })
  };
}

export function createMigrationClient(connectionString = getDatabaseUrl("migration")) {
  return postgres(connectionString, {
    max: 1,
    prepare: false
  });
}

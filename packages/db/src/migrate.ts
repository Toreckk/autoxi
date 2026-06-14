import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMigrationClient } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../migrations");

async function migrate() {
  const client = createMigrationClient();

  try {
    await client`
      CREATE TABLE IF NOT EXISTS __autoxi_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of migrationFiles) {
      const id = file.replace(/\.sql$/, "");
      const [existing] = await client<{ id: string }[]>`
        SELECT id FROM __autoxi_migrations WHERE id = ${id}
      `;

      if (existing) {
        console.info(`[db:migrate] ${id} already applied`);
        continue;
      }

      const sql = await readFile(resolve(migrationsDir, file), "utf8");

      await client.begin(async (tx) => {
        await tx.unsafe(sql);
        await tx`
          INSERT INTO __autoxi_migrations (id)
          VALUES (${id})
        `;
      });

      console.info(`[db:migrate] applied ${id}`);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error("[db:migrate] failed", error);
  process.exitCode = 1;
});

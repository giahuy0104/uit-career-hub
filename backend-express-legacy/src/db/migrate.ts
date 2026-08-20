import pg from "pg";

import { env } from "../config/env.js";
import { resolveMigrationDatabaseUrl } from "./database-url.js";
import { loadMigrationFiles } from "./migration-files.js";

const { Client } = pg;

type MigrationOptions = {
  databaseUrl?: string;
  log?: (message: string) => void;
};

export async function runMigrations(options: MigrationOptions = {}) {
  const databaseUrl =
    options.databaseUrl ?? resolveMigrationDatabaseUrl(env.databaseUrl, env.databaseUrlDirect);
  const log = options.log ?? console.log;
  const migrations = await loadMigrationFiles();
  const client = new Client({ connectionString: databaseUrl, application_name: "uit-career-hub-migrate" });

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext('uit-career-hub-migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query<{
      version: string;
      checksum: string;
    }>("SELECT version, checksum FROM schema_migrations ORDER BY version");
    const applied = new Map(appliedResult.rows.map((row) => [row.version, row.checksum]));

    for (const migration of migrations) {
      const appliedChecksum = applied.get(migration.version);
      if (appliedChecksum) {
        if (appliedChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.fileName} đã bị thay đổi sau khi áp dụng. Hãy tạo migration mới.`,
          );
        }
        log(`Bỏ qua ${migration.fileName} (đã áp dụng).`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
          [migration.version, migration.name, migration.checksum],
        );
        await client.query("COMMIT");
        log(`Đã áp dụng ${migration.fileName}.`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('uit-career-hub-migrations'))").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

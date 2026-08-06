import { readFile } from "node:fs/promises";
import pg from "pg";

import { env } from "../config/env.js";
import { resolveMigrationDatabaseUrl } from "./database-url.js";
import { getDatabaseDirectory } from "./migration-files.js";

const { Client } = pg;

export async function seedDevelopmentDatabase() {
  if (env.nodeEnv === "production") {
    throw new Error("Không được chạy development seed trong NODE_ENV=production.");
  }

  const databaseUrl = resolveMigrationDatabaseUrl(env.databaseUrl, env.databaseUrlDirect);
  const sql = await readFile(`${getDatabaseDirectory("seeds")}/development.sql`, "utf8");
  const client = new Client({ connectionString: databaseUrl, application_name: "uit-career-hub-seed" });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Đã nạp dữ liệu demo development.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDevelopmentDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

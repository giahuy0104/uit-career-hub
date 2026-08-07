import { readFile } from "node:fs/promises";
import pg from "pg";

import { env } from "../config/env.js";
import { resolveMigrationDatabaseUrl } from "./database-url.js";
import { getDatabaseDirectory } from "./migration-files.js";

const { Client } = pg;

type DemoResetOptions = {
  databaseUrl?: string;
  allowReset?: boolean;
  log?: (message: string) => void;
};

function describeDatabaseTarget(databaseUrl: string) {
  const target = new URL(databaseUrl);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, "")) || "(default)";
  return `${target.hostname}/${databaseName}`;
}

export async function resetDemoDatabase(options: DemoResetOptions = {}) {
  const allowReset = options.allowReset ?? env.allowDemoReset;
  if (env.nodeEnv === "production") {
    throw new Error("Không được reset dữ liệu demo trong NODE_ENV=production.");
  }
  if (!allowReset) {
    throw new Error("Demo reset đang bị khóa. Đặt ALLOW_DEMO_RESET=true sau khi kiểm tra đúng database development.");
  }

  const databaseUrl = options.databaseUrl
    ?? resolveMigrationDatabaseUrl(env.databaseUrl, env.databaseUrlDirect);
  const resetSql = await readFile(`${getDatabaseDirectory("seeds")}/demo-reset.sql`, "utf8");
  const developmentSql = await readFile(`${getDatabaseDirectory("seeds")}/development.sql`, "utf8");
  const client = new Client({ connectionString: databaseUrl, application_name: "uit-career-hub-demo-reset" });
  const log = options.log ?? console.log;

  log(`Mục tiêu demo reset: ${describeDatabaseTarget(databaseUrl)}`);
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('uit-career-hub-demo-reset'))");
    await client.query(resetSql);
    await client.query(developmentSql);
    await client.query("COMMIT");
    log("Đã đưa dữ liệu demo về checkpoint ban đầu.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("demo-reset.ts") || process.argv[1]?.endsWith("demo-reset.js")) {
  resetDemoDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

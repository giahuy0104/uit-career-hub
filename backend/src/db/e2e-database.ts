import pg from "pg";

import { env } from "../config/env.js";
import { resetDemoDatabase } from "./demo-reset.js";
import { isLocalDatabaseUrl } from "./database-url.js";
import { runMigrations } from "./migrate.js";

const { Client } = pg;

type E2eDatabaseOptions = {
  databaseUrl?: string;
  allowReset?: boolean;
  runtimeDatabaseUrls?: Array<string | undefined>;
  log?: (message: string) => void;
};

function databaseIdentity(value: string) {
  const parsed = new URL(value);
  const port = parsed.port || "5432";
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  return `${parsed.hostname.toLowerCase()}:${port}/${databaseName.toLowerCase()}`;
}

function databaseName(value: string) {
  return decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
}

export function assertSafeE2eDatabaseTarget(options: E2eDatabaseOptions = {}) {
  const target = options.databaseUrl ?? env.databaseUrlE2e;
  const allowReset = options.allowReset ?? env.allowE2eReset;

  if (env.nodeEnv === "production") {
    throw new Error("Không được provision hoặc reset database E2E trong NODE_ENV=production.");
  }
  if (!allowReset) {
    throw new Error("E2E reset đang bị khóa. Đặt ALLOW_E2E_RESET=true sau khi kiểm tra đúng database E2E.");
  }
  if (!target) {
    throw new Error("DATABASE_URL_E2E là bắt buộc; tuyệt đối không fallback sang database runtime.");
  }

  const targetName = databaseName(target);
  if (!/^[a-z0-9_\-]*e2e[a-z0-9_\-]*$/i.test(targetName)) {
    throw new Error("Tên database E2E phải chứa 'e2e' để ngăn reset nhầm database khác.");
  }

  const targetIdentity = databaseIdentity(target);
  const protectedUrls = options.runtimeDatabaseUrls ?? [
    env.databaseUrl,
    env.databaseUrlDirect,
    env.databaseUrlTest,
  ];
  if (protectedUrls.filter(Boolean).some((value) => databaseIdentity(value!) === targetIdentity)) {
    throw new Error("DATABASE_URL_E2E phải tách biệt với DATABASE_URL, DATABASE_URL_DIRECT và DATABASE_URL_TEST.");
  }

  return target;
}

export async function provisionE2eDatabase(options: E2eDatabaseOptions = {}) {
  const databaseUrl = assertSafeE2eDatabaseTarget(options);
  const log = options.log ?? console.log;
  const targetName = databaseName(databaseUrl);

  if (!isLocalDatabaseUrl(databaseUrl)) {
    const client = new Client({ connectionString: databaseUrl, application_name: "uit-career-hub-e2e-check" });
    await client.connect();
    await client.end();
    log(`Database E2E từ xa đã tồn tại: ${new URL(databaseUrl).hostname}/${targetName}.`);
    return;
  }

  if (!/^[a-z0-9_]+$/i.test(targetName)) {
    throw new Error("Tên database E2E local chỉ được chứa chữ, số và dấu gạch dưới.");
  }

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";
  const client = new Client({
    connectionString: maintenanceUrl.toString(),
    application_name: "uit-career-hub-e2e-provision",
  });

  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetName]);
    if (existing.rowCount) {
      log(`Database E2E local đã tồn tại: ${targetName}.`);
      return;
    }
    await client.query(`CREATE DATABASE "${targetName}"`);
    log(`Đã tạo database E2E local: ${targetName}.`);
  } finally {
    await client.end();
  }
}

export async function resetE2eDatabase(options: E2eDatabaseOptions = {}) {
  const databaseUrl = assertSafeE2eDatabaseTarget(options);
  const log = options.log ?? console.log;

  await runMigrations({ databaseUrl, log });
  await resetDemoDatabase({
    databaseUrl,
    allowReset: true,
    log,
    objectStorage: null,
  });
  log(`Database E2E đã sẵn sàng: ${new URL(databaseUrl).hostname}/${databaseName(databaseUrl)}.`);
}

const entrypoint = process.argv[1] ?? "";
if (entrypoint.endsWith("e2e-database.ts") || entrypoint.endsWith("e2e-database.js")) {
  const command = process.argv[2];
  const task = command === "provision" ? provisionE2eDatabase : command === "reset" ? resetE2eDatabase : null;
  if (!task) {
    console.error("Cách dùng: e2e-database.ts <provision|reset>");
    process.exitCode = 1;
  } else {
    task().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}

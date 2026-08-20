import { readFile } from "node:fs/promises";
import pg from "pg";

import { env } from "../config/env.js";
import type { ObjectStorage } from "../modules/storage/object-storage.js";
import { R2ObjectStorage } from "../modules/storage/r2-object-storage.js";
import { resolveMigrationDatabaseUrl } from "./database-url.js";
import { getDatabaseDirectory } from "./migration-files.js";

const { Client } = pg;

type DemoResetOptions = {
  databaseUrl?: string;
  allowReset?: boolean;
  log?: (message: string) => void;
  objectStorage?: ObjectStorage | null;
};

const demoOfferStorageKeysSql = `
  SELECT DISTINCT odu.storage_key
  FROM offer_document_uploads odu
  JOIN applications a ON a.id = odu.application_id
  WHERE odu.created_by_user_id IN (
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000102',
          '00000000-0000-4000-8000-000000000103'
        )
     OR odu.company_id IN (
          '00000000-0000-4000-8000-000000001001',
          '00000000-0000-4000-8000-000000001002'
        )
     OR a.student_profile_id IN (
          '00000000-0000-4000-8000-000000002001',
          '00000000-0000-4000-8000-000000002002',
          '00000000-0000-4000-8000-000000002003'
        )
`;

function configuredObjectStorage() {
  if (!env.objectStorageEnabled) return null;
  return new R2ObjectStorage({
    accountId: env.r2AccountId!,
    accessKeyId: env.r2AccessKeyId!,
    secretAccessKey: env.r2SecretAccessKey!,
    bucket: env.r2Bucket!,
  });
}

export async function cleanupDemoOfferObjects(
  storageKeys: string[],
  objectStorage: ObjectStorage | null,
  log: (message: string) => void,
) {
  if (storageKeys.length === 0) return;
  if (!objectStorage) {
    log(`Cảnh báo: đã xóa metadata nhưng chưa dọn ${storageKeys.length} object offer vì R2 đang tắt.`);
    return;
  }
  const results = await Promise.allSettled(storageKeys.map((key) => objectStorage.deleteObject(key)));
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    log(`Cảnh báo: không thể dọn ${failed}/${storageKeys.length} object offer demo trên R2.`);
    return;
  }
  log(`Đã dọn ${storageKeys.length} object offer demo trên R2.`);
}

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
  let offerStorageKeys: string[] = [];
  try {
    const offerObjects = await client.query<{ storage_key: string }>(demoOfferStorageKeysSql);
    offerStorageKeys = offerObjects.rows.map((row) => row.storage_key);
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
  await cleanupDemoOfferObjects(
    offerStorageKeys,
    options.objectStorage === undefined ? configuredObjectStorage() : options.objectStorage,
    log,
  );
}

if (process.argv[1]?.endsWith("demo-reset.ts") || process.argv[1]?.endsWith("demo-reset.js")) {
  resetDemoDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { env } from "../config/env.js";
import { isLocalDatabaseUrl } from "./database-url.js";
import { loadMigrationFiles } from "./migration-files.js";

const { Client } = pg;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultReportDirectory = resolve(currentDirectory, "../../../artifacts/backup-restore");
const safeSourceLabelPattern = /test|staging|preview|e2e|demo|nonprod/i;
const safeTargetLabelPattern = /restore|drill/i;

type DrillOptions = {
  sourceUrl?: string;
  targetUrl?: string;
  sourceLabel?: string;
  targetLabel?: string;
  allowRestore?: boolean;
  provisionLocalTarget?: boolean;
  toolsDockerContainer?: string;
  toolsDockerImage?: string;
  reportDirectory?: string;
  protectedUrls?: Array<string | undefined>;
  log?: (message: string) => void;
};

type DatabaseSnapshot = {
  migrations: Array<{ version: string; checksum: string }>;
  tableCounts: Record<string, number>;
};

function parseDatabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error();
    return parsed;
  } catch {
    throw new Error("Backup/restore drill yêu cầu connection string PostgreSQL hợp lệ.");
  }
}

function databaseName(value: string) {
  return decodeURIComponent(parseDatabaseUrl(value).pathname.replace(/^\//, ""));
}

export function databaseIdentity(value: string) {
  const parsed = parseDatabaseUrl(value);
  return `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${databaseName(value).toLowerCase()}`;
}

export function assertSafeBackupRestoreDrill(options: DrillOptions = {}) {
  const sourceUrl = options.sourceUrl ?? process.env.BACKUP_RESTORE_SOURCE_URL;
  const targetUrl = options.targetUrl ?? process.env.BACKUP_RESTORE_TARGET_URL;
  const sourceLabel = options.sourceLabel ?? process.env.BACKUP_RESTORE_SOURCE_LABEL ?? "";
  const targetLabel = options.targetLabel ?? process.env.BACKUP_RESTORE_TARGET_LABEL ?? "";
  const allowRestore = options.allowRestore ?? process.env.ALLOW_BACKUP_RESTORE_DRILL === "true";

  if (env.nodeEnv === "production") {
    throw new Error("Không được chạy backup/restore drill trong NODE_ENV=production.");
  }
  if (!allowRestore) {
    throw new Error("Restore drill đang bị khóa. Đặt ALLOW_BACKUP_RESTORE_DRILL=true sau khi xác minh hai database test.");
  }
  if (!sourceUrl || !targetUrl) {
    throw new Error("BACKUP_RESTORE_SOURCE_URL và BACKUP_RESTORE_TARGET_URL là bắt buộc.");
  }
  if (!safeSourceLabelPattern.test(sourceLabel)) {
    throw new Error("BACKUP_RESTORE_SOURCE_LABEL phải chỉ rõ test/staging/preview/e2e/demo/nonprod.");
  }
  if (!safeTargetLabelPattern.test(targetLabel)) {
    throw new Error("BACKUP_RESTORE_TARGET_LABEL phải chứa restore hoặc drill.");
  }

  const sourceIdentity = databaseIdentity(sourceUrl);
  const targetIdentity = databaseIdentity(targetUrl);
  if (sourceIdentity === targetIdentity) {
    throw new Error("Database restore target phải khác database source.");
  }
  if (["postgres", "template0", "template1"].includes(databaseName(targetUrl).toLowerCase())) {
    throw new Error("Không được restore vào database maintenance/template.");
  }
  if (isLocalDatabaseUrl(targetUrl) && !safeTargetLabelPattern.test(databaseName(targetUrl))) {
    throw new Error("Tên database restore local phải chứa restore hoặc drill.");
  }

  const protectedUrls = options.protectedUrls ?? [
    env.databaseUrl,
    env.databaseUrlDirect,
    env.databaseUrlTest,
    env.databaseUrlE2e,
  ];
  if (protectedUrls.filter(Boolean).some((value) => databaseIdentity(value!) === targetIdentity)) {
    throw new Error("Restore target trùng database runtime/direct/test/E2E đang được bảo vệ.");
  }

  const toolsDockerContainer = options.toolsDockerContainer ?? process.env.POSTGRES_TOOLS_DOCKER_CONTAINER;
  const toolsDockerImage = options.toolsDockerImage ?? process.env.POSTGRES_TOOLS_DOCKER_IMAGE;
  if (toolsDockerContainer && toolsDockerImage) {
    throw new Error("Chỉ chọn một trong POSTGRES_TOOLS_DOCKER_CONTAINER hoặc POSTGRES_TOOLS_DOCKER_IMAGE.");
  }
  if (toolsDockerContainer && !/^[A-Za-z0-9_.-]+$/.test(toolsDockerContainer)) {
    throw new Error("POSTGRES_TOOLS_DOCKER_CONTAINER không hợp lệ.");
  }
  if (toolsDockerImage && !/^[A-Za-z0-9./:_-]+$/.test(toolsDockerImage)) {
    throw new Error("POSTGRES_TOOLS_DOCKER_IMAGE không hợp lệ.");
  }

  return {
    sourceUrl,
    targetUrl,
    sourceLabel,
    targetLabel,
    toolsDockerContainer,
    toolsDockerImage,
  };
}

function postgresEnvironment(databaseUrl: string, dockerUsesHostGateway = false) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const sslMode = parsed.searchParams.get("sslmode");
  return {
    PGHOST: dockerUsesHostGateway && isLocalDatabaseUrl(databaseUrl)
      ? "host.docker.internal"
      : parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: databaseName(databaseUrl),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    ...(sslMode ? { PGSSLMODE: sslMode } : {}),
    ...(parsed.hostname.endsWith(".neon.tech") && sslMode === "verify-full"
      ? { PGSSLROOTCERT: "system" }
      : {}),
  };
}

async function runCommand(
  executable: string,
  argumentsList: string[],
  commandEnvironment: Record<string, string>,
) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(executable, argumentsList, {
      env: { ...process.env, ...commandEnvironment },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4_096);
    });
    child.once("error", (error) => {
      reject(new Error(`Không thể chạy ${executable}: ${error.message}`));
    });
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${executable} thất bại (exit ${code ?? "unknown"}): ${stderr.trim()}`));
    });
  });
}

function dockerEnvironmentArguments(commandEnvironment: Record<string, string>) {
  return Object.keys(commandEnvironment).flatMap((key) => ["--env", key]);
}

async function runDockerImageTool(
  image: string,
  temporaryDirectory: string,
  commandEnvironment: Record<string, string>,
  tool: "pg_dump" | "pg_restore",
  argumentsList: string[],
) {
  await runCommand("docker", [
    "run",
    "--rm",
    "--add-host",
    "host.docker.internal:host-gateway",
    ...dockerEnvironmentArguments(commandEnvironment),
    "--volume",
    `${temporaryDirectory}:/work`,
    image,
    tool,
    ...argumentsList,
  ], commandEnvironment);
}

async function ensureLocalTargetDatabase(databaseUrl: string) {
  if (!isLocalDatabaseUrl(databaseUrl)) return;
  const targetName = databaseName(databaseUrl);
  if (!/^[A-Za-z0-9_]+$/.test(targetName) || !safeTargetLabelPattern.test(targetName)) {
    throw new Error("Tên database restore local không an toàn để provision.");
  }

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";
  const client = new Client({
    connectionString: maintenanceUrl.toString(),
    application_name: "uit-career-hub-backup-restore-provision",
  });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetName]);
    if (!existing.rowCount) await client.query(`CREATE DATABASE "${targetName}"`);
  } finally {
    await client.end();
  }
}

async function snapshotDatabase(databaseUrl: string): Promise<DatabaseSnapshot> {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "uit-career-hub-backup-restore-verify",
  });
  await client.connect();
  try {
    const migrations = await client.query<{ version: string; checksum: string }>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version",
    );
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const tableCounts: Record<string, number> = {};
    for (const { tablename } of tables.rows) {
      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${client.escapeIdentifier(tablename)}`,
      );
      tableCounts[tablename] = Number(count.rows[0]?.count ?? 0);
    }
    return { migrations: migrations.rows, tableCounts };
  } finally {
    await client.end();
  }
}

async function sha256(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function cleanupTemporaryDirectory(directory: string) {
  const resolvedDirectory = resolve(directory);
  const resolvedTemp = resolve(tmpdir());
  if (!resolvedDirectory.startsWith(`${resolvedTemp}\\`) && !resolvedDirectory.startsWith(`${resolvedTemp}/`)) {
    throw new Error("Từ chối xóa temporary directory nằm ngoài OS temp.");
  }
  if (!basename(resolvedDirectory).startsWith("uit-career-hub-backup-drill-")) {
    throw new Error("Từ chối xóa temporary directory không đúng prefix an toàn.");
  }
  await rm(resolvedDirectory, { recursive: true, force: true });
}

export async function runBackupRestoreDrill(options: DrillOptions = {}) {
  const safe = assertSafeBackupRestoreDrill(options);
  const log = options.log ?? console.log;
  const reportDirectory = options.reportDirectory ?? defaultReportDirectory;
  const provisionLocalTarget = options.provisionLocalTarget
    ?? process.env.BACKUP_RESTORE_PROVISION_LOCAL === "true";
  const startedAt = new Date();
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "uit-career-hub-backup-drill-"));
  const hostArchivePath = join(temporaryDirectory, "backup.dump");
  const containerArchivePath = `/tmp/uit-career-hub-backup-drill-${randomUUID()}.dump`;

  log(`Backup source: ${databaseIdentity(safe.sourceUrl)} (${safe.sourceLabel}).`);
  log(`Restore target: ${databaseIdentity(safe.targetUrl)} (${safe.targetLabel}).`);

  try {
    if (provisionLocalTarget) await ensureLocalTargetDatabase(safe.targetUrl);
    const sourceSnapshot = await snapshotDatabase(safe.sourceUrl);
    const expectedMigrations = (await loadMigrationFiles()).map(({ version, checksum }) => ({
      version,
      checksum,
    }));
    const sourceSchemaCurrent = JSON.stringify(sourceSnapshot.migrations) === JSON.stringify(expectedMigrations);
    if (!sourceSchemaCurrent) {
      throw new Error(
        `Backup source chưa khớp migration contract: ${sourceSnapshot.migrations.length}/${expectedMigrations.length} migrations.`,
      );
    }
    const sourceEnvironment = postgresEnvironment(safe.sourceUrl, Boolean(safe.toolsDockerImage));
    const targetEnvironment = postgresEnvironment(safe.targetUrl, Boolean(safe.toolsDockerImage));
    const dumpStartedAt = Date.now();

    if (safe.toolsDockerImage) {
      await runDockerImageTool(
        safe.toolsDockerImage,
        temporaryDirectory,
        sourceEnvironment,
        "pg_dump",
        [
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          "--file",
          "/work/backup.dump",
        ],
      );
    } else if (safe.toolsDockerContainer) {
      await runCommand("docker", [
        "exec",
        ...dockerEnvironmentArguments(sourceEnvironment),
        safe.toolsDockerContainer,
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        containerArchivePath,
      ], sourceEnvironment);
      await runCommand("docker", [
        "cp",
        `${safe.toolsDockerContainer}:${containerArchivePath}`,
        hostArchivePath,
      ], {});
    } else {
      await runCommand("pg_dump", [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        hostArchivePath,
      ], sourceEnvironment);
    }

    const dumpCompletedAt = Date.now();
    const restoreStartedAt = Date.now();
    if (safe.toolsDockerImage) {
      await runDockerImageTool(
        safe.toolsDockerImage,
        temporaryDirectory,
        targetEnvironment,
        "pg_restore",
        [
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-privileges",
          "--exit-on-error",
          "--dbname",
          targetEnvironment.PGDATABASE,
          "/work/backup.dump",
        ],
      );
    } else if (safe.toolsDockerContainer) {
      await runCommand("docker", [
        "exec",
        ...dockerEnvironmentArguments(targetEnvironment),
        safe.toolsDockerContainer,
        "pg_restore",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--dbname",
        targetEnvironment.PGDATABASE,
        containerArchivePath,
      ], targetEnvironment);
    } else {
      await runCommand("pg_restore", [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--dbname",
        targetEnvironment.PGDATABASE,
        hostArchivePath,
      ], targetEnvironment);
    }
    const restoreCompletedAt = Date.now();
    const targetSnapshot = await snapshotDatabase(safe.targetUrl);
    const countsMatched = JSON.stringify(sourceSnapshot.tableCounts) === JSON.stringify(targetSnapshot.tableCounts);
    const migrationsMatched = JSON.stringify(sourceSnapshot.migrations) === JSON.stringify(targetSnapshot.migrations);
    if (!countsMatched || !migrationsMatched) {
      throw new Error("Restore verification thất bại: migration hoặc row count không khớp source.");
    }

    const archiveStat = await stat(hostArchivePath);
    const finishedAt = new Date();
    const report = {
      schemaVersion: 1,
      status: "PASSED",
      source: { identity: databaseIdentity(safe.sourceUrl), label: safe.sourceLabel },
      target: { identity: databaseIdentity(safe.targetUrl), label: safe.targetLabel },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSeconds: Number(((finishedAt.getTime() - startedAt.getTime()) / 1_000).toFixed(3)),
      dumpSeconds: Number(((dumpCompletedAt - dumpStartedAt) / 1_000).toFixed(3)),
      restoreSeconds: Number(((restoreCompletedAt - restoreStartedAt) / 1_000).toFixed(3)),
      archive: { bytes: archiveStat.size, sha256: await sha256(hostArchivePath), retained: false },
      verification: {
        sourceSchemaCurrent,
        migrationsMatched,
        tableCountsMatched: countsMatched,
        expectedMigrationCount: expectedMigrations.length,
        migrationCount: sourceSnapshot.migrations.length,
        tableCount: Object.keys(sourceSnapshot.tableCounts).length,
        tableCounts: sourceSnapshot.tableCounts,
      },
    } as const;

    await mkdir(reportDirectory, { recursive: true });
    const reportPath = join(
      reportDirectory,
      `${startedAt.toISOString().replace(/[:.]/g, "-")}-${safe.targetLabel.replace(/[^A-Za-z0-9_-]/g, "-")}.json`,
    );
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    log(`Backup/restore drill PASSED. Evidence: ${reportPath}`);
    return { report, reportPath };
  } finally {
    if (safe.toolsDockerContainer) {
      await runCommand("docker", ["exec", safe.toolsDockerContainer, "rm", "-f", containerArchivePath], {})
        .catch(() => undefined);
    }
    await cleanupTemporaryDirectory(temporaryDirectory);
  }
}

const entrypoint = process.argv[1] ?? "";
if (entrypoint.endsWith("backup-restore-drill.ts") || entrypoint.endsWith("backup-restore-drill.js")) {
  runBackupRestoreDrill().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

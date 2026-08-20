import { readFile } from "node:fs/promises";
import pg from "pg";

import { isLocalDatabaseUrl } from "../db/database-url.js";

const { Client } = pg;

export const demoAccountEmails = [
  "admin.career@uit.edu.vn",
  "20521067@student.uit.edu.vn",
  "21520881@student.uit.edu.vn",
  "recruiter@vng.example",
  "recruiter@fpt.example",
] as const;

export type ReadinessCheck = {
  id: string;
  passed: boolean;
  detail: string;
};

function check(id: string, passed: boolean, success: string, failure: string): ReadinessCheck {
  return { id, passed, detail: passed ? success : failure };
}

function isPlaceholder(value: string | undefined) {
  return !value || /replace|change[-_ ]?me|development|example|demo|test|password/i.test(value);
}

function isStrongSecret(value: string | undefined) {
  return Boolean(value && value.length >= 32 && !isPlaceholder(value));
}

function isHttps(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function databaseCheck(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || isLocalDatabaseUrl(value)) return false;
    if (parsed.hostname.endsWith(".neon.tech")) {
      return ["require", "verify-full"].includes(parsed.searchParams.get("sslmode") ?? "");
    }
    return true;
  } catch {
    return false;
  }
}

function rotationIsRecent(value: string | undefined, now = new Date()) {
  if (!value) return false;
  const rotatedAt = new Date(value);
  const ageMs = now.getTime() - rotatedAt.getTime();
  return Number.isFinite(rotatedAt.getTime()) && ageMs >= 0 && ageMs <= 90 * 24 * 60 * 60 * 1_000;
}

export function evaluateProductionEnvironment(
  source: NodeJS.ProcessEnv,
  now = new Date(),
): ReadinessCheck[] {
  const jwtSecret = source.JWT_ACCESS_SECRET;
  const cronSecret = source.CRON_SECRET;
  const emailEnabled = source.EMAIL_ENABLED === "true";
  const storageConfigured = [
    source.R2_ACCOUNT_ID,
    source.R2_ACCESS_KEY_ID,
    source.R2_SECRET_ACCESS_KEY,
    source.R2_BUCKET,
  ].every(Boolean);

  return [
    check("environment.production", source.NODE_ENV === "production", "NODE_ENV=production.", "NODE_ENV phải là production."),
    check(
      "demo.frontend_hidden",
      source.VITE_SHOW_DEMO_ACCOUNTS !== "true",
      "Frontend không yêu cầu hiển thị demo accounts.",
      "VITE_SHOW_DEMO_ACCOUNTS không được là true.",
    ),
    check(
      "demo.reset_disabled",
      source.ALLOW_DEMO_RESET !== "true" && source.ALLOW_E2E_RESET !== "true",
      "Demo/E2E reset đã tắt.",
      "ALLOW_DEMO_RESET và ALLOW_E2E_RESET phải tắt.",
    ),
    check("secret.jwt", isStrongSecret(jwtSecret), "JWT secret đạt gate.", "JWT secret thiếu, yếu hoặc có dấu hiệu placeholder."),
    check("secret.cron", isStrongSecret(cronSecret), "Cron secret đạt gate.", "Cron secret thiếu, yếu hoặc có dấu hiệu placeholder."),
    check(
      "secret.separation",
      Boolean(jwtSecret && cronSecret && jwtSecret !== cronSecret),
      "JWT và Cron dùng secret riêng.",
      "JWT và Cron secret phải khác nhau.",
    ),
    check(
      "secret.rotation_evidence",
      rotationIsRecent(source.PRODUCTION_SECRETS_ROTATED_AT, now),
      "Có bằng chứng rotate secret trong 90 ngày.",
      "PRODUCTION_SECRETS_ROTATED_AT thiếu, không hợp lệ hoặc quá 90 ngày.",
    ),
    check("cookie.secure", source.AUTH_COOKIE_SECURE === "true", "Cookie Secure đã bật.", "AUTH_COOKIE_SECURE phải là true."),
    check("origin.cors_https", isHttps(source.CORS_ORIGIN), "CORS origin dùng HTTPS.", "CORS_ORIGIN phải là HTTPS."),
    check("origin.public_https", isHttps(source.PUBLIC_APP_URL), "Public app URL dùng HTTPS.", "PUBLIC_APP_URL phải là HTTPS."),
    check(
      "database.runtime",
      databaseCheck(source.DATABASE_URL),
      "Runtime database là PostgreSQL remote an toàn.",
      "DATABASE_URL phải là remote PostgreSQL; Neon bắt buộc SSL.",
    ),
    check(
      "database.test_urls_absent",
      !source.DATABASE_URL_TEST && !source.DATABASE_URL_E2E,
      "Không có test/E2E URL trong production.",
      "Không được cấu hình DATABASE_URL_TEST/DATABASE_URL_E2E trên production.",
    ),
    check(
      "monitor.webhook_https",
      isHttps(source.ERROR_MONITOR_WEBHOOK_URL),
      "Error monitor HTTPS đã cấu hình.",
      "ERROR_MONITOR_WEBHOOK_URL HTTPS là bắt buộc trước go-live.",
    ),
    check(
      "storage.private_r2",
      source.OBJECT_STORAGE_ENABLED === "true" && storageConfigured,
      "Private object storage đã cấu hình.",
      "OBJECT_STORAGE_ENABLED và đủ R2 credentials là bắt buộc.",
    ),
    check(
      "email.safe_configuration",
      !emailEnabled || (
        Boolean(source.RESEND_API_KEY?.startsWith("re_"))
        && Boolean(source.EMAIL_FROM)
        && !source.EMAIL_FROM?.toLowerCase().includes("onboarding@resend.dev")
        && isHttps(source.PUBLIC_APP_URL)
      ),
      emailEnabled ? "Email sender đạt gate." : "Email đang tắt; không có outbound mail.",
      "Email bật nhưng Resend/sender/domain/public URL chưa an toàn.",
    ),
  ];
}

export async function findActiveDemoAccounts(databaseUrl: string) {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "uit-career-hub-production-readiness",
  });
  await client.connect();
  try {
    const result = await client.query<{ email: string }>(
      `SELECT email
       FROM users
       WHERE lower(email) = ANY($1::text[]) AND status = 'ACTIVE'
       ORDER BY email`,
      [demoAccountEmails],
    );
    return result.rows.map(({ email }) => email);
  } finally {
    await client.end();
  }
}

export async function verifyNeonRestoreEvidence(path: string | undefined, now = new Date()): Promise<ReadinessCheck> {
  if (!path) {
    return check("recovery.neon_restore", false, "", "Thiếu BACKUP_RESTORE_EVIDENCE_PATH.");
  }
  try {
    const report = JSON.parse(await readFile(path, "utf8")) as {
      status?: string;
      finishedAt?: string;
      source?: { identity?: string; label?: string };
      target?: { label?: string };
      verification?: {
        sourceSchemaCurrent?: boolean;
        migrationsMatched?: boolean;
        tableCountsMatched?: boolean;
      };
    };
    const finishedAt = new Date(report.finishedAt ?? "");
    const ageMs = now.getTime() - finishedAt.getTime();
    const recent = Number.isFinite(finishedAt.getTime()) && ageMs >= 0 && ageMs <= 30 * 24 * 60 * 60 * 1_000;
    const passed = report.status === "PASSED"
      && recent
      && report.source?.identity?.includes(".neon.tech:") === true
      && /test|staging|preview|nonprod/i.test(report.source?.label ?? "")
      && /restore|drill/i.test(report.target?.label ?? "")
      && report.verification?.sourceSchemaCurrent === true
      && report.verification?.migrationsMatched === true
      && report.verification?.tableCountsMatched === true;
    return check(
      "recovery.neon_restore",
      passed,
      "Neon test-branch restore drill trong 30 ngày đã PASS.",
      "Evidence phải là restore PASS trong 30 ngày trên Neon non-production branch.",
    );
  } catch {
    return check("recovery.neon_restore", false, "", "Không thể đọc/kiểm tra backup restore evidence.");
  }
}

export async function runProductionReadiness(source: NodeJS.ProcessEnv = process.env) {
  const checks = evaluateProductionEnvironment(source);
  checks.push(await verifyNeonRestoreEvidence(source.BACKUP_RESTORE_EVIDENCE_PATH));

  if (source.DATABASE_URL) {
    try {
      const activeDemoAccounts = await findActiveDemoAccounts(source.DATABASE_URL);
      checks.push(check(
        "demo.database_accounts_disabled",
        activeDemoAccounts.length === 0,
        "Không còn demo account ACTIVE trong database.",
        `Còn ${activeDemoAccounts.length} demo account ACTIVE trong database.`,
      ));
    } catch {
      checks.push(check(
        "demo.database_accounts_disabled",
        false,
        "",
        "Không thể thực hiện read-only check demo accounts.",
      ));
    }
  }

  for (const item of checks) {
    console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id} - ${item.detail}`);
  }
  const failed = checks.filter(({ passed }) => !passed);
  if (failed.length > 0) throw new Error(`Production readiness thất bại: ${failed.length}/${checks.length} checks chưa đạt.`);
  return checks;
}

const entrypoint = process.argv[1] ?? "";
if (entrypoint.endsWith("production-readiness.ts") || entrypoint.endsWith("production-readiness.js")) {
  runProductionReadiness().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

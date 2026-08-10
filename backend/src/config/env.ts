import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, "../../../.env") });

const optionalDatabaseUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional(),
);

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return value === "true";
}, z.boolean().optional());

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub"),
  DATABASE_URL_DIRECT: optionalDatabaseUrl,
  DATABASE_URL_TEST: optionalDatabaseUrl,
  DATABASE_URL_E2E: optionalDatabaseUrl,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(10),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().min(1).default("uit-career-hub-api"),
  JWT_AUDIENCE: z.string().min(1).default("uit-career-hub-web"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  AUTH_COOKIE_NAME: z.string().min(1).default("uit_refresh_token"),
  AUTH_COOKIE_SECURE: optionalBoolean,
  AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  UIT_EMAIL_DOMAINS: z.string().min(1).default("student.uit.edu.vn,uit.edu.vn"),
  ALLOW_DEMO_RESET: optionalBoolean.default(false),
  ALLOW_E2E_RESET: optionalBoolean.default(false),
  CRON_SECRET: optionalSecret,
  EMAIL_ENABLED: optionalBoolean.default(false),
  RESEND_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().startsWith("re_", "RESEND_API_KEY phải bắt đầu bằng re_.").optional(),
  ),
  EMAIL_FROM: optionalString,
  PUBLIC_APP_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  EMAIL_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  OBJECT_STORAGE_ENABLED: optionalBoolean.default(false),
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  OBJECT_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  OBJECT_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
});

function assertPostgresUrl(value: string, key: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} không phải connection string hợp lệ.`);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${key} phải dùng giao thức postgresql:// hoặc postgres://.`);
  }

  if (parsed.hostname.endsWith(".neon.tech")) {
    const sslMode = parsed.searchParams.get("sslmode");
    if (!sslMode || !["require", "verify-full"].includes(sslMode)) {
      throw new Error(`${key} của Neon phải có sslmode=require hoặc sslmode=verify-full.`);
    }
  }
}

export function parseEnvironment(source: NodeJS.ProcessEnv) {
  const parsed = environmentSchema.parse(source);

  if (parsed.NODE_ENV === "production" && !parsed.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET là bắt buộc trong môi trường production.");
  }

  const jwtAccessSecret =
    parsed.JWT_ACCESS_SECRET ?? "development-only-change-me-32-characters";
  const authCookieSecure = parsed.AUTH_COOKIE_SECURE ?? parsed.NODE_ENV === "production";

  if (parsed.AUTH_COOKIE_SAME_SITE === "none" && !authCookieSecure) {
    throw new Error("AUTH_COOKIE_SAME_SITE=none yêu cầu AUTH_COOKIE_SECURE=true.");
  }

  const uitEmailDomains = parsed.UIT_EMAIL_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  if (uitEmailDomains.length === 0) {
    throw new Error("UIT_EMAIL_DOMAINS phải có ít nhất một tên miền.");
  }

  if (parsed.EMAIL_ENABLED && (!parsed.RESEND_API_KEY || !parsed.EMAIL_FROM)) {
    throw new Error("EMAIL_ENABLED=true yêu cầu RESEND_API_KEY và EMAIL_FROM.");
  }

  if (
    parsed.OBJECT_STORAGE_ENABLED &&
    (!parsed.R2_ACCOUNT_ID || !parsed.R2_ACCESS_KEY_ID || !parsed.R2_SECRET_ACCESS_KEY || !parsed.R2_BUCKET)
  ) {
    throw new Error(
      "OBJECT_STORAGE_ENABLED=true requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.",
    );
  }

  assertPostgresUrl(parsed.DATABASE_URL, "DATABASE_URL");
  if (parsed.DATABASE_URL_DIRECT) {
    assertPostgresUrl(parsed.DATABASE_URL_DIRECT, "DATABASE_URL_DIRECT");
  }
  if (parsed.DATABASE_URL_TEST) {
    assertPostgresUrl(parsed.DATABASE_URL_TEST, "DATABASE_URL_TEST");
  }
  if (parsed.DATABASE_URL_E2E) {
    assertPostgresUrl(parsed.DATABASE_URL_E2E, "DATABASE_URL_E2E");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    backendPort: parsed.BACKEND_PORT,
    corsOrigin: parsed.CORS_ORIGIN,
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlDirect: parsed.DATABASE_URL_DIRECT,
    databaseUrlTest: parsed.DATABASE_URL_TEST,
    databaseUrlE2e: parsed.DATABASE_URL_E2E,
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    jwtAccessSecret,
    jwtIssuer: parsed.JWT_ISSUER,
    jwtAudience: parsed.JWT_AUDIENCE,
    accessTokenTtlSeconds: parsed.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: parsed.REFRESH_TOKEN_TTL_DAYS,
    authCookieName: parsed.AUTH_COOKIE_NAME,
    authCookieSecure,
    authCookieSameSite: parsed.AUTH_COOKIE_SAME_SITE,
    uitEmailDomains,
    allowDemoReset: parsed.ALLOW_DEMO_RESET,
    allowE2eReset: parsed.ALLOW_E2E_RESET,
    cronSecret: parsed.CRON_SECRET,
    emailEnabled: parsed.EMAIL_ENABLED,
    resendApiKey: parsed.RESEND_API_KEY,
    emailFrom: parsed.EMAIL_FROM,
    publicAppUrl: parsed.PUBLIC_APP_URL ?? parsed.CORS_ORIGIN,
    emailBatchSize: parsed.EMAIL_BATCH_SIZE,
    emailMaxAttempts: parsed.EMAIL_MAX_ATTEMPTS,
    objectStorageEnabled: parsed.OBJECT_STORAGE_ENABLED,
    r2AccountId: parsed.R2_ACCOUNT_ID,
    r2AccessKeyId: parsed.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
    r2Bucket: parsed.R2_BUCKET,
    objectUploadUrlTtlSeconds: parsed.OBJECT_UPLOAD_URL_TTL_SECONDS,
    objectDownloadUrlTtlSeconds: parsed.OBJECT_DOWNLOAD_URL_TTL_SECONDS,
  } as const;
}

export const env = parseEnvironment(process.env);

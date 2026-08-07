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
  CRON_SECRET: optionalSecret,
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

  assertPostgresUrl(parsed.DATABASE_URL, "DATABASE_URL");
  if (parsed.DATABASE_URL_DIRECT) {
    assertPostgresUrl(parsed.DATABASE_URL_DIRECT, "DATABASE_URL_DIRECT");
  }
  if (parsed.DATABASE_URL_TEST) {
    assertPostgresUrl(parsed.DATABASE_URL_TEST, "DATABASE_URL_TEST");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    backendPort: parsed.BACKEND_PORT,
    corsOrigin: parsed.CORS_ORIGIN,
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlDirect: parsed.DATABASE_URL_DIRECT,
    databaseUrlTest: parsed.DATABASE_URL_TEST,
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
    cronSecret: parsed.CRON_SECRET,
  } as const;
}

export const env = parseEnvironment(process.env);

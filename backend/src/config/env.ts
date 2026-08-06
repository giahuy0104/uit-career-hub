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
  } as const;
}

export const env = parseEnvironment(process.env);

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../.env") });
config();

const backendPort = Number(process.env.BACKEND_PORT ?? 3000);

if (!Number.isInteger(backendPort) || backendPort <= 0) {
  throw new Error("BACKEND_PORT phải là một số nguyên dương.");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  backendPort,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub",
} as const;


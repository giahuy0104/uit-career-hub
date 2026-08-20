import pg from "pg";

import { env } from "../config/env.js";

const { Pool } = pg;

export function createDatabasePool(databaseUrl = env.databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
    max: env.databasePoolMax,
    idleTimeoutMillis: env.nodeEnv === "production" ? 10_000 : 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: env.nodeEnv === "production",
    application_name: "uit-career-hub-backend",
  });
}

export const databasePool = createDatabasePool();

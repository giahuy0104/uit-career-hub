import pg from "pg";

import { env } from "../config/env.js";

const { Pool } = pg;

export function createDatabasePool(databaseUrl = env.databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "uit-career-hub-backend",
  });
}

export const databasePool = createDatabasePool();

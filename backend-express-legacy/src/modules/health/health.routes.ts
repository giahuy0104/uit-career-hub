import { Router } from "express";
import type { Pool } from "pg";

import { env } from "../../config/env.js";
import { getDatabaseProvider } from "../../db/database-url.js";
import { databasePool } from "../../db/pool.js";

type DatabaseHealthClient = Pick<Pool, "query">;

export function createHealthRouter(client: DatabaseHealthClient = databasePool) {
  const healthRouter = Router();

  healthRouter.get("/", (_request, response) => {
    response.json({
      status: "ok",
      service: "uit-career-hub-backend",
      timestamp: new Date().toISOString(),
    });
  });

  healthRouter.get("/database", async (_request, response) => {
    try {
      await client.query("SELECT 1");
      response.json({
        status: "ok",
        database: "connected",
        provider: getDatabaseProvider(env.databaseUrl),
      });
    } catch {
      response.status(503).json({ status: "degraded", database: "unavailable" });
    }
  });

  return healthRouter;
}

export const healthRouter = createHealthRouter();

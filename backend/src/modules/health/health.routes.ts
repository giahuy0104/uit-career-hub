import { Router } from "express";

import { databasePool } from "../../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.json({
    status: "ok",
    service: "uit-career-hub-backend",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/database", async (_request, response) => {
  try {
    await databasePool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "degraded", database: "unavailable" });
  }
});


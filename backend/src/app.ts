import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Pool } from "pg";

import { env } from "./config/env.js";
import { databasePool } from "./db/pool.js";
import { createHealthRouter } from "./modules/health/health.routes.js";

type AppDependencies = {
  database?: Pick<Pool, "query">;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api", (_request, response) => {
    response.json({ name: "UIT Career Hub API", version: "0.1.0" });
  });
  app.use("/api/health", createHealthRouter(dependencies.database ?? databasePool));

  app.use((_request, response) => {
    response.status(404).json({ message: "Không tìm thấy tài nguyên." });
  });

  return app;
}

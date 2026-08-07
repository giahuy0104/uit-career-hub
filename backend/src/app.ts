import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { Pool } from "pg";

import { env } from "./config/env.js";
import { databasePool } from "./db/pool.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { AuthRepository, type AuthDatabase } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { TokenService } from "./modules/auth/token.service.js";
import { ApplicationRepository, type ApplicationDatabase } from "./modules/applications/application.repository.js";
import { createApplicationRouter } from "./modules/applications/application.routes.js";
import { ApplicationService } from "./modules/applications/application.service.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { JobRepository, type JobDatabase } from "./modules/jobs/job.repository.js";
import { createJobRouter } from "./modules/jobs/job.routes.js";
import { JobService } from "./modules/jobs/job.service.js";
import { AppError } from "./shared/app-error.js";

type AppDependencies = {
  database?: Pick<Pool, "query">;
  authDatabase?: AuthDatabase;
  authService?: AuthService;
  tokenService?: TokenService;
  jobDatabase?: JobDatabase;
  jobService?: JobService;
  applicationDatabase?: ApplicationDatabase;
  applicationService?: ApplicationService;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(requestContext);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const tokenService = dependencies.tokenService ?? new TokenService();
  const authService =
    dependencies.authService ??
    new AuthService(new AuthRepository(dependencies.authDatabase ?? databasePool), tokenService);
  const jobService =
    dependencies.jobService ??
    new JobService(new JobRepository(dependencies.jobDatabase ?? databasePool));
  const applicationService =
    dependencies.applicationService ??
    new ApplicationService(
      new ApplicationRepository(dependencies.applicationDatabase ?? databasePool),
    );

  app.get("/api", (_request, response) => {
    response.json({ name: "UIT Career Hub API", version: "0.6.0" });
  });
  app.use("/api/health", createHealthRouter(dependencies.database ?? databasePool));
  app.use("/api/v1/auth", createAuthRouter(authService, tokenService));
  app.use("/api/v1", createJobRouter(jobService, tokenService));
  app.use("/api/v1", createApplicationRouter(applicationService, tokenService));

  app.use((_request, _response, next) => {
    next(new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên."));
  });
  app.use(errorHandler);

  return app;
}

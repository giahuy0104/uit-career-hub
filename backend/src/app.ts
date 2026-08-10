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
import { CompanyRepository, type CompanyDatabase } from "./modules/companies/company.repository.js";
import { createCompanyRouter } from "./modules/companies/company.routes.js";
import { CompanyService } from "./modules/companies/company.service.js";
import { DashboardRepository, type DashboardDatabase } from "./modules/dashboard/dashboard.repository.js";
import { createDashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { DashboardService } from "./modules/dashboard/dashboard.service.js";
import { EmailDeliveryRepository, type EmailDeliveryDatabase } from "./modules/email/email-delivery.repository.js";
import { EmailDeliveryService } from "./modules/email/email-delivery.service.js";
import { ResendEmailProvider } from "./modules/email/resend-email.provider.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { JobRepository, type JobDatabase } from "./modules/jobs/job.repository.js";
import { createJobRouter } from "./modules/jobs/job.routes.js";
import { JobService } from "./modules/jobs/job.service.js";
import { NotificationRepository, type NotificationDatabase } from "./modules/notifications/notification.repository.js";
import { createNotificationRouter } from "./modules/notifications/notification.routes.js";
import { NotificationService } from "./modules/notifications/notification.service.js";
import { ReportingRepository, type ReportingDatabase } from "./modules/reporting/reporting.repository.js";
import { createReportingRouter } from "./modules/reporting/reporting.routes.js";
import { ReportingService } from "./modules/reporting/reporting.service.js";
import { DailyPendingRepository, type DailyPendingDatabase } from "./modules/scheduler/daily-pending.repository.js";
import { createDailyPendingRouter } from "./modules/scheduler/daily-pending.routes.js";
import { DailyPendingService } from "./modules/scheduler/daily-pending.service.js";
import type { ObjectStorage } from "./modules/storage/object-storage.js";
import { R2ObjectStorage } from "./modules/storage/r2-object-storage.js";
import { TaxonomyRepository, type TaxonomyDatabase } from "./modules/taxonomy/taxonomy.repository.js";
import { createTaxonomyRouter } from "./modules/taxonomy/taxonomy.routes.js";
import { TaxonomyService } from "./modules/taxonomy/taxonomy.service.js";
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
  companyDatabase?: CompanyDatabase;
  companyService?: CompanyService;
  dashboardDatabase?: DashboardDatabase;
  dashboardService?: DashboardService;
  notificationDatabase?: NotificationDatabase;
  notificationService?: NotificationService;
  emailDeliveryDatabase?: EmailDeliveryDatabase;
  emailDeliveryService?: EmailDeliveryService;
  dailyPendingDatabase?: DailyPendingDatabase;
  dailyPendingService?: DailyPendingService;
  taxonomyDatabase?: TaxonomyDatabase;
  taxonomyService?: TaxonomyService;
  reportingDatabase?: ReportingDatabase;
  reportingService?: ReportingService;
  cronSecret?: string;
  objectStorage?: ObjectStorage;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable("x-powered-by");
  if (env.nodeEnv === "production") {
    app.set("trust proxy", 1);
  }
  app.use(helmet());
  app.use(cors({
    origin: env.corsOrigin,
    credentials: true,
    exposedHeaders: ["Content-Disposition", "X-Report-Row-Count"],
  }));
  app.use(requestContext);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api/v1", (_request, response, next) => {
    response.setHeader("cache-control", "private, no-store");
    next();
  });

  const tokenService = dependencies.tokenService ?? new TokenService();
  const authService =
    dependencies.authService ??
    new AuthService(new AuthRepository(dependencies.authDatabase ?? databasePool), tokenService);
  const jobService =
    dependencies.jobService ??
    new JobService(new JobRepository(dependencies.jobDatabase ?? databasePool));
  const companyService =
    dependencies.companyService ??
    new CompanyService(
      new CompanyRepository(dependencies.companyDatabase ?? databasePool),
      tokenService,
    );
  const dashboardService =
    dependencies.dashboardService ??
    new DashboardService(
      new DashboardRepository(dependencies.dashboardDatabase ?? dependencies.database ?? databasePool),
    );
  const emailDeliveryService =
    dependencies.emailDeliveryService ??
    new EmailDeliveryService(
      new EmailDeliveryRepository(
        dependencies.emailDeliveryDatabase ?? dependencies.database ?? databasePool,
      ),
      env.emailEnabled
        ? new ResendEmailProvider(env.resendApiKey!, env.emailFrom!)
        : null,
      {
        appBaseUrl: env.publicAppUrl,
        batchSize: env.emailBatchSize,
        maxAttempts: env.emailMaxAttempts,
      },
    );
  const applicationService =
    dependencies.applicationService ??
    new ApplicationService(
      new ApplicationRepository(dependencies.applicationDatabase ?? databasePool),
      emailDeliveryService,
      dependencies.objectStorage ??
        (env.objectStorageEnabled
          ? new R2ObjectStorage({
              accountId: env.r2AccountId!,
              accessKeyId: env.r2AccessKeyId!,
              secretAccessKey: env.r2SecretAccessKey!,
              bucket: env.r2Bucket!,
            })
          : undefined),
      {
        uploadUrlTtlSeconds: env.objectUploadUrlTtlSeconds,
        downloadUrlTtlSeconds: env.objectDownloadUrlTtlSeconds,
      },
    );
  const notificationService =
    dependencies.notificationService ??
    new NotificationService(
      new NotificationRepository(dependencies.notificationDatabase ?? databasePool),
    );
  const dailyPendingService =
    dependencies.dailyPendingService ??
    new DailyPendingService(
      new DailyPendingRepository(dependencies.dailyPendingDatabase ?? databasePool),
      emailDeliveryService,
    );
  const taxonomyService =
    dependencies.taxonomyService ??
    new TaxonomyService(
      new TaxonomyRepository(dependencies.taxonomyDatabase ?? databasePool),
    );
  const reportingService =
    dependencies.reportingService ??
    new ReportingService(
      new ReportingRepository(dependencies.reportingDatabase ?? databasePool),
    );

  app.get("/api", (_request, response) => {
    response.json({ name: "UIT Career Hub API", version: "0.14.0" });
  });
  app.use("/api/health", createHealthRouter(dependencies.database ?? databasePool));
  app.use(
    "/api/v1",
    createDailyPendingRouter(dailyPendingService, dependencies.cronSecret ?? env.cronSecret),
  );
  app.use("/api/v1/auth", createAuthRouter(authService, tokenService));
  app.use("/api/v1", createJobRouter(jobService, tokenService));
  app.use("/api/v1", createCompanyRouter(companyService, tokenService));
  app.use("/api/v1", createDashboardRouter(dashboardService, tokenService));
  app.use("/api/v1", createApplicationRouter(applicationService, tokenService));
  app.use("/api/v1", createNotificationRouter(notificationService, tokenService));
  app.use("/api/v1", createTaxonomyRouter(taxonomyService, tokenService));
  app.use("/api/v1", createReportingRouter(reportingService, tokenService));

  app.use((_request, _response, next) => {
    next(new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên."));
  });
  app.use(errorHandler);

  return app;
}

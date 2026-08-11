import type { Request } from "express";
import { Router } from "express";

import {
  createAuthenticate,
  requireRoles,
  type AccessPrincipalStore,
} from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import { applicationReportExportSchema, applicationReportQuerySchema } from "./reporting.schemas.js";
import { ReportingService } from "./reporting.service.js";

function principal(request: Request) {
  if (!request.auth) {
    throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  }
  return request.auth;
}

function metadata(request: Request) {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get("user-agent")?.slice(0, 512) ?? null,
  };
}

export function createReportingRouter(
  service: ReportingService,
  tokenService: TokenService,
  accessPrincipalStore: AccessPrincipalStore,
) {
  const router = Router();
  router.use(createAuthenticate(tokenService, accessPrincipalStore));
  router.use("/uit/reports", requireRoles("UIT_ADMIN"));

  router.get("/uit/reports/applications", async (request, response) => {
    const query = applicationReportQuerySchema.parse(request.query);
    const result = await service.listApplications(query);
    response.json({
      data: result.items,
      summary: result.summary,
      filterOptions: result.filterOptions,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    });
  });

  router.post("/uit/reports/applications/exports", async (request, response) => {
    const auth = principal(request);
    const file = await service.exportApplications(
      auth.userId,
      applicationReportExportSchema.parse(request.body),
      metadata(request),
    );
    response.status(200);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", `attachment; filename=\"${file.fileName}\"`);
    response.setHeader("content-length", String(file.buffer.length));
    response.setHeader("x-report-row-count", String(file.rowCount));
    response.send(file.buffer);
  });

  return router;
}

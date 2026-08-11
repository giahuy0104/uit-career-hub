import type { Request } from "express";
import { Router } from "express";

import {
  createAuthenticate,
  requireRoles,
  type AccessPrincipalStore,
} from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import { DashboardService } from "./dashboard.service.js";

function principal(request: Request) {
  if (!request.auth) {
    throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  }
  return request.auth;
}

export function createDashboardRouter(
  service: DashboardService,
  tokenService: TokenService,
  accessPrincipalStore: AccessPrincipalStore,
) {
  const router = Router();
  router.use(createAuthenticate(tokenService, accessPrincipalStore));

  router.get("/uit/dashboard", requireRoles("UIT_ADMIN"), async (_request, response) => {
    response.json({ data: await service.adminDashboard() });
  });

  router.get("/companies/me/dashboard", requireRoles("COMPANY"), async (request, response) => {
    response.json({ data: await service.companyDashboard(principal(request).companyId!) });
  });

  router.get("/students/me/dashboard", requireRoles("STUDENT"), async (request, response) => {
    response.json({ data: await service.studentDashboard(principal(request).studentProfileId!) });
  });

  return router;
}

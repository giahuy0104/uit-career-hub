import type { Request } from "express";
import { Router } from "express";

import { createAuthenticate, requireRoles } from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import {
  companyCreateSchema,
  companyIdSchema,
  companyListQuerySchema,
  companyProfileUpdateSchema,
  companyUpdateSchema,
  recruiterCreateSchema,
  recruiterStateChangeSchema,
  recruiterUserIdSchema,
  partnerDirectoryQuerySchema,
  stateChangeSchema,
} from "./company.schemas.js";
import { CompanyService } from "./company.service.js";

function metadata(request: Request) {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get("user-agent")?.slice(0, 512) ?? null,
  };
}
function principal(request: Request) {
  if (!request.auth) {
    throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  }
  return request.auth;
}

function pageMeta(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
}

export function createCompanyRouter(service: CompanyService, tokenService = new TokenService()) {
  const router = Router();
  router.use(createAuthenticate(tokenService));

  router.get("/companies", requireRoles("STUDENT"), async (request, response) => {
    const query = partnerDirectoryQuerySchema.parse(request.query);
    const result = await service.listPartnerDirectory(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.get("/uit/companies", requireRoles("UIT_ADMIN"), async (request, response) => {
    const query = companyListQuerySchema.parse(request.query);
    const result = await service.list(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/uit/companies", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.create(auth.userId, companyCreateSchema.parse(request.body), metadata(request)),
    });
  });

  router.get("/uit/companies/:companyId", requireRoles("UIT_ADMIN"), async (request, response) => {
    response.json({ data: await service.get(companyIdSchema.parse(request.params.companyId)) });
  });

  router.patch("/uit/companies/:companyId", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.update(
        auth.userId,
        companyIdSchema.parse(request.params.companyId),
        companyUpdateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/uit/companies/:companyId/suspend", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    const input = stateChangeSchema.parse(request.body);
    response.json({
      data: await service.suspend(
        auth.userId,
        companyIdSchema.parse(request.params.companyId),
        input.expectedVersion,
        input.reason,
        metadata(request),
      ),
    });
  });

  router.post("/uit/companies/:companyId/reactivate", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    const input = stateChangeSchema.parse(request.body);
    response.json({
      data: await service.reactivate(
        auth.userId,
        companyIdSchema.parse(request.params.companyId),
        input.expectedVersion,
        input.reason,
        metadata(request),
      ),
    });
  });

  router.post("/uit/companies/:companyId/recruiters", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.addRecruiter(
        auth.userId,
        companyIdSchema.parse(request.params.companyId),
        recruiterCreateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post(
    "/uit/companies/:companyId/recruiters/:userId/suspend",
    requireRoles("UIT_ADMIN"),
    async (request, response) => {
      const auth = principal(request);
      const input = recruiterStateChangeSchema.parse(request.body);
      response.json({
        data: await service.suspendRecruiter(
          auth.userId,
          companyIdSchema.parse(request.params.companyId),
          recruiterUserIdSchema.parse(request.params.userId),
          input.reason,
          metadata(request),
        ),
      });
    },
  );

  router.post(
    "/uit/companies/:companyId/recruiters/:userId/reactivate",
    requireRoles("UIT_ADMIN"),
    async (request, response) => {
      const auth = principal(request);
      const input = recruiterStateChangeSchema.parse(request.body);
      response.json({
        data: await service.reactivateRecruiter(
          auth.userId,
          companyIdSchema.parse(request.params.companyId),
          recruiterUserIdSchema.parse(request.params.userId),
          input.reason,
          metadata(request),
        ),
      });
    },
  );

  router.post(
    "/uit/companies/:companyId/recruiters/:userId/activation-link",
    requireRoles("UIT_ADMIN"),
    async (request, response) => {
      const auth = principal(request);
      response.json({
        data: await service.regenerateActivation(
          auth.userId,
          companyIdSchema.parse(request.params.companyId),
          recruiterUserIdSchema.parse(request.params.userId),
          metadata(request),
        ),
      });
    },
  );

  router.get("/companies/me/profile", requireRoles("COMPANY"), async (request, response) => {
    response.json({ data: await service.getMyProfile(principal(request).userId) });
  });

  router.patch("/companies/me/profile", requireRoles("COMPANY"), async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.updateMyProfile(
        auth.userId,
        auth.companyId!,
        companyProfileUpdateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.get("/companies/:companyId", requireRoles("STUDENT"), async (request, response) => {
    response.json({ data: await service.getPartnerDirectory(companyIdSchema.parse(request.params.companyId)) });
  });

  return router;
}

import type { Request } from "express";
import { Router } from "express";

import {
  createAuthenticate,
  requireRoles,
  type AccessPrincipalStore,
} from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import {
  categoryCreateSchema,
  skillCreateSchema,
  taxonomyIdSchema,
  taxonomyListQuerySchema,
  taxonomyStateSchema,
  taxonomyUpdateSchema,
} from "./taxonomy.schemas.js";
import { TaxonomyService } from "./taxonomy.service.js";

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

export function createTaxonomyRouter(
  service: TaxonomyService,
  tokenService: TokenService,
  accessPrincipalStore: AccessPrincipalStore,
) {
  const router = Router();
  router.use(createAuthenticate(tokenService, accessPrincipalStore));
  router.use("/uit/taxonomy", requireRoles("UIT_ADMIN"));

  router.get("/uit/taxonomy/categories", async (request, response) => {
    const query = taxonomyListQuerySchema.parse(request.query);
    const result = await service.listCategories(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/uit/taxonomy/categories", async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.createCategory(auth.userId, categoryCreateSchema.parse(request.body), metadata(request)),
    });
  });

  router.patch("/uit/taxonomy/categories/:taxonomyId", async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.updateCategory(
        auth.userId,
        taxonomyIdSchema.parse(request.params.taxonomyId),
        taxonomyUpdateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/uit/taxonomy/categories/:taxonomyId/archive", async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.archiveCategory(
        auth.userId,
        taxonomyIdSchema.parse(request.params.taxonomyId),
        taxonomyStateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/uit/taxonomy/categories/:taxonomyId/reactivate", async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.reactivateCategory(
        auth.userId,
        taxonomyIdSchema.parse(request.params.taxonomyId),
        taxonomyStateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.get("/uit/taxonomy/skills", async (request, response) => {
    const query = taxonomyListQuerySchema.parse(request.query);
    const result = await service.listSkills(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/uit/taxonomy/skills", async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.createSkill(auth.userId, skillCreateSchema.parse(request.body), metadata(request)),
    });
  });

  router.patch("/uit/taxonomy/skills/:taxonomyId", async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.updateSkill(
        auth.userId,
        taxonomyIdSchema.parse(request.params.taxonomyId),
        taxonomyUpdateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/uit/taxonomy/skills/:taxonomyId/archive", async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.archiveSkill(
        auth.userId,
        taxonomyIdSchema.parse(request.params.taxonomyId),
        taxonomyStateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/uit/taxonomy/skills/:taxonomyId/reactivate", async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.reactivateSkill(
        auth.userId,
        taxonomyIdSchema.parse(request.params.taxonomyId),
        taxonomyStateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  return router;
}

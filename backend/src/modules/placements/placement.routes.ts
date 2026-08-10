import type { Request } from "express";
import { Router } from "express";

import { createAuthenticate, requireRoles } from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import {
  placementCommandIdSchema,
  placementIdSchema,
  placementListQuerySchema,
  placementTransitionSchema,
} from "./placement.schemas.js";
import { PlacementService } from "./placement.service.js";

function principal(request: Request) {
  if (!request.auth) throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  return request.auth;
}

function metadata(request: Request) {
  return { ipAddress: request.ip || null, userAgent: request.get("user-agent")?.slice(0, 512) ?? null };
}

export function createPlacementRouter(service: PlacementService, tokenService = new TokenService()) {
  const router = Router();
  router.use(createAuthenticate(tokenService));
  router.use("/uit/placements", requireRoles("UIT_ADMIN"));

  router.get("/uit/placements", async (request, response) => {
    const query = placementListQuerySchema.parse(request.query);
    const result = await service.list(query);
    response.json({
      data: result.items,
      summary: result.summary,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    });
  });

  for (const action of ["start", "complete"] as const) {
    router.post(`/uit/placements/:placementId/${action}`, async (request, response) => {
      response.json({
        data: await service.transition(
          principal(request).userId,
          placementIdSchema.parse(request.params.placementId),
          placementCommandIdSchema.parse(request.header("idempotency-key")),
          action,
          placementTransitionSchema.parse(request.body),
          metadata(request),
        ),
      });
    });
  }

  return router;
}

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
  internshipEvaluationApplicationIdSchema,
  internshipEvaluationCommandIdSchema,
  internshipEvaluationSubmitSchema,
} from "./evaluation.schemas.js";
import { InternshipEvaluationService } from "./evaluation.service.js";

function principal(request: Request) {
  if (!request.auth) throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  return request.auth;
}

function metadata(request: Request) {
  return { ipAddress: request.ip || null, userAgent: request.get("user-agent")?.slice(0, 512) ?? null };
}

export function createInternshipEvaluationRouter(
  service: InternshipEvaluationService,
  tokenService: TokenService,
  accessPrincipalStore: AccessPrincipalStore,
) {
  const router = Router();
  router.use(createAuthenticate(tokenService, accessPrincipalStore));

  router.get(
    "/applications/:applicationId/internship-evaluations",
    requireRoles("STUDENT"),
    async (request, response) => {
      const auth = principal(request);
      response.json({
        data: await service.get(
          { userId: auth.userId, studentProfileId: auth.studentProfileId! },
          internshipEvaluationApplicationIdSchema.parse(request.params.applicationId),
          "STUDENT",
        ),
      });
    },
  );

  router.post(
    "/applications/:applicationId/internship-evaluations",
    requireRoles("STUDENT"),
    async (request, response) => {
      const auth = principal(request);
      response.status(201).json({
        data: await service.submit(
          { userId: auth.userId, studentProfileId: auth.studentProfileId! },
          internshipEvaluationApplicationIdSchema.parse(request.params.applicationId),
          internshipEvaluationCommandIdSchema.parse(request.header("idempotency-key")),
          "STUDENT",
          internshipEvaluationSubmitSchema.parse(request.body),
          metadata(request),
        ),
      });
    },
  );

  router.get(
    "/companies/me/applications/:applicationId/internship-evaluations",
    requireRoles("COMPANY"),
    async (request, response) => {
      const auth = principal(request);
      response.json({
        data: await service.get(
          { userId: auth.userId, companyId: auth.companyId! },
          internshipEvaluationApplicationIdSchema.parse(request.params.applicationId),
          "COMPANY",
        ),
      });
    },
  );

  router.post(
    "/companies/me/applications/:applicationId/internship-evaluations",
    requireRoles("COMPANY"),
    async (request, response) => {
      const auth = principal(request);
      response.status(201).json({
        data: await service.submit(
          { userId: auth.userId, companyId: auth.companyId! },
          internshipEvaluationApplicationIdSchema.parse(request.params.applicationId),
          internshipEvaluationCommandIdSchema.parse(request.header("idempotency-key")),
          "COMPANY",
          internshipEvaluationSubmitSchema.parse(request.body),
          metadata(request),
        ),
      });
    },
  );

  return router;
}

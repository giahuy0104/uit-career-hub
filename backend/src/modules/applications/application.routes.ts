import type { Request } from "express";
import { Router } from "express";

import { createAuthenticate, requireRoles } from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import {
  applicationIdSchema,
  applicationIdempotencyKeySchema,
  applicationListQuerySchema,
  applicationReviewQueueQuerySchema,
  applicationReviewReasonSchema,
  applicationSubmitSchema,
  applicationSupplementRequestSchema,
  companyCandidateListQuerySchema,
  interviewRequestSchema,
} from "./application.schemas.js";
import { ApplicationService } from "./application.service.js";

function principal(request: Request) {
  if (!request.auth) throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  return request.auth;
}

function metadata(request: Request) {
  return { ipAddress: request.ip || null, userAgent: request.get("user-agent")?.slice(0, 512) ?? null };
}

function pageMeta(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
}

export function createApplicationRouter(service: ApplicationService, tokenService = new TokenService()) {
  const router = Router();
  router.use(createAuthenticate(tokenService));
  const studentOnly = requireRoles("STUDENT");
  const uitOnly = requireRoles("UIT_ADMIN");
  const companyOnly = requireRoles("COMPANY");

  router.get("/students/me", studentOnly, async (request, response) => {
    response.json({ data: await service.getStudentProfile(principal(request).studentProfileId) });
  });

  router.get("/students/me/documents", studentOnly, async (request, response) => {
    response.json({ data: await service.listStudentDocuments(principal(request).studentProfileId) });
  });

  router.get("/applications", studentOnly, async (request, response) => {
    const query = applicationListQuerySchema.parse(request.query);
    const result = await service.listApplications(principal(request).studentProfileId, query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/applications", studentOnly, async (request, response) => {
    const auth = principal(request);
    const commandId = applicationIdempotencyKeySchema.parse(request.header("idempotency-key"));
    const application = await service.submit(
      { userId: auth.userId, studentProfileId: auth.studentProfileId },
      applicationSubmitSchema.parse(request.body),
      commandId,
      metadata(request),
    );
    response.status(201).json({ data: application });
  });

  router.get("/applications/:applicationId", studentOnly, async (request, response) => {
    response.json({
      data: await service.getApplication(
        principal(request).studentProfileId,
        applicationIdSchema.parse(request.params.applicationId),
      ),
    });
  });

  router.get("/uit/applications/review-queue", uitOnly, async (request, response) => {
    const query = applicationReviewQueueQuerySchema.parse(request.query);
    const result = await service.listReviewQueue(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/uit/applications/:applicationId/request-supplement", uitOnly, async (request, response) => {
    const auth = principal(request);
    const payload = applicationSupplementRequestSchema.parse(request.body);
    response.json({
      data: await service.review(
        auth.userId,
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "request-supplement",
        payload,
        metadata(request),
      ),
    });
  });

  router.post("/uit/applications/:applicationId/reject", uitOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.review(
        auth.userId,
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "reject",
        applicationReviewReasonSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/uit/applications/:applicationId/forward", uitOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.review(
        auth.userId,
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "forward",
        {},
        metadata(request),
      ),
    });
  });

  router.get("/companies/me/candidates", companyOnly, async (request, response) => {
    const auth = principal(request);
    const query = companyCandidateListQuerySchema.parse(request.query);
    const result = await service.listCompanyCandidates(auth.companyId, query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post(
    "/companies/me/applications/:applicationId/start-review",
    companyOnly,
    async (request, response) => {
      const auth = principal(request);
      response.json({
        data: await service.startCompanyReview(
          { userId: auth.userId, companyId: auth.companyId },
          applicationIdSchema.parse(request.params.applicationId),
          applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
          metadata(request),
        ),
      });
    },
  );

  router.post("/companies/me/applications/:applicationId/reject", companyOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.rejectCompanyApplication(
        { userId: auth.userId, companyId: auth.companyId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        applicationReviewReasonSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/companies/me/applications/:applicationId/interviews", companyOnly, async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.scheduleInterview(
        { userId: auth.userId, companyId: auth.companyId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        interviewRequestSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  return router;
}

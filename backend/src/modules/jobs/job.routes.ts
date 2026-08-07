import type { Request } from "express";
import { Router } from "express";

import { createAuthenticate, requireRoles } from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import {
  idempotencyKeySchema,
  jobDraftSchema,
  jobDraftUpdateSchema,
  jobIdSchema,
  jobListQuerySchema,
  recruitingJobQuerySchema,
  reviewQueueQuerySchema,
  reviewReasonSchema,
} from "./job.schemas.js";
import { JobService } from "./job.service.js";

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

function commandId(request: Request) {
  return idempotencyKeySchema.parse(request.header("idempotency-key"));
}

function envelope(data: unknown) {
  return { data };
}

function pageMeta(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
}

export function createJobRouter(service: JobService, tokenService = new TokenService()) {
  const router = Router();
  const authenticate = createAuthenticate(tokenService);

  router.use(authenticate);

  router.get("/jobs", async (request, response) => {
    const query = recruitingJobQuerySchema.parse(request.query);
    const result = await service.listRecruitingJobs(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.get("/jobs/:jobId", async (request, response) => {
    response.json(envelope(await service.getRecruitingJob(jobIdSchema.parse(request.params.jobId))));
  });

  router.get("/companies/me/jobs", requireRoles("COMPANY"), async (request, response) => {
    const auth = principal(request);
    const query = jobListQuerySchema.parse(request.query);
    const result = await service.listCompanyJobs(auth.companyId, query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/companies/me/jobs", requireRoles("COMPANY"), async (request, response) => {
    const auth = principal(request);
    const job = await service.createDraft(
      { userId: auth.userId, companyId: auth.companyId },
      jobDraftSchema.parse(request.body),
      metadata(request),
    );
    response.status(201).json(envelope(job));
  });

  router.get("/companies/me/jobs/:jobId", requireRoles("COMPANY"), async (request, response) => {
    const auth = principal(request);
    const jobId = jobIdSchema.parse(request.params.jobId);
    response.json(envelope(await service.getCompanyJob(auth.companyId, jobId)));
  });

  router.patch("/companies/me/jobs/:jobId", requireRoles("COMPANY"), async (request, response) => {
    const auth = principal(request);
    const job = await service.updateDraft(
      { userId: auth.userId, companyId: auth.companyId },
      jobIdSchema.parse(request.params.jobId),
      jobDraftUpdateSchema.parse(request.body),
      metadata(request),
    );
    response.json(envelope(job));
  });

  router.post("/companies/me/jobs/:jobId/submit", requireRoles("COMPANY"), async (request, response) => {
    const auth = principal(request);
    const job = await service.submit(
      { userId: auth.userId, companyId: auth.companyId },
      jobIdSchema.parse(request.params.jobId),
      commandId(request),
      metadata(request),
    );
    response.json(envelope(job));
  });

  router.get("/uit/jobs/review-queue", requireRoles("UIT_ADMIN"), async (request, response) => {
    const query = reviewQueueQuerySchema.parse(request.query);
    const result = await service.listReviewQueue(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/uit/jobs/:jobId/approve", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    response.json(
      envelope(
        await service.review(
          auth.userId,
          jobIdSchema.parse(request.params.jobId),
          commandId(request),
          "approve",
          null,
          metadata(request),
        ),
      ),
    );
  });

  router.post("/uit/jobs/:jobId/request-revision", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    response.json(
      envelope(
        await service.review(
          auth.userId,
          jobIdSchema.parse(request.params.jobId),
          commandId(request),
          "request-revision",
          reviewReasonSchema.parse(request.body),
          metadata(request),
        ),
      ),
    );
  });

  router.post("/uit/jobs/:jobId/reject", requireRoles("UIT_ADMIN"), async (request, response) => {
    const auth = principal(request);
    response.json(
      envelope(
        await service.review(
          auth.userId,
          jobIdSchema.parse(request.params.jobId),
          commandId(request),
          "reject",
          reviewReasonSchema.parse(request.body),
          metadata(request),
        ),
      ),
    );
  });

  return router;
}

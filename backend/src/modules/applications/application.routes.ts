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
  applicationResubmitSchema,
  applicationSubmitSchema,
  applicationSupplementRequestSchema,
  companyCandidateListQuerySchema,
  interviewIdSchema,
  interviewListQuerySchema,
  interviewRequestSchema,
  placementConfirmationSchema,
  recruitmentResultSchema,
  studentDocumentIdSchema,
  studentDocumentReviewListQuerySchema,
  studentDocumentReviewSchema,
  studentDocumentUploadIdSchema,
  studentDocumentUploadSchema,
  studentProfileUpdateSchema,
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

  router.patch("/students/me", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.updateStudentProfile(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        studentProfileUpdateSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.get("/students/me/documents", studentOnly, async (request, response) => {
    response.json({ data: await service.listStudentDocuments(principal(request).studentProfileId) });
  });

  router.post("/students/me/documents/uploads", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.createStudentDocumentUploadIntent(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        studentDocumentUploadSchema.parse(request.body),
      ),
    });
  });

  router.post("/students/me/documents/uploads/:uploadId/complete", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.status(201).json({
      data: await service.completeStudentDocumentUpload(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        studentDocumentUploadIdSchema.parse(request.params.uploadId),
        metadata(request),
      ),
    });
  });

  router.post("/students/me/documents/:documentId/download", studentOnly, async (request, response) => {
    response.json({
      data: await service.createStudentDocumentDownload(
        principal(request).studentProfileId,
        studentDocumentIdSchema.parse(request.params.documentId),
      ),
    });
  });

  router.delete("/students/me/documents/:documentId", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.deleteStudentDocument(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        studentDocumentIdSchema.parse(request.params.documentId),
        metadata(request),
      ),
    });
  });

  router.post("/students/me/documents/:documentId/default", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.setDefaultStudentCv(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        studentDocumentIdSchema.parse(request.params.documentId),
        metadata(request),
      ),
    });
  });

  router.get("/students/me/interviews", studentOnly, async (request, response) => {
    const query = interviewListQuerySchema.parse(request.query);
    const result = await service.listStudentInterviews(principal(request).studentProfileId, query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/students/me/interviews/:interviewId/confirm", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.confirmInterview(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        interviewIdSchema.parse(request.params.interviewId),
        metadata(request),
      ),
    });
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

  router.post("/applications/:applicationId/resubmit", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.resubmit(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        applicationResubmitSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/applications/:applicationId/withdraw", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.withdraw(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "withdraw",
        applicationReviewReasonSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/applications/:applicationId/cancel-interview", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.withdraw(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "cancel-interview",
        applicationReviewReasonSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.post("/applications/:applicationId/offer/accept", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.respondToOffer(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "accept",
        {},
        metadata(request),
      ),
    });
  });

  router.post("/applications/:applicationId/offer/decline", studentOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.respondToOffer(
        { userId: auth.userId, studentProfileId: auth.studentProfileId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        "decline",
        applicationReviewReasonSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.get("/uit/applications/review-queue", uitOnly, async (request, response) => {
    const query = applicationReviewQueueQuerySchema.parse(request.query);
    const result = await service.listReviewQueue(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.get("/uit/student-documents", uitOnly, async (request, response) => {
    const query = studentDocumentReviewListQuerySchema.parse(request.query);
    const result = await service.listStudentDocumentsForReview(query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.post("/uit/student-documents/:documentId/download", uitOnly, async (request, response) => {
    response.json({
      data: await service.createUitStudentDocumentDownload(
        studentDocumentIdSchema.parse(request.params.documentId),
      ),
    });
  });

  router.post("/uit/student-documents/:documentId/review", uitOnly, async (request, response) => {
    response.json({
      data: await service.reviewStudentDocument(
        principal(request).userId,
        studentDocumentIdSchema.parse(request.params.documentId),
        studentDocumentReviewSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  router.get("/uit/applications/placement-queue", uitOnly, async (request, response) => {
    const query = applicationReviewQueueQuerySchema.parse(request.query);
    const result = await service.listPlacementQueue(query);
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

  router.post("/uit/applications/:applicationId/confirm-placement", uitOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.confirmPlacement(
        auth.userId,
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        placementConfirmationSchema.parse(request.body),
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

  router.get("/companies/me/interviews", companyOnly, async (request, response) => {
    const auth = principal(request);
    const query = interviewListQuerySchema.parse(request.query);
    const result = await service.listCompanyInterviews(auth.companyId, query);
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

  router.post("/companies/me/applications/:applicationId/results", companyOnly, async (request, response) => {
    const auth = principal(request);
    response.json({
      data: await service.recordInterviewResult(
        { userId: auth.userId, companyId: auth.companyId },
        applicationIdSchema.parse(request.params.applicationId),
        applicationIdempotencyKeySchema.parse(request.header("idempotency-key")),
        recruitmentResultSchema.parse(request.body),
        metadata(request),
      ),
    });
  });

  return router;
}

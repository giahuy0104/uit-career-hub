import { z } from "zod";

import { applicationStatuses } from "./application.types.js";

export const applicationIdSchema = z.string().uuid();
export const applicationIdempotencyKeySchema = z.string().uuid("Idempotency-Key phải là UUID.");

export const applicationSubmitSchema = z.object({
  jobId: z.string().uuid(),
  documents: z
    .array(z.object({ documentId: z.string().uuid() }))
    .min(1)
    .max(10)
    .superRefine((documents, context) => {
      const unique = new Set(documents.map((document) => document.documentId));
      if (unique.size !== documents.length) {
        context.addIssue({ code: "custom", message: "Không được chọn trùng tài liệu." });
      }
    }),
  consentToShare: z.literal(true),
});

export const applicationResubmitSchema = z.object({
  documents: z
    .array(z.object({ documentId: z.string().uuid() }))
    .min(1)
    .max(10)
    .superRefine((documents, context) => {
      const unique = new Set(documents.map((document) => document.documentId));
      if (unique.size !== documents.length) {
        context.addIssue({ code: "custom", message: "Không được chọn trùng tài liệu." });
      }
    }),
  consentToShare: z.literal(true),
});

export const applicationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(applicationStatuses).optional(),
});

export const applicationReviewQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const placementConfirmationSchema = z.object({
  startDate: z.iso.date(),
  note: z.string().trim().max(500).optional(),
});

export const companyCandidateListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  jobId: z.string().uuid().optional(),
  status: z.enum(applicationStatuses).optional(),
});

export const applicationReviewReasonSchema = z.object({
  reasonCode: z.string().trim().min(2).max(80),
  note: z.string().trim().min(5).max(2_000),
});

export const applicationSupplementRequestSchema = applicationReviewReasonSchema.extend({
  requiredDocumentTypes: z
    .array(z.enum(["CV", "TRANSCRIPT", "STUDENT_CONFIRMATION", "OTHER"]))
    .min(1)
    .max(4)
    .refine((items) => new Set(items).size === items.length, "Không được chọn trùng loại tài liệu."),
  dueAt: z.string().datetime({ offset: true }),
});

export const interviewRequestSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true }),
    timeZone: z.string().trim().min(2).max(80).default("Asia/Ho_Chi_Minh"),
    mode: z.enum(["ONSITE", "ONLINE", "PHONE"]),
    location: z.string().trim().min(3).max(500).optional(),
    meetingUrl: z.string().url().max(2_000).optional(),
    interviewerName: z.string().trim().min(2).max(150),
  })
  .superRefine((value, context) => {
    if (value.mode === "ONLINE" && !value.meetingUrl) {
      context.addIssue({ code: "custom", path: ["meetingUrl"], message: "Phá»ng váº¥n online cáº§n Ä‘Æ°á»ng dáº«n tham gia." });
    }
    if (value.mode === "ONSITE" && !value.location) {
      context.addIssue({ code: "custom", path: ["location"], message: "Phá»ng váº¥n táº¡i chá»— cáº§n Ä‘á»‹a Ä‘iá»ƒm." });
    }
  });

const recruitmentPassSchema = z.object({
  outcome: z.literal("PASS"),
  startDate: z.iso.date(),
  offerStorageKey: z.string().trim().min(3).max(2_000).optional(),
  internalNote: z.string().trim().max(2_000).optional(),
});

const recruitmentFailSchema = applicationReviewReasonSchema.extend({
  outcome: z.literal("FAIL"),
});

export const recruitmentResultSchema = z.discriminatedUnion("outcome", [
  recruitmentPassSchema,
  recruitmentFailSchema,
]);

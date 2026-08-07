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

export const applicationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(applicationStatuses).optional(),
});

export const applicationReviewQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
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

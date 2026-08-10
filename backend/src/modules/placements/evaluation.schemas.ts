import { z } from "zod";

export const internshipEvaluationApplicationIdSchema = z.string().uuid();
export const internshipEvaluationCommandIdSchema = z.string().uuid("Idempotency-Key phải là UUID.");

export const internshipEvaluationSubmitSchema = z
  .object({
    workQualityRating: z.coerce.number().int().min(1).max(5),
    collaborationRating: z.coerce.number().int().min(1).max(5),
    professionalismRating: z.coerce.number().int().min(1).max(5),
    overallRating: z.coerce.number().int().min(1).max(5),
    recommendation: z.boolean(),
    strengths: z.string().trim().min(10).max(2_000),
    improvements: z.string().trim().min(5).max(2_000).optional(),
  })
  .strict();

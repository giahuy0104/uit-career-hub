import { z } from "zod";

import { jobStatuses, opportunityTypes, workModes } from "./job.types.js";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Ngày không hợp lệ.");

export const jobIdSchema = z.string().uuid();
export const idempotencyKeySchema = z.string().uuid("Idempotency-Key phải là UUID.");

export const jobDraftSchema = z.object({
  title: z.string().trim().min(5).max(180),
  opportunityType: z.enum(opportunityTypes),
  workMode: z.enum(workModes),
  location: z.string().trim().min(2).max(255),
  description: z.string().trim().min(20).max(20_000),
  requirements: z.string().trim().min(10).max(20_000),
  benefits: z.string().trim().max(10_000).nullable().optional().default(null),
  positions: z.coerce.number().int().min(1).max(1_000),
  deadline: dateSchema,
  categoryIds: z.array(z.string().uuid()).max(20).optional().default([]),
  skillIds: z.array(z.string().uuid()).max(50).optional().default([]),
});

export const jobDraftUpdateSchema = jobDraftSchema.extend({
  expectedVersion: z.coerce.number().int().positive(),
});

export const jobListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(jobStatuses).optional(),
});

export const reviewQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const reviewReasonSchema = z.object({
  reasonCode: z.string().trim().min(2).max(80),
  note: z.string().trim().min(5).max(2_000),
});


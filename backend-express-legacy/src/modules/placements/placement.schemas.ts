import { z } from "zod";

import { placementStatuses } from "./placement.types.js";

export const placementIdSchema = z.string().uuid();
export const placementCommandIdSchema = z.string().uuid("Idempotency-Key phải là UUID.");

export const placementListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(placementStatuses).optional(),
  query: z.string().trim().max(120).optional(),
});

export const placementTransitionSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    effectiveDate: z.iso.date(),
    note: z.string().trim().min(5).max(1_000).optional(),
  })
  .strict();

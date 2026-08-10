import { z } from "zod";

import { taxonomyStatuses } from "./taxonomy.types.js";

export const taxonomyIdSchema = z.string().uuid();

export const taxonomyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: z.string().trim().max(100).optional(),
  status: z.enum(taxonomyStatuses).optional(),
});

const taxonomyName = z.string().trim().min(2).max(120);

export const categoryCreateSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(50).regex(/^[A-Z0-9_]+$/),
  name: taxonomyName,
}).strict();

export const skillCreateSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: taxonomyName,
}).strict();

export const taxonomyUpdateSchema = z.object({
  name: taxonomyName,
  expectedVersion: z.coerce.number().int().positive(),
}).strict();

export const taxonomyStateSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().min(5).max(500),
}).strict();

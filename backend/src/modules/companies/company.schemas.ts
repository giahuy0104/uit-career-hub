import { z } from "zod";

import { partnerStatuses } from "./company.types.js";

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().default(null);
const website = z.string().trim().url("Website không hợp lệ.").max(500).nullable().optional().default(null);

const companyFields = {
  code: z.string().trim().toUpperCase().min(2).max(30).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(180),
  legalName: nullableText(255),
  taxCode: z.string().trim().min(3).max(50).nullable().optional().default(null),
  industry: nullableText(120),
  companySize: nullableText(80),
  description: nullableText(5_000),
  website,
  address: nullableText(500),
};

const recruiterFields = {
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  fullName: z.string().trim().min(2).max(180),
  title: nullableText(120),
};

export const companyIdSchema = z.string().uuid();
export const recruiterUserIdSchema = z.string().uuid();

export const companyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: z.string().trim().max(100).optional(),
  status: z.enum(partnerStatuses).optional(),
});

export const partnerDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: z.string().trim().max(100).optional(),
  industry: z.string().trim().max(120).optional(),
  hasRecruitingJobs: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const companyCreateSchema = z.object({
  ...companyFields,
  primaryRecruiter: z.object(recruiterFields),
});

export const companyUpdateSchema = z.object({
  ...companyFields,
  expectedVersion: z.coerce.number().int().positive(),
});

export const companyProfileUpdateSchema = z.object({
  name: companyFields.name,
  industry: companyFields.industry,
  companySize: companyFields.companySize,
  description: companyFields.description,
  website,
  address: companyFields.address,
  expectedVersion: z.coerce.number().int().positive(),
});

export const recruiterCreateSchema = z.object(recruiterFields);

export const stateChangeSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().min(5).max(1_000),
});

export const recruiterStateChangeSchema = z.object({
  reason: z.string().trim().min(5).max(1_000),
});

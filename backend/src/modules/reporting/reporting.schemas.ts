import { z } from "zod";

import { applicationStatuses } from "../applications/application.types.js";
import { opportunityTypes } from "../jobs/job.types.js";
import { reportExportFormats } from "./reporting.types.js";

const dateString = z.string().date();

const filtersShape = {
  fromDate: dateString.optional(),
  toDate: dateString.optional(),
  faculty: z.string().trim().min(1).max(120).optional(),
  major: z.string().trim().min(1).max(120).optional(),
  cohort: z.string().trim().min(1).max(40).optional(),
  companyId: z.string().uuid().optional(),
  status: z.enum(applicationStatuses).optional(),
  opportunityType: z.enum(opportunityTypes).optional(),
  query: z.string().trim().min(1).max(100).optional(),
};

function validDateRange(value: { fromDate?: string; toDate?: string }) {
  return !value.fromDate || !value.toDate || value.fromDate <= value.toDate;
}

export const applicationReportQuerySchema = z.object({
  ...filtersShape,
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
}).refine(validDateRange, {
  message: "Ngày bắt đầu không được sau ngày kết thúc.",
  path: ["toDate"],
});

export const applicationReportExportSchema = z.object({
  ...filtersShape,
  format: z.enum(reportExportFormats),
}).strict().refine(validDateRange, {
  message: "Ngày bắt đầu không được sau ngày kết thúc.",
  path: ["toDate"],
});

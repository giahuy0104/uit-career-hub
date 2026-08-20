import type { ApplicationStatus } from "../applications/application.types.js";
import type { OpportunityType, WorkMode } from "../jobs/job.types.js";

export const reportExportFormats = ["CSV", "XLSX"] as const;
export type ReportExportFormat = (typeof reportExportFormats)[number];

export type ApplicationReportFilters = {
  fromDate?: string;
  toDate?: string;
  faculty?: string;
  major?: string;
  cohort?: string;
  companyId?: string;
  status?: ApplicationStatus;
  opportunityType?: OpportunityType;
  query?: string;
};

export type ApplicationReportListInput = ApplicationReportFilters & {
  page: number;
  pageSize: number;
};

export type ApplicationReportExportInput = ApplicationReportFilters & {
  format: ReportExportFormat;
};

export type ApplicationReportRow = {
  applicationId: string;
  submittedAt: string;
  lastTransitionAt: string;
  student: {
    studentCode: string;
    fullName: string;
    faculty: string;
    major: string;
    cohort: string;
  };
  company: { id: string; code: string; name: string };
  job: {
    title: string;
    opportunityType: OpportunityType;
    workMode: WorkMode;
  };
  status: ApplicationStatus;
  recruitmentResult: {
    outcome: "PASS" | "FAIL";
    studentDecision: "ACCEPTED" | "DECLINED" | null;
    startDate: string | null;
  } | null;
};

export type ApplicationReportSummary = {
  totalApplications: number;
  uniqueStudents: number;
  companyCount: number;
  hiredCount: number;
  hiredRate: number;
  statusCounts: Array<{ status: ApplicationStatus; count: number }>;
};

export type ApplicationReportFilterOptions = {
  faculties: string[];
  majors: string[];
  cohorts: string[];
  companies: Array<{ id: string; code: string; name: string }>;
};

export type ApplicationReportData = {
  items: ApplicationReportRow[];
  total: number;
  summary: ApplicationReportSummary;
  filterOptions: ApplicationReportFilterOptions;
};

export type ReportFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  rowCount: number;
};

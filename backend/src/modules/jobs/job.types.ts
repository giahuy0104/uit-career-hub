export const jobStatuses = [
  "DRAFT",
  "PENDING_UIT_REVIEW",
  "REVISION_REQUIRED",
  "RECRUITING",
  "PAUSED",
  "EXPIRED",
  "REJECTED",
  "CLOSED",
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export const opportunityTypes = ["INTERNSHIP", "PART_TIME", "FULL_TIME", "FRESHER"] as const;
export type OpportunityType = (typeof opportunityTypes)[number];

export const workModes = ["ONSITE", "REMOTE", "HYBRID"] as const;
export type WorkMode = (typeof workModes)[number];

export type JobDraftInput = {
  title: string;
  opportunityType: OpportunityType;
  workMode: WorkMode;
  location: string;
  description: string;
  requirements: string;
  benefits: string | null;
  positions: number;
  deadline: string;
  categoryIds: string[];
  skillIds: string[];
};

export type JobDraftUpdateInput = JobDraftInput & { expectedVersion: number };

export type ReviewDecision = "approve" | "request-revision" | "reject";

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type JobDto = {
  id: string;
  company: {
    id: string;
    code: string;
    name: string;
    industry: string | null;
    partnerStatus: string;
  };
  title: string;
  opportunityType: OpportunityType;
  workMode: WorkMode;
  location: string;
  description: string;
  requirements: string;
  benefits: string | null;
  positions: number;
  deadline: string;
  status: JobStatus;
  version: number;
  categories: Array<{ id: string; code: string; name: string }>;
  skills: Array<{ id: string; slug: string; name: string; isRequired: boolean }>;
  latestReview: { reasonCode: string; note: string | null; createdAt: string } | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};


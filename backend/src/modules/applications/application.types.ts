export const applicationStatuses = [
  "UIT_REVIEWING",
  "NEEDS_SUPPLEMENT",
  "FORWARDED_TO_COMPANY",
  "COMPANY_REVIEWING",
  "INTERVIEW_INVITED",
  "NOT_SUITABLE",
  "INTERVIEW_FAILED",
  "OFFER_PENDING_STUDENT",
  "ACCEPTED_PENDING_UIT_CONFIRMATION",
  "HIRED",
  "OFFER_DECLINED",
  "UIT_REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];
export type AvailableAction =
  | "RESUBMIT"
  | "WITHDRAW"
  | "CANCEL_INTERVIEW"
  | "ACCEPT_OFFER"
  | "DECLINE_OFFER";

export type ApplicationDto = {
  id: string;
  studentProfileId: string;
  status: ApplicationStatus;
  version: number;
  submittedAt: string;
  lastTransitionAt: string;
  availableActions: AvailableAction[];
  job: {
    id: string;
    title: string;
    opportunityType: string;
    workMode: string;
    location: string;
    deadline: string;
    company: { id: string; code: string; name: string };
  };
  documents: Array<{
    id: string;
    sourceDocumentId: string | null;
    documentType: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    sourceVersion: number;
  }>;
  timeline: Array<{
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    actorType: string;
    reasonCode: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type StudentProfileDto = {
  id: string;
  studentCode: string;
  fullName: string;
  faculty: string;
  major: string;
  cohort: string;
  gpa: number | null;
  academicStatus: string;
  email: string;
};

export type StudentDocumentDto = {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  version: number;
  isDefault: boolean;
  verificationStatus: string;
  createdAt: string;
};

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};


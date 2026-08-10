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

export const studentDocumentTypes = ["CV", "TRANSCRIPT", "STUDENT_CONFIRMATION", "OTHER"] as const;
export type StudentDocumentType = (typeof studentDocumentTypes)[number];

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
  student: {
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
  recruitmentResult: {
    id: string;
    outcome: "PASS" | "FAIL";
    studentDecision: "ACCEPTED" | "DECLINED" | null;
    offeredAt: string | null;
    respondedAt: string | null;
    startDate: string | null;
    offerDocument: {
      fileName: string;
      mimeType: string;
      fileSizeBytes: number | null;
    } | null;
  } | null;
  timeline: Array<{
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    actorType: string;
    reasonCode: string | null;
    note: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type ApplicationReviewDecision = "request-supplement" | "reject" | "forward";
export type CompanyApplicationDecision = "start-review" | "reject";

export type InterviewDto = {
  id: string;
  applicationId: string;
  scheduledAt: string;
  timeZone: string;
  mode: "ONSITE" | "ONLINE" | "PHONE";
  location: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
  status: string;
  version: number;
};

export type InterviewListItemDto = InterviewDto & {
  applicationStatus: ApplicationStatus;
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    major: string;
    gpa: number | null;
  };
  job: {
    id: string;
    title: string;
    company: { id: string; code: string; name: string };
  };
  recruitmentResult: {
    outcome: "PASS" | "FAIL";
    studentDecision: "ACCEPTED" | "DECLINED" | null;
  } | null;
};

export type StudentProfileDto = {
  id: string;
  studentCode: string;
  fullName: string;
  faculty: string;
  major: string;
  cohort: string;
  gpa: number | null;
  phone: string | null;
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

export const studentDocumentVerificationStatuses = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type StudentDocumentVerificationStatus = (typeof studentDocumentVerificationStatuses)[number];

export type UitStudentDocumentReviewDto = StudentDocumentDto & {
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    email: string;
    faculty: string;
    major: string;
  };
};

export type StudentDocumentUploadIntentDto = {
  uploadId: string;
  uploadUrl: string;
  method: "PUT";
  headers: { "Content-Type": "application/pdf" };
  expiresAt: string;
};

export type OfferDocumentUploadIntentDto = StudentDocumentUploadIntentDto;

export type OfferDocumentDto = {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type StudentDocumentDownloadDto = {
  downloadUrl: string;
  expiresAt: string;
};

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

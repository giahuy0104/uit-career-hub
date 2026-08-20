import type { PlacementStatus, RequestMetadata } from "./placement.types.js";

export const internshipEvaluationRoles = ["STUDENT", "COMPANY"] as const;

export type InternshipEvaluationRole = (typeof internshipEvaluationRoles)[number];

export type InternshipEvaluationDto = {
  id: string;
  respondentRole: InternshipEvaluationRole;
  workQualityRating: number;
  collaborationRating: number;
  professionalismRating: number;
  overallRating: number;
  recommendation: boolean;
  strengths: string;
  improvements: string | null;
  submittedBy: { id: string; name: string };
  submittedAt: string;
};

export type InternshipEvaluationInput = {
  workQualityRating: number;
  collaborationRating: number;
  professionalismRating: number;
  overallRating: number;
  recommendation: boolean;
  strengths: string;
  improvements?: string;
};

export type InternshipEvaluationView = {
  placement: {
    id: string;
    applicationId: string;
    status: PlacementStatus;
    expectedStartDate: string;
    actualStartDate: string | null;
    completedDate: string | null;
  };
  companyEvaluation: InternshipEvaluationDto | null;
  studentEvaluation: InternshipEvaluationDto | null;
  studentEvaluationSubmitted: boolean;
  canSubmit: boolean;
};

export type InternshipEvaluationActor = {
  userId: string;
  studentProfileId?: string;
  companyId?: string;
};

export type InternshipEvaluationSubmit = {
  actor: InternshipEvaluationActor;
  applicationId: string;
  commandId: string;
  role: InternshipEvaluationRole;
  input: InternshipEvaluationInput;
  request: RequestMetadata;
};

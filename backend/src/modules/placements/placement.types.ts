export const placementStatuses = ["HIRED", "STARTED", "COMPLETED"] as const;

export type PlacementStatus = (typeof placementStatuses)[number];
export type PlacementAction = "START" | "COMPLETE";

export type PlacementHistoryDto = {
  fromStatus: PlacementStatus | null;
  toStatus: PlacementStatus;
  actorType: "UIT_ADMIN" | "SYSTEM";
  actorUserId: string | null;
  actorName: string;
  effectiveDate: string;
  note: string | null;
  createdAt: string;
};

export type PlacementDto = {
  id: string;
  applicationId: string;
  status: PlacementStatus;
  version: number;
  expectedStartDate: string;
  actualStartDate: string | null;
  completedDate: string | null;
  hiredAt: string;
  startedAt: string | null;
  completedAt: string | null;
  availableActions: PlacementAction[];
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    faculty: string;
    major: string;
    cohort: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
    company: { id: string; code: string; name: string };
  };
  history: PlacementHistoryDto[];
};

export type PlacementListInput = {
  page: number;
  pageSize: number;
  status?: PlacementStatus;
  query?: string;
};

export type PlacementSummary = Record<PlacementStatus, number> & { total: number };

export type PlacementTransitionInput = {
  expectedVersion: number;
  effectiveDate: string;
  note?: string;
};

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

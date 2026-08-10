export type AdminDashboardDto = {
  metrics: {
    pendingJobReviews: number;
    pendingUitApplications: number;
    awaitingCompany: number;
    hiresThisMonth: number;
  };
  queues: {
    uitApplications: { total: number; overdue: number; oldestWaitingHours: number | null };
    jobReviews: { total: number; overdue: number; companyCount: number };
    placementConfirmations: { total: number; oldestWaitingHours: number | null };
  };
  handledToday: {
    completed: number;
    incoming: number;
    completionRate: number;
  };
  applicationFunnel: Array<{ status: string; count: number }>;
  topCompanies: Array<{
    companyId: string;
    companyName: string;
    recruitingJobs: number;
    applications: number;
  }>;
};

export type CompanyDashboardDto = {
  metrics: {
    recruitingJobs: number;
    pendingJobReviews: number;
    newCandidates: number;
    interviewsThisWeek: number;
    hiresThisMonth: number;
  };
  actionQueue: {
    overdueCandidates: number;
    revisionRequiredJobs: number;
  };
  recentCandidates: Array<{
    applicationId: string;
    studentName: string;
    studentCode: string;
    gpa: number | null;
    jobTitle: string;
    status: string;
    lastTransitionAt: string;
  }>;
  jobPerformance: Array<{
    jobId: string;
    title: string;
    applications: number;
    forwarded: number;
    interviews: number;
    hires: number;
  }>;
};

export type StudentDashboardDto = {
  metrics: {
    profileCompleteness: number;
    activeApplications: number;
    upcomingInterviews: number;
    pendingOffers: number;
  };
  profile: { missingItems: string[] };
  tasks: Array<{
    type: "SUPPLEMENT_DOCUMENTS" | "RESPOND_OFFER" | "UPCOMING_INTERVIEW";
    applicationId: string;
    title: string;
    description: string;
    dueAt: string | null;
  }>;
  latestApplication: {
    applicationId: string;
    status: string;
    jobTitle: string;
    companyName: string;
    lastTransitionAt: string;
  } | null;
  opportunities: Array<{
    jobId: string;
    title: string;
    companyName: string;
    workMode: string;
    deadline: string;
  }>;
};

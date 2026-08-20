import type { Pool, QueryResultRow } from "pg";

import type {
  AdminDashboardDto,
  CompanyDashboardDto,
  StudentDashboardDto,
} from "./dashboard.types.js";

export type DashboardDatabase = Pick<Pool, "query">;

function number(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function nullableNumber(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function iso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

type AdminMetricRow = QueryResultRow & {
  pending_job_reviews: string;
  pending_uit_applications: string;
  awaiting_company: string;
  hires_this_month: string;
  overdue_uit_applications: string;
  oldest_uit_hours: string | null;
  overdue_job_reviews: string;
  pending_job_companies: string;
  placement_confirmations: string;
  oldest_placement_hours: string | null;
  completed_today: string;
  incoming_today: string;
};

type CompanyMetricRow = QueryResultRow & {
  recruiting_jobs: string;
  pending_job_reviews: string;
  new_candidates: string;
  interviews_this_week: string;
  hires_this_month: string;
  overdue_candidates: string;
  revision_required_jobs: string;
};

type StudentMetricRow = QueryResultRow & {
  phone_present: boolean;
  gpa_present: boolean;
  has_default_cv: boolean;
  has_transcript: boolean;
  has_confirmation: boolean;
  active_applications: string;
  upcoming_interviews: string;
  pending_offers: string;
};

export class DashboardRepository {
  constructor(private readonly database: DashboardDatabase) {}

  async adminDashboard(): Promise<AdminDashboardDto> {
    const [metricResult, funnelResult, companyResult] = await Promise.all([
      this.database.query<AdminMetricRow>(`
        SELECT
          (SELECT count(*) FROM job_posts WHERE status = 'PENDING_UIT_REVIEW')::text AS pending_job_reviews,
          (SELECT count(*) FROM applications WHERE status = 'UIT_REVIEWING')::text AS pending_uit_applications,
          (SELECT count(*) FROM applications
             WHERE status IN ('FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED'))::text AS awaiting_company,
          (SELECT count(*) FROM applications
             WHERE status = 'HIRED'
               AND placement_confirmed_at >= date_trunc('month', now()))::text AS hires_this_month,
          (SELECT count(*) FROM applications
             WHERE status = 'UIT_REVIEWING'
               AND last_transition_at < now() - interval '24 hours')::text AS overdue_uit_applications,
          (SELECT round(max(extract(epoch FROM (now() - last_transition_at))) / 3600)::text
             FROM applications WHERE status = 'UIT_REVIEWING') AS oldest_uit_hours,
          (SELECT count(*) FROM job_posts
             WHERE status = 'PENDING_UIT_REVIEW'
               AND submitted_at < now() - interval '24 hours')::text AS overdue_job_reviews,
          (SELECT count(DISTINCT company_id) FROM job_posts
             WHERE status = 'PENDING_UIT_REVIEW')::text AS pending_job_companies,
          (SELECT count(*) FROM applications
             WHERE status = 'ACCEPTED_PENDING_UIT_CONFIRMATION')::text AS placement_confirmations,
          (SELECT round(max(extract(epoch FROM (now() - last_transition_at))) / 3600)::text
             FROM applications WHERE status = 'ACCEPTED_PENDING_UIT_CONFIRMATION') AS oldest_placement_hours,
          ((SELECT count(*) FROM application_status_history
              WHERE actor_type = 'UIT_ADMIN' AND created_at >= date_trunc('day', now()))
           + (SELECT count(*) FROM job_post_status_history
              WHERE actor_type = 'UIT_ADMIN' AND created_at >= date_trunc('day', now())))::text AS completed_today,
          ((SELECT count(*) FROM applications WHERE submitted_at >= date_trunc('day', now()))
           + (SELECT count(*) FROM job_posts WHERE submitted_at >= date_trunc('day', now())))::text AS incoming_today
      `),
      this.database.query<{ status: string; count: string }>(`
        SELECT bucket AS status, count(*)::text AS count
        FROM (
          SELECT CASE
            WHEN status IN ('UIT_REVIEWING', 'NEEDS_SUPPLEMENT') THEN 'UIT_REVIEW'
            WHEN status IN ('FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING') THEN 'COMPANY_REVIEW'
            WHEN status = 'INTERVIEW_INVITED' THEN 'INTERVIEW'
            WHEN status IN ('OFFER_PENDING_STUDENT', 'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED') THEN 'OFFER_OR_HIRED'
            ELSE 'CLOSED'
          END AS bucket
          FROM applications
        ) grouped
        GROUP BY bucket
      `),
      this.database.query<{
        company_id: string;
        company_name: string;
        recruiting_jobs: string;
        applications: string;
      }>(`
        SELECT c.id AS company_id, c.name AS company_name,
               count(DISTINCT j.id) FILTER (WHERE j.status = 'RECRUITING')::text AS recruiting_jobs,
               count(a.id)::text AS applications
        FROM companies c
        LEFT JOIN job_posts j ON j.company_id = c.id
        LEFT JOIN applications a ON a.job_post_id = j.id
        WHERE c.partner_status = 'ACTIVE'
        GROUP BY c.id, c.name
        HAVING count(DISTINCT j.id) FILTER (WHERE j.status = 'RECRUITING') > 0 OR count(a.id) > 0
        ORDER BY count(a.id) DESC, count(DISTINCT j.id) FILTER (WHERE j.status = 'RECRUITING') DESC, c.name
        LIMIT 4
      `),
    ]);

    const row = metricResult.rows[0]!;
    const completed = number(row.completed_today);
    const incoming = number(row.incoming_today);
    const pendingNow = number(row.pending_job_reviews) + number(row.pending_uit_applications)
      + number(row.placement_confirmations);
    const workload = completed + pendingNow;

    return {
      metrics: {
        pendingJobReviews: number(row.pending_job_reviews),
        pendingUitApplications: number(row.pending_uit_applications),
        awaitingCompany: number(row.awaiting_company),
        hiresThisMonth: number(row.hires_this_month),
      },
      queues: {
        uitApplications: {
          total: number(row.pending_uit_applications),
          overdue: number(row.overdue_uit_applications),
          oldestWaitingHours: nullableNumber(row.oldest_uit_hours),
        },
        jobReviews: {
          total: number(row.pending_job_reviews),
          overdue: number(row.overdue_job_reviews),
          companyCount: number(row.pending_job_companies),
        },
        placementConfirmations: {
          total: number(row.placement_confirmations),
          oldestWaitingHours: nullableNumber(row.oldest_placement_hours),
        },
      },
      handledToday: {
        completed,
        incoming,
        completionRate: workload ? Math.round((completed / workload) * 100) : 100,
      },
      applicationFunnel: funnelResult.rows.map((item) => ({
        status: item.status,
        count: number(item.count),
      })),
      topCompanies: companyResult.rows.map((item) => ({
        companyId: item.company_id,
        companyName: item.company_name,
        recruitingJobs: number(item.recruiting_jobs),
        applications: number(item.applications),
      })),
    };
  }

  async companyDashboard(companyId: string): Promise<CompanyDashboardDto> {
    const [metricResult, candidateResult, performanceResult] = await Promise.all([
      this.database.query<CompanyMetricRow>(`
        SELECT
          (SELECT count(*) FROM job_posts
             WHERE company_id = $1 AND status = 'RECRUITING')::text AS recruiting_jobs,
          (SELECT count(*) FROM job_posts
             WHERE company_id = $1 AND status = 'PENDING_UIT_REVIEW')::text AS pending_job_reviews,
          (SELECT count(*) FROM applications a JOIN job_posts j ON j.id = a.job_post_id
             WHERE j.company_id = $1 AND a.status = 'FORWARDED_TO_COMPANY')::text AS new_candidates,
          (SELECT count(*) FROM interviews i
             JOIN applications a ON a.id = i.application_id
             JOIN job_posts j ON j.id = a.job_post_id
             WHERE j.company_id = $1
               AND i.scheduled_at >= date_trunc('week', now())
               AND i.scheduled_at < date_trunc('week', now()) + interval '7 days'
               AND i.status NOT IN ('CANCELLED', 'NO_SHOW'))::text AS interviews_this_week,
          (SELECT count(*) FROM applications a JOIN job_posts j ON j.id = a.job_post_id
             WHERE j.company_id = $1 AND a.status = 'HIRED'
               AND a.placement_confirmed_at >= date_trunc('month', now()))::text AS hires_this_month,
          (SELECT count(*) FROM applications a JOIN job_posts j ON j.id = a.job_post_id
             WHERE j.company_id = $1
               AND a.status IN ('FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED')
               AND a.last_transition_at < now() - interval '48 hours')::text AS overdue_candidates,
          (SELECT count(*) FROM job_posts
             WHERE company_id = $1 AND status = 'REVISION_REQUIRED')::text AS revision_required_jobs
      `, [companyId]),
      this.database.query<{
        application_id: string;
        student_name: string;
        student_code: string;
        gpa: string | null;
        job_title: string;
        status: string;
        last_transition_at: Date;
      }>(`
        SELECT a.id AS application_id, sp.full_name AS student_name,
               sp.student_code, sp.gpa::text, j.title AS job_title,
               a.status, a.last_transition_at
        FROM applications a
        JOIN student_profiles sp ON sp.id = a.student_profile_id
        JOIN job_posts j ON j.id = a.job_post_id
        WHERE j.company_id = $1
          AND a.status IN ('FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED')
        ORDER BY a.last_transition_at ASC, a.id
        LIMIT 5
      `, [companyId]),
      this.database.query<{
        job_id: string;
        title: string;
        applications: string;
        forwarded: string;
        interviews: string;
        hires: string;
      }>(`
        SELECT j.id AS job_id, j.title,
               count(DISTINCT a.id)::text AS applications,
               count(DISTINCT a.id) FILTER (WHERE a.status IN (
                 'FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED',
                 'INTERVIEW_FAILED', 'OFFER_PENDING_STUDENT',
                 'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED', 'OFFER_DECLINED'
               ))::text AS forwarded,
               count(DISTINCT i.application_id)::text AS interviews,
               count(DISTINCT a.id) FILTER (WHERE a.status = 'HIRED')::text AS hires
        FROM job_posts j
        LEFT JOIN applications a ON a.job_post_id = j.id
        LEFT JOIN interviews i ON i.application_id = a.id
        WHERE j.company_id = $1 AND j.status = 'RECRUITING'
        GROUP BY j.id, j.title, j.updated_at
        ORDER BY j.updated_at DESC
        LIMIT 5
      `, [companyId]),
    ]);

    const row = metricResult.rows[0]!;
    return {
      metrics: {
        recruitingJobs: number(row.recruiting_jobs),
        pendingJobReviews: number(row.pending_job_reviews),
        newCandidates: number(row.new_candidates),
        interviewsThisWeek: number(row.interviews_this_week),
        hiresThisMonth: number(row.hires_this_month),
      },
      actionQueue: {
        overdueCandidates: number(row.overdue_candidates),
        revisionRequiredJobs: number(row.revision_required_jobs),
      },
      recentCandidates: candidateResult.rows.map((item) => ({
        applicationId: item.application_id,
        studentName: item.student_name,
        studentCode: item.student_code,
        gpa: nullableNumber(item.gpa),
        jobTitle: item.job_title,
        status: item.status,
        lastTransitionAt: iso(item.last_transition_at)!,
      })),
      jobPerformance: performanceResult.rows.map((item) => ({
        jobId: item.job_id,
        title: item.title,
        applications: number(item.applications),
        forwarded: number(item.forwarded),
        interviews: number(item.interviews),
        hires: number(item.hires),
      })),
    };
  }

  async studentDashboard(studentProfileId: string): Promise<StudentDashboardDto> {
    const [metricResult, taskResult, latestResult, opportunityResult] = await Promise.all([
      this.database.query<StudentMetricRow>(`
        SELECT
          (sp.phone IS NOT NULL AND btrim(sp.phone) <> '') AS phone_present,
          (sp.gpa IS NOT NULL) AS gpa_present,
          EXISTS (SELECT 1 FROM student_documents d
                  WHERE d.student_profile_id = sp.id AND d.document_type = 'CV'
                    AND d.is_default AND d.verification_status = 'VERIFIED') AS has_default_cv,
          EXISTS (SELECT 1 FROM student_documents d
                  WHERE d.student_profile_id = sp.id AND d.document_type = 'TRANSCRIPT'
                    AND d.verification_status = 'VERIFIED') AS has_transcript,
          EXISTS (SELECT 1 FROM student_documents d
                  WHERE d.student_profile_id = sp.id AND d.document_type = 'STUDENT_CONFIRMATION'
                    AND d.verification_status = 'VERIFIED') AS has_confirmation,
          (SELECT count(*) FROM applications a
             WHERE a.student_profile_id = sp.id
               AND a.status IN ('UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
                 'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'OFFER_PENDING_STUDENT',
                 'ACCEPTED_PENDING_UIT_CONFIRMATION'))::text AS active_applications,
          (SELECT count(*) FROM interviews i JOIN applications a ON a.id = i.application_id
             WHERE a.student_profile_id = sp.id AND i.scheduled_at >= now()
               AND i.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW'))::text AS upcoming_interviews,
          (SELECT count(*) FROM applications a
             WHERE a.student_profile_id = sp.id AND a.status = 'OFFER_PENDING_STUDENT')::text AS pending_offers
        FROM student_profiles sp
        WHERE sp.id = $1
      `, [studentProfileId]),
      this.database.query<{
        type: StudentDashboardDto["tasks"][number]["type"];
        application_id: string;
        title: string;
        description: string;
        due_at: Date | null;
      }>(`
        SELECT * FROM (
          SELECT 'SUPPLEMENT_DOCUMENTS'::text AS type, a.id AS application_id,
                 j.title, ('Bổ sung hồ sơ theo yêu cầu của UIT · ' || c.name) AS description,
                 NULL::timestamptz AS due_at, 1 AS priority
          FROM applications a JOIN job_posts j ON j.id = a.job_post_id
          JOIN companies c ON c.id = j.company_id
          WHERE a.student_profile_id = $1 AND a.status = 'NEEDS_SUPPLEMENT'
          UNION ALL
          SELECT 'RESPOND_OFFER'::text, a.id, j.title,
                 ('Phản hồi kết quả tuyển dụng từ ' || c.name), NULL::timestamptz, 2
          FROM applications a JOIN job_posts j ON j.id = a.job_post_id
          JOIN companies c ON c.id = j.company_id
          WHERE a.student_profile_id = $1 AND a.status = 'OFFER_PENDING_STUDENT'
          UNION ALL
          SELECT 'UPCOMING_INTERVIEW'::text, a.id, j.title,
                 ('Phỏng vấn với ' || c.name), i.scheduled_at, 3
          FROM interviews i JOIN applications a ON a.id = i.application_id
          JOIN job_posts j ON j.id = a.job_post_id JOIN companies c ON c.id = j.company_id
          WHERE a.student_profile_id = $1 AND i.scheduled_at >= now()
            AND i.status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW')
        ) tasks
        ORDER BY priority, due_at NULLS LAST
        LIMIT 5
      `, [studentProfileId]),
      this.database.query<{
        application_id: string;
        status: string;
        job_title: string;
        company_name: string;
        last_transition_at: Date;
      }>(`
        SELECT a.id AS application_id, a.status, j.title AS job_title,
               c.name AS company_name, a.last_transition_at
        FROM applications a JOIN job_posts j ON j.id = a.job_post_id
        JOIN companies c ON c.id = j.company_id
        WHERE a.student_profile_id = $1
        ORDER BY a.last_transition_at DESC, a.id DESC
        LIMIT 1
      `, [studentProfileId]),
      this.database.query<{
        job_id: string;
        title: string;
        company_name: string;
        work_mode: string;
        deadline: Date | string;
      }>(`
        SELECT j.id AS job_id, j.title, c.name AS company_name, j.work_mode, j.deadline
        FROM job_posts j JOIN companies c ON c.id = j.company_id
        WHERE j.status = 'RECRUITING' AND j.deadline >= current_date
          AND c.partner_status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM applications a
                          WHERE a.job_post_id = j.id AND a.student_profile_id = $1)
        ORDER BY j.deadline ASC, j.created_at DESC
        LIMIT 3
      `, [studentProfileId]),
    ]);

    const row = metricResult.rows[0]!;
    const profileCompleteness = 25
      + (row.phone_present ? 10 : 0)
      + (row.gpa_present ? 10 : 0)
      + (row.has_default_cv ? 30 : 0)
      + (row.has_transcript ? 15 : 0)
      + (row.has_confirmation ? 10 : 0);
    const missingItems = [
      !row.phone_present && "Số điện thoại",
      !row.gpa_present && "GPA",
      !row.has_default_cv && "CV mặc định đã xác minh",
      !row.has_transcript && "Bảng điểm đã xác minh",
      !row.has_confirmation && "Giấy xác nhận sinh viên",
    ].filter((item): item is string => Boolean(item));
    const latest = latestResult.rows[0];

    return {
      metrics: {
        profileCompleteness,
        activeApplications: number(row.active_applications),
        upcomingInterviews: number(row.upcoming_interviews),
        pendingOffers: number(row.pending_offers),
      },
      profile: { missingItems },
      tasks: taskResult.rows.map((item) => ({
        type: item.type,
        applicationId: item.application_id,
        title: item.title,
        description: item.description,
        dueAt: iso(item.due_at),
      })),
      latestApplication: latest ? {
        applicationId: latest.application_id,
        status: latest.status,
        jobTitle: latest.job_title,
        companyName: latest.company_name,
        lastTransitionAt: iso(latest.last_transition_at)!,
      } : null,
      opportunities: opportunityResult.rows.map((item) => ({
        jobId: item.job_id,
        title: item.title,
        companyName: item.company_name,
        workMode: item.work_mode,
        deadline: typeof item.deadline === "string"
          ? item.deadline.slice(0, 10)
          : item.deadline.toISOString().slice(0, 10),
      })),
    };
  }
}

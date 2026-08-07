import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  ApplicationDto,
  ApplicationStatus,
  AvailableAction,
  InterviewDto,
  InterviewListItemDto,
  StudentDocumentDto,
  StudentProfileDto,
} from "./application.types.js";

export type ApplicationDatabase = Pick<Pool, "query" | "connect">;

type ApplicationRow = QueryResultRow & {
  id: string;
  student_profile_id: string;
  status: ApplicationStatus;
  version: number;
  submitted_at: Date;
  last_transition_at: Date;
  student_code: string;
  student_full_name: string;
  student_faculty: string;
  student_major: string;
  student_cohort: string;
  student_gpa: string | null;
  student_academic_status: string;
  student_email: string;
  job_id: string;
  job_title: string;
  opportunity_type: string;
  work_mode: string;
  location: string;
  deadline: string | Date;
  company_id: string;
  company_code: string;
  company_name: string;
  documents: ApplicationDto["documents"] | null;
  recruitment_result: ApplicationDto["recruitmentResult"];
  timeline: ApplicationDto["timeline"] | null;
};

export type SourceDocument = {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: string;
  storageKey: string;
  checksum: string | null;
  version: number;
  verificationStatus: string;
};

const applicationSelect = `
  SELECT
    a.id,
    a.student_profile_id,
    a.status,
    a.version,
    a.submitted_at,
    a.last_transition_at,
    sp.student_code,
    sp.full_name AS student_full_name,
    sp.faculty AS student_faculty,
    sp.major AS student_major,
    sp.cohort AS student_cohort,
    sp.gpa AS student_gpa,
    sp.academic_status AS student_academic_status,
    student_user.email AS student_email,
    j.id AS job_id,
    j.title AS job_title,
    j.opportunity_type,
    j.work_mode,
    j.location,
    j.deadline,
    c.id AS company_id,
    c.code AS company_code,
    c.name AS company_name,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ad.id,
        'sourceDocumentId', ad.source_document_id,
        'documentType', ad.document_type,
        'fileName', ad.file_name,
        'mimeType', ad.mime_type,
        'fileSizeBytes', ad.file_size_bytes,
        'sourceVersion', ad.source_version
      ) ORDER BY ad.created_at)
      FROM application_documents ad WHERE ad.application_id = a.id
    ), '[]'::jsonb) AS documents,
    (
      SELECT jsonb_build_object(
        'id', rr.id,
        'outcome', rr.outcome,
        'studentDecision', rr.student_decision,
        'offeredAt', rr.offered_at,
        'respondedAt', rr.responded_at,
        'startDate', rr.start_date,
        'offerStorageKey', rr.offer_storage_key
      )
      FROM recruitment_results rr WHERE rr.application_id = a.id
    ) AS recruitment_result,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fromStatus', ah.from_status,
        'toStatus', ah.to_status,
        'actorType', ah.actor_type,
        'reasonCode', ah.reason_code,
        'note', ah.note,
        'metadata', ah.metadata,
        'createdAt', ah.created_at
      ) ORDER BY ah.created_at)
      FROM application_status_history ah WHERE ah.application_id = a.id
    ), '[]'::jsonb) AS timeline
  FROM applications a
  JOIN job_posts j ON j.id = a.job_post_id
  JOIN companies c ON c.id = j.company_id
  JOIN student_profiles sp ON sp.id = a.student_profile_id
  JOIN users student_user ON student_user.id = sp.user_id
`;

function dateOnly(value: string | Date) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function availableActions(status: ApplicationStatus): AvailableAction[] {
  if (status === "NEEDS_SUPPLEMENT") return ["RESUBMIT", "WITHDRAW"];
  if (["UIT_REVIEWING", "FORWARDED_TO_COMPANY", "COMPANY_REVIEWING"].includes(status)) return ["WITHDRAW"];
  if (status === "INTERVIEW_INVITED") return ["CANCEL_INTERVIEW"];
  if (status === "OFFER_PENDING_STUDENT") return ["ACCEPT_OFFER", "DECLINE_OFFER"];
  return [];
}

function mapApplication(row: ApplicationRow): ApplicationDto {
  return {
    id: row.id,
    studentProfileId: row.student_profile_id,
    status: row.status,
    version: row.version,
    submittedAt: row.submitted_at.toISOString(),
    lastTransitionAt: row.last_transition_at.toISOString(),
    availableActions: availableActions(row.status),
    student: {
      id: row.student_profile_id,
      studentCode: row.student_code,
      fullName: row.student_full_name,
      faculty: row.student_faculty,
      major: row.student_major,
      cohort: row.student_cohort,
      gpa: row.student_gpa === null ? null : Number(row.student_gpa),
      academicStatus: row.student_academic_status,
      email: row.student_email,
    },
    job: {
      id: row.job_id,
      title: row.job_title,
      opportunityType: row.opportunity_type,
      workMode: row.work_mode,
      location: row.location,
      deadline: dateOnly(row.deadline),
      company: { id: row.company_id, code: row.company_code, name: row.company_name },
    },
    documents: (row.documents ?? []).map((document) => ({
      ...document,
      fileSizeBytes: Number(document.fileSizeBytes),
    })),
    recruitmentResult: row.recruitment_result ?? null,
    timeline: row.timeline ?? [],
  };
}

function mapInterview(row: {
  id: string;
  application_id: string;
  scheduled_at: Date;
  time_zone: string;
  mode: "ONSITE" | "ONLINE" | "PHONE";
  location: string | null;
  meeting_url: string | null;
  interviewer_name: string | null;
  status: string;
  version: number;
}): InterviewDto {
  return {
    id: row.id,
    applicationId: row.application_id,
    scheduledAt: row.scheduled_at.toISOString(),
    timeZone: row.time_zone,
    mode: row.mode,
    location: row.location,
    meetingUrl: row.meeting_url,
    interviewerName: row.interviewer_name,
    status: row.status,
    version: row.version,
  };
}

type InterviewListRow = QueryResultRow & {
  id: string;
  application_id: string;
  scheduled_at: Date;
  time_zone: string;
  mode: "ONSITE" | "ONLINE" | "PHONE";
  location: string | null;
  meeting_url: string | null;
  interviewer_name: string | null;
  interview_status: string;
  interview_version: number;
  application_status: ApplicationStatus;
  student_profile_id: string;
  student_code: string;
  student_full_name: string;
  student_major: string;
  student_gpa: string | null;
  job_id: string;
  job_title: string;
  company_id: string;
  company_code: string;
  company_name: string;
  recruitment_outcome: "PASS" | "FAIL" | null;
  student_decision: "ACCEPTED" | "DECLINED" | null;
};

const interviewListSelect = `
  SELECT
    i.id,
    i.application_id,
    i.scheduled_at,
    i.time_zone,
    i.mode,
    i.location,
    i.meeting_url,
    i.interviewer_name,
    i.status AS interview_status,
    i.version AS interview_version,
    a.status AS application_status,
    sp.id AS student_profile_id,
    sp.student_code,
    sp.full_name AS student_full_name,
    sp.major AS student_major,
    sp.gpa AS student_gpa,
    j.id AS job_id,
    j.title AS job_title,
    c.id AS company_id,
    c.code AS company_code,
    c.name AS company_name,
    rr.outcome AS recruitment_outcome,
    rr.student_decision
  FROM interviews i
  JOIN applications a ON a.id = i.application_id
  JOIN student_profiles sp ON sp.id = a.student_profile_id
  JOIN job_posts j ON j.id = a.job_post_id
  JOIN companies c ON c.id = j.company_id
  LEFT JOIN recruitment_results rr ON rr.application_id = a.id
`;

function mapInterviewListItem(row: InterviewListRow): InterviewListItemDto {
  return {
    id: row.id,
    applicationId: row.application_id,
    scheduledAt: row.scheduled_at.toISOString(),
    timeZone: row.time_zone,
    mode: row.mode,
    location: row.location,
    meetingUrl: row.meeting_url,
    interviewerName: row.interviewer_name,
    status: row.interview_status,
    version: row.interview_version,
    applicationStatus: row.application_status,
    student: {
      id: row.student_profile_id,
      studentCode: row.student_code,
      fullName: row.student_full_name,
      major: row.student_major,
      gpa: row.student_gpa === null ? null : Number(row.student_gpa),
    },
    job: {
      id: row.job_id,
      title: row.job_title,
      company: { id: row.company_id, code: row.company_code, name: row.company_name },
    },
    recruitmentResult: row.recruitment_outcome
      ? { outcome: row.recruitment_outcome, studentDecision: row.student_decision }
      : null,
  };
}

export class ApplicationRepository {
  constructor(readonly database: ApplicationDatabase) {}

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.database.connect();
    await client.query("BEGIN");
    try {
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findStudentProfile(studentProfileId: string): Promise<StudentProfileDto | null> {
    const result = await this.database.query<{
      id: string;
      student_code: string;
      full_name: string;
      faculty: string;
      major: string;
      cohort: string;
      gpa: string | null;
      academic_status: string;
      email: string;
    }>(
      `SELECT sp.id, sp.student_code, sp.full_name, sp.faculty, sp.major, sp.cohort,
              sp.gpa, sp.academic_status, u.email
       FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1`,
      [studentProfileId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          studentCode: row.student_code,
          fullName: row.full_name,
          faculty: row.faculty,
          major: row.major,
          cohort: row.cohort,
          gpa: row.gpa === null ? null : Number(row.gpa),
          academicStatus: row.academic_status,
          email: row.email,
        }
      : null;
  }

  async listStudentDocuments(studentProfileId: string): Promise<StudentDocumentDto[]> {
    const result = await this.database.query<{
      id: string;
      document_type: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: string;
      version: number;
      is_default: boolean;
      verification_status: string;
      created_at: Date;
    }>(
      `SELECT id, document_type, file_name, mime_type, file_size_bytes, version,
              is_default, verification_status, created_at
       FROM student_documents WHERE student_profile_id = $1
       ORDER BY document_type, is_default DESC, created_at DESC`,
      [studentProfileId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      documentType: row.document_type,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: Number(row.file_size_bytes),
      version: row.version,
      isDefault: row.is_default,
      verificationStatus: row.verification_status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async findSourceDocuments(client: PoolClient, studentProfileId: string, ids: string[]): Promise<SourceDocument[]> {
    const result = await client.query<{
      id: string;
      document_type: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: string;
      storage_key: string;
      checksum: string | null;
      version: number;
      verification_status: string;
    }>(
      `SELECT id, document_type, file_name, mime_type, file_size_bytes, storage_key,
              checksum, version, verification_status
       FROM student_documents WHERE student_profile_id = $1 AND id = ANY($2::uuid[])
       FOR SHARE`,
      [studentProfileId, ids],
    );
    return result.rows.map((row) => ({
      id: row.id,
      documentType: row.document_type,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      storageKey: row.storage_key,
      checksum: row.checksum,
      version: row.version,
      verificationStatus: row.verification_status,
    }));
  }

  async findById(applicationId: string, studentProfileId: string, client: Pick<PoolClient, "query"> = this.database) {
    const result = await client.query<ApplicationRow>(
      `${applicationSelect} WHERE a.id = $1 AND a.student_profile_id = $2`,
      [applicationId, studentProfileId],
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async findByIdForUit(applicationId: string, client: Pick<PoolClient, "query"> = this.database) {
    const result = await client.query<ApplicationRow>(`${applicationSelect} WHERE a.id = $1`, [applicationId]);
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async findByIdForCompany(
    applicationId: string,
    companyId: string,
    client: Pick<PoolClient, "query"> = this.database,
  ) {
    const result = await client.query<ApplicationRow>(
      `${applicationSelect}
       WHERE a.id = $1 AND j.company_id = $2
         AND EXISTS (
           SELECT 1 FROM application_status_history company_visibility
           WHERE company_visibility.application_id = a.id
             AND company_visibility.to_status = 'FORWARDED_TO_COMPANY'
         )`,
      [applicationId, companyId],
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async findByCommand(client: PoolClient, studentProfileId: string, commandId: string) {
    const result = await client.query<ApplicationRow>(
      `${applicationSelect}
       JOIN application_status_history command_history ON command_history.application_id = a.id
       WHERE a.student_profile_id = $1 AND command_history.command_id = $2`,
      [studentProfileId, commandId],
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async listStudentApplications(
    studentProfileId: string,
    input: { page: number; pageSize: number; status?: ApplicationStatus },
  ) {
    const filters = ["a.student_profile_id = $1"];
    const values: unknown[] = [studentProfileId];
    if (input.status) {
      values.push(input.status);
      filters.push(`a.status = $${values.length}`);
    }
    const where = filters.join(" AND ");
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM applications a WHERE ${where}`,
      values,
    );
    values.push(input.pageSize, (input.page - 1) * input.pageSize);
    const result = await this.database.query<ApplicationRow>(
      `${applicationSelect} WHERE ${where}
       ORDER BY a.submitted_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(mapApplication), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listUitReviewQueue(input: { page: number; pageSize: number }) {
    const count = await this.database.query<{ total: string }>(
      "SELECT count(*)::text AS total FROM applications WHERE status = 'UIT_REVIEWING'",
    );
    const result = await this.database.query<ApplicationRow>(
      `${applicationSelect} WHERE a.status = 'UIT_REVIEWING'
       ORDER BY a.submitted_at ASC, a.id ASC LIMIT $1 OFFSET $2`,
      [input.pageSize, (input.page - 1) * input.pageSize],
    );
    return { items: result.rows.map(mapApplication), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listUitPlacementQueue(input: { page: number; pageSize: number }) {
    const count = await this.database.query<{ total: string }>(
      "SELECT count(*)::text AS total FROM applications WHERE status = 'ACCEPTED_PENDING_UIT_CONFIRMATION'",
    );
    const result = await this.database.query<ApplicationRow>(
      `${applicationSelect} WHERE a.status = 'ACCEPTED_PENDING_UIT_CONFIRMATION'
       ORDER BY a.last_transition_at ASC, a.id ASC LIMIT $1 OFFSET $2`,
      [input.pageSize, (input.page - 1) * input.pageSize],
    );
    return { items: result.rows.map(mapApplication), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listCompanyCandidates(
    companyId: string,
    input: { page: number; pageSize: number; jobId?: string; status?: ApplicationStatus },
  ) {
    const filters = [
      "j.company_id = $1",
      `EXISTS (
        SELECT 1 FROM application_status_history company_visibility
        WHERE company_visibility.application_id = a.id
          AND company_visibility.to_status = 'FORWARDED_TO_COMPANY'
      )`,
    ];
    const values: unknown[] = [companyId];
    if (input.jobId) {
      values.push(input.jobId);
      filters.push(`a.job_post_id = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status);
      filters.push(`a.status = $${values.length}`);
    }
    const where = filters.join(" AND ");
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM applications a JOIN job_posts j ON j.id = a.job_post_id
       WHERE ${where}`,
      values,
    );
    values.push(input.pageSize, (input.page - 1) * input.pageSize);
    const result = await this.database.query<ApplicationRow>(
      `${applicationSelect} WHERE ${where}
       ORDER BY a.last_transition_at DESC, a.id ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(mapApplication), total: Number(count.rows[0]?.total ?? 0) };
  }

  private interviewScopeFilter(scope: "upcoming" | "history" | "all") {
    if (scope === "upcoming") {
      return "i.scheduled_at >= now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'RESCHEDULE_REQUESTED')";
    }
    if (scope === "history") {
      return "(i.scheduled_at < now() OR i.status IN ('CANCELLED', 'COMPLETED', 'NO_SHOW'))";
    }
    return null;
  }

  async listStudentInterviews(
    studentProfileId: string,
    input: { page: number; pageSize: number; scope: "upcoming" | "history" | "all" },
  ) {
    const filters = ["a.student_profile_id = $1"];
    const scopeFilter = this.interviewScopeFilter(input.scope);
    if (scopeFilter) filters.push(scopeFilter);
    const where = filters.join(" AND ");
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM interviews i JOIN applications a ON a.id = i.application_id
       WHERE ${where}`,
      [studentProfileId],
    );
    const result = await this.database.query<InterviewListRow>(
      `${interviewListSelect} WHERE ${where}
       ORDER BY CASE
         WHEN i.scheduled_at >= now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'RESCHEDULE_REQUESTED') THEN 0
         ELSE 1
       END, i.scheduled_at ASC, i.id ASC
       LIMIT $2 OFFSET $3`,
      [studentProfileId, input.pageSize, (input.page - 1) * input.pageSize],
    );
    return { items: result.rows.map(mapInterviewListItem), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listCompanyInterviews(
    companyId: string,
    input: { page: number; pageSize: number; scope: "upcoming" | "history" | "all" },
  ) {
    const filters = ["j.company_id = $1"];
    const scopeFilter = this.interviewScopeFilter(input.scope);
    if (scopeFilter) filters.push(scopeFilter);
    const where = filters.join(" AND ");
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN job_posts j ON j.id = a.job_post_id
       WHERE ${where}`,
      [companyId],
    );
    const result = await this.database.query<InterviewListRow>(
      `${interviewListSelect} WHERE ${where}
       ORDER BY CASE
         WHEN i.scheduled_at >= now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'RESCHEDULE_REQUESTED') THEN 0
         ELSE 1
       END, i.scheduled_at ASC, i.id ASC
       LIMIT $2 OFFSET $3`,
      [companyId, input.pageSize, (input.page - 1) * input.pageSize],
    );
    return { items: result.rows.map(mapInterviewListItem), total: Number(count.rows[0]?.total ?? 0) };
  }

  async lockStudentInterview(client: PoolClient, interviewId: string, studentProfileId: string) {
    const result = await client.query<{
      id: string;
      application_id: string;
      status: string;
      student_full_name: string;
      job_title: string;
      company_id: string;
    }>(
      `SELECT i.id, i.application_id, i.status, sp.full_name AS student_full_name,
              j.title AS job_title, c.id AS company_id
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN student_profiles sp ON sp.id = a.student_profile_id
       JOIN job_posts j ON j.id = a.job_post_id
       JOIN companies c ON c.id = j.company_id
       WHERE i.id = $1 AND a.student_profile_id = $2
       FOR UPDATE OF i`,
      [interviewId, studentProfileId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          applicationId: row.application_id,
          status: row.status,
          studentFullName: row.student_full_name,
          jobTitle: row.job_title,
          companyId: row.company_id,
        }
      : null;
  }

  async findStudentInterview(
    client: Pick<PoolClient, "query">,
    interviewId: string,
    studentProfileId: string,
  ) {
    const result = await client.query<InterviewListRow>(
      `${interviewListSelect} WHERE i.id = $1 AND a.student_profile_id = $2`,
      [interviewId, studentProfileId],
    );
    return result.rows[0] ? mapInterviewListItem(result.rows[0]) : null;
  }

  async lockApplication(client: PoolClient, applicationId: string) {
    const result = await client.query<{
      id: string;
      status: ApplicationStatus;
      version: number;
      student_profile_id: string;
      student_user_id: string;
      student_full_name: string;
      job_post_id: string;
      job_title: string;
      company_id: string;
      company_name: string;
    }>(
      `SELECT a.id, a.status, a.version, a.student_profile_id, sp.user_id AS student_user_id,
              sp.full_name AS student_full_name, j.id AS job_post_id, j.title AS job_title,
              c.id AS company_id, c.name AS company_name
       FROM applications a
       JOIN student_profiles sp ON sp.id = a.student_profile_id
       JOIN job_posts j ON j.id = a.job_post_id
       JOIN companies c ON c.id = j.company_id
       WHERE a.id = $1 FOR UPDATE OF a`,
      [applicationId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          status: row.status,
          version: row.version,
          studentProfileId: row.student_profile_id,
          studentUserId: row.student_user_id,
          studentFullName: row.student_full_name,
          jobId: row.job_post_id,
          jobTitle: row.job_title,
          companyId: row.company_id,
          companyName: row.company_name,
        }
      : null;
  }

  async commandExists(client: PoolClient, applicationId: string, commandId: string) {
    const result = await client.query(
      "SELECT 1 FROM application_status_history WHERE application_id = $1 AND command_id = $2",
      [applicationId, commandId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findInterviewByCommand(client: Pick<PoolClient, "query">, applicationId: string, commandId: string) {
    const result = await client.query<{
      id: string;
      application_id: string;
      scheduled_at: Date;
      time_zone: string;
      mode: "ONSITE" | "ONLINE" | "PHONE";
      location: string | null;
      meeting_url: string | null;
      interviewer_name: string | null;
      status: string;
      version: number;
    }>(
      `SELECT id, application_id, scheduled_at, time_zone, mode, location, meeting_url,
              interviewer_name, status, version
       FROM interviews WHERE application_id = $1 AND command_id = $2`,
      [applicationId, commandId],
    );
    return result.rows[0] ? mapInterview(result.rows[0]) : null;
  }
}

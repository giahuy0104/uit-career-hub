import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  ApplicationDto,
  ApplicationStatus,
  AvailableAction,
  InterviewDto,
  InterviewListItemDto,
  StudentDocumentDto,
  StudentDocumentType,
  StudentDocumentVerificationStatus,
  StudentProfileDto,
  UitStudentDocumentReviewDto,
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

export type StudentDocumentUploadRecord = {
  id: string;
  studentProfileId: string;
  studentDocumentId: string | null;
  documentType: StudentDocumentType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  status: "PENDING" | "COMPLETED" | "REJECTED" | "EXPIRED";
  expiresAt: Date;
};

export type OfferDocumentUploadRecord = {
  id: string;
  applicationId: string;
  companyId: string;
  createdByUserId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  status: "PENDING" | "COMPLETED" | "REJECTED" | "EXPIRED" | "CONSUMED";
  expiresAt: Date;
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
        'offerDocument', CASE
          WHEN rr.offer_storage_key IS NULL THEN NULL
          ELSE jsonb_build_object(
            'fileName', COALESCE(odu.file_name, regexp_replace(rr.offer_storage_key, '^.*/', '')),
            'mimeType', COALESCE(odu.mime_type, 'application/pdf'),
            'fileSizeBytes', odu.file_size_bytes
          )
        END
      )
      FROM recruitment_results rr
      LEFT JOIN offer_document_uploads odu ON odu.id = rr.offer_upload_id
      WHERE rr.application_id = a.id
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
    recruitmentResult: row.recruitment_result
      ? {
          ...row.recruitment_result,
          offerDocument: row.recruitment_result.offerDocument
            ? {
                ...row.recruitment_result.offerDocument,
                fileSizeBytes: row.recruitment_result.offerDocument.fileSizeBytes === null
                  ? null
                  : Number(row.recruitment_result.offerDocument.fileSizeBytes),
              }
            : null,
        }
      : null,
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

  async findStudentProfile(
    studentProfileId: string,
    client: Pick<PoolClient, "query"> = this.database,
  ): Promise<StudentProfileDto | null> {
    const result = await client.query<{
      id: string;
      student_code: string;
      full_name: string;
      faculty: string;
      major: string;
      cohort: string;
      gpa: string | null;
      phone: string | null;
      academic_status: string;
      email: string;
    }>(
      `SELECT sp.id, sp.student_code, sp.full_name, sp.faculty, sp.major, sp.cohort,
              sp.gpa, sp.phone, sp.academic_status, u.email
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
          phone: row.phone,
          academicStatus: row.academic_status,
          email: row.email,
        }
      : null;
  }

  async listStudentDocuments(
    studentProfileId: string,
    client: Pick<PoolClient, "query"> = this.database,
  ): Promise<StudentDocumentDto[]> {
    const result = await client.query<{
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

  async listStudentDocumentsForReview(input: {
    page: number;
    pageSize: number;
    status: StudentDocumentVerificationStatus;
    query?: string;
  }): Promise<{ items: UitStudentDocumentReviewDto[]; total: number }> {
    const search = input.query?.trim() || null;
    const result = await this.database.query<{
      id: string;
      document_type: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: string;
      version: number;
      is_default: boolean;
      verification_status: StudentDocumentVerificationStatus;
      created_at: Date;
      student_profile_id: string;
      student_code: string;
      full_name: string;
      email: string;
      faculty: string;
      major: string;
      total_count: string;
    }>(
      `SELECT sd.id, sd.document_type, sd.file_name, sd.mime_type, sd.file_size_bytes,
              sd.version, sd.is_default, sd.verification_status, sd.created_at,
              sp.id AS student_profile_id, sp.student_code, sp.full_name, u.email,
              sp.faculty, sp.major, count(*) OVER() AS total_count
       FROM student_documents sd
       JOIN student_profiles sp ON sp.id = sd.student_profile_id
       JOIN users u ON u.id = sp.user_id
       WHERE sd.verification_status = $1
         AND ($2::text IS NULL OR sp.full_name ILIKE '%' || $2 || '%'
              OR sp.student_code ILIKE '%' || $2 || '%'
              OR sd.file_name ILIKE '%' || $2 || '%')
       ORDER BY sd.created_at ASC, sd.id ASC
       LIMIT $3 OFFSET $4`,
      [input.status, search, input.pageSize, (input.page - 1) * input.pageSize],
    );
    return {
      items: result.rows.map((row) => this.mapStudentDocumentForReview(row)),
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  async findStudentDocumentForUit(
    documentId: string,
    client: Pick<PoolClient, "query"> = this.database,
    lock = false,
  ) {
    const result = await client.query<{
      id: string;
      document_type: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: string;
      storage_key: string;
      version: number;
      is_default: boolean;
      verification_status: StudentDocumentVerificationStatus;
      created_at: Date;
      student_profile_id: string;
      student_user_id: string;
      student_code: string;
      full_name: string;
      email: string;
      faculty: string;
      major: string;
      total_count: string;
    }>(
      `SELECT sd.id, sd.document_type, sd.file_name, sd.mime_type, sd.file_size_bytes,
              sd.storage_key, sd.version, sd.is_default, sd.verification_status, sd.created_at,
              sp.id AS student_profile_id, sp.user_id AS student_user_id, sp.student_code,
              sp.full_name, u.email, sp.faculty, sp.major, '1'::text AS total_count
       FROM student_documents sd
       JOIN student_profiles sp ON sp.id = sd.student_profile_id
       JOIN users u ON u.id = sp.user_id
       WHERE sd.id = $1${lock ? " FOR UPDATE OF sd" : ""}`,
      [documentId],
    );
    const row = result.rows[0];
    return row
      ? {
          dto: this.mapStudentDocumentForReview(row),
          storageKey: row.storage_key,
          studentUserId: row.student_user_id,
          studentProfileId: row.student_profile_id,
        }
      : null;
  }

  async updateStudentDocumentVerification(
    client: PoolClient,
    documentId: string,
    status: "VERIFIED" | "REJECTED",
  ) {
    await client.query(
      `UPDATE student_documents SET verification_status = $2 WHERE id = $1`,
      [documentId, status],
    );
  }

  private mapStudentDocumentForReview(row: {
    id: string;
    document_type: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: string;
    version: number;
    is_default: boolean;
    verification_status: StudentDocumentVerificationStatus;
    created_at: Date;
    student_profile_id: string;
    student_code: string;
    full_name: string;
    email: string;
    faculty: string;
    major: string;
  }): UitStudentDocumentReviewDto {
    return {
      id: row.id,
      documentType: row.document_type,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: Number(row.file_size_bytes),
      version: row.version,
      isDefault: row.is_default,
      verificationStatus: row.verification_status,
      createdAt: row.created_at.toISOString(),
      student: {
        id: row.student_profile_id,
        studentCode: row.student_code,
        fullName: row.full_name,
        email: row.email,
        faculty: row.faculty,
        major: row.major,
      },
    };
  }

  async createStudentDocumentUpload(input: {
    id: string;
    studentProfileId: string;
    documentType: StudentDocumentType;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    expiresAt: Date;
  }) {
    await this.database.query(
      `INSERT INTO student_document_uploads
       (id, student_profile_id, document_type, file_name, mime_type, file_size_bytes, storage_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.id,
        input.studentProfileId,
        input.documentType,
        input.fileName,
        input.mimeType,
        input.fileSizeBytes,
        input.storageKey,
        input.expiresAt,
      ],
    );
  }

  async findStudentDocumentUpload(
    studentProfileId: string,
    uploadId: string,
    client: Pick<PoolClient, "query"> = this.database,
    lock = false,
  ): Promise<StudentDocumentUploadRecord | null> {
    const result = await client.query<{
      id: string;
      student_profile_id: string;
      student_document_id: string | null;
      document_type: StudentDocumentType;
      file_name: string;
      mime_type: string;
      file_size_bytes: string;
      storage_key: string;
      status: StudentDocumentUploadRecord["status"];
      expires_at: Date;
    }>(
      `SELECT id, student_profile_id, student_document_id, document_type, file_name, mime_type,
              file_size_bytes, storage_key, status, expires_at
       FROM student_document_uploads
       WHERE id = $1 AND student_profile_id = $2${lock ? " FOR UPDATE" : ""}`,
      [uploadId, studentProfileId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          studentProfileId: row.student_profile_id,
          studentDocumentId: row.student_document_id,
          documentType: row.document_type,
          fileName: row.file_name,
          mimeType: row.mime_type,
          fileSizeBytes: Number(row.file_size_bytes),
          storageKey: row.storage_key,
          status: row.status,
          expiresAt: row.expires_at,
        }
      : null;
  }

  async completeStudentDocumentUpload(client: PoolClient, upload: StudentDocumentUploadRecord, etag: string | null) {
    const existing = upload.studentDocumentId
      ? await client.query<{ id: string }>("SELECT id FROM student_documents WHERE id = $1", [upload.studentDocumentId])
      : null;
    if (existing?.rows[0]) return upload.studentDocumentId!;

    const versionResult = await client.query<{ next_version: number }>(
      `SELECT COALESCE(max(version), 0) + 1 AS next_version
       FROM student_documents
       WHERE student_profile_id = $1 AND document_type = $2`,
      [upload.studentProfileId, upload.documentType],
    );
    const documentResult = await client.query<{ id: string }>(
      `INSERT INTO student_documents
       (student_profile_id, document_type, file_name, mime_type, file_size_bytes,
        storage_key, checksum, version, is_default, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 'PENDING')
       RETURNING id`,
      [
        upload.studentProfileId,
        upload.documentType,
        upload.fileName,
        upload.mimeType,
        upload.fileSizeBytes,
        upload.storageKey,
        etag,
        Number(versionResult.rows[0]?.next_version ?? 1),
      ],
    );
    const documentId = documentResult.rows[0]!.id;
    await client.query(
      `UPDATE student_document_uploads
       SET status = 'COMPLETED', student_document_id = $2, etag = $3, completed_at = now()
       WHERE id = $1`,
      [upload.id, documentId, etag],
    );
    return documentId;
  }

  async rejectStudentDocumentUpload(client: PoolClient, uploadId: string, status: "REJECTED" | "EXPIRED") {
    await client.query(
      `UPDATE student_document_uploads SET status = $2
       WHERE id = $1 AND status = 'PENDING'`,
      [uploadId, status],
    );
  }

  async createOfferDocumentUpload(input: {
    id: string;
    applicationId: string;
    companyId: string;
    createdByUserId: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    expiresAt: Date;
  }) {
    await this.database.query(
      `INSERT INTO offer_document_uploads
       (id, application_id, company_id, created_by_user_id, file_name, mime_type,
        file_size_bytes, storage_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.id,
        input.applicationId,
        input.companyId,
        input.createdByUserId,
        input.fileName,
        input.mimeType,
        input.fileSizeBytes,
        input.storageKey,
        input.expiresAt,
      ],
    );
  }

  async findOfferDocumentUpload(
    companyId: string,
    applicationId: string,
    uploadId: string,
    client: Pick<PoolClient, "query"> = this.database,
    lock = false,
  ): Promise<OfferDocumentUploadRecord | null> {
    const result = await client.query<{
      id: string;
      application_id: string;
      company_id: string;
      created_by_user_id: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: string;
      storage_key: string;
      status: OfferDocumentUploadRecord["status"];
      expires_at: Date;
    }>(
      `SELECT id, application_id, company_id, created_by_user_id, file_name, mime_type,
              file_size_bytes, storage_key, status, expires_at
       FROM offer_document_uploads
       WHERE id = $1 AND application_id = $2 AND company_id = $3${lock ? " FOR UPDATE" : ""}`,
      [uploadId, applicationId, companyId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          applicationId: row.application_id,
          companyId: row.company_id,
          createdByUserId: row.created_by_user_id,
          fileName: row.file_name,
          mimeType: row.mime_type,
          fileSizeBytes: Number(row.file_size_bytes),
          storageKey: row.storage_key,
          status: row.status,
          expiresAt: row.expires_at,
        }
      : null;
  }

  async completeOfferDocumentUpload(client: PoolClient, uploadId: string, etag: string | null) {
    await client.query(
      `UPDATE offer_document_uploads
       SET status = 'COMPLETED', etag = $2, completed_at = now()
       WHERE id = $1 AND status = 'PENDING'`,
      [uploadId, etag],
    );
  }

  async rejectOfferDocumentUpload(client: PoolClient, uploadId: string, status: "REJECTED" | "EXPIRED") {
    await client.query(
      `UPDATE offer_document_uploads SET status = $2
       WHERE id = $1 AND status = 'PENDING'`,
      [uploadId, status],
    );
  }

  async consumeOfferDocumentUpload(client: PoolClient, uploadId: string) {
    const result = await client.query<{ storage_key: string }>(
      `UPDATE offer_document_uploads
       SET status = 'CONSUMED', consumed_at = now()
       WHERE id = $1 AND status = 'COMPLETED'
       RETURNING storage_key`,
      [uploadId],
    );
    return result.rows[0]?.storage_key ?? null;
  }

  async findStudentDocumentStorage(studentProfileId: string, documentId: string) {
    const result = await this.database.query<{ storage_key: string; file_name: string }>(
      `SELECT storage_key, file_name FROM student_documents
       WHERE id = $1 AND student_profile_id = $2`,
      [documentId, studentProfileId],
    );
    const row = result.rows[0];
    return row ? { storageKey: row.storage_key, fileName: row.file_name } : null;
  }

  async updateStudentPhone(client: PoolClient, studentProfileId: string, phone: string | null) {
    const result = await client.query(
      `UPDATE student_profiles
       SET phone = $2
       WHERE id = $1
       RETURNING id`,
      [studentProfileId, phone],
    );
    return result.rowCount === 1;
  }

  async lockStudentDocument(client: PoolClient, studentProfileId: string, documentId: string) {
    const result = await client.query<{
      id: string;
      document_type: string;
      verification_status: string;
      is_default: boolean;
      storage_key: string;
      used_by_application: boolean;
    }>(
      `SELECT sd.id, sd.document_type, sd.verification_status, sd.is_default, sd.storage_key,
              EXISTS (
                SELECT 1 FROM application_documents ad WHERE ad.source_document_id = sd.id
              ) AS used_by_application
       FROM student_documents sd
       WHERE sd.id = $1 AND sd.student_profile_id = $2
       FOR UPDATE`,
      [documentId, studentProfileId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          documentType: row.document_type,
          verificationStatus: row.verification_status,
          isDefault: row.is_default,
          storageKey: row.storage_key,
          usedByApplication: row.used_by_application,
        }
      : null;
  }

  async deleteStudentDocument(client: PoolClient, studentProfileId: string, documentId: string) {
    await client.query(
      "DELETE FROM student_document_uploads WHERE student_document_id = $1 AND student_profile_id = $2",
      [documentId, studentProfileId],
    );
    const result = await client.query(
      "DELETE FROM student_documents WHERE id = $1 AND student_profile_id = $2 RETURNING id",
      [documentId, studentProfileId],
    );
    return result.rowCount === 1;
  }

  async setDefaultCv(client: PoolClient, studentProfileId: string, documentId: string) {
    await client.query(
      `UPDATE student_documents
       SET is_default = false
       WHERE student_profile_id = $1 AND document_type = 'CV' AND is_default`,
      [studentProfileId],
    );
    await client.query(
      `UPDATE student_documents
       SET is_default = true
       WHERE id = $1 AND student_profile_id = $2 AND document_type = 'CV'`,
      [documentId, studentProfileId],
    );
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

  async findApplicationDocumentForUit(applicationId: string, documentId: string) {
    const result = await this.database.query<{
      id: string;
      storage_key: string;
      file_name: string;
    }>(
      `SELECT ad.id, ad.storage_key, ad.file_name
       FROM application_documents ad
       WHERE ad.application_id = $1 AND ad.id = $2`,
      [applicationId, documentId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, storageKey: row.storage_key, fileName: row.file_name } : null;
  }

  async findApplicationDocumentForCompany(applicationId: string, documentId: string, companyId: string) {
    const result = await this.database.query<{
      id: string;
      storage_key: string;
      file_name: string;
    }>(
      `SELECT ad.id, ad.storage_key, ad.file_name
       FROM application_documents ad
       JOIN applications a ON a.id = ad.application_id
       JOIN job_posts j ON j.id = a.job_post_id
       WHERE ad.application_id = $1 AND ad.id = $2 AND j.company_id = $3
         AND EXISTS (
           SELECT 1 FROM application_status_history company_visibility
           WHERE company_visibility.application_id = a.id
             AND company_visibility.to_status = 'FORWARDED_TO_COMPANY'
         )`,
      [applicationId, documentId, companyId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, storageKey: row.storage_key, fileName: row.file_name } : null;
  }

  async recordApplicationDocumentDownload(input: {
    actorUserId: string;
    actorType: "UIT_ADMIN" | "COMPANY";
    applicationId: string;
    documentId: string;
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    await this.database.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, 'APPLICATION_DOCUMENT_DOWNLOAD_URL_CREATED', 'APPLICATION_DOCUMENT', $2,
               jsonb_build_object('applicationId', $3::uuid::text, 'actorType', $4::text), $5, $6)`,
      [
        input.actorUserId,
        input.documentId,
        input.applicationId,
        input.actorType,
        input.ipAddress,
        input.userAgent,
      ],
    );
  }

  async findStudentOfferDocumentStorage(studentProfileId: string, applicationId: string) {
    return this.findOfferDocumentStorage(
      `a.student_profile_id = $2`,
      [applicationId, studentProfileId],
    );
  }

  async findUitOfferDocumentStorage(applicationId: string) {
    return this.findOfferDocumentStorage("TRUE", [applicationId]);
  }

  async findCompanyOfferDocumentStorage(companyId: string, applicationId: string) {
    return this.findOfferDocumentStorage(
      `j.company_id = $2 AND EXISTS (
         SELECT 1 FROM application_status_history company_visibility
         WHERE company_visibility.application_id = a.id
           AND company_visibility.to_status = 'FORWARDED_TO_COMPANY'
       )`,
      [applicationId, companyId],
    );
  }

  private async findOfferDocumentStorage(scopeSql: string, values: unknown[]) {
    const result = await this.database.query<{
      recruitment_result_id: string;
      storage_key: string;
      file_name: string;
    }>(
      `SELECT rr.id AS recruitment_result_id, rr.offer_storage_key AS storage_key,
              COALESCE(odu.file_name, regexp_replace(rr.offer_storage_key, '^.*/', '')) AS file_name
       FROM recruitment_results rr
       JOIN applications a ON a.id = rr.application_id
       JOIN job_posts j ON j.id = a.job_post_id
       LEFT JOIN offer_document_uploads odu ON odu.id = rr.offer_upload_id
       WHERE rr.application_id = $1 AND rr.outcome = 'PASS'
         AND rr.offer_storage_key IS NOT NULL AND ${scopeSql}`,
      values,
    );
    const row = result.rows[0];
    return row
      ? { resultId: row.recruitment_result_id, storageKey: row.storage_key, fileName: row.file_name }
      : null;
  }

  async recordOfferDocumentDownload(input: {
    actorUserId: string;
    actorType: "STUDENT" | "UIT_ADMIN" | "COMPANY";
    applicationId: string;
    resultId: string;
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    await this.database.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, 'OFFER_DOCUMENT_DOWNLOAD_URL_CREATED', 'RECRUITMENT_RESULT', $2,
               jsonb_build_object('applicationId', $3::uuid::text, 'actorType', $4::text), $5, $6)`,
      [
        input.actorUserId,
        input.resultId,
        input.applicationId,
        input.actorType,
        input.ipAddress,
        input.userAgent,
      ],
    );
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

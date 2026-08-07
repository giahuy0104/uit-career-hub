import { AppError } from "../../shared/app-error.js";
import { ApplicationRepository } from "./application.repository.js";
import type { ApplicationStatus, RequestMetadata } from "./application.types.js";

function studentNotFound() {
  return new AppError(404, "STUDENT_PROFILE_NOT_FOUND", "Không tìm thấy hồ sơ sinh viên.");
}

function applicationNotFound() {
  return new AppError(404, "APPLICATION_NOT_FOUND", "Không tìm thấy đơn ứng tuyển.");
}

export class ApplicationService {
  constructor(private readonly repository: ApplicationRepository) {}

  async getStudentProfile(studentProfileId: string | null) {
    if (!studentProfileId) throw studentNotFound();
    const profile = await this.repository.findStudentProfile(studentProfileId);
    if (!profile) throw studentNotFound();
    return profile;
  }

  async listStudentDocuments(studentProfileId: string | null) {
    if (!studentProfileId) throw studentNotFound();
    return this.repository.listStudentDocuments(studentProfileId);
  }

  async listApplications(
    studentProfileId: string | null,
    input: { page: number; pageSize: number; status?: ApplicationStatus },
  ) {
    if (!studentProfileId) throw studentNotFound();
    return this.repository.listStudentApplications(studentProfileId, input);
  }

  async getApplication(studentProfileId: string | null, applicationId: string) {
    if (!studentProfileId) throw studentNotFound();
    const application = await this.repository.findById(applicationId, studentProfileId);
    if (!application) throw applicationNotFound();
    return application;
  }

  async submit(
    actor: { userId: string; studentProfileId: string | null },
    input: { jobId: string; documents: Array<{ documentId: string }>; consentToShare: true },
    commandId: string,
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;
    return this.repository.withTransaction(async (client) => {
      const lockKey = `${studentProfileId}:${input.jobId}`;
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);

      const repeated = await this.repository.findByCommand(client, studentProfileId, commandId);
      if (repeated) {
        if (repeated.job.id !== input.jobId) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key đã được dùng cho một yêu cầu khác.");
        }
        return repeated;
      }

      const student = await client.query<{ academic_status: string }>(
        "SELECT academic_status FROM student_profiles WHERE id = $1 FOR SHARE",
        [studentProfileId],
      );
      if (!student.rows[0]) throw studentNotFound();
      if (student.rows[0].academic_status !== "ACTIVE") {
        throw new AppError(403, "STUDENT_NOT_ACTIVE", "Sinh viên không ở trạng thái đủ điều kiện ứng tuyển.");
      }

      const job = await client.query<{ title: string; status: string; deadline: string | Date; partner_status: string }>(
        `SELECT j.title, j.status, j.deadline, c.partner_status
         FROM job_posts j JOIN companies c ON c.id = j.company_id
         WHERE j.id = $1 FOR SHARE OF j`,
        [input.jobId],
      );
      const targetJob = job.rows[0];
      if (!targetJob || targetJob.status !== "RECRUITING" || targetJob.partner_status !== "ACTIVE") {
        throw new AppError(404, "JOB_NOT_AVAILABLE", "Tin tuyển dụng không còn nhận hồ sơ.");
      }
      const deadline = typeof targetJob.deadline === "string"
        ? targetJob.deadline.slice(0, 10)
        : targetJob.deadline.toISOString().slice(0, 10);
      if (deadline < new Date().toISOString().slice(0, 10)) {
        throw new AppError(409, "JOB_DEADLINE_EXPIRED", "Tin tuyển dụng đã hết hạn ứng tuyển.");
      }

      const duplicate = await client.query(
        `SELECT 1 FROM applications
         WHERE student_profile_id = $1 AND job_post_id = $2
           AND status IN ('UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
                          'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'OFFER_PENDING_STUDENT',
                          'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED')`,
        [studentProfileId, input.jobId],
      );
      if ((duplicate.rowCount ?? 0) > 0) {
        throw new AppError(409, "APPLICATION_ALREADY_ACTIVE", "Bạn đã có đơn đang được xử lý cho tin tuyển dụng này.");
      }

      const documentIds = input.documents.map((document) => document.documentId);
      const documents = await this.repository.findSourceDocuments(client, studentProfileId, documentIds);
      if (documents.length !== documentIds.length) {
        throw new AppError(400, "APPLICATION_DOCUMENT_INVALID", "Có tài liệu không thuộc hồ sơ của bạn.");
      }
      if (documents.some((document) => document.verificationStatus !== "VERIFIED")) {
        throw new AppError(400, "APPLICATION_DOCUMENT_NOT_VERIFIED", "Chỉ có thể gửi tài liệu đã được xác minh.");
      }
      if (!documents.some((document) => document.documentType === "CV")) {
        throw new AppError(400, "APPLICATION_CV_REQUIRED", "Đơn ứng tuyển phải có ít nhất một CV.");
      }

      const created = await client.query<{ id: string }>(
        `INSERT INTO applications
         (student_profile_id, job_post_id, status, consented_at)
         VALUES ($1, $2, 'UIT_REVIEWING', now()) RETURNING id`,
        [studentProfileId, input.jobId],
      );
      const applicationId = created.rows[0]!.id;
      for (const document of documents) {
        await client.query(
          `INSERT INTO application_documents
           (application_id, source_document_id, document_type, file_name, mime_type,
            file_size_bytes, storage_key, checksum, source_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            applicationId,
            document.id,
            document.documentType,
            document.fileName,
            document.mimeType,
            document.fileSizeBytes,
            document.storageKey,
            document.checksum,
            document.version,
          ],
        );
      }
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id)
         VALUES ($1, $2, NULL, 'UIT_REVIEWING', 'STUDENT', $3)`,
        [applicationId, commandId, actor.userId],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'APPLICATION_SUBMITTED', 'Có hồ sơ sinh viên cần xử lý',
                'Có đơn mới ứng tuyển vị trí "' || $3 || '".', 'APPLICATION', $1::uuid,
                '/uit/applications/' || $1::text,
                'application:' || $1::text || ':submitted:' || $2::text || ':' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text)
         FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [applicationId, commandId, targetJob.title],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'APPLICATION_SUBMITTED', 'APPLICATION', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          applicationId,
          JSON.stringify({ jobId: input.jobId, commandId, documentCount: documents.length }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findById(applicationId, studentProfileId, client))!;
    });
  }
}

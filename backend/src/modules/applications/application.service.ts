import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/app-error.js";
import { ApplicationRepository } from "./application.repository.js";
import type { ApplicationReviewDecision, ApplicationStatus, RequestMetadata } from "./application.types.js";

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

  async listReviewQueue(input: { page: number; pageSize: number }) {
    return this.repository.listUitReviewQueue(input);
  }

  async review(
    actorUserId: string,
    applicationId: string,
    commandId: string,
    decision: ApplicationReviewDecision,
    payload: {
      reasonCode?: string;
      note?: string;
      requiredDocumentTypes?: string[];
      dueAt?: string;
    },
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findByIdForUit(applicationId, client))!;
      }
      if (application.status !== "UIT_REVIEWING") {
        throw new AppError(
          409,
          "APPLICATION_STATE_CONFLICT",
          "Hồ sơ không còn ở trạng thái chờ UIT kiểm duyệt.",
        );
      }

      const toStatus: ApplicationStatus = decision === "request-supplement"
        ? "NEEDS_SUPPLEMENT"
        : decision === "reject"
          ? "UIT_REJECTED"
          : "FORWARDED_TO_COMPANY";
      const reasonCode = decision === "forward" ? null : payload.reasonCode!;
      const note = decision === "forward" ? null : payload.note!;
      const historyMetadata = decision === "request-supplement"
        ? { requiredDocumentTypes: payload.requiredDocumentTypes, dueAt: payload.dueAt }
        : {};

      await client.query(
        `UPDATE applications
         SET status = $2, version = version + 1, last_transition_at = now()
         WHERE id = $1`,
        [applicationId, toStatus],
      );
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id,
          reason_code, note, metadata)
         VALUES ($1, $2, 'UIT_REVIEWING', $3, 'UIT_ADMIN', $4, $5, $6, $7::jsonb)`,
        [applicationId, commandId, toStatus, actorUserId, reasonCode, note, JSON.stringify(historyMetadata)],
      );

      const studentNotification = decision === "request-supplement"
        ? {
            type: "APPLICATION_SUPPLEMENT_REQUESTED",
            title: "Hồ sơ cần được bổ sung",
            body: `UIT yêu cầu bạn bổ sung hồ sơ cho vị trí “${application.jobTitle}” trước ${payload.dueAt}.`,
          }
        : decision === "reject"
          ? {
              type: "APPLICATION_UIT_REJECTED",
              title: "Hồ sơ chưa đủ điều kiện",
              body: `UIT đã kết thúc đơn ứng tuyển vị trí “${application.jobTitle}”.`,
            }
          : {
              type: "APPLICATION_FORWARDED",
              title: "Hồ sơ đã chuyển đến doanh nghiệp",
              body: `UIT đã chuyển hồ sơ vị trí “${application.jobTitle}” đến ${application.companyName}.`,
            };
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, $2, $3, $4, 'APPLICATION', $5::uuid, $6,
                 'application:' || $5::text || ':' || $7::text || ':student',
                 jsonb_build_object('applicationId', $5::text, 'commandId', $7::text, 'status', $8::text))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          application.studentUserId,
          studentNotification.type,
          studentNotification.title,
          studentNotification.body,
          applicationId,
          `/applications/${applicationId}`,
          commandId,
          toStatus,
        ],
      );

      if (decision === "forward") {
        await client.query(
          `INSERT INTO notifications
           (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
           SELECT u.id, 'APPLICATION_RECEIVED', 'Có hồ sơ ứng viên cần xử lý',
                  $3 || ' đã được UIT chuyển đến vị trí “' || $4 || '”.',
                  'APPLICATION', $1::uuid, '/company/candidates/' || $1::text,
                  'application:' || $1::text || ':' || $2::text || ':company:' || u.id::text,
                  jsonb_build_object('applicationId', $1::text, 'commandId', $2::text, 'jobId', $5::text)
           FROM company_users cu JOIN users u ON u.id = cu.user_id
           WHERE cu.company_id = $6 AND u.status = 'ACTIVE'
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [
            applicationId,
            commandId,
            application.studentFullName,
            application.jobTitle,
            application.jobId,
            application.companyId,
          ],
        );
      }

      const action = decision === "request-supplement"
        ? "APPLICATION_SUPPLEMENT_REQUESTED"
        : decision === "reject"
          ? "APPLICATION_UIT_REJECTED"
          : "APPLICATION_FORWARDED";
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, $2, 'APPLICATION', $3, $4::jsonb, $5, $6)`,
        [
          actorUserId,
          action,
          applicationId,
          JSON.stringify({ commandId, fromStatus: "UIT_REVIEWING", toStatus, ...historyMetadata }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findByIdForUit(applicationId, client))!;
    });
  }

  async listCompanyCandidates(
    companyId: string | null,
    input: { page: number; pageSize: number; jobId?: string; status?: ApplicationStatus },
  ) {
    if (!companyId) throw applicationNotFound();
    return this.repository.listCompanyCandidates(companyId, input);
  }

  async startCompanyReview(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    commandId: string,
    request: RequestMetadata,
  ) {
    return this.companyDecision(actor, applicationId, commandId, "start-review", {}, request);
  }

  async rejectCompanyApplication(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    commandId: string,
    payload: { reasonCode: string; note: string },
    request: RequestMetadata,
  ) {
    return this.companyDecision(actor, applicationId, commandId, "reject", payload, request);
  }

  private async companyDecision(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    commandId: string,
    decision: "start-review" | "reject",
    payload: { reasonCode?: string; note?: string },
    request: RequestMetadata,
  ) {
    if (!actor.companyId) throw applicationNotFound();
    const companyId = actor.companyId;
    return this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application || application.companyId !== companyId) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findByIdForCompany(applicationId, companyId, client))!;
      }

      const expectedStatus: ApplicationStatus = decision === "start-review"
        ? "FORWARDED_TO_COMPANY"
        : "COMPANY_REVIEWING";
      if (application.status !== expectedStatus) {
        throw new AppError(
          409,
          "APPLICATION_STATE_CONFLICT",
          decision === "start-review"
            ? "Há»“ sÆ¡ khÃ´ng cÃ²n á»Ÿ tráº¡ng thÃ¡i má»›i tá»« UIT."
            : "Chá»‰ cÃ³ thá»ƒ chá»n KhÃ´ng phÃ¹ há»£p khi há»“ sÆ¡ Ä‘ang Ä‘Æ°á»£c sÃ ng lá»c.",
        );
      }

      const toStatus: ApplicationStatus = decision === "start-review" ? "COMPANY_REVIEWING" : "NOT_SUITABLE";
      await client.query(
        `UPDATE applications
         SET status = $2, version = version + 1, last_transition_at = now()
         WHERE id = $1`,
        [applicationId, toStatus],
      );
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id,
          reason_code, note)
         VALUES ($1, $2, $3, $4, 'COMPANY', $5, $6, $7)`,
        [
          applicationId,
          commandId,
          expectedStatus,
          toStatus,
          actor.userId,
          decision === "reject" ? payload.reasonCode : null,
          decision === "reject" ? payload.note : null,
        ],
      );

      const notification = decision === "start-review"
        ? {
            type: "APPLICATION_COMPANY_REVIEWING",
            title: "Doanh nghiá»‡p Ä‘ang xem há»“ sÆ¡",
            body: `${application.companyName} Ä‘Ã£ báº¯t Ä‘áº§u xem há»“ sÆ¡ vá»‹ trÃ­ â€œ${application.jobTitle}â€ cá»§a báº¡n.`,
          }
        : {
            type: "APPLICATION_NOT_SUITABLE",
            title: "Doanh nghiá»‡p Ä‘Ã£ pháº£n há»“i há»“ sÆ¡",
            body: `Há»“ sÆ¡ vá»‹ trÃ­ â€œ${application.jobTitle}â€ táº¡i ${application.companyName} chÆ°a phÃ¹ há»£p.`,
          };
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, $2, $3, $4, 'APPLICATION', $5::uuid, '/applications/' || $5::text,
                 'application:' || $5::text || ':' || $6::text || ':student',
                 jsonb_build_object('applicationId', $5::text, 'commandId', $6::text, 'status', $7::text))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [application.studentUserId, notification.type, notification.title, notification.body, applicationId, commandId, toStatus],
      );

      if (decision === "reject") {
        await client.query(
          `INSERT INTO notifications
           (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
           SELECT u.id, 'APPLICATION_NOT_SUITABLE_RECORDED', 'Doanh nghiá»‡p Ä‘Ã£ cáº­p nháº­t káº¿t quáº£',
                  $3 || ' Ä‘Ã£ chá»n KhÃ´ng phÃ¹ há»£p cho há»“ sÆ¡ vá»‹ trÃ­ â€œ' || $4 || 'â€.',
                  'APPLICATION', $1::uuid, '/uit/applications/' || $1::text,
                  'application:' || $1::text || ':' || $2::text || ':uit:' || u.id::text,
                  jsonb_build_object('applicationId', $1::text, 'commandId', $2::text, 'status', 'NOT_SUITABLE')
           FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [applicationId, commandId, application.companyName, application.jobTitle],
        );
      }

      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, $2, 'APPLICATION', $3, $4::jsonb, $5, $6)`,
        [
          actor.userId,
          decision === "start-review" ? "APPLICATION_COMPANY_REVIEW_STARTED" : "APPLICATION_NOT_SUITABLE",
          applicationId,
          JSON.stringify({ commandId, fromStatus: expectedStatus, toStatus, reasonCode: payload.reasonCode ?? null }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findByIdForCompany(applicationId, companyId, client))!;
    });
  }

  async scheduleInterview(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    commandId: string,
    input: {
      scheduledAt: string;
      timeZone: string;
      mode: "ONSITE" | "ONLINE" | "PHONE";
      location?: string;
      meetingUrl?: string;
      interviewerName: string;
    },
    request: RequestMetadata,
  ) {
    if (!actor.companyId) throw applicationNotFound();
    if (new Date(input.scheduledAt).getTime() <= Date.now() + 15 * 60 * 1_000) {
      throw new AppError(400, "INTERVIEW_TIME_INVALID", "Lá»‹ch phá»ng váº¥n pháº£i cÃ¡ch thá»i Ä‘iá»ƒm hiá»‡n táº¡i Ã­t nháº¥t 15 phÃºt.");
    }
    const companyId = actor.companyId;
    return this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application || application.companyId !== companyId) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        const repeated = await this.repository.findInterviewByCommand(client, applicationId, commandId);
        if (!repeated) throw new AppError(409, "APPLICATION_STATE_CONFLICT", "YÃªu cáº§u Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½.");
        return repeated;
      }
      if (application.status !== "COMPANY_REVIEWING") {
        throw new AppError(
          409,
          "APPLICATION_STATE_CONFLICT",
          "Chá»‰ cÃ³ thá»ƒ má»i phá»ng váº¥n khi há»“ sÆ¡ Ä‘ang Ä‘Æ°á»£c sÃ ng lá»c.",
        );
      }

      const interviewId = randomUUID();
      await client.query(
        `INSERT INTO interviews
         (id, application_id, command_id, created_by_user_id, scheduled_at, time_zone, mode,
          location, meeting_url, interviewer_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          interviewId,
          applicationId,
          commandId,
          actor.userId,
          input.scheduledAt,
          input.timeZone,
          input.mode,
          input.location ?? null,
          input.meetingUrl ?? null,
          input.interviewerName,
        ],
      );
      await client.query(
        `UPDATE applications
         SET status = 'INTERVIEW_INVITED', version = version + 1, last_transition_at = now()
         WHERE id = $1`,
        [applicationId],
      );
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id, metadata)
         VALUES ($1, $2, 'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'COMPANY', $3, $4::jsonb)`,
        [
          applicationId,
          commandId,
          actor.userId,
          JSON.stringify({ interviewId, scheduledAt: input.scheduledAt, mode: input.mode, interviewerName: input.interviewerName }),
        ],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, 'INTERVIEW_INVITED', 'Báº¡n cÃ³ lá»‹ch phá»ng váº¥n má»›i',
                 $2 || ' Ä‘Ã£ má»i báº¡n phá»ng váº¥n cho vá»‹ trÃ­ â€œ' || $3 || 'â€.',
                 'APPLICATION', $4::uuid, '/applications/' || $4::text,
                 'application:' || $4::text || ':' || $5::text || ':interview',
                 jsonb_build_object('applicationId', $4::text, 'interviewId', $6::text,
                                    'scheduledAt', $7::text, 'mode', $8::text))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          application.studentUserId,
          application.companyName,
          application.jobTitle,
          applicationId,
          commandId,
          interviewId,
          input.scheduledAt,
          input.mode,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'INTERVIEW_SCHEDULED', 'APPLICATION', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          applicationId,
          JSON.stringify({ commandId, interviewId, scheduledAt: input.scheduledAt, mode: input.mode }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findInterviewByCommand(client, applicationId, commandId))!;
    });
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

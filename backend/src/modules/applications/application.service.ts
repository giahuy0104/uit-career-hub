import { randomUUID } from "node:crypto";

import { appLogger, serializeError } from "../../observability/structured-logger.js";
import { AppError } from "../../shared/app-error.js";
import type { EmailDeliveryService } from "../email/email-delivery.service.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { ApplicationRepository } from "./application.repository.js";
import type {
  ApplicationReviewDecision,
  ApplicationStatus,
  OfferDocumentDto,
  OfferDocumentUploadIntentDto,
  RequestMetadata,
  StudentDocumentDownloadDto,
  StudentDocumentType,
  StudentDocumentUploadIntentDto,
  StudentDocumentVerificationStatus,
} from "./application.types.js";

function studentNotFound() {
  return new AppError(404, "STUDENT_PROFILE_NOT_FOUND", "Không tìm thấy hồ sơ sinh viên.");
}

function applicationNotFound() {
  return new AppError(404, "APPLICATION_NOT_FOUND", "Không tìm thấy đơn ứng tuyển.");
}

function interviewNotFound() {
  return new AppError(404, "INTERVIEW_NOT_FOUND", "Không tìm thấy lịch phỏng vấn.");
}

export class ApplicationService {
  constructor(
    private readonly repository: ApplicationRepository,
    private readonly emailDeliveryService?: Pick<EmailDeliveryService, "dispatchPending">,
    private readonly objectStorage?: ObjectStorage,
    private readonly objectStorageOptions = { uploadUrlTtlSeconds: 600, downloadUrlTtlSeconds: 300 },
  ) {}

  private requireObjectStorage() {
    if (!this.objectStorage) {
      throw new AppError(
        503,
        "OBJECT_STORAGE_NOT_CONFIGURED",
        "Chức năng tải tài liệu chưa được cấu hình trên môi trường này.",
      );
    }
    return this.objectStorage;
  }

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

  async listStudentDocumentsForReview(input: {
    page: number;
    pageSize: number;
    status: StudentDocumentVerificationStatus;
    query?: string;
  }) {
    return this.repository.listStudentDocumentsForReview(input);
  }

  async createUitStudentDocumentDownload(documentId: string): Promise<StudentDocumentDownloadDto> {
    const objectStorage = this.requireObjectStorage();
    const document = await this.repository.findStudentDocumentForUit(documentId);
    if (!document) {
      throw new AppError(404, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
    }
    const expiresAt = new Date(Date.now() + this.objectStorageOptions.downloadUrlTtlSeconds * 1_000);
    return {
      downloadUrl: await objectStorage.createDownloadUrl({
        key: document.storageKey,
        fileName: document.dto.fileName,
        expiresInSeconds: this.objectStorageOptions.downloadUrlTtlSeconds,
      }),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async reviewStudentDocument(
    actorUserId: string,
    documentId: string,
    input: { decision: "VERIFY"; note?: string } | { decision: "REJECT"; note: string },
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const document = await this.repository.findStudentDocumentForUit(documentId, client, true);
      if (!document) {
        throw new AppError(404, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
      }

      const toStatus = input.decision === "VERIFY" ? "VERIFIED" : "REJECTED";
      if (document.dto.verificationStatus === toStatus) return document.dto;
      if (document.dto.verificationStatus !== "PENDING") {
        throw new AppError(
          409,
          "STUDENT_DOCUMENT_REVIEW_CONFLICT",
          "Tài liệu đã được xử lý và không thể đổi sang quyết định khác.",
        );
      }

      await this.repository.updateStudentDocumentVerification(client, documentId, toStatus);
      const notification = input.decision === "VERIFY"
        ? {
            type: "STUDENT_DOCUMENT_VERIFIED",
            title: "Tài liệu đã được UIT xác minh",
            body: `Tài liệu “${document.dto.fileName}” đã được chấp nhận và có thể dùng trong hồ sơ ứng tuyển.`,
          }
        : {
            type: "STUDENT_DOCUMENT_REJECTED",
            title: "Tài liệu chưa được chấp nhận",
            body: `Tài liệu “${document.dto.fileName}” chưa được UIT chấp nhận. Lý do: ${input.note}`,
          };
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, $2, $3, $4, 'STUDENT_DOCUMENT', $5::uuid, '/profile',
                 'student-document:' || $5::text || ':' || $6::text,
                 jsonb_build_object('documentId', $5::text, 'status', $6::text))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [document.studentUserId, notification.type, notification.title, notification.body, documentId, toStatus],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, $2, 'STUDENT_DOCUMENT', $3, $4::jsonb, $5, $6)`,
        [
          actorUserId,
          input.decision === "VERIFY" ? "STUDENT_DOCUMENT_VERIFIED_BY_UIT" : "STUDENT_DOCUMENT_REJECTED_BY_UIT",
          documentId,
          JSON.stringify({
            studentProfileId: document.studentProfileId,
            fromStatus: "PENDING",
            toStatus,
            note: input.note?.trim() || null,
          }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      const updated = await this.repository.findStudentDocumentForUit(documentId, client);
      return updated!.dto;
    });
  }

  async createStudentDocumentUploadIntent(
    actor: { userId: string; studentProfileId: string | null },
    input: {
      documentType: StudentDocumentType;
      fileName: string;
      mimeType: "application/pdf";
      fileSizeBytes: number;
    },
  ): Promise<StudentDocumentUploadIntentDto> {
    if (!actor.studentProfileId) throw studentNotFound();
    const objectStorage = this.requireObjectStorage();
    const uploadId = randomUUID();
    const storageKey = `students/${actor.studentProfileId}/${input.documentType.toLowerCase()}/${uploadId}.pdf`;
    const expiresAt = new Date(Date.now() + this.objectStorageOptions.uploadUrlTtlSeconds * 1_000);
    const uploadUrl = await objectStorage.createUploadUrl({
      key: storageKey,
      contentType: input.mimeType,
      expiresInSeconds: this.objectStorageOptions.uploadUrlTtlSeconds,
    });
    await this.repository.createStudentDocumentUpload({
      id: uploadId,
      studentProfileId: actor.studentProfileId,
      documentType: input.documentType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      storageKey,
      expiresAt,
    });
    return {
      uploadId,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeStudentDocumentUpload(
    actor: { userId: string; studentProfileId: string | null },
    uploadId: string,
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;
    const objectStorage = this.requireObjectStorage();
    const initial = await this.repository.findStudentDocumentUpload(studentProfileId, uploadId);
    if (!initial) {
      throw new AppError(404, "STUDENT_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải tài liệu.");
    }
    if (initial.status === "COMPLETED") return this.repository.listStudentDocuments(studentProfileId);
    if (initial.status !== "PENDING") {
      throw new AppError(409, "STUDENT_DOCUMENT_UPLOAD_CLOSED", "Phiên tải tài liệu không còn hiệu lực.");
    }
    if (initial.expiresAt.getTime() <= Date.now()) {
      await this.repository.withTransaction(async (client) => {
        await this.repository.rejectStudentDocumentUpload(client, uploadId, "EXPIRED");
      });
      throw new AppError(410, "STUDENT_DOCUMENT_UPLOAD_EXPIRED", "URL tải tài liệu đã hết hạn.");
    }

    const storedObject = await objectStorage.headObject(initial.storageKey);
    if (!storedObject) {
      throw new AppError(409, "STUDENT_DOCUMENT_UPLOAD_MISSING", "R2 chưa nhận được tệp tải lên.");
    }
    const contentType = storedObject.contentType?.split(";")[0]?.trim().toLowerCase();
    if (storedObject.contentLength !== initial.fileSizeBytes || contentType !== initial.mimeType) {
      await objectStorage.deleteObject(initial.storageKey);
      await this.repository.withTransaction(async (client) => {
        await this.repository.rejectStudentDocumentUpload(client, uploadId, "REJECTED");
      });
      throw new AppError(
        409,
        "STUDENT_DOCUMENT_UPLOAD_MISMATCH",
        "Tệp trên R2 không khớp dung lượng hoặc định dạng đã đăng ký.",
      );
    }
    const signature = await objectStorage.readObjectPrefix(initial.storageKey, 5);
    if (new TextDecoder().decode(signature) !== "%PDF-") {
      await objectStorage.deleteObject(initial.storageKey);
      await this.repository.withTransaction(async (client) => {
        await this.repository.rejectStudentDocumentUpload(client, uploadId, "REJECTED");
      });
      throw new AppError(
        409,
        "STUDENT_DOCUMENT_INVALID_PDF",
        "Nội dung tệp không phải là tài liệu PDF hợp lệ.",
      );
    }

    return this.repository.withTransaction(async (client) => {
      const upload = await this.repository.findStudentDocumentUpload(studentProfileId, uploadId, client, true);
      if (!upload) {
        throw new AppError(404, "STUDENT_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải tài liệu.");
      }
      if (upload.status === "COMPLETED") return this.repository.listStudentDocuments(studentProfileId, client);
      if (upload.status !== "PENDING") {
        throw new AppError(409, "STUDENT_DOCUMENT_UPLOAD_CLOSED", "Phiên tải tài liệu không còn hiệu lực.");
      }
      const documentId = await this.repository.completeStudentDocumentUpload(client, upload, storedObject.etag);
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'STUDENT_DOCUMENT_UPLOADED', 'STUDENT_DOCUMENT', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          documentId,
          JSON.stringify({ uploadId, documentType: upload.documentType, fileSizeBytes: upload.fileSizeBytes }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'STUDENT_DOCUMENT_PENDING_REVIEW', 'Có tài liệu sinh viên cần xác minh',
                sp.full_name || ' vừa tải lên tài liệu “' || $3 || '”.',
                'STUDENT_DOCUMENT', $1::uuid, '/uit/student-documents/' || $1::text,
                'student-document:' || $1::text || ':pending:uit:' || u.id::text,
                jsonb_build_object('documentId', $1::text, 'studentProfileId', $2::uuid::text, 'status', 'PENDING')
         FROM users u CROSS JOIN student_profiles sp
         WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE' AND sp.id = $2::uuid
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [documentId, studentProfileId, upload.fileName],
      );
      return this.repository.listStudentDocuments(studentProfileId, client);
    });
  }

  async createOfferDocumentUploadIntent(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    input: {
      fileName: string;
      mimeType: "application/pdf";
      fileSizeBytes: number;
    },
  ): Promise<OfferDocumentUploadIntentDto> {
    if (!actor.companyId) throw applicationNotFound();
    const application = await this.repository.findByIdForCompany(applicationId, actor.companyId);
    if (!application) throw applicationNotFound();
    if (application.status !== "INTERVIEW_INVITED" || application.recruitmentResult) {
      throw new AppError(
        409,
        "OFFER_DOCUMENT_STATE_CONFLICT",
        "Chỉ có thể tải offer khi ứng viên đang ở bước phỏng vấn và chưa có kết quả.",
      );
    }

    const objectStorage = this.requireObjectStorage();
    const uploadId = randomUUID();
    const storageKey = `offers/${actor.companyId}/${applicationId}/${uploadId}.pdf`;
    const expiresAt = new Date(Date.now() + this.objectStorageOptions.uploadUrlTtlSeconds * 1_000);
    const uploadUrl = await objectStorage.createUploadUrl({
      key: storageKey,
      contentType: input.mimeType,
      expiresInSeconds: this.objectStorageOptions.uploadUrlTtlSeconds,
    });
    await this.repository.createOfferDocumentUpload({
      id: uploadId,
      applicationId,
      companyId: actor.companyId,
      createdByUserId: actor.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      storageKey,
      expiresAt,
    });
    return {
      uploadId,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeOfferDocumentUpload(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    uploadId: string,
    request: RequestMetadata,
  ): Promise<OfferDocumentDto> {
    if (!actor.companyId) throw applicationNotFound();
    const companyId = actor.companyId;
    const objectStorage = this.requireObjectStorage();
    const initial = await this.repository.findOfferDocumentUpload(companyId, applicationId, uploadId);
    if (!initial) {
      throw new AppError(404, "OFFER_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải offer.");
    }
    const dto = {
      fileName: initial.fileName,
      mimeType: initial.mimeType,
      fileSizeBytes: initial.fileSizeBytes,
    };
    if (["COMPLETED", "CONSUMED"].includes(initial.status)) return dto;
    if (initial.status !== "PENDING") {
      throw new AppError(409, "OFFER_DOCUMENT_UPLOAD_CLOSED", "Phiên tải offer không còn hiệu lực.");
    }
    if (initial.expiresAt.getTime() <= Date.now()) {
      await this.repository.withTransaction(async (client) => {
        await this.repository.rejectOfferDocumentUpload(client, uploadId, "EXPIRED");
      });
      throw new AppError(410, "OFFER_DOCUMENT_UPLOAD_EXPIRED", "URL tải offer đã hết hạn.");
    }

    const storedObject = await objectStorage.headObject(initial.storageKey);
    if (!storedObject) {
      throw new AppError(409, "OFFER_DOCUMENT_UPLOAD_MISSING", "R2 chưa nhận được tệp offer.");
    }
    const contentType = storedObject.contentType?.split(";")[0]?.trim().toLowerCase();
    if (storedObject.contentLength !== initial.fileSizeBytes || contentType !== initial.mimeType) {
      await objectStorage.deleteObject(initial.storageKey);
      await this.repository.withTransaction(async (client) => {
        await this.repository.rejectOfferDocumentUpload(client, uploadId, "REJECTED");
      });
      throw new AppError(
        409,
        "OFFER_DOCUMENT_UPLOAD_MISMATCH",
        "Tệp offer trên R2 không khớp dung lượng hoặc định dạng đã đăng ký.",
      );
    }
    const signature = await objectStorage.readObjectPrefix(initial.storageKey, 5);
    if (new TextDecoder().decode(signature) !== "%PDF-") {
      await objectStorage.deleteObject(initial.storageKey);
      await this.repository.withTransaction(async (client) => {
        await this.repository.rejectOfferDocumentUpload(client, uploadId, "REJECTED");
      });
      throw new AppError(409, "OFFER_DOCUMENT_INVALID_PDF", "Nội dung tệp offer không phải PDF hợp lệ.");
    }

    return this.repository.withTransaction(async (client) => {
      const upload = await this.repository.findOfferDocumentUpload(
        companyId,
        applicationId,
        uploadId,
        client,
        true,
      );
      if (!upload) {
        throw new AppError(404, "OFFER_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải offer.");
      }
      if (["COMPLETED", "CONSUMED"].includes(upload.status)) {
        return { fileName: upload.fileName, mimeType: upload.mimeType, fileSizeBytes: upload.fileSizeBytes };
      }
      if (upload.status !== "PENDING") {
        throw new AppError(409, "OFFER_DOCUMENT_UPLOAD_CLOSED", "Phiên tải offer không còn hiệu lực.");
      }
      await this.repository.completeOfferDocumentUpload(client, uploadId, storedObject.etag);
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'OFFER_DOCUMENT_UPLOADED', 'APPLICATION', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          applicationId,
          JSON.stringify({ uploadId, fileName: upload.fileName, fileSizeBytes: upload.fileSizeBytes }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return { fileName: upload.fileName, mimeType: upload.mimeType, fileSizeBytes: upload.fileSizeBytes };
    });
  }

  private async createOfferDocumentDownload(
    actor: { userId: string; actorType: "STUDENT" | "UIT_ADMIN" | "COMPANY" },
    applicationId: string,
    document: { resultId: string; storageKey: string; fileName: string } | null,
    request: RequestMetadata,
  ): Promise<StudentDocumentDownloadDto> {
    if (!document) {
      throw new AppError(404, "OFFER_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu offer của đơn ứng tuyển.");
    }
    const objectStorage = this.requireObjectStorage();
    const expiresAt = new Date(Date.now() + this.objectStorageOptions.downloadUrlTtlSeconds * 1_000);
    const downloadUrl = await objectStorage.createDownloadUrl({
      key: document.storageKey,
      fileName: document.fileName,
      expiresInSeconds: this.objectStorageOptions.downloadUrlTtlSeconds,
    });
    await this.repository.recordOfferDocumentDownload({
      actorUserId: actor.userId,
      actorType: actor.actorType,
      applicationId,
      resultId: document.resultId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });
    return { downloadUrl, expiresAt: expiresAt.toISOString() };
  }

  async createStudentOfferDocumentDownload(
    actor: { userId: string; studentProfileId: string | null },
    applicationId: string,
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    return this.createOfferDocumentDownload(
      { userId: actor.userId, actorType: "STUDENT" },
      applicationId,
      await this.repository.findStudentOfferDocumentStorage(actor.studentProfileId, applicationId),
      request,
    );
  }

  async createUitOfferDocumentDownload(actorUserId: string, applicationId: string, request: RequestMetadata) {
    return this.createOfferDocumentDownload(
      { userId: actorUserId, actorType: "UIT_ADMIN" },
      applicationId,
      await this.repository.findUitOfferDocumentStorage(applicationId),
      request,
    );
  }

  async createCompanyOfferDocumentDownload(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    request: RequestMetadata,
  ) {
    if (!actor.companyId) throw applicationNotFound();
    return this.createOfferDocumentDownload(
      { userId: actor.userId, actorType: "COMPANY" },
      applicationId,
      await this.repository.findCompanyOfferDocumentStorage(actor.companyId, applicationId),
      request,
    );
  }

  async createStudentDocumentDownload(
    studentProfileId: string | null,
    documentId: string,
  ): Promise<StudentDocumentDownloadDto> {
    if (!studentProfileId) throw studentNotFound();
    const objectStorage = this.requireObjectStorage();
    const document = await this.repository.findStudentDocumentStorage(studentProfileId, documentId);
    if (!document) {
      throw new AppError(404, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
    }
    const expiresAt = new Date(Date.now() + this.objectStorageOptions.downloadUrlTtlSeconds * 1_000);
    return {
      downloadUrl: await objectStorage.createDownloadUrl({
        key: document.storageKey,
        fileName: document.fileName,
        expiresInSeconds: this.objectStorageOptions.downloadUrlTtlSeconds,
      }),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async deleteStudentDocument(
    actor: { userId: string; studentProfileId: string | null },
    documentId: string,
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;
    const objectStorage = this.requireObjectStorage();
    return this.repository.withTransaction(async (client) => {
      const document = await this.repository.lockStudentDocument(client, studentProfileId, documentId);
      if (!document) {
        throw new AppError(404, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
      }
      if (document.isDefault) {
        throw new AppError(
          409,
          "STUDENT_DOCUMENT_DEFAULT_CV",
          "Hãy chọn một CV khác làm mặc định trước khi xóa tài liệu này.",
        );
      }
      if (document.usedByApplication) {
        throw new AppError(
          409,
          "STUDENT_DOCUMENT_IN_USE",
          "Tài liệu đã được dùng trong đơn ứng tuyển nên phải được giữ lại trong lịch sử hồ sơ.",
        );
      }

      await objectStorage.deleteObject(document.storageKey);
      const deleted = await this.repository.deleteStudentDocument(client, studentProfileId, documentId);
      if (!deleted) {
        throw new AppError(404, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
      }
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'STUDENT_DOCUMENT_DELETED', 'STUDENT_DOCUMENT', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          documentId,
          JSON.stringify({ studentProfileId, documentType: document.documentType }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return this.repository.listStudentDocuments(studentProfileId, client);
    });
  }

  async updateStudentProfile(
    actor: { userId: string; studentProfileId: string | null },
    input: { phone: string | null },
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;
    return this.repository.withTransaction(async (client) => {
      const normalizedPhone = input.phone?.trim() || null;
      const updated = await this.repository.updateStudentPhone(client, studentProfileId, normalizedPhone);
      if (!updated) throw studentNotFound();
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'STUDENT_PROFILE_UPDATED', 'STUDENT_PROFILE', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          studentProfileId,
          JSON.stringify({ changedFields: ["phone"] }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findStudentProfile(studentProfileId, client))!;
    });
  }

  async setDefaultStudentCv(
    actor: { userId: string; studentProfileId: string | null },
    documentId: string,
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;
    return this.repository.withTransaction(async (client) => {
      const document = await this.repository.lockStudentDocument(client, studentProfileId, documentId);
      if (!document) {
        throw new AppError(404, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
      }
      if (document.documentType !== "CV") {
        throw new AppError(409, "STUDENT_DOCUMENT_NOT_CV", "Chỉ có thể chọn tài liệu CV làm mặc định.");
      }
      if (document.verificationStatus !== "VERIFIED") {
        throw new AppError(409, "STUDENT_DOCUMENT_NOT_VERIFIED", "CV phải được UIT xác minh trước khi đặt làm mặc định.");
      }
      if (!document.isDefault) {
        await this.repository.setDefaultCv(client, studentProfileId, documentId);
        await client.query(
          `INSERT INTO audit_logs
           (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
           VALUES ($1, 'STUDENT_DEFAULT_CV_CHANGED', 'STUDENT_DOCUMENT', $2, $3::jsonb, $4, $5)`,
          [
            actor.userId,
            documentId,
            JSON.stringify({ studentProfileId }),
            request.ipAddress,
            request.userAgent,
          ],
        );
      }
      return this.repository.listStudentDocuments(studentProfileId, client);
    });
  }

  async listStudentInterviews(
    studentProfileId: string | null,
    input: { page: number; pageSize: number; scope: "upcoming" | "history" | "all" },
  ) {
    if (!studentProfileId) throw studentNotFound();
    return this.repository.listStudentInterviews(studentProfileId, input);
  }

  async listCompanyInterviews(
    companyId: string | null,
    input: { page: number; pageSize: number; scope: "upcoming" | "history" | "all" },
  ) {
    if (!companyId) throw applicationNotFound();
    return this.repository.listCompanyInterviews(companyId, input);
  }

  async confirmInterview(
    actor: { userId: string; studentProfileId: string | null },
    interviewId: string,
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;
    return this.repository.withTransaction(async (client) => {
      const interview = await this.repository.lockStudentInterview(client, interviewId, studentProfileId);
      if (!interview) throw interviewNotFound();

      if (interview.status === "CONFIRMED") {
        return (await this.repository.findStudentInterview(client, interviewId, studentProfileId))!;
      }
      if (interview.status !== "PENDING_STUDENT_CONFIRMATION") {
        throw new AppError(
          409,
          "INTERVIEW_STATE_CONFLICT",
          "Lịch phỏng vấn này không còn chờ sinh viên xác nhận.",
        );
      }

      await client.query(
        `UPDATE interviews
         SET status = 'CONFIRMED', version = version + 1, updated_at = now()
         WHERE id = $1`,
        [interviewId],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'INTERVIEW_CONFIRMED_BY_STUDENT', 'Sinh viên đã xác nhận lịch phỏng vấn',
                $2 || ' đã xác nhận tham gia phỏng vấn vị trí “' || $3 || '”.',
                'INTERVIEW', $1::uuid, '/company/interviews',
                'interview:' || $1::text || ':confirmed:company:' || u.id::text,
                jsonb_build_object('interviewId', $1::text, 'applicationId', $4::text)
         FROM company_users cu JOIN users u ON u.id = cu.user_id
         WHERE cu.company_id = $5 AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [interviewId, interview.studentFullName, interview.jobTitle, interview.applicationId, interview.companyId],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'INTERVIEW_CONFIRMED_BY_STUDENT', 'INTERVIEW', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          interviewId,
          JSON.stringify({ applicationId: interview.applicationId, fromStatus: interview.status, toStatus: "CONFIRMED" }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findStudentInterview(client, interviewId, studentProfileId))!;
    });
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

  async createUitApplicationDocumentDownload(
    actorUserId: string,
    applicationId: string,
    documentId: string,
    request: RequestMetadata,
  ): Promise<StudentDocumentDownloadDto> {
    const objectStorage = this.requireObjectStorage();
    const document = await this.repository.findApplicationDocumentForUit(applicationId, documentId);
    if (!document) throw applicationNotFound();

    const expiresAt = new Date(Date.now() + this.objectStorageOptions.downloadUrlTtlSeconds * 1_000);
    const downloadUrl = await objectStorage.createDownloadUrl({
      key: document.storageKey,
      fileName: document.fileName,
      expiresInSeconds: this.objectStorageOptions.downloadUrlTtlSeconds,
    });
    await this.repository.recordApplicationDocumentDownload({
      actorUserId,
      actorType: "UIT_ADMIN",
      applicationId,
      documentId,
      ...request,
    });
    return { downloadUrl, expiresAt: expiresAt.toISOString() };
  }

  async listPlacementQueue(input: { page: number; pageSize: number }) {
    return this.repository.listUitPlacementQueue(input);
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
    const result = await this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findByIdForUit(applicationId, client))!;
      }
      if (decision === "request-supplement" && new Date(payload.dueAt!).getTime() <= Date.now()) {
        throw new AppError(
          400,
          "APPLICATION_SUPPLEMENT_DUE_DATE_INVALID",
          "Hạn bổ sung hồ sơ phải nằm trong tương lai.",
        );
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

    if (decision === "forward") {
      await this.dispatchEmailsBestEffort(applicationId);
    }
    return result;
  }

  async listCompanyCandidates(
    companyId: string | null,
    input: { page: number; pageSize: number; jobId?: string; status?: ApplicationStatus },
  ) {
    if (!companyId) throw applicationNotFound();
    return this.repository.listCompanyCandidates(companyId, input);
  }

  async createCompanyApplicationDocumentDownload(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    documentId: string,
    request: RequestMetadata,
  ): Promise<StudentDocumentDownloadDto> {
    if (!actor.companyId) throw applicationNotFound();
    const objectStorage = this.requireObjectStorage();
    const document = await this.repository.findApplicationDocumentForCompany(
      applicationId,
      documentId,
      actor.companyId,
    );
    if (!document) throw applicationNotFound();

    const expiresAt = new Date(Date.now() + this.objectStorageOptions.downloadUrlTtlSeconds * 1_000);
    const downloadUrl = await objectStorage.createDownloadUrl({
      key: document.storageKey,
      fileName: document.fileName,
      expiresInSeconds: this.objectStorageOptions.downloadUrlTtlSeconds,
    });
    await this.repository.recordApplicationDocumentDownload({
      actorUserId: actor.userId,
      actorType: "COMPANY",
      applicationId,
      documentId,
      ...request,
    });
    return { downloadUrl, expiresAt: expiresAt.toISOString() };
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

  async recordInterviewResult(
    actor: { userId: string; companyId: string | null },
    applicationId: string,
    commandId: string,
    input:
      | { outcome: "PASS"; startDate: string; offerUploadId?: string; internalNote?: string }
      | { outcome: "FAIL"; reasonCode: string; note: string },
    request: RequestMetadata,
  ) {
    if (!actor.companyId) throw applicationNotFound();
    if (input.outcome === "PASS" && input.startDate < new Date().toISOString().slice(0, 10)) {
      throw new AppError(400, "OFFER_START_DATE_INVALID", "Ngày bắt đầu làm việc không được nằm trong quá khứ.");
    }

    const companyId = actor.companyId;
    return this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application || application.companyId !== companyId) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findByIdForCompany(applicationId, companyId, client))!;
      }
      if (application.status !== "INTERVIEW_INVITED") {
        throw new AppError(
          409,
          "APPLICATION_STATE_CONFLICT",
          "Chỉ có thể cập nhật kết quả khi ứng viên đang ở bước phỏng vấn.",
        );
      }

      const offerUpload = input.outcome === "PASS" && input.offerUploadId
        ? await this.repository.findOfferDocumentUpload(
            companyId,
            applicationId,
            input.offerUploadId,
            client,
            true,
          )
        : null;
      if (input.outcome === "PASS" && input.offerUploadId && !offerUpload) {
        throw new AppError(404, "OFFER_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải offer.");
      }
      if (offerUpload && offerUpload.status !== "COMPLETED") {
        throw new AppError(
          409,
          "OFFER_DOCUMENT_UPLOAD_NOT_READY",
          "Tệp offer chưa tải xong hoặc đã được sử dụng.",
        );
      }

      const interview = await client.query<{ id: string }>(
        `UPDATE interviews
         SET status = 'COMPLETED', version = version + 1, updated_at = now()
         WHERE id = (
           SELECT id FROM interviews
           WHERE application_id = $1 AND status <> 'CANCELLED'
           ORDER BY scheduled_at DESC, created_at DESC LIMIT 1
         )
         RETURNING id`,
        [applicationId],
      );
      const interviewId = interview.rows[0]?.id;
      if (!interviewId) {
        throw new AppError(409, "INTERVIEW_NOT_FOUND", "Không tìm thấy lịch phỏng vấn hợp lệ của ứng viên.");
      }

      const resultId = randomUUID();
      const toStatus: ApplicationStatus = input.outcome === "PASS" ? "OFFER_PENDING_STUDENT" : "INTERVIEW_FAILED";
      await client.query(
        `INSERT INTO recruitment_results
         (id, application_id, command_id, decided_by_user_id, outcome, offered_at,
          start_date, offer_storage_key, offer_upload_id, internal_note)
         VALUES ($1, $2, $3, $4, $5,
                 CASE WHEN $5 = 'PASS' THEN now() ELSE NULL END,
                 $6, $7, $8, $9)`,
        [
          resultId,
          applicationId,
          commandId,
          actor.userId,
          input.outcome,
          input.outcome === "PASS" ? input.startDate : null,
          offerUpload?.storageKey ?? null,
          offerUpload?.id ?? null,
          input.outcome === "PASS" ? input.internalNote ?? null : input.note,
        ],
      );
      if (offerUpload) {
        const storageKey = await this.repository.consumeOfferDocumentUpload(client, offerUpload.id);
        if (!storageKey) {
          throw new AppError(409, "OFFER_DOCUMENT_UPLOAD_NOT_READY", "Tệp offer đã được sử dụng.");
        }
      }
      await client.query(
        `UPDATE applications
         SET status = $2, version = version + 1, last_transition_at = now(), updated_at = now()
         WHERE id = $1`,
        [applicationId, toStatus],
      );
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id,
          reason_code, note, metadata)
         VALUES ($1, $2, 'INTERVIEW_INVITED', $3, 'COMPANY', $4, $5, $6, $7::jsonb)`,
        [
          applicationId,
          commandId,
          toStatus,
          actor.userId,
          input.outcome === "FAIL" ? input.reasonCode : null,
          input.outcome === "FAIL" ? input.note : null,
          JSON.stringify({
            interviewId,
            resultId,
            outcome: input.outcome,
            startDate: input.outcome === "PASS" ? input.startDate : null,
            hasOfferDocument: Boolean(offerUpload),
          }),
        ],
      );

      const studentNotification = input.outcome === "PASS"
        ? {
            type: "OFFER_AVAILABLE",
            title: "Bạn có lời mời nhận việc mới",
            body: `${application.companyName} đã gửi offer cho vị trí “${application.jobTitle}”.`,
          }
        : {
            type: "INTERVIEW_FAILED",
            title: "Doanh nghiệp đã cập nhật kết quả phỏng vấn",
            body: `Bạn chưa phù hợp với vị trí “${application.jobTitle}” tại ${application.companyName}.`,
          };
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, $2, $3, $4, 'APPLICATION', $5::uuid, '/applications/' || $5::text,
                 'application:' || $5::text || ':' || $6::text || ':result:student',
                 jsonb_build_object('applicationId', $5::text, 'commandId', $6::text,
                                    'outcome', $7::text, 'status', $8::text))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          application.studentUserId,
          studentNotification.type,
          studentNotification.title,
          studentNotification.body,
          applicationId,
          commandId,
          input.outcome,
          toStatus,
        ],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'INTERVIEW_RESULT_RECORDED', 'Doanh nghiệp đã cập nhật kết quả phỏng vấn',
                $3 || ' đã cập nhật kết quả ' || $4 || ' cho hồ sơ vị trí “' || $5 || '”.',
                'APPLICATION', $1::uuid, '/uit/applications/' || $1::text,
                'application:' || $1::text || ':' || $2::text || ':result:uit:' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                   'outcome', $4::text, 'status', $6::text)
         FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [applicationId, commandId, application.companyName, input.outcome, application.jobTitle, toStatus],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'INTERVIEW_RESULT_RECORDED', 'APPLICATION', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          applicationId,
          JSON.stringify({ commandId, interviewId, resultId, outcome: input.outcome, toStatus }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findByIdForCompany(applicationId, companyId, client))!;
    });
  }

  async resubmit(
    actor: { userId: string; studentProfileId: string | null },
    applicationId: string,
    commandId: string,
    input: { documents: Array<{ documentId: string }>; consentToShare: true },
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;

    return this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application || application.studentProfileId !== studentProfileId) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findById(applicationId, studentProfileId, client))!;
      }
      if (application.status !== "NEEDS_SUPPLEMENT") {
        throw new AppError(
          409,
          "APPLICATION_STATE_CONFLICT",
          "Chỉ có thể nộp bổ sung khi UIT đang yêu cầu cập nhật hồ sơ.",
        );
      }

      const latestRequest = await client.query<{
        command_id: string;
        note: string | null;
        metadata: { requiredDocumentTypes?: string[]; dueAt?: string };
      }>(
        `SELECT command_id, note, metadata
         FROM application_status_history
         WHERE application_id = $1 AND to_status = 'NEEDS_SUPPLEMENT'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [applicationId],
      );
      const supplementRequest = latestRequest.rows[0];
      const requiredDocumentTypes = supplementRequest?.metadata.requiredDocumentTypes ?? [];
      const dueAt = supplementRequest?.metadata.dueAt;
      if (!supplementRequest || requiredDocumentTypes.length === 0 || !dueAt) {
        throw new AppError(
          409,
          "APPLICATION_SUPPLEMENT_REQUEST_INVALID",
          "Yêu cầu bổ sung không còn đầy đủ thông tin để xử lý.",
        );
      }
      if (new Date(dueAt).getTime() < Date.now()) {
        throw new AppError(
          409,
          "APPLICATION_SUPPLEMENT_DEADLINE_EXPIRED",
          "Đã quá hạn bổ sung hồ sơ. Vui lòng liên hệ bộ phận phụ trách UIT.",
        );
      }

      const documentIds = input.documents.map((document) => document.documentId);
      const documents = await this.repository.findSourceDocuments(client, studentProfileId, documentIds);
      if (documents.length !== documentIds.length) {
        throw new AppError(400, "APPLICATION_DOCUMENT_INVALID", "Có tài liệu không thuộc hồ sơ của bạn.");
      }
      if (documents.some((document) => document.verificationStatus !== "VERIFIED")) {
        throw new AppError(400, "APPLICATION_DOCUMENT_NOT_VERIFIED", "Chỉ có thể gửi tài liệu đã được xác minh.");
      }

      const existingSnapshots = await client.query<{ source_document_id: string | null }>(
        "SELECT source_document_id FROM application_documents WHERE application_id = $1 FOR SHARE",
        [applicationId],
      );
      const existingSourceIds = new Set(
        existingSnapshots.rows.flatMap((row) => row.source_document_id ? [row.source_document_id] : []),
      );
      if (documents.some((document) => existingSourceIds.has(document.id))) {
        throw new AppError(
          400,
          "APPLICATION_DOCUMENT_ALREADY_SUBMITTED",
          "Hãy chọn phiên bản tài liệu mới, chưa có trong đơn ứng tuyển.",
        );
      }

      const selectedTypes = new Set(documents.map((document) => document.documentType));
      const missingDocumentTypes = requiredDocumentTypes.filter((documentType) => !selectedTypes.has(documentType));
      if (missingDocumentTypes.length > 0) {
        throw new AppError(
          400,
          "APPLICATION_REQUIRED_DOCUMENTS_MISSING",
          `Còn thiếu loại tài liệu UIT yêu cầu: ${missingDocumentTypes.join(", ")}.`,
          [{ missingDocumentTypes }],
        );
      }

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

      const documentSnapshots = documents.map((document) => ({
        sourceDocumentId: document.id,
        documentType: document.documentType,
        fileName: document.fileName,
        sourceVersion: document.version,
      }));
      await client.query(
        `UPDATE applications
         SET status = 'UIT_REVIEWING', consented_at = now(), version = version + 1,
             last_transition_at = now(), updated_at = now()
         WHERE id = $1`,
        [applicationId],
      );
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id, note, metadata)
         VALUES ($1, $2, 'NEEDS_SUPPLEMENT', 'UIT_REVIEWING', 'STUDENT', $3, $4, $5::jsonb)`,
        [
          applicationId,
          commandId,
          actor.userId,
          `Sinh viên đã nộp ${documents.length} tài liệu bổ sung.`,
          JSON.stringify({
            supplementRequestCommandId: supplementRequest.command_id,
            requiredDocumentTypes,
            documents: documentSnapshots,
          }),
        ],
      );

      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'APPLICATION_RESUBMITTED', 'Sinh viên đã bổ sung hồ sơ',
                $3 || ' đã bổ sung hồ sơ vị trí “' || $4 || '” tại ' || $5 || '.',
                'APPLICATION', $1::uuid, '/uit/applications/' || $1::text,
                'application:' || $1::text || ':' || $2::text || ':resubmit:uit:' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                   'status', 'UIT_REVIEWING', 'documentCount', $6::int)
         FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          applicationId,
          commandId,
          application.studentFullName,
          application.jobTitle,
          application.companyName,
          documents.length,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'APPLICATION_RESUBMITTED', 'APPLICATION', $2, $3::jsonb, $4, $5)`,
        [
          actor.userId,
          applicationId,
          JSON.stringify({
            commandId,
            supplementRequestCommandId: supplementRequest.command_id,
            documentSnapshots,
          }),
          request.ipAddress,
          request.userAgent,
        ],
      );

      return (await this.repository.findById(applicationId, studentProfileId, client))!;
    });
  }

  async withdraw(
    actor: { userId: string; studentProfileId: string | null },
    applicationId: string,
    commandId: string,
    action: "withdraw" | "cancel-interview",
    payload: { reasonCode: string; note: string },
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;

    return this.repository.withTransaction(async (client) => {
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application || application.studentProfileId !== studentProfileId) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findById(applicationId, studentProfileId, client))!;
      }

      const genericWithdrawStatuses = new Set<ApplicationStatus>([
        "UIT_REVIEWING",
        "NEEDS_SUPPLEMENT",
        "FORWARDED_TO_COMPANY",
        "COMPANY_REVIEWING",
      ]);
      const validState = action === "cancel-interview"
        ? application.status === "INTERVIEW_INVITED"
        : genericWithdrawStatuses.has(application.status);
      if (!validState) {
        throw new AppError(
          409,
          "APPLICATION_WITHDRAWAL_NOT_ALLOWED",
          action === "cancel-interview"
            ? "Chỉ có thể hủy tham gia khi đơn đang ở bước phỏng vấn."
            : "Bạn không thể rút đơn ở bước hiện tại. Hãy dùng hành động dành riêng cho bước này.",
        );
      }

      const fromStatus = application.status;
      await client.query(
        `UPDATE applications
         SET status = 'WITHDRAWN', withdrawn_at = now(), version = version + 1,
             last_transition_at = now(), updated_at = now()
         WHERE id = $1`,
        [applicationId],
      );

      if (action === "cancel-interview") {
        const cancelled = await client.query(
          `UPDATE interviews
           SET status = 'CANCELLED', cancellation_reason = $2,
               version = version + 1, updated_at = now()
           WHERE application_id = $1
             AND status IN ('PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'RESCHEDULE_REQUESTED')`,
          [applicationId, payload.note],
        );
        if ((cancelled.rowCount ?? 0) === 0) {
          throw new AppError(409, "INTERVIEW_STATE_CONFLICT", "Không còn lịch phỏng vấn đang hoạt động để hủy.");
        }
      }

      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id,
          reason_code, note, metadata)
         VALUES ($1, $2, $3, 'WITHDRAWN', 'STUDENT', $4, $5, $6,
                 jsonb_build_object('action', $7::text))`,
        [applicationId, commandId, fromStatus, actor.userId, payload.reasonCode, payload.note, action],
      );

      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'APPLICATION_WITHDRAWN_RECORDED', 'Sinh viên đã rút đơn ứng tuyển',
                $3 || ' đã rút đơn vị trí “' || $4 || '” tại ' || $5 || '. Lý do: ' || $6,
                'APPLICATION', $1::uuid, '/uit/applications/' || $1::text,
                'application:' || $1::text || ':' || $2::text || ':withdraw:uit:' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                   'fromStatus', $7::text, 'status', 'WITHDRAWN',
                                   'reasonCode', $8::text, 'action', $9::text)
         FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          applicationId,
          commandId,
          application.studentFullName,
          application.jobTitle,
          application.companyName,
          payload.note,
          fromStatus,
          payload.reasonCode,
          action,
        ],
      );

      if (["FORWARDED_TO_COMPANY", "COMPANY_REVIEWING", "INTERVIEW_INVITED"].includes(fromStatus)) {
        const companyNotification = action === "cancel-interview"
          ? {
              type: "INTERVIEW_CANCELLED_BY_STUDENT",
              title: "Sinh viên đã hủy tham gia phỏng vấn",
              body: `${application.studentFullName} đã hủy tham gia phỏng vấn vị trí “${application.jobTitle}”. Lý do: ${payload.note}`,
            }
          : {
              type: "APPLICATION_WITHDRAWN_BY_STUDENT",
              title: "Sinh viên đã rút đơn ứng tuyển",
              body: `${application.studentFullName} đã rút hồ sơ vị trí “${application.jobTitle}”. Lý do: ${payload.note}`,
            };
        await client.query(
          `INSERT INTO notifications
           (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
           SELECT u.id, $3, $4, $5,
                  'APPLICATION', $1::uuid, '/company/candidates/' || $1::text,
                  'application:' || $1::text || ':' || $2::text || ':withdraw:company:' || u.id::text,
                  jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                     'fromStatus', $6::text, 'status', 'WITHDRAWN',
                                     'reasonCode', $7::text, 'action', $8::text)
           FROM company_users cu JOIN users u ON u.id = cu.user_id
           WHERE cu.company_id = $9 AND u.status = 'ACTIVE'
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [
            applicationId,
            commandId,
            companyNotification.type,
            companyNotification.title,
            companyNotification.body,
            fromStatus,
            payload.reasonCode,
            action,
            application.companyId,
          ],
        );
      }

      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, $2, 'APPLICATION', $3, $4::jsonb, $5, $6)`,
        [
          actor.userId,
          action === "cancel-interview" ? "INTERVIEW_CANCELLED_BY_STUDENT" : "APPLICATION_WITHDRAWN_BY_STUDENT",
          applicationId,
          JSON.stringify({ commandId, fromStatus, toStatus: "WITHDRAWN", reasonCode: payload.reasonCode, action }),
          request.ipAddress,
          request.userAgent,
        ],
      );

      return (await this.repository.findById(applicationId, studentProfileId, client))!;
    });
  }

  async respondToOffer(
    actor: { userId: string; studentProfileId: string | null },
    applicationId: string,
    commandId: string,
    decision: "accept" | "decline",
    payload: { reasonCode?: string; note?: string },
    request: RequestMetadata,
  ) {
    if (!actor.studentProfileId) throw studentNotFound();
    const studentProfileId = actor.studentProfileId;

    return this.repository.withTransaction(async (client) => {
      if (decision === "accept") {
        await client.query("SELECT id FROM student_profiles WHERE id = $1 FOR UPDATE", [studentProfileId]);
      }
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application || application.studentProfileId !== studentProfileId) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        return (await this.repository.findById(applicationId, studentProfileId, client))!;
      }
      if (application.status !== "OFFER_PENDING_STUDENT") {
        throw new AppError(409, "APPLICATION_STATE_CONFLICT", "Offer này không còn chờ bạn phản hồi.");
      }

      if (decision === "accept") {
        const selected = await client.query(
          `SELECT 1 FROM applications
           WHERE student_profile_id = $1 AND id <> $2
             AND status IN ('ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED')
           LIMIT 1`,
          [studentProfileId, applicationId],
        );
        if ((selected.rowCount ?? 0) > 0) {
          throw new AppError(
            409,
            "STUDENT_PLACEMENT_ALREADY_SELECTED",
            "Bạn đã chọn một nơi làm việc khác và đang chờ UIT xác nhận.",
          );
        }
      }

      const studentDecision = decision === "accept" ? "ACCEPTED" : "DECLINED";
      const result = await client.query(
        `UPDATE recruitment_results
         SET student_decision = $2, responded_at = now(), updated_at = now()
         WHERE application_id = $1 AND outcome = 'PASS' AND student_decision IS NULL`,
        [applicationId, studentDecision],
      );
      if ((result.rowCount ?? 0) !== 1) {
        throw new AppError(409, "OFFER_RESULT_CONFLICT", "Không tìm thấy offer hợp lệ để phản hồi.");
      }

      const toStatus: ApplicationStatus = decision === "accept"
        ? "ACCEPTED_PENDING_UIT_CONFIRMATION"
        : "OFFER_DECLINED";
      await client.query(
        `UPDATE applications
         SET status = $2,
             accepted_at = CASE WHEN $2 = 'ACCEPTED_PENDING_UIT_CONFIRMATION' THEN now() ELSE accepted_at END,
             version = version + 1, last_transition_at = now(), updated_at = now()
         WHERE id = $1`,
        [applicationId, toStatus],
      );
      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id,
          reason_code, note, metadata)
         VALUES ($1, $2, 'OFFER_PENDING_STUDENT', $3, 'STUDENT', $4, $5, $6, $7::jsonb)`,
        [
          applicationId,
          commandId,
          toStatus,
          actor.userId,
          decision === "decline" ? payload.reasonCode : null,
          decision === "decline" ? payload.note : null,
          JSON.stringify({ decision: studentDecision }),
        ],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, $3, $4,
                $5 || ' đã ' || $6 || ' offer cho vị trí “' || $7 || '”.',
                'APPLICATION', $1::uuid, '/company/candidates/' || $1::text,
                'application:' || $1::text || ':' || $2::text || ':offer:company:' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                   'decision', $8::text, 'status', $9::text)
         FROM company_users cu JOIN users u ON u.id = cu.user_id
         WHERE cu.company_id = $10 AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          applicationId,
          commandId,
          decision === "accept" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
          decision === "accept" ? "Sinh viên đã nhận offer" : "Sinh viên đã từ chối offer",
          application.studentFullName,
          decision === "accept" ? "nhận" : "từ chối",
          application.jobTitle,
          studentDecision,
          toStatus,
          application.companyId,
        ],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, $3, $4, $5,
                'APPLICATION', $1::uuid, '/uit/applications/' || $1::text,
                'application:' || $1::text || ':' || $2::text || ':offer:uit:' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                   'decision', $6::text, 'status', $7::text)
         FROM users u WHERE u.role = 'UIT_ADMIN' AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          applicationId,
          commandId,
          decision === "accept" ? "PLACEMENT_CONFIRMATION_REQUIRED" : "OFFER_DECLINED_RECORDED",
          decision === "accept" ? "Có nơi thực tập cần UIT xác nhận" : "Sinh viên đã từ chối offer",
          decision === "accept"
            ? `${application.studentFullName} đã nhận offer tại ${application.companyName}.`
            : `${application.studentFullName} đã từ chối offer tại ${application.companyName}.`,
          studentDecision,
          toStatus,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, $2, 'APPLICATION', $3, $4::jsonb, $5, $6)`,
        [
          actor.userId,
          decision === "accept" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
          applicationId,
          JSON.stringify({ commandId, decision: studentDecision, toStatus, reasonCode: payload.reasonCode ?? null }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return (await this.repository.findById(applicationId, studentProfileId, client))!;
    });
  }

  async confirmPlacement(
    actorUserId: string,
    applicationId: string,
    commandId: string,
    input: { startDate: string; note?: string },
    request: RequestMetadata,
  ) {
    return this.repository.withTransaction(async (client) => {
      const owner = await client.query<{ student_profile_id: string }>(
        "SELECT student_profile_id FROM applications WHERE id = $1",
        [applicationId],
      );
      const studentProfileId = owner.rows[0]?.student_profile_id;
      if (!studentProfileId) throw applicationNotFound();

      await client.query("SELECT id FROM student_profiles WHERE id = $1 FOR UPDATE", [studentProfileId]);
      const lockedApplications = await client.query<{
        id: string;
        status: ApplicationStatus;
        company_id: string;
        company_name: string;
        job_title: string;
      }>(
        `SELECT a.id, a.status, c.id AS company_id, c.name AS company_name, j.title AS job_title
         FROM applications a
         JOIN job_posts j ON j.id = a.job_post_id
         JOIN companies c ON c.id = j.company_id
         WHERE a.student_profile_id = $1
         ORDER BY a.id
         FOR UPDATE OF a`,
        [studentProfileId],
      );
      const application = await this.repository.lockApplication(client, applicationId);
      if (!application) throw applicationNotFound();

      if (await this.repository.commandExists(client, applicationId, commandId)) {
        const autoWithdrawn = await client.query<{ application_id: string }>(
          `SELECT application_id FROM application_status_history
           WHERE command_id = $1 AND to_status = 'WITHDRAWN'
             AND metadata->>'selectedApplicationId' = $2
           ORDER BY application_id`,
          [commandId, applicationId],
        );
        return {
          selectedApplication: (await this.repository.findByIdForUit(applicationId, client))!,
          autoWithdrawnApplicationIds: autoWithdrawn.rows.map((row) => row.application_id),
        };
      }
      if (application.status !== "ACCEPTED_PENDING_UIT_CONFIRMATION") {
        throw new AppError(
          409,
          "APPLICATION_STATE_CONFLICT",
          "Chỉ có thể xác nhận nơi thực tập sau khi sinh viên đã nhận offer.",
        );
      }

      const activeStatuses = new Set<ApplicationStatus>([
        "UIT_REVIEWING",
        "NEEDS_SUPPLEMENT",
        "FORWARDED_TO_COMPANY",
        "COMPANY_REVIEWING",
        "INTERVIEW_INVITED",
        "OFFER_PENDING_STUDENT",
      ]);
      const otherApplications = lockedApplications.rows.filter(
        (item) => item.id !== applicationId && activeStatuses.has(item.status),
      );
      const autoWithdrawnApplicationIds = otherApplications.map((item) => item.id);

      const result = await client.query(
        `UPDATE recruitment_results
         SET start_date = $2, updated_at = now()
         WHERE application_id = $1 AND outcome = 'PASS' AND student_decision = 'ACCEPTED'`,
        [applicationId, input.startDate],
      );
      if ((result.rowCount ?? 0) !== 1) {
        throw new AppError(409, "PLACEMENT_RESULT_CONFLICT", "Không tìm thấy offer đã được sinh viên chấp nhận.");
      }

      await client.query(
        `UPDATE applications
         SET status = 'HIRED', placement_confirmed_at = now(), version = version + 1,
             last_transition_at = now(), updated_at = now()
         WHERE id = $1`,
        [applicationId],
      );
      if (autoWithdrawnApplicationIds.length) {
        await client.query(
          `UPDATE applications
           SET status = 'WITHDRAWN', withdrawn_at = now(), version = version + 1,
               last_transition_at = now(), updated_at = now()
           WHERE id = ANY($1::uuid[])`,
          [autoWithdrawnApplicationIds],
        );
        await client.query(
          `UPDATE interviews
           SET status = 'CANCELLED', cancellation_reason = 'ACCEPTED_OTHER_JOB',
               version = version + 1, updated_at = now()
           WHERE application_id = ANY($1::uuid[])
             AND status IN ('PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'RESCHEDULE_REQUESTED')`,
          [autoWithdrawnApplicationIds],
        );
      }

      await client.query(
        `INSERT INTO application_status_history
         (application_id, command_id, from_status, to_status, actor_type, actor_user_id, note, metadata)
         VALUES ($1, $2, 'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED', 'UIT_ADMIN', $3, $4, $5::jsonb)`,
        [
          applicationId,
          commandId,
          actorUserId,
          input.note ?? null,
          JSON.stringify({ startDate: input.startDate, autoWithdrawnApplicationIds }),
        ],
      );
      const placementResult = await client.query<{ id: string }>(
        `INSERT INTO internship_placements
         (application_id, status, expected_start_date, hired_at)
         VALUES ($1, 'HIRED', $2, now())
         RETURNING id`,
        [applicationId, input.startDate],
      );
      const placementId = placementResult.rows[0]!.id;
      await client.query(
        `INSERT INTO internship_placement_history
         (placement_id, command_id, from_status, to_status, actor_type, actor_user_id,
          effective_date, note, metadata)
         VALUES ($1, $2, NULL, 'HIRED', 'UIT_ADMIN', $3, $4, $5,
                 jsonb_build_object('applicationId', $6::text, 'autoWithdrawnApplicationIds', $7::jsonb))`,
        [
          placementId,
          commandId,
          actorUserId,
          input.startDate,
          input.note ?? null,
          applicationId,
          JSON.stringify(autoWithdrawnApplicationIds),
        ],
      );
      for (const otherApplication of otherApplications) {
        await client.query(
          `INSERT INTO application_status_history
           (application_id, command_id, from_status, to_status, actor_type,
            reason_code, note, metadata)
           VALUES ($1, $2, $3, 'WITHDRAWN', 'SYSTEM', 'ACCEPTED_OTHER_JOB',
                   'Hệ thống đóng đơn sau khi UIT xác nhận sinh viên đã chọn nơi thực tập khác.', $4::jsonb)`,
          [
            otherApplication.id,
            commandId,
            otherApplication.status,
            JSON.stringify({ selectedApplicationId: applicationId, selectedCompanyId: application.companyId }),
          ],
        );
      }

      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, 'PLACEMENT_CONFIRMED', 'UIT đã xác nhận nơi thực tập',
                 'UIT đã xác nhận bạn nhận vị trí “' || $2 || '” tại ' || $3 || '. ' ||
                 CASE WHEN $4::int > 0 THEN $4::text || ' đơn khác đã được hệ thống đóng.' ELSE '' END,
                 'APPLICATION', $5::uuid, '/applications/' || $5::text,
                 'application:' || $5::text || ':' || $6::text || ':placement:student',
                 jsonb_build_object('applicationId', $5::text, 'commandId', $6::text,
                                    'status', 'HIRED', 'autoWithdrawnApplicationIds', $7::jsonb))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          application.studentUserId,
          application.jobTitle,
          application.companyName,
          autoWithdrawnApplicationIds.length,
          applicationId,
          commandId,
          JSON.stringify(autoWithdrawnApplicationIds),
        ],
      );
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'PLACEMENT_CONFIRMED_BY_UIT', 'UIT đã xác nhận sinh viên nhận việc',
                $3 || ' đã được UIT xác nhận nhận vị trí “' || $4 || '”.',
                'APPLICATION', $1::uuid, '/company/candidates/' || $1::text,
                'application:' || $1::text || ':' || $2::text || ':placement:company:' || u.id::text,
                jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                   'status', 'HIRED', 'startDate', $5::text)
         FROM company_users cu JOIN users u ON u.id = cu.user_id
         WHERE cu.company_id = $6 AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          applicationId,
          commandId,
          application.studentFullName,
          application.jobTitle,
          input.startDate,
          application.companyId,
        ],
      );
      for (const otherApplication of otherApplications) {
        await client.query(
          `INSERT INTO notifications
           (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
           SELECT u.id, 'APPLICATION_AUTO_WITHDRAWN', 'Ứng viên đã chọn nơi thực tập khác',
                  $3 || ' đã được UIT xác nhận tại doanh nghiệp khác; hồ sơ vị trí “' || $4 || '” đã tự đóng.',
                  'APPLICATION', $1::uuid, '/company/candidates/' || $1::text,
                  'application:' || $1::text || ':' || $2::text || ':auto-withdrawn:company:' || u.id::text,
                  jsonb_build_object('applicationId', $1::text, 'commandId', $2::text,
                                     'status', 'WITHDRAWN', 'selectedApplicationId', $5::text)
           FROM company_users cu JOIN users u ON u.id = cu.user_id
           WHERE cu.company_id = $6 AND u.status = 'ACTIVE'
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [
            otherApplication.id,
            commandId,
            application.studentFullName,
            otherApplication.job_title,
            applicationId,
            otherApplication.company_id,
          ],
        );
      }

      await client.query(
        `INSERT INTO audit_logs
         (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
         VALUES ($1, 'PLACEMENT_CONFIRMED', 'APPLICATION', $2, $3::jsonb, $4, $5)`,
        [
          actorUserId,
          applicationId,
          JSON.stringify({ commandId, placementId, startDate: input.startDate, autoWithdrawnApplicationIds }),
          request.ipAddress,
          request.userAgent,
        ],
      );
      return {
        selectedApplication: (await this.repository.findByIdForUit(applicationId, client))!,
        autoWithdrawnApplicationIds,
      };
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
    const result = await this.repository.withTransaction(async (client) => {
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

    await this.dispatchEmailsBestEffort(result.id);
    return result;
  }

  private async dispatchEmailsBestEffort(applicationId: string) {
    if (!this.emailDeliveryService) return;

    try {
      const summary = await this.emailDeliveryService.dispatchPending(applicationId);
      if (summary.failed > 0) {
        appLogger.warn("email_delivery_retry_queued", { applicationId, failed: summary.failed });
      }
    } catch (error) {
      appLogger.error("email_delivery_dispatch_failed", {
        applicationId,
        error: serializeError(error),
      });
    }
  }
}

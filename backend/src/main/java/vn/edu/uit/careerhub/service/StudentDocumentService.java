package vn.edu.uit.careerhub.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.DocumentReviewRequest;
import vn.edu.uit.careerhub.dto.request.DocumentUploadRequest;
import vn.edu.uit.careerhub.entity.DocumentUpload;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.exception.UploadExpiredException;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.NotificationRepository;
import vn.edu.uit.careerhub.repository.StudentDocumentRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.storage.ObjectStorage;

@Service
public class StudentDocumentService {
    private static final String UPLOAD_PREFIX = "STUDENT_DOCUMENT";

    private final StudentDocumentRepository repository;
    private final NotificationRepository notifications;
    private final AuditRepository audit;
    private final UploadedFileService files;

    public StudentDocumentService(StudentDocumentRepository repository, NotificationRepository notifications,
            AuditRepository audit, UploadedFileService files) {
        this.repository = repository;
        this.notifications = notifications;
        this.audit = audit;
        this.files = files;
    }

    public List<Map<String, Object>> studentDocuments(UUID id) { return repository.studentDocuments(id); }

    public PageResult documentsForReview(int page, int pageSize, String status, String query) {
        return repository.studentDocumentsForReview(page, pageSize, status, query);
    }

    public Map<String, Object> createStudentUpload(AuthPrincipal principal, DocumentUploadRequest input) {
        ObjectStorage objects = files.storage();
        UUID id = UUID.randomUUID();
        String key = "students/" + principal.studentProfileId() + "/" + input.documentType().name().toLowerCase() + "/" + id + ".pdf";
        Instant expires = files.uploadExpiry();
        String url = objects.createUploadUrl(key, input.mimeType(), files.uploadTtlSeconds());
        repository.createUpload(id, principal.studentProfileId(), input, key, expires);
        return files.uploadIntent(id, url, expires);
    }

    @Transactional(noRollbackFor = UploadExpiredException.class)
    public List<Map<String, Object>> completeStudentUpload(AuthPrincipal principal, UUID uploadId, RequestMetadata request) {
        DocumentUpload upload = repository.lockUpload(principal.studentProfileId(), uploadId)
                .orElseThrow(() -> new AppException(ErrorType.NOT_FOUND, "STUDENT_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải tài liệu."));
        if ("COMPLETED".equals(upload.status())) return studentDocuments(principal.studentProfileId());
        files.ensureOpen(upload, UPLOAD_PREFIX, repository::expireUpload);
        files.verifyPdf(upload, UPLOAD_PREFIX);
        UUID documentId = UUID.randomUUID();
        repository.insertDocument(documentId, principal.studentProfileId(), upload);
        repository.completeUpload(uploadId, documentId);
        audit.record(principal.userId(), "STUDENT_DOCUMENT_UPLOADED", "STUDENT_DOCUMENT", documentId, Map.of("uploadId", uploadId, "documentType", upload.documentType()), request);
        notifications.notifyUitAdmins("STUDENT_DOCUMENT_PENDING_REVIEW", "Có tài liệu sinh viên cần xác minh", upload.fileName(), "STUDENT_DOCUMENT", documentId, "/uit/student-documents/" + documentId, "student-document:" + documentId + ":pending:uit:");
        return studentDocuments(principal.studentProfileId());
    }

    public Map<String, Object> studentDocumentDownload(UUID studentId, UUID documentId) {
        var document = repository.studentDocumentStorage(studentId, documentId).orElseThrow(this::documentNotFound);
        return files.download(document.storageKey(), document.fileName());
    }

    public Map<String, Object> uitDocumentDownload(UUID documentId) {
        var map = repository.studentDocumentForReview(documentId, false).orElseThrow(this::documentNotFound);
        return files.download(map.get("storageKey").toString(), map.get("fileName").toString());
    }

    @Transactional
    public List<Map<String, Object>> deleteStudentDocument(AuthPrincipal principal, UUID documentId, RequestMetadata request) {
        var document = repository.lockStudentDocument(principal.studentProfileId(), documentId).orElseThrow(this::documentNotFound);
        if (document.isDefault()) throw new AppException(ErrorType.CONFLICT, "STUDENT_DOCUMENT_DEFAULT_CV", "Hãy chọn một CV khác làm mặc định trước khi xóa.");
        if (document.usedByApplication()) throw new AppException(ErrorType.CONFLICT, "STUDENT_DOCUMENT_IN_USE", "Tài liệu đã được dùng trong đơn ứng tuyển.");
        files.storage().deleteObject(document.storageKey());
        repository.delete(documentId, principal.studentProfileId());
        audit.record(principal.userId(), "STUDENT_DOCUMENT_DELETED", "STUDENT_DOCUMENT", documentId, Map.of("documentType", document.documentType()), request);
        return studentDocuments(principal.studentProfileId());
    }

    @Transactional
    public List<Map<String, Object>> setDefaultCv(AuthPrincipal principal, UUID documentId, RequestMetadata request) {
        var document = repository.lockStudentDocument(principal.studentProfileId(), documentId).orElseThrow(this::documentNotFound);
        if (!"CV".equals(document.documentType())) throw new AppException(ErrorType.CONFLICT, "STUDENT_DOCUMENT_NOT_CV", "Chỉ có thể chọn tài liệu CV làm mặc định.");
        if (!"VERIFIED".equals(document.verificationStatus())) throw new AppException(ErrorType.CONFLICT, "STUDENT_DOCUMENT_NOT_VERIFIED", "CV phải được UIT xác minh trước.");
        if (!document.isDefault()) {
            repository.makeDefaultCv(documentId, principal.studentProfileId());
            audit.record(principal.userId(), "STUDENT_DEFAULT_CV_CHANGED", "STUDENT_DOCUMENT", documentId, Map.of(), request);
        }
        return studentDocuments(principal.studentProfileId());
    }

    @Transactional
    public Map<String, Object> reviewDocument(AuthPrincipal principal, UUID documentId, DocumentReviewRequest input, RequestMetadata request) {
        if ("REJECT".equals(input.decision()) && (input.note() == null || input.note().strip().length() < 5)) throw new AppException(ErrorType.INVALID_INPUT, "VALIDATION_ERROR", "Cần ghi rõ lý do từ chối.");
        var current = repository.studentDocumentForReview(documentId, true).orElseThrow(this::documentNotFound);
        String to = "VERIFY".equals(input.decision()) ? "VERIFIED" : "REJECTED";
        String from = current.get("verificationStatus").toString();
        if (from.equals(to)) return sanitizedDocument(current);
        if (!"PENDING".equals(from)) throw new AppException(ErrorType.CONFLICT, "STUDENT_DOCUMENT_REVIEW_CONFLICT", "Tài liệu đã được xử lý.");
        repository.updateVerificationStatus(documentId, to);
        UUID studentUser = UUID.fromString(current.get("studentUserId").toString());
        notifications.notifyUser(studentUser, "VERIFIED".equals(to) ? "STUDENT_DOCUMENT_VERIFIED" : "STUDENT_DOCUMENT_REJECTED",
                "VERIFIED".equals(to) ? "Tài liệu đã được UIT xác minh" : "Tài liệu chưa được chấp nhận", current.get("fileName").toString(), "STUDENT_DOCUMENT", documentId, "/profile", "student-document:" + documentId + ":" + to);
        audit.record(principal.userId(), "VERIFIED".equals(to) ? "STUDENT_DOCUMENT_VERIFIED_BY_UIT" : "STUDENT_DOCUMENT_REJECTED_BY_UIT", "STUDENT_DOCUMENT", documentId, Map.of("fromStatus", from, "toStatus", to), request);
        return sanitizedDocument(repository.studentDocumentForReview(documentId, false).orElseThrow());
    }

    private AppException documentNotFound() {
        return new AppException(ErrorType.NOT_FOUND, "STUDENT_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu của sinh viên.");
    }

    private Map<String, Object> sanitizedDocument(Map<String, Object> source) {
        var copy = new LinkedHashMap<>(source);
        copy.remove("storageKey");
        copy.remove("studentUserId");
        copy.remove("studentProfileId");
        return copy;
    }
}

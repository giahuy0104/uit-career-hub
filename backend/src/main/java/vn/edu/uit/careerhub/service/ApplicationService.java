package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.ApplicationReasonRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationResubmitRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationSubmitRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationSupplementRequest;
import vn.edu.uit.careerhub.dto.request.DocumentRefRequest;
import vn.edu.uit.careerhub.entity.LockedApplication;
import vn.edu.uit.careerhub.entity.SourceDocument;
import vn.edu.uit.careerhub.enums.ApplicationStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.ApplicationRepository;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.InterviewRepository;
import vn.edu.uit.careerhub.repository.NotificationRepository;
import vn.edu.uit.careerhub.repository.StudentDocumentRepository;
import vn.edu.uit.careerhub.repository.StudentProfileRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/** The application lifecycle up to the interview stage: submission, review, supplement and withdrawal. */
@Service
public class ApplicationService {
    private final ApplicationRepository repository;
    private final StudentProfileRepository students;
    private final StudentDocumentRepository documents;
    private final InterviewRepository interviews;
    private final NotificationRepository notifications;
    private final AuditRepository audit;
    private final ApplicationAccess access;
    private final UploadedFileService files;

    public ApplicationService(ApplicationRepository repository, StudentProfileRepository students,
            StudentDocumentRepository documents, InterviewRepository interviews, NotificationRepository notifications,
            AuditRepository audit, ApplicationAccess access, UploadedFileService files) {
        this.repository = repository;
        this.students = students;
        this.documents = documents;
        this.interviews = interviews;
        this.notifications = notifications;
        this.audit = audit;
        this.access = access;
        this.files = files;
    }

    public Map<String, Object> application(UUID id, UUID studentId) { return repository.application(id, studentId, null, false).orElseThrow(access::applicationNotFound); }
    public PageResult applications(UUID studentId, int page, int pageSize, ApplicationStatus status) { return repository.applications(studentId, page, pageSize, status); }
    public PageResult reviewQueue(int page, int pageSize, boolean placements) { return repository.reviewQueue(page, pageSize, placements); }
    public PageResult companyCandidates(UUID companyId, int page, int pageSize, UUID jobId, ApplicationStatus status) { return repository.companyCandidates(companyId, page, pageSize, jobId, status); }

    @Transactional
    public Map<String, Object> submit(AuthPrincipal principal, ApplicationSubmitRequest input, UUID commandId, RequestMetadata request) {
        UUID studentId = principal.studentProfileId();
        repository.lockSubmission(studentId, input.jobId());
        var repeated = repository.applicationByCommand(studentId, commandId);
        if (repeated.isPresent()) {
            @SuppressWarnings("unchecked") Map<String, Object> job = (Map<String, Object>) repeated.get().get("job");
            if (!input.jobId().toString().equals(job.get("id").toString())) throw new AppException(ErrorType.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key đã được dùng cho yêu cầu khác.");
            return repeated.get();
        }
        String academic = students.academicStatusForShare(studentId).orElseThrow(access::studentNotFound);
        if (!"ACTIVE".equals(academic)) throw new AppException(ErrorType.FORBIDDEN, "STUDENT_NOT_ACTIVE", "Sinh viên không ở trạng thái đủ điều kiện ứng tuyển.");
        var job = repository.lockTargetJob(input.jobId()).orElseThrow(this::jobNotAvailable);
        if (!"RECRUITING".equals(job.status()) || !"ACTIVE".equals(job.partnerStatus())) throw jobNotAvailable();
        if (job.deadline().isBefore(LocalDate.now())) throw new AppException(ErrorType.CONFLICT, "JOB_DEADLINE_EXPIRED", "Tin tuyển dụng đã hết hạn ứng tuyển.");
        if (repository.countActive(studentId, input.jobId()) > 0) throw new AppException(ErrorType.CONFLICT, "APPLICATION_ALREADY_ACTIVE", "Bạn đã có đơn đang được xử lý cho tin này.");
        List<UUID> ids = uniqueDocumentIds(input.documents().stream().map(DocumentRefRequest::documentId).toList());
        var selected = verifiedDocuments(studentId, ids, true);
        UUID applicationId = repository.insert(studentId, input.jobId());
        repository.insertSnapshots(applicationId, selected);
        repository.addHistory(applicationId, commandId, null, "UIT_REVIEWING", "STUDENT", principal.userId(), null, null, Map.of());
        notifications.notifyUitAdmins("APPLICATION_SUBMITTED", "Có hồ sơ sinh viên cần xử lý", "Có đơn mới ứng tuyển vị trí \"" + job.title() + "\".", "APPLICATION", applicationId, "/uit/applications/" + applicationId, "application:" + applicationId + ":submitted:" + commandId + ":");
        audit.record(principal.userId(), "APPLICATION_SUBMITTED", "APPLICATION", applicationId, Map.of("jobId", input.jobId(), "commandId", commandId, "documentCount", selected.size()), request);
        return repository.application(applicationId, studentId, null, false).orElseThrow();
    }

    @Transactional
    public Map<String, Object> uitReview(AuthPrincipal principal, UUID applicationId, UUID commandId, String decision, Object payload, RequestMetadata request) {
        LockedApplication app = access.lock(applicationId);
        if (repository.commandExists(applicationId, commandId)) return repository.application(applicationId, null, null, true).orElseThrow();
        if (app.status() != ApplicationStatus.UIT_REVIEWING) throw access.stateConflict("Hồ sơ không còn chờ UIT kiểm duyệt.");
        String to;
        String reason = null, note = null;
        Map<String, Object> metadata = Map.of();
        if ("request-supplement".equals(decision)) {
            ApplicationSupplementRequest supplement = (ApplicationSupplementRequest) payload;
            if (!supplement.dueAt().isAfter(OffsetDateTime.now())) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_SUPPLEMENT_DUE_DATE_INVALID", "Hạn bổ sung phải nằm trong tương lai.");
            to = "NEEDS_SUPPLEMENT";
            reason = supplement.reasonCode().strip();
            note = supplement.note().strip();
            metadata = Map.of("requiredDocumentTypes", supplement.requiredDocumentTypes(), "dueAt", supplement.dueAt());
        } else if ("reject".equals(decision)) {
            ApplicationReasonRequest value = (ApplicationReasonRequest) payload;
            to = "UIT_REJECTED";
            reason = value.reasonCode().strip();
            note = value.note().strip();
        } else {
            to = "FORWARDED_TO_COMPANY";
        }
        repository.updateStatus(applicationId, to);
        repository.addHistory(applicationId, commandId, "UIT_REVIEWING", to, "UIT_ADMIN", principal.userId(), reason, note, metadata);
        notifications.notifyUser(app.studentUserId(), "APPLICATION_" + to, "Hồ sơ đã được UIT cập nhật", "Trạng thái hồ sơ vị trí \"" + app.jobTitle() + "\" đã thay đổi.", "APPLICATION", applicationId, "/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":student");
        if ("FORWARDED_TO_COMPANY".equals(to)) notifications.notifyCompanyOfApplication(app.companyId(), "APPLICATION_RECEIVED", "Có hồ sơ ứng viên cần xử lý", app.studentFullName() + " đã được UIT chuyển đến vị trí \"" + app.jobTitle() + "\".", applicationId, commandId);
        audit.record(principal.userId(), "APPLICATION_" + to, "APPLICATION", applicationId, Map.of("commandId", commandId, "toStatus", to), request);
        return repository.application(applicationId, null, null, true).orElseThrow();
    }

    @Transactional
    public Map<String, Object> companyDecision(AuthPrincipal principal, UUID applicationId, UUID commandId, boolean reject, ApplicationReasonRequest reason, RequestMetadata request) {
        LockedApplication app = access.lockOwnedByCompany(applicationId, principal.companyId());
        if (repository.commandExists(applicationId, commandId)) return repository.application(applicationId, null, principal.companyId(), false).orElseThrow();
        ApplicationStatus expected = reject ? ApplicationStatus.COMPANY_REVIEWING : ApplicationStatus.FORWARDED_TO_COMPANY;
        if (app.status() != expected) throw access.stateConflict(reject ? "Chỉ có thể từ chối khi hồ sơ đang được sàng lọc." : "Hồ sơ không còn ở trạng thái mới từ UIT.");
        String to = reject ? "NOT_SUITABLE" : "COMPANY_REVIEWING";
        repository.updateStatus(applicationId, to);
        repository.addHistory(applicationId, commandId, expected.name(), to, "COMPANY", principal.userId(), reject ? reason.reasonCode() : null, reject ? reason.note() : null, Map.of());
        notifications.notifyUser(app.studentUserId(), "APPLICATION_" + to, "Doanh nghiệp đã cập nhật hồ sơ", app.companyName() + " đã cập nhật hồ sơ vị trí \"" + app.jobTitle() + "\".", "APPLICATION", applicationId, "/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":student");
        audit.record(principal.userId(), reject ? "APPLICATION_NOT_SUITABLE" : "APPLICATION_COMPANY_REVIEW_STARTED", "APPLICATION", applicationId, Map.of("commandId", commandId, "toStatus", to), request);
        return repository.application(applicationId, null, principal.companyId(), false).orElseThrow();
    }

    public Map<String, Object> applicationDocumentDownload(AuthPrincipal principal, UUID applicationId, UUID documentId, boolean uit, RequestMetadata request) {
        var document = (uit ? repository.applicationDocumentStorage(applicationId, documentId)
                : repository.companyApplicationDocumentStorage(applicationId, documentId, principal.companyId()))
                .orElseThrow(access::applicationNotFound);
        Map<String, Object> result = files.download(document.storageKey(), document.fileName());
        audit.record(principal.userId(), "APPLICATION_DOCUMENT_DOWNLOAD_URL_CREATED", "APPLICATION_DOCUMENT", documentId, Map.of("applicationId", applicationId, "actorType", uit ? "UIT_ADMIN" : "COMPANY"), request);
        return result;
    }

    @Transactional
    public Map<String, Object> resubmit(AuthPrincipal principal, UUID applicationId, UUID commandId, ApplicationResubmitRequest input, RequestMetadata request) {
        LockedApplication app = access.lockOwnedByStudent(applicationId, principal.studentProfileId());
        if (repository.commandExists(applicationId, commandId)) return repository.application(applicationId, principal.studentProfileId(), null, false).orElseThrow();
        if (app.status() != ApplicationStatus.NEEDS_SUPPLEMENT) throw access.stateConflict("Chỉ có thể nộp bổ sung khi UIT đang yêu cầu cập nhật hồ sơ.");
        var supplement = repository.latestSupplementRequest(applicationId)
                .orElseThrow(() -> new AppException(ErrorType.CONFLICT, "APPLICATION_SUPPLEMENT_REQUEST_INVALID", "Yêu cầu bổ sung không đầy đủ thông tin."));
        Object dueValue = supplement.metadata().get("dueAt");
        if (dueValue == null || !OffsetDateTime.parse(dueValue.toString()).isAfter(OffsetDateTime.now())) throw new AppException(ErrorType.CONFLICT, "APPLICATION_SUPPLEMENT_DEADLINE_EXPIRED", "Đã quá hạn bổ sung hồ sơ.");
        @SuppressWarnings("unchecked") List<String> required = ((List<Object>) supplement.metadata().getOrDefault("requiredDocumentTypes", List.of())).stream().map(Object::toString).toList();
        List<UUID> ids = uniqueDocumentIds(input.documents().stream().map(DocumentRefRequest::documentId).toList());
        var chosen = verifiedDocuments(principal.studentProfileId(), ids, false);
        Set<String> selected = chosen.stream().map(SourceDocument::documentType).collect(Collectors.toSet());
        List<String> missing = required.stream().filter(type -> !selected.contains(type)).toList();
        if (!missing.isEmpty()) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_REQUIRED_DOCUMENTS_MISSING", "Còn thiếu tài liệu UIT yêu cầu: " + String.join(", ", missing) + ".");
        if (repository.countSubmittedDocuments(applicationId, ids) > 0) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_DOCUMENT_ALREADY_SUBMITTED", "Hãy chọn phiên bản tài liệu mới.");
        repository.insertSnapshots(applicationId, chosen);
        repository.markResubmitted(applicationId);
        repository.addHistory(applicationId, commandId, "NEEDS_SUPPLEMENT", "UIT_REVIEWING", "STUDENT", principal.userId(), null, "Sinh viên đã nộp tài liệu bổ sung.", Map.of("supplementRequestCommandId", supplement.commandId(), "requiredDocumentTypes", required));
        notifications.notifyUitAdmins("APPLICATION_RESUBMITTED", "Sinh viên đã bổ sung hồ sơ", app.studentFullName() + " đã bổ sung hồ sơ vị trí \"" + app.jobTitle() + "\".", "APPLICATION", applicationId, "/uit/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":resubmit:uit:");
        audit.record(principal.userId(), "APPLICATION_RESUBMITTED", "APPLICATION", applicationId, Map.of("commandId", commandId, "documentCount", chosen.size()), request);
        return repository.application(applicationId, principal.studentProfileId(), null, false).orElseThrow();
    }

    @Transactional
    public Map<String, Object> withdraw(AuthPrincipal principal, UUID applicationId, UUID commandId, boolean cancelInterview, ApplicationReasonRequest reason, RequestMetadata request) {
        LockedApplication app = access.lockOwnedByStudent(applicationId, principal.studentProfileId());
        if (repository.commandExists(applicationId, commandId)) return repository.application(applicationId, principal.studentProfileId(), null, false).orElseThrow();
        boolean valid = cancelInterview ? app.status() == ApplicationStatus.INTERVIEW_INVITED : Set.of(ApplicationStatus.UIT_REVIEWING, ApplicationStatus.NEEDS_SUPPLEMENT, ApplicationStatus.FORWARDED_TO_COMPANY, ApplicationStatus.COMPANY_REVIEWING).contains(app.status());
        if (!valid) throw new AppException(ErrorType.CONFLICT, "APPLICATION_WITHDRAWAL_NOT_ALLOWED", "Không thể rút đơn ở bước hiện tại.");
        String from = app.status().name();
        repository.markWithdrawn(applicationId);
        if (cancelInterview && interviews.cancelActive(applicationId, reason.note()) == 0) throw new AppException(ErrorType.CONFLICT, "INTERVIEW_STATE_CONFLICT", "Không còn lịch phỏng vấn để hủy.");
        repository.addHistory(applicationId, commandId, from, "WITHDRAWN", "STUDENT", principal.userId(), reason.reasonCode(), reason.note(), Map.of("action", cancelInterview ? "cancel-interview" : "withdraw"));
        notifications.notifyUitAdmins("APPLICATION_WITHDRAWN_RECORDED", "Sinh viên đã rút đơn", app.studentFullName() + " đã rút đơn vị trí \"" + app.jobTitle() + "\".", "APPLICATION", applicationId, "/uit/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":withdraw:uit:");
        if (Set.of(ApplicationStatus.FORWARDED_TO_COMPANY, ApplicationStatus.COMPANY_REVIEWING, ApplicationStatus.INTERVIEW_INVITED).contains(app.status())) notifications.notifyCompanyOfApplication(app.companyId(), cancelInterview ? "INTERVIEW_CANCELLED_BY_STUDENT" : "APPLICATION_WITHDRAWN_BY_STUDENT", "Sinh viên đã rút hồ sơ", app.studentFullName() + " đã rút hồ sơ vị trí \"" + app.jobTitle() + "\".", applicationId, commandId);
        audit.record(principal.userId(), cancelInterview ? "INTERVIEW_CANCELLED_BY_STUDENT" : "APPLICATION_WITHDRAWN_BY_STUDENT", "APPLICATION", applicationId, Map.of("commandId", commandId, "fromStatus", from), request);
        return repository.application(applicationId, principal.studentProfileId(), null, false).orElseThrow();
    }

    private AppException jobNotAvailable() {
        return new AppException(ErrorType.NOT_FOUND, "JOB_NOT_AVAILABLE", "Tin tuyển dụng không còn nhận hồ sơ.");
    }

    private List<UUID> uniqueDocumentIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_DOCUMENT_INVALID", "Cần chọn ít nhất một tài liệu.");
        if (ids.stream().distinct().count() != ids.size()) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_DOCUMENT_INVALID", "Không được chọn trùng tài liệu.");
        return ids;
    }

    private List<SourceDocument> verifiedDocuments(UUID studentId, List<UUID> ids, boolean requireCv) {
        var found = documents.sourceDocuments(studentId, ids);
        if (found.size() != ids.size()) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_DOCUMENT_INVALID", "Có tài liệu không thuộc hồ sơ của bạn.");
        if (found.stream().anyMatch(d -> !"VERIFIED".equals(d.verificationStatus()))) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_DOCUMENT_NOT_VERIFIED", "Chỉ có thể gửi tài liệu đã xác minh.");
        if (requireCv && found.stream().noneMatch(d -> "CV".equals(d.documentType()))) throw new AppException(ErrorType.INVALID_INPUT, "APPLICATION_CV_REQUIRED", "Đơn ứng tuyển phải có CV.");
        return found;
    }
}

package vn.edu.uit.careerhub.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.ApplicationReasonRequest;
import vn.edu.uit.careerhub.dto.request.OfferUploadRequest;
import vn.edu.uit.careerhub.dto.request.RecruitmentResultRequest;
import vn.edu.uit.careerhub.entity.DocumentUpload;
import vn.edu.uit.careerhub.entity.LockedApplication;
import vn.edu.uit.careerhub.enums.ApplicationStatus;
import vn.edu.uit.careerhub.enums.ResultOutcome;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.exception.UploadExpiredException;
import vn.edu.uit.careerhub.repository.ApplicationRepository;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.InterviewRepository;
import vn.edu.uit.careerhub.repository.NotificationRepository;
import vn.edu.uit.careerhub.repository.RecruitmentResultRepository;
import vn.edu.uit.careerhub.repository.StudentProfileRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.storage.ObjectStorage;

/** Recruitment outcome: offer documents, the company's result and the student's response. */
@Service
public class RecruitmentResultService {
    private static final String UPLOAD_PREFIX = "OFFER_DOCUMENT";

    private final RecruitmentResultRepository repository;
    private final ApplicationRepository applications;
    private final InterviewRepository interviews;
    private final StudentProfileRepository students;
    private final NotificationRepository notifications;
    private final AuditRepository audit;
    private final ApplicationAccess access;
    private final UploadedFileService files;

    public RecruitmentResultService(RecruitmentResultRepository repository, ApplicationRepository applications,
            InterviewRepository interviews, StudentProfileRepository students, NotificationRepository notifications,
            AuditRepository audit, ApplicationAccess access, UploadedFileService files) {
        this.repository = repository;
        this.applications = applications;
        this.interviews = interviews;
        this.students = students;
        this.notifications = notifications;
        this.audit = audit;
        this.access = access;
        this.files = files;
    }

    public Map<String, Object> createOfferUpload(AuthPrincipal principal, UUID applicationId, OfferUploadRequest input) {
        Map<String, Object> application = applications.application(applicationId, null, principal.companyId(), false).orElseThrow(access::applicationNotFound);
        if (!"INTERVIEW_INVITED".equals(application.get("status")) || application.get("recruitmentResult") != null) throw new AppException(ErrorType.CONFLICT, "OFFER_DOCUMENT_STATE_CONFLICT", "Chỉ có thể tải offer khi ứng viên đang ở bước phỏng vấn.");
        ObjectStorage objects = files.storage();
        UUID id = UUID.randomUUID();
        String key = "offers/" + principal.companyId() + "/" + applicationId + "/" + id + ".pdf";
        Instant expires = files.uploadExpiry();
        repository.createOfferUpload(id, applicationId, principal.companyId(), principal.userId(), input, key, expires);
        return files.uploadIntent(id, objects.createUploadUrl(key, input.mimeType(), files.uploadTtlSeconds()), expires);
    }

    @Transactional(noRollbackFor = UploadExpiredException.class)
    public Map<String, Object> completeOfferUpload(AuthPrincipal principal, UUID applicationId, UUID uploadId, RequestMetadata request) {
        DocumentUpload upload = repository.lockOfferUpload(principal.companyId(), applicationId, uploadId).orElseThrow(this::offerUploadNotFound);
        Map<String, Object> dto = Map.of("fileName", upload.fileName(), "mimeType", upload.mimeType(), "fileSizeBytes", upload.size());
        if (Set.of("COMPLETED", "CONSUMED").contains(upload.status())) return dto;
        files.ensureOpen(upload, UPLOAD_PREFIX, repository::expireOfferUpload);
        files.verifyPdf(upload, UPLOAD_PREFIX);
        repository.completeOfferUpload(uploadId, files.storage().headObject(upload.storageKey()).etag());
        audit.record(principal.userId(), "OFFER_DOCUMENT_UPLOADED", "APPLICATION", applicationId, Map.of("uploadId", uploadId, "fileName", upload.fileName()), request);
        return dto;
    }

    @Transactional
    public Map<String, Object> recordResult(AuthPrincipal principal, UUID applicationId, UUID commandId, RecruitmentResultRequest input, RequestMetadata request) {
        if (input.outcome() == ResultOutcome.PASS) {
            if (input.startDate() == null) throw new AppException(ErrorType.INVALID_INPUT, "VALIDATION_ERROR", "Kết quả PASS cần ngày bắt đầu.");
            if (input.startDate().isBefore(LocalDate.now())) throw new AppException(ErrorType.INVALID_INPUT, "OFFER_START_DATE_INVALID", "Ngày bắt đầu không được trong quá khứ.");
        } else if (input.reasonCode() == null || input.note() == null) {
            throw new AppException(ErrorType.INVALID_INPUT, "VALIDATION_ERROR", "Kết quả FAIL cần lý do và ghi chú.");
        }
        LockedApplication app = access.lockOwnedByCompany(applicationId, principal.companyId());
        if (applications.commandExists(applicationId, commandId)) return applications.application(applicationId, null, principal.companyId(), false).orElseThrow();
        if (app.status() != ApplicationStatus.INTERVIEW_INVITED) throw access.stateConflict("Chỉ có thể cập nhật kết quả ở bước phỏng vấn.");
        boolean pass = input.outcome() == ResultOutcome.PASS;
        DocumentUpload offer = pass && input.offerUploadId() != null
                ? repository.lockOfferUpload(principal.companyId(), applicationId, input.offerUploadId()).orElseThrow(this::offerUploadNotFound) : null;
        if (offer != null && !"COMPLETED".equals(offer.status())) throw new AppException(ErrorType.CONFLICT, "OFFER_DOCUMENT_UPLOAD_NOT_READY", "Tệp offer chưa tải xong hoặc đã được dùng.");
        UUID interviewId = interviews.completeLatest(applicationId)
                .orElseThrow(() -> new AppException(ErrorType.CONFLICT, "INTERVIEW_NOT_FOUND", "Không tìm thấy lịch phỏng vấn hợp lệ."));
        UUID resultId = UUID.randomUUID();
        repository.insert(resultId, applicationId, commandId, principal.userId(), input.outcome().name(), pass ? input.startDate() : null,
                offer == null ? null : offer.storageKey(), offer == null ? null : offer.id(), pass ? input.internalNote() : input.note());
        if (offer != null) repository.consumeOfferUpload(offer.id());
        String to = pass ? "OFFER_PENDING_STUDENT" : "INTERVIEW_FAILED";
        applications.updateStatus(applicationId, to);
        applications.addHistory(applicationId, commandId, "INTERVIEW_INVITED", to, "COMPANY", principal.userId(), pass ? null : input.reasonCode(), pass ? null : input.note(), Map.of("interviewId", interviewId, "resultId", resultId, "outcome", input.outcome()));
        notifications.notifyUser(app.studentUserId(), pass ? "OFFER_AVAILABLE" : "INTERVIEW_FAILED", pass ? "Bạn có lời mời nhận việc mới" : "Doanh nghiệp đã cập nhật kết quả", app.companyName() + " đã cập nhật kết quả vị trí \"" + app.jobTitle() + "\".", "APPLICATION", applicationId, "/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":result:student");
        audit.record(principal.userId(), "INTERVIEW_RESULT_RECORDED", "APPLICATION", applicationId, Map.of("commandId", commandId, "resultId", resultId, "outcome", input.outcome()), request);
        return applications.application(applicationId, null, principal.companyId(), false).orElseThrow();
    }

    public Map<String, Object> offerDownload(AuthPrincipal principal, UUID applicationId, UserRole actor, RequestMetadata request) {
        UUID owner = switch (actor) {
            case STUDENT -> principal.studentProfileId();
            case COMPANY -> principal.companyId();
            case UIT_ADMIN -> null;
        };
        var document = repository.offerDocument(applicationId, actor, owner)
                .orElseThrow(() -> new AppException(ErrorType.NOT_FOUND, "OFFER_DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu offer."));
        Map<String, Object> result = files.download(document.storageKey(), document.fileName());
        audit.record(principal.userId(), "OFFER_DOCUMENT_DOWNLOAD_URL_CREATED", "RECRUITMENT_RESULT", document.id(), Map.of("applicationId", applicationId, "actorType", actor.name()), request);
        return result;
    }

    @Transactional
    public Map<String, Object> respondOffer(AuthPrincipal principal, UUID applicationId, UUID commandId, boolean accept, ApplicationReasonRequest reason, RequestMetadata request) {
        if (accept) students.lock(principal.studentProfileId());
        LockedApplication app = access.lockOwnedByStudent(applicationId, principal.studentProfileId());
        if (applications.commandExists(applicationId, commandId)) return applications.application(applicationId, principal.studentProfileId(), null, false).orElseThrow();
        if (app.status() != ApplicationStatus.OFFER_PENDING_STUDENT) throw access.stateConflict("Offer này không còn chờ phản hồi.");
        if (accept && applications.countOtherSelected(principal.studentProfileId(), applicationId) > 0) throw new AppException(ErrorType.CONFLICT, "STUDENT_PLACEMENT_ALREADY_SELECTED", "Bạn đã chọn một nơi làm việc khác.");
        String decision = accept ? "ACCEPTED" : "DECLINED";
        if (repository.recordStudentDecision(applicationId, decision) != 1) throw new AppException(ErrorType.CONFLICT, "OFFER_RESULT_CONFLICT", "Không tìm thấy offer hợp lệ.");
        String to = accept ? "ACCEPTED_PENDING_UIT_CONFIRMATION" : "OFFER_DECLINED";
        applications.markOfferResponse(applicationId, to);
        applications.addHistory(applicationId, commandId, "OFFER_PENDING_STUDENT", to, "STUDENT", principal.userId(), accept ? null : reason.reasonCode(), accept ? null : reason.note(), Map.of("decision", decision));
        notifications.notifyCompanyOfApplication(app.companyId(), accept ? "OFFER_ACCEPTED" : "OFFER_DECLINED", accept ? "Sinh viên đã nhận offer" : "Sinh viên đã từ chối offer", app.studentFullName() + " đã phản hồi offer vị trí \"" + app.jobTitle() + "\".", applicationId, commandId);
        notifications.notifyUitAdmins(accept ? "PLACEMENT_CONFIRMATION_REQUIRED" : "OFFER_DECLINED_RECORDED", accept ? "Có nơi thực tập cần xác nhận" : "Sinh viên đã từ chối offer", app.studentFullName() + " đã phản hồi offer tại " + app.companyName() + ".", "APPLICATION", applicationId, "/uit/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":offer:uit:");
        audit.record(principal.userId(), accept ? "OFFER_ACCEPTED" : "OFFER_DECLINED", "APPLICATION", applicationId, Map.of("commandId", commandId, "decision", decision), request);
        return applications.application(applicationId, principal.studentProfileId(), null, false).orElseThrow();
    }

    private AppException offerUploadNotFound() {
        return new AppException(ErrorType.NOT_FOUND, "OFFER_DOCUMENT_UPLOAD_NOT_FOUND", "Không tìm thấy phiên tải offer.");
    }
}

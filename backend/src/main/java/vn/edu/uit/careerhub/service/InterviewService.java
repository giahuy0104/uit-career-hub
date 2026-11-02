package vn.edu.uit.careerhub.service;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.InterviewRequest;
import vn.edu.uit.careerhub.entity.LockedApplication;
import vn.edu.uit.careerhub.enums.ApplicationStatus;
import vn.edu.uit.careerhub.enums.InterviewMode;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.ApplicationRepository;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.InterviewRepository;
import vn.edu.uit.careerhub.repository.NotificationRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

@Service
public class InterviewService {
    private final InterviewRepository repository;
    private final ApplicationRepository applications;
    private final NotificationRepository notifications;
    private final AuditRepository audit;
    private final ApplicationAccess access;

    public InterviewService(InterviewRepository repository, ApplicationRepository applications,
            NotificationRepository notifications, AuditRepository audit, ApplicationAccess access) {
        this.repository = repository;
        this.applications = applications;
        this.notifications = notifications;
        this.audit = audit;
        this.access = access;
    }

    public PageResult interviews(UUID owner, boolean company, int page, int pageSize, String scope) {
        return repository.interviews(owner, company, page, pageSize, scope);
    }

    @Transactional
    public Map<String, Object> confirmInterview(AuthPrincipal principal, UUID interviewId, RequestMetadata request) {
        var interview = repository.lockForStudent(interviewId, principal.studentProfileId())
                .orElseThrow(() -> new AppException(ErrorType.NOT_FOUND, "INTERVIEW_NOT_FOUND", "Không tìm thấy lịch phỏng vấn."));
        if (!"CONFIRMED".equals(interview.status())) {
            if (!"PENDING_STUDENT_CONFIRMATION".equals(interview.status())) throw new AppException(ErrorType.CONFLICT, "INTERVIEW_STATE_CONFLICT", "Lịch phỏng vấn không còn chờ xác nhận.");
            repository.confirm(interviewId);
            audit.record(principal.userId(), "INTERVIEW_CONFIRMED_BY_STUDENT", "INTERVIEW", interviewId, Map.of("applicationId", interview.applicationId()), request);
        }
        return repository.studentInterview(interviewId, principal.studentProfileId()).orElseThrow();
    }

    @Transactional
    public Map<String, Object> scheduleInterview(AuthPrincipal principal, UUID applicationId, UUID commandId, InterviewRequest input, RequestMetadata request) {
        if (!input.scheduledAt().isAfter(OffsetDateTime.now().plusMinutes(15))) throw new AppException(ErrorType.INVALID_INPUT, "INTERVIEW_TIME_INVALID", "Lịch phỏng vấn phải cách hiện tại ít nhất 15 phút.");
        if (input.mode() == InterviewMode.ONLINE && (input.meetingUrl() == null || input.meetingUrl().isBlank())) throw new AppException(ErrorType.INVALID_INPUT, "VALIDATION_ERROR", "Phỏng vấn online cần đường dẫn.");
        if (input.mode() == InterviewMode.ONSITE && (input.location() == null || input.location().isBlank())) throw new AppException(ErrorType.INVALID_INPUT, "VALIDATION_ERROR", "Phỏng vấn tại chỗ cần địa điểm.");
        LockedApplication app = access.lockOwnedByCompany(applicationId, principal.companyId());
        if (applications.commandExists(applicationId, commandId)) return repository.interviewByCommand(applicationId, commandId).orElseThrow(() -> access.stateConflict("Yêu cầu đã được xử lý."));
        if (app.status() != ApplicationStatus.COMPANY_REVIEWING) throw access.stateConflict("Chỉ có thể mời phỏng vấn khi hồ sơ đang được sàng lọc.");
        UUID interviewId = UUID.randomUUID();
        repository.insert(interviewId, applicationId, commandId, principal.userId(), input);
        applications.updateStatus(applicationId, "INTERVIEW_INVITED");
        applications.addHistory(applicationId, commandId, "COMPANY_REVIEWING", "INTERVIEW_INVITED", "COMPANY", principal.userId(), null, null, Map.of("interviewId", interviewId, "scheduledAt", input.scheduledAt(), "mode", input.mode()));
        notifications.notifyUser(app.studentUserId(), "INTERVIEW_INVITED", "Bạn có lịch phỏng vấn mới", app.companyName() + " đã mời bạn phỏng vấn vị trí \"" + app.jobTitle() + "\".", "APPLICATION", applicationId, "/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":interview");
        audit.record(principal.userId(), "INTERVIEW_SCHEDULED", "APPLICATION", applicationId, Map.of("commandId", commandId, "interviewId", interviewId), request);
        return repository.interviewByCommand(applicationId, commandId).orElseThrow();
    }
}

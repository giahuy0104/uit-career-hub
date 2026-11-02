package vn.edu.uit.careerhub.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.ApplicationPlacementRequest;
import vn.edu.uit.careerhub.entity.LockedApplication;
import vn.edu.uit.careerhub.entity.OpenApplication;
import vn.edu.uit.careerhub.enums.ApplicationStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.ApplicationRepository;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.InterviewRepository;
import vn.edu.uit.careerhub.repository.NotificationRepository;
import vn.edu.uit.careerhub.repository.PlacementRepository;
import vn.edu.uit.careerhub.repository.RecruitmentResultRepository;
import vn.edu.uit.careerhub.repository.StudentProfileRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/** UIT confirms an accepted offer: creates the placement and closes the student's other applications. */
@Service
public class PlacementConfirmationService {
    private final ApplicationRepository applications;
    private final StudentProfileRepository students;
    private final RecruitmentResultRepository results;
    private final InterviewRepository interviews;
    private final PlacementRepository placements;
    private final NotificationRepository notifications;
    private final AuditRepository audit;
    private final ApplicationAccess access;

    public PlacementConfirmationService(ApplicationRepository applications, StudentProfileRepository students,
            RecruitmentResultRepository results, InterviewRepository interviews, PlacementRepository placements,
            NotificationRepository notifications, AuditRepository audit, ApplicationAccess access) {
        this.applications = applications;
        this.students = students;
        this.results = results;
        this.interviews = interviews;
        this.placements = placements;
        this.notifications = notifications;
        this.audit = audit;
        this.access = access;
    }

    @Transactional
    public Map<String, Object> confirmPlacement(AuthPrincipal principal, UUID applicationId, UUID commandId, ApplicationPlacementRequest input, RequestMetadata request) {
        LockedApplication app = access.lock(applicationId);
        students.lock(app.studentProfileId());
        if (applications.commandExists(applicationId, commandId)) return response(applicationId, applications.autoWithdrawnIds(commandId, applicationId));
        if (app.status() != ApplicationStatus.ACCEPTED_PENDING_UIT_CONFIRMATION) throw access.stateConflict("Chỉ xác nhận sau khi sinh viên đã nhận offer.");
        if (results.updateAcceptedStartDate(applicationId, input.startDate()) != 1) throw new AppException(ErrorType.CONFLICT, "PLACEMENT_RESULT_CONFLICT", "Không tìm thấy offer đã chấp nhận.");
        List<OpenApplication> others = applications.lockOtherOpen(app.studentProfileId(), applicationId);
        applications.updateStatus(applicationId, "HIRED");
        applications.markPlacementConfirmed(applicationId);
        List<UUID> otherIds = others.stream().map(OpenApplication::id).toList();
        if (!otherIds.isEmpty()) {
            applications.markAllWithdrawn(otherIds);
            interviews.cancelForAcceptedOtherJob(otherIds);
        }
        applications.addHistory(applicationId, commandId, "ACCEPTED_PENDING_UIT_CONFIRMATION", "HIRED", "UIT_ADMIN", principal.userId(), null, input.note(), Map.of("startDate", input.startDate(), "autoWithdrawnApplicationIds", otherIds));
        UUID placementId = placements.insertHired(applicationId, input.startDate());
        placements.addHiredHistory(placementId, commandId, principal.userId(), input.startDate(), input.note(), applicationId, otherIds);
        for (var other : others) applications.addHistory(other.id(), commandId, other.status(), "WITHDRAWN", "SYSTEM", null, "ACCEPTED_OTHER_JOB", "Hệ thống đóng đơn do sinh viên đã chọn nơi khác.", Map.of("selectedApplicationId", applicationId));
        notifications.notifyUser(app.studentUserId(), "PLACEMENT_CONFIRMED", "UIT đã xác nhận nơi thực tập", "UIT đã xác nhận vị trí \"" + app.jobTitle() + "\" tại " + app.companyName() + ".", "APPLICATION", applicationId, "/applications/" + applicationId, "application:" + applicationId + ":" + commandId + ":placement:student");
        notifications.notifyCompanyOfApplication(app.companyId(), "PLACEMENT_CONFIRMED_BY_UIT", "UIT đã xác nhận sinh viên nhận việc", app.studentFullName() + " đã được xác nhận.", applicationId, commandId);
        audit.record(principal.userId(), "PLACEMENT_CONFIRMED", "APPLICATION", applicationId, Map.of("commandId", commandId, "placementId", placementId, "autoWithdrawnApplicationIds", otherIds), request);
        return response(applicationId, otherIds);
    }

    private Map<String, Object> response(UUID applicationId, List<UUID> autoWithdrawn) {
        return Map.of("selectedApplication", applications.application(applicationId, null, null, true).orElseThrow(), "autoWithdrawnApplicationIds", autoWithdrawn);
    }
}

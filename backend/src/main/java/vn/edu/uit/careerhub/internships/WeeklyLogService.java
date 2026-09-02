package vn.edu.uit.careerhub.internships;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Action;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.ActorType;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.LogContext;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.PlacementContext;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Status;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Review;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Save;
import vn.edu.uit.careerhub.placements.PlacementModels;

@Service
public class WeeklyLogService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final WeeklyLogRepository repository;
    private final WeeklyLogWorkflow workflow;

    public WeeklyLogService(WeeklyLogRepository repository, WeeklyLogWorkflow workflow) {
        this.repository = repository;
        this.workflow = workflow;
    }

    public Map<String, Object> get(AuthPrincipal principal, UUID placementId, Viewer viewer) {
        PlacementContext placement = ownedPlacement(principal, placementId, viewer, false);
        return view(placement, viewer);
    }

    @Transactional
    public Map<String, Object> create(AuthPrincipal principal, UUID placementId, Save input, RequestMetadata request) {
        PlacementContext placement = ownedPlacement(principal, placementId, Viewer.STUDENT, true);
        requireStarted(placement);
        if (input.expectedVersion() != null || input.weekNumber() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INTERNSHIP_WEEKLY_LOG_CREATE_INVALID",
                    "Khi tạo nhật ký, weekNumber là bắt buộc và expectedVersion phải để trống.");
        }
        int nextWeek = repository.nextWeekNumber(placementId);
        if (input.weekNumber() != nextWeek) {
            throw new AppException(HttpStatus.CONFLICT, "INTERNSHIP_WEEKLY_LOG_WEEK_SEQUENCE_CONFLICT",
                    "Chỉ có thể tạo tuần tiếp theo theo đúng thứ tự.");
        }
        LocalDate periodStart = placement.actualStartDate().plusWeeks(nextWeek - 1L);
        if (periodStart.isAfter(LocalDate.now(BUSINESS_ZONE).plusDays(7))) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INTERNSHIP_WEEKLY_LOG_WEEK_TOO_EARLY",
                    "Chưa đến thời điểm tạo nhật ký cho tuần này.");
        }
        repository.create(placement, principal.userId(), nextWeek, periodStart, periodStart.plusDays(6),
                periodStart.plusDays(8), input, request);
        return view(placement, Viewer.STUDENT);
    }

    @Transactional
    public Map<String, Object> save(AuthPrincipal principal, UUID placementId, UUID logId, Save input,
            RequestMetadata request) {
        PlacementContext placement = ownedPlacement(principal, placementId, Viewer.STUDENT, true);
        requireStarted(placement);
        LogContext log = repository.lockLog(placementId, logId).orElseThrow(this::logNotFound);
        if (log.status() != Status.DRAFT && log.status() != Status.COMPANY_REVISION_REQUIRED) {
            throw stateConflict();
        }
        if (input.expectedVersion() == null || input.expectedVersion() != log.version()) {
            throw versionConflict();
        }
        if (input.weekNumber() != null && input.weekNumber() != log.weekNumber()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INTERNSHIP_WEEKLY_LOG_WEEK_IMMUTABLE",
                    "Không thể thay đổi tuần của nhật ký đã tạo.");
        }
        repository.update(placement, log, principal.userId(), input, request);
        return view(placement, Viewer.STUDENT);
    }

    @Transactional
    public Map<String, Object> transition(AuthPrincipal principal, UUID placementId, UUID logId, UUID commandId,
            Viewer viewer, Action action, int expectedVersion, String reasonCode, String note,
            RequestMetadata request) {
        PlacementContext placement = ownedPlacement(principal, placementId, viewer, true);
        LogContext log = repository.lockLog(placementId, logId).orElseThrow(this::logNotFound);

        Action repeated = repository.command(logId, commandId).orElse(null);
        if (repeated != null) {
            if (repeated != action) {
                throw new AppException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "Idempotency-Key đã được dùng cho một thao tác khác.");
            }
            return view(placement, viewer);
        }
        if (log.version() != expectedVersion) throw versionConflict();

        ActorType actor = switch (viewer) {
            case STUDENT -> ActorType.STUDENT;
            case COMPANY -> ActorType.COMPANY;
            case UIT -> throw new AppException(HttpStatus.FORBIDDEN, "AUTH_FORBIDDEN",
                    "UIT chỉ theo dõi và không duyệt nội dung nhật ký thay doanh nghiệp.");
        };
        if (action == Action.SUBMIT) {
            requireStarted(placement);
            validateSubmission(log);
        }
        if (action == Action.COMPANY_REQUEST_REVISION
                && (blank(reasonCode) || blank(note) || note.strip().length() < 5)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INTERNSHIP_WEEKLY_LOG_REVISION_REASON_REQUIRED",
                    "Vui lòng chọn lý do và nhập góp ý chỉnh sửa từ 5 ký tự.");
        }

        Status next = workflow.next(log.status(), action, actor);
        repository.transition(placement, log, principal.userId(), commandId, actor, action, next,
                clean(reasonCode), clean(note), request);
        return view(placement, viewer);
    }

    public Map<String, Object> review(AuthPrincipal principal, UUID placementId, UUID logId, UUID commandId,
            Action action, Review input, RequestMetadata request) {
        return transition(principal, placementId, logId, commandId, Viewer.COMPANY, action,
                input.expectedVersion(), input.reasonCode(), input.note(), request);
    }

    public Map<String, Long> summary(AuthPrincipal principal) {
        return repository.summary();
    }

    public List<Map<String, Object>> overdue(AuthPrincipal principal) {
        return repository.overdue();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> view(PlacementContext placement, Viewer viewer) {
        List<Map<String, Object>> logs = repository.logs(placement.placementId());
        logs.forEach(log -> addActions(log, placement, viewer));
        int nextWeekNumber = repository.nextWeekNumber(placement.placementId());
        LocalDate nextPeriodStart = placement.actualStartDate() == null ? null
                : placement.actualStartDate().plusWeeks(nextWeekNumber - 1L);
        boolean canCreate = viewer == Viewer.STUDENT && placement.placementStatus() == PlacementModels.Status.STARTED
                && nextPeriodStart != null && !nextPeriodStart.isAfter(LocalDate.now(BUSINESS_ZONE).plusDays(7));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", logs.size());
        summary.put("confirmed", logs.stream().filter(log -> Status.COMPANY_CONFIRMED.name().equals(log.get("status"))).count());
        summary.put("awaitingCompany", logs.stream().filter(log -> Status.SUBMITTED.name().equals(log.get("status"))).count());
        summary.put("needsRevision", logs.stream().filter(log -> Status.COMPANY_REVISION_REQUIRED.name().equals(log.get("status"))).count());
        summary.put("overdue", logs.stream().filter(log -> Boolean.TRUE.equals(log.get("overdue"))).count());
        summary.put("nextWeekNumber", nextWeekNumber);
        summary.put("canCreate", canCreate);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("placement", placementMap(placement));
        result.put("logs", logs);
        result.put("summary", summary);
        return result;
    }

    private void addActions(Map<String, Object> log, PlacementContext placement, Viewer viewer) {
        Status status = Status.valueOf(log.get("status").toString());
        List<String> actions = new ArrayList<>();
        if (viewer == Viewer.STUDENT && placement.placementStatus() == PlacementModels.Status.STARTED
                && (status == Status.DRAFT || status == Status.COMPANY_REVISION_REQUIRED)) {
            actions.add("SAVE");
            actions.add("SUBMIT");
        }
        if (viewer == Viewer.COMPANY && status == Status.SUBMITTED) {
            actions.add("CONFIRM");
            actions.add("REQUEST_REVISION");
        }
        log.put("availableActions", actions);
    }

    private PlacementContext ownedPlacement(AuthPrincipal principal, UUID placementId, Viewer viewer, boolean lock) {
        PlacementContext placement = repository.placement(placementId, lock).orElseThrow(this::placementNotFound);
        boolean owned = switch (viewer) {
            case STUDENT -> placement.studentProfileId().equals(principal.studentProfileId());
            case COMPANY -> placement.companyId().equals(principal.companyId());
            case UIT -> true;
        };
        if (!owned) throw placementNotFound();
        return placement;
    }

    private Map<String, Object> placementMap(PlacementContext placement) {
        Map<String, Object> student = new LinkedHashMap<>();
        student.put("id", placement.studentProfileId());
        student.put("studentCode", placement.studentCode());
        student.put("fullName", placement.studentName());
        Map<String, Object> company = new LinkedHashMap<>();
        company.put("id", placement.companyId());
        company.put("name", placement.companyName());
        Map<String, Object> job = new LinkedHashMap<>();
        job.put("title", placement.jobTitle());
        job.put("company", company);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", placement.placementId());
        result.put("applicationId", placement.applicationId());
        result.put("status", placement.placementStatus().name());
        result.put("expectedStartDate", placement.expectedStartDate() == null ? null : placement.expectedStartDate().toString());
        result.put("actualStartDate", placement.actualStartDate() == null ? null : placement.actualStartDate().toString());
        result.put("student", student);
        result.put("job", job);
        return result;
    }

    private void validateSubmission(LogContext log) {
        List<String> missing = new ArrayList<>();
        required(missing, "workSummary", log.workSummary());
        required(missing, "outcomes", log.outcomes());
        required(missing, "nextPlan", log.nextPlan());
        if (!missing.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INTERNSHIP_WEEKLY_LOG_INCOMPLETE",
                    "Nhật ký chưa đủ thông tin để nộp.",
                    missing.stream().map(field -> Map.<String, Object>of("field", field, "message", "Thông tin bắt buộc."))
                            .toList());
        }
    }

    private void requireStarted(PlacementContext placement) {
        if (placement.placementStatus() != PlacementModels.Status.STARTED || placement.actualStartDate() == null) {
            throw new AppException(HttpStatus.CONFLICT, "INTERNSHIP_WEEKLY_LOG_PLACEMENT_NOT_STARTED",
                    "Chỉ có thể cập nhật nhật ký khi kỳ thực tập đang diễn ra.");
        }
    }

    private static void required(List<String> missing, String field, String value) {
        if (blank(value)) missing.add(field);
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static String clean(String value) { return blank(value) ? null : value.strip(); }

    private AppException placementNotFound() {
        return new AppException(HttpStatus.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND", "Không tìm thấy kỳ thực tập.");
    }
    private AppException logNotFound() {
        return new AppException(HttpStatus.NOT_FOUND, "INTERNSHIP_WEEKLY_LOG_NOT_FOUND", "Không tìm thấy nhật ký thực tập.");
    }
    private AppException versionConflict() {
        return new AppException(HttpStatus.CONFLICT, "INTERNSHIP_WEEKLY_LOG_VERSION_CONFLICT",
                "Nhật ký đã thay đổi. Vui lòng tải lại trước khi thao tác.");
    }
    private AppException stateConflict() {
        return new AppException(HttpStatus.CONFLICT, "INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT",
                "Nhật ký đang được duyệt hoặc đã xác nhận nên không thể chỉnh sửa.");
    }

    public enum Viewer { STUDENT, COMPANY, UIT }
}

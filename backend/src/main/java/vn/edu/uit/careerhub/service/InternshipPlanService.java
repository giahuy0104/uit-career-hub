package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.InternshipPlanReviewRequest;
import vn.edu.uit.careerhub.dto.request.InternshipPlanSaveDraftRequest;
import vn.edu.uit.careerhub.entity.InternshipPlanContext;
import vn.edu.uit.careerhub.enums.InternshipPlanAction;
import vn.edu.uit.careerhub.enums.InternshipPlanActorType;
import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.enums.PlacementStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.InternshipPlanRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

@Service
public class InternshipPlanService {
    private final InternshipPlanRepository repository;
    private final InternshipPlanWorkflow workflow;

    public InternshipPlanService(InternshipPlanRepository repository, InternshipPlanWorkflow workflow) {
        this.repository = repository;
        this.workflow = workflow;
    }

    public List<Map<String, Object>> list(AuthPrincipal principal, InternshipPlanActorType viewer) {
        List<Map<String, Object>> results = switch (viewer) {
            case STUDENT -> repository.listForStudent(principal.studentProfileId());
            case COMPANY -> repository.listForCompany(principal.companyId());
            case UIT_ADMIN -> repository.listForUit();
            case SYSTEM -> List.of();
        };
        results.forEach(item -> addActions(item, viewer));
        return results;
    }

    public Map<String, Object> get(AuthPrincipal principal, UUID placementId, InternshipPlanActorType viewer) {
        InternshipPlanContext context = ownedContext(principal, placementId, viewer, false);
        Map<String, Object> view = repository.find(context.placementId()).orElseThrow(this::notFound);
        addActions(view, viewer);
        return view;
    }

    @Transactional
    public Map<String, Object> save(AuthPrincipal principal, UUID placementId, InternshipPlanSaveDraftRequest input,
            RequestMetadata request) {
        InternshipPlanContext context = ownedContext(principal, placementId, InternshipPlanActorType.STUDENT, true);
        if (context.placementStatus() == PlacementStatus.COMPLETED) {
            throw new AppException(ErrorType.CONFLICT, "INTERNSHIP_PLAN_PLACEMENT_COMPLETED",
                    "Kỳ thực tập đã hoàn thành nên kế hoạch không thể chỉnh sửa.");
        }
        validateDateOrder(input.startDate(), input.endDate());
        if (!context.hasPlan()) {
            if (input.expectedVersion() != null) {
                throw versionConflict();
            }
            repository.create(context, principal.userId(), input, request);
        } else {
            if (!editable(context.planStatus())) {
                throw new AppException(ErrorType.CONFLICT, "INTERNSHIP_PLAN_STATE_CONFLICT",
                        "Kế hoạch đang được duyệt hoặc đã hoàn tất nên không thể chỉnh sửa.");
            }
            if (input.expectedVersion() == null || !input.expectedVersion().equals(context.planVersion())) {
                throw versionConflict();
            }
            repository.update(context, principal.userId(), input, request);
        }
        return get(principal, placementId, InternshipPlanActorType.STUDENT);
    }

    @Transactional
    public Map<String, Object> transition(AuthPrincipal principal, UUID placementId, UUID commandId,
            InternshipPlanActorType actor, InternshipPlanAction action, int expectedVersion, String reasonCode, String note,
            RequestMetadata request) {
        InternshipPlanContext context = ownedContext(principal, placementId, actor, true);
        if (!context.hasPlan()) {
            throw new AppException(ErrorType.NOT_FOUND, "INTERNSHIP_PLAN_NOT_FOUND",
                    "Sinh viên chưa tạo kế hoạch thực tập.");
        }

        InternshipPlanAction repeated = repository.command(context.planId(), commandId).orElse(null);
        if (repeated != null) {
            if (repeated != action) {
                throw new AppException(ErrorType.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "Idempotency-Key đã được dùng cho một thao tác khác.");
            }
            return get(principal, placementId, actor);
        }
        if (context.planVersion() != expectedVersion) {
            throw versionConflict();
        }
        if (action == InternshipPlanAction.SUBMIT) {
            validateSubmission(context);
        }
        if (action == InternshipPlanAction.COMPANY_REQUEST_REVISION || action == InternshipPlanAction.UIT_REQUEST_REVISION) {
            if (blank(reasonCode) || blank(note) || note.strip().length() < 5) {
                throw new AppException(ErrorType.INVALID_INPUT, "INTERNSHIP_PLAN_REVISION_REASON_REQUIRED",
                        "Vui lòng chọn lý do và nhập góp ý chỉnh sửa từ 5 ký tự.");
            }
        }

        InternshipPlanStatus next = workflow.next(context.planStatus(), action, actor);
        repository.transition(context, principal.userId(), commandId, actor, action, next,
                clean(reasonCode), clean(note), request);
        return get(principal, placementId, actor);
    }

    @Transactional
    public Map<String, Object> review(AuthPrincipal principal, UUID placementId, UUID commandId,
            InternshipPlanActorType actor, InternshipPlanAction action, InternshipPlanReviewRequest input, RequestMetadata request) {
        return transition(principal, placementId, commandId, actor, action, input.expectedVersion(),
                input.reasonCode(), input.note(), request);
    }

    private InternshipPlanContext ownedContext(AuthPrincipal principal, UUID placementId, InternshipPlanActorType viewer, boolean lock) {
        InternshipPlanContext context = repository.context(placementId, lock).orElseThrow(this::notFound);
        boolean owned = switch (viewer) {
            case STUDENT -> context.studentProfileId().equals(principal.studentProfileId());
            case COMPANY -> context.companyId().equals(principal.companyId());
            case UIT_ADMIN -> true;
            case SYSTEM -> false;
        };
        if (!owned) throw notFound();
        return context;
    }

    @SuppressWarnings("unchecked")
    private void addActions(Map<String, Object> view, InternshipPlanActorType viewer) {
        Map<String, Object> plan = (Map<String, Object>) view.get("plan");
        Map<String, Object> placement = (Map<String, Object>) view.get("placement");
        boolean placementCompleted = PlacementStatus.COMPLETED.name().equals(placement.get("status"));
        List<String> actions = new ArrayList<>();
        if (viewer == InternshipPlanActorType.STUDENT) {
            if (plan == null && !placementCompleted) {
                actions.add("SAVE");
            } else {
                InternshipPlanStatus status = plan == null ? null : InternshipPlanStatus.valueOf(plan.get("status").toString());
                if (!placementCompleted && editable(status)) {
                    actions.add("SAVE");
                    actions.add("SUBMIT");
                }
            }
        } else if (plan != null) {
            InternshipPlanStatus status = InternshipPlanStatus.valueOf(plan.get("status").toString());
            if (viewer == InternshipPlanActorType.COMPANY && status == InternshipPlanStatus.PENDING_COMPANY_REVIEW) {
                actions.add("CONFIRM");
                actions.add("REQUEST_REVISION");
            }
            if (viewer == InternshipPlanActorType.UIT_ADMIN && status == InternshipPlanStatus.PENDING_UIT_REVIEW) {
                actions.add("APPROVE");
                actions.add("REQUEST_REVISION");
            }
        }
        view.put("availableActions", actions);
    }

    private void validateSubmission(InternshipPlanContext context) {
        List<String> missing = new ArrayList<>();
        required(missing, "title", context.title());
        required(missing, "department", context.department());
        required(missing, "companySupervisorName", context.companySupervisorName());
        required(missing, "companySupervisorEmail", context.companySupervisorEmail());
        required(missing, "objectives", context.objectives());
        required(missing, "expectedTasks", context.expectedTasks());
        required(missing, "expectedSkills", context.expectedSkills());
        if (context.startDate() == null) missing.add("startDate");
        if (context.endDate() == null) missing.add("endDate");
        if (!missing.isEmpty()) {
            throw new AppException(ErrorType.INVALID_INPUT, "INTERNSHIP_PLAN_INCOMPLETE",
                    "Kế hoạch chưa đủ thông tin để nộp.",
                    missing.stream().map(field -> Map.<String, Object>of("field", field, "message", "Thông tin bắt buộc."))
                            .toList());
        }
        validateDateOrder(context.startDate(), context.endDate());
    }

    private void validateDateOrder(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new AppException(ErrorType.INVALID_INPUT, "INTERNSHIP_PLAN_DATE_ORDER_INVALID",
                    "Ngày kết thúc không được trước ngày bắt đầu.");
        }
    }

    private static boolean editable(InternshipPlanStatus status) {
        return status == InternshipPlanStatus.DRAFT || status == InternshipPlanStatus.COMPANY_REVISION_REQUIRED
                || status == InternshipPlanStatus.UIT_REVISION_REQUIRED;
    }

    private static void required(List<String> missing, String field, String value) {
        if (blank(value)) missing.add(field);
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static String clean(String value) { return blank(value) ? null : value.strip(); }

    private AppException notFound() {
        return new AppException(ErrorType.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND",
                "Không tìm thấy kỳ thực tập.");
    }

    private AppException versionConflict() {
        return new AppException(ErrorType.CONFLICT, "INTERNSHIP_PLAN_VERSION_CONFLICT",
                "Kế hoạch đã thay đổi. Vui lòng tải lại trước khi thao tác.");
    }
}

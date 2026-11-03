package vn.edu.uit.careerhub.service;

import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.EvaluationRequest;
import vn.edu.uit.careerhub.entity.PlacementContext;
import vn.edu.uit.careerhub.enums.EvaluationRole;
import vn.edu.uit.careerhub.enums.PlacementStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.EvaluationRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

@Service
public class EvaluationService {
    private final EvaluationRepository repository;

    public EvaluationService(EvaluationRepository repository) {
        this.repository = repository;
    }

    public Map<String, Object> get(AuthPrincipal principal, UUID applicationId, EvaluationRole role) {
        PlacementContext context = ownedContext(principal, applicationId, role, false);
        return repository.view(context, role);
    }

    @Transactional
    public Map<String, Object> submit(AuthPrincipal principal, UUID applicationId, UUID commandId,
            EvaluationRole role, EvaluationRequest input, RequestMetadata request) {
        PlacementContext context = ownedContext(principal, applicationId, role, true);
        var repeated = repository.byCommand(context.placementId(), commandId);
        if (repeated.isPresent()) {
            if (!role.name().equals(repeated.get().get("respondentRole"))) {
                throw new AppException(ErrorType.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "Idempotency-Key đã được dùng cho một phiếu khác.");
            }
            return repository.view(context, role);
        }

        Map<String, Object> current = repository.view(context, role);
        if (!Boolean.TRUE.equals(current.get("canSubmit"))) {
            if (context.status() != PlacementStatus.COMPLETED) {
                throw new AppException(ErrorType.CONFLICT, "INTERNSHIP_EVALUATION_NOT_AVAILABLE",
                        "Chỉ có thể gửi đánh giá sau khi UIT xác nhận hoàn thành kỳ thực tập.");
            }
            throw new AppException(ErrorType.CONFLICT, "INTERNSHIP_EVALUATION_ALREADY_SUBMITTED",
                    "Phiếu đánh giá đã được gửi và không thể chỉnh sửa.");
        }

        repository.insert(context, role, principal.userId(), commandId, input, request);
        return repository.view(context, role);
    }

    private PlacementContext ownedContext(AuthPrincipal principal, UUID applicationId, EvaluationRole role, boolean lock) {
        PlacementContext context = repository.context(applicationId, lock)
                .orElseThrow(() -> new AppException(ErrorType.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND",
                        "Không tìm thấy kỳ thực tập."));
        boolean owned = role == EvaluationRole.STUDENT
                ? context.studentProfileId().equals(principal.studentProfileId())
                : context.companyId().equals(principal.companyId());
        if (!owned) {
            throw new AppException(ErrorType.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND",
                    "Không tìm thấy kỳ thực tập.");
        }
        return context;
    }
}

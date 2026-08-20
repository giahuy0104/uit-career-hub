package vn.edu.uit.careerhub.placements;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.placements.PlacementModels.Context;
import vn.edu.uit.careerhub.placements.PlacementModels.EvaluationRole;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;
import vn.edu.uit.careerhub.placements.PlacementRequests.Evaluation;

@Service
public class EvaluationService {
    private final EvaluationRepository repository;

    public EvaluationService(EvaluationRepository repository) {
        this.repository = repository;
    }

    public Map<String, Object> get(AuthPrincipal principal, UUID applicationId, EvaluationRole role) {
        Context context = ownedContext(principal, applicationId, role, false);
        return repository.view(context, role);
    }

    @Transactional
    public Map<String, Object> submit(AuthPrincipal principal, UUID applicationId, UUID commandId,
            EvaluationRole role, Evaluation input, RequestMetadata request) {
        Context context = ownedContext(principal, applicationId, role, true);
        var repeated = repository.byCommand(context.placementId(), commandId);
        if (repeated.isPresent()) {
            if (!role.name().equals(repeated.get().get("respondentRole"))) {
                throw new AppException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "Idempotency-Key đã được dùng cho một phiếu khác.");
            }
            return repository.view(context, role);
        }

        Map<String, Object> current = repository.view(context, role);
        if (!Boolean.TRUE.equals(current.get("canSubmit"))) {
            if (context.status() != Status.COMPLETED) {
                throw new AppException(HttpStatus.CONFLICT, "INTERNSHIP_EVALUATION_NOT_AVAILABLE",
                        "Chỉ có thể gửi đánh giá sau khi UIT xác nhận hoàn thành kỳ thực tập.");
            }
            throw new AppException(HttpStatus.CONFLICT, "INTERNSHIP_EVALUATION_ALREADY_SUBMITTED",
                    "Phiếu đánh giá đã được gửi và không thể chỉnh sửa.");
        }

        repository.insert(context, role, principal.userId(), commandId, input, request);
        return repository.view(context, role);
    }

    private Context ownedContext(AuthPrincipal principal, UUID applicationId, EvaluationRole role, boolean lock) {
        Context context = repository.context(applicationId, lock)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND",
                        "Không tìm thấy kỳ thực tập."));
        boolean owned = role == EvaluationRole.STUDENT
                ? context.studentProfileId().equals(principal.studentProfileId())
                : context.companyId().equals(principal.companyId());
        if (!owned) {
            throw new AppException(HttpStatus.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND",
                    "Không tìm thấy kỳ thực tập.");
        }
        return context;
    }
}

package vn.edu.uit.careerhub.placements;

import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.placements.PlacementModels.EvaluationRole;
import vn.edu.uit.careerhub.placements.PlacementRequests.Evaluation;

@RestController
@RequestMapping("/api/v1")
public class EvaluationController {
    private final EvaluationService service;

    public EvaluationController(EvaluationService service) {
        this.service = service;
    }

    @GetMapping("/applications/{applicationId}/internship-evaluations")
    ApiEnvelope<Map<String, Object>> studentGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID applicationId) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.get(principal, applicationId, EvaluationRole.STUDENT));
    }

    @PostMapping("/applications/{applicationId}/internship-evaluations")
    @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String, Object>> studentSubmit(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID applicationId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Evaluation input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.submit(principal, applicationId, commandId, EvaluationRole.STUDENT, input,
                RequestMetadata.from(request)));
    }

    @GetMapping("/companies/me/applications/{applicationId}/internship-evaluations")
    ApiEnvelope<Map<String, Object>> companyGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID applicationId) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.get(principal, applicationId, EvaluationRole.COMPANY));
    }

    @PostMapping("/companies/me/applications/{applicationId}/internship-evaluations")
    @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String, Object>> companySubmit(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID applicationId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Evaluation input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.submit(principal, applicationId, commandId, EvaluationRole.COMPANY, input,
                RequestMetadata.from(request)));
    }
}

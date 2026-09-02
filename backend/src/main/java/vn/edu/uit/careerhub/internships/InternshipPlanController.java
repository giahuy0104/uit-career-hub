package vn.edu.uit.careerhub.internships;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Action;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.ActorType;
import vn.edu.uit.careerhub.internships.InternshipPlanRequests.Review;
import vn.edu.uit.careerhub.internships.InternshipPlanRequests.SaveDraft;
import vn.edu.uit.careerhub.internships.InternshipPlanRequests.Submit;

@RestController
@RequestMapping("/api/v1")
public class InternshipPlanController {
    private final InternshipPlanService service;

    public InternshipPlanController(InternshipPlanService service) {
        this.service = service;
    }

    @GetMapping("/student/internships")
    ApiEnvelope<List<Map<String, Object>>> studentList(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.list(principal, ActorType.STUDENT));
    }

    @GetMapping({"/student/internships/{placementId}", "/student/internships/{placementId}/plan"})
    ApiEnvelope<Map<String, Object>> studentGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.get(principal, placementId, ActorType.STUDENT));
    }

    @PutMapping("/student/internships/{placementId}/plan")
    ApiEnvelope<Map<String, Object>> studentSave(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @Valid @RequestBody SaveDraft input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.save(principal, placementId, input, RequestMetadata.from(request)));
    }

    @PostMapping("/student/internships/{placementId}/plan/submit")
    ApiEnvelope<Map<String, Object>> studentSubmit(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Submit input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.transition(principal, placementId, commandId, ActorType.STUDENT,
                Action.SUBMIT, input.expectedVersion(), null, null, RequestMetadata.from(request)));
    }

    @GetMapping("/company/internships")
    ApiEnvelope<List<Map<String, Object>>> companyList(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.list(principal, ActorType.COMPANY));
    }

    @GetMapping("/company/internships/{placementId}")
    ApiEnvelope<Map<String, Object>> companyGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.get(principal, placementId, ActorType.COMPANY));
    }

    @PostMapping("/company/internships/{placementId}/plan/confirm")
    ApiEnvelope<Map<String, Object>> companyConfirm(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Review input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, ActorType.COMPANY,
                Action.COMPANY_CONFIRM, input, RequestMetadata.from(request)));
    }

    @PostMapping("/company/internships/{placementId}/plan/request-revision")
    ApiEnvelope<Map<String, Object>> companyRequestRevision(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Review input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, ActorType.COMPANY,
                Action.COMPANY_REQUEST_REVISION, input, RequestMetadata.from(request)));
    }

    @GetMapping("/uit/internship-supervision")
    ApiEnvelope<List<Map<String, Object>>> uitList(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.list(principal, ActorType.UIT_ADMIN));
    }

    @GetMapping("/uit/internship-supervision/{placementId}")
    ApiEnvelope<Map<String, Object>> uitGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.get(principal, placementId, ActorType.UIT_ADMIN));
    }

    @PostMapping("/uit/internship-supervision/{placementId}/plan/approve")
    ApiEnvelope<Map<String, Object>> uitApprove(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Review input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, ActorType.UIT_ADMIN,
                Action.UIT_APPROVE, input, RequestMetadata.from(request)));
    }

    @PostMapping("/uit/internship-supervision/{placementId}/plan/request-revision")
    ApiEnvelope<Map<String, Object>> uitRequestRevision(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody Review input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, ActorType.UIT_ADMIN,
                Action.UIT_REQUEST_REVISION, input, RequestMetadata.from(request)));
    }
}

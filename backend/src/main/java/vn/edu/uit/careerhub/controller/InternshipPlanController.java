package vn.edu.uit.careerhub.controller;

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

import vn.edu.uit.careerhub.dto.request.InternshipPlanReviewRequest;
import vn.edu.uit.careerhub.dto.request.InternshipPlanSaveDraftRequest;
import vn.edu.uit.careerhub.dto.request.InternshipPlanSubmitRequest;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.enums.InternshipPlanAction;
import vn.edu.uit.careerhub.enums.InternshipPlanActorType;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.InternshipPlanService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

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
        return ApiEnvelope.of(service.list(principal, InternshipPlanActorType.STUDENT));
    }

    @GetMapping({"/student/internships/{placementId}", "/student/internships/{placementId}/plan"})
    ApiEnvelope<Map<String, Object>> studentGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.get(principal, placementId, InternshipPlanActorType.STUDENT));
    }

    @PutMapping("/student/internships/{placementId}/plan")
    ApiEnvelope<Map<String, Object>> studentSave(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @Valid @RequestBody InternshipPlanSaveDraftRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.save(principal, placementId, input, RequestMetadataFactory.from(request)));
    }

    @PostMapping("/student/internships/{placementId}/plan/submit")
    ApiEnvelope<Map<String, Object>> studentSubmit(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody InternshipPlanSubmitRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.transition(principal, placementId, commandId, InternshipPlanActorType.STUDENT,
                InternshipPlanAction.SUBMIT, input.expectedVersion(), null, null, RequestMetadataFactory.from(request)));
    }

    @GetMapping("/company/internships")
    ApiEnvelope<List<Map<String, Object>>> companyList(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.list(principal, InternshipPlanActorType.COMPANY));
    }

    @GetMapping("/company/internships/{placementId}")
    ApiEnvelope<Map<String, Object>> companyGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.get(principal, placementId, InternshipPlanActorType.COMPANY));
    }

    @PostMapping("/company/internships/{placementId}/plan/confirm")
    ApiEnvelope<Map<String, Object>> companyConfirm(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody InternshipPlanReviewRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, InternshipPlanActorType.COMPANY,
                InternshipPlanAction.COMPANY_CONFIRM, input, RequestMetadataFactory.from(request)));
    }

    @PostMapping("/company/internships/{placementId}/plan/request-revision")
    ApiEnvelope<Map<String, Object>> companyRequestRevision(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody InternshipPlanReviewRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, InternshipPlanActorType.COMPANY,
                InternshipPlanAction.COMPANY_REQUEST_REVISION, input, RequestMetadataFactory.from(request)));
    }

    @GetMapping("/uit/internship-supervision")
    ApiEnvelope<List<Map<String, Object>>> uitList(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.list(principal, InternshipPlanActorType.UIT_ADMIN));
    }

    @GetMapping("/uit/internship-supervision/{placementId}")
    ApiEnvelope<Map<String, Object>> uitGet(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.get(principal, placementId, InternshipPlanActorType.UIT_ADMIN));
    }

    @PostMapping("/uit/internship-supervision/{placementId}/plan/approve")
    ApiEnvelope<Map<String, Object>> uitApprove(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody InternshipPlanReviewRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, InternshipPlanActorType.UIT_ADMIN,
                InternshipPlanAction.UIT_APPROVE, input, RequestMetadataFactory.from(request)));
    }

    @PostMapping("/uit/internship-supervision/{placementId}/plan/request-revision")
    ApiEnvelope<Map<String, Object>> uitRequestRevision(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @RequestHeader("Idempotency-Key") UUID commandId,
            @Valid @RequestBody InternshipPlanReviewRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.review(principal, placementId, commandId, InternshipPlanActorType.UIT_ADMIN,
                InternshipPlanAction.UIT_REQUEST_REVISION, input, RequestMetadataFactory.from(request)));
    }
}

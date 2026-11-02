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

import vn.edu.uit.careerhub.dto.request.WeeklyLogReviewRequest;
import vn.edu.uit.careerhub.dto.request.WeeklyLogSaveRequest;
import vn.edu.uit.careerhub.dto.request.WeeklyLogSubmitRequest;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.WeeklyLogAction;
import vn.edu.uit.careerhub.enums.WeeklyLogViewer;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.WeeklyLogService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

@RestController
@RequestMapping("/api/v1")
public class WeeklyLogController {
    private final WeeklyLogService service;

    public WeeklyLogController(WeeklyLogService service) {
        this.service = service;
    }

    @GetMapping("/student/internships/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> studentList(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.get(principal, placementId, WeeklyLogViewer.STUDENT));
    }

    @PostMapping("/student/internships/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> studentCreate(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @Valid @RequestBody WeeklyLogSaveRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.create(principal, placementId, input, RequestMetadataFactory.from(request)));
    }

    @PutMapping("/student/internships/{placementId}/weekly-logs/{logId}")
    ApiEnvelope<Map<String, Object>> studentSave(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId, @Valid @RequestBody WeeklyLogSaveRequest input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.save(principal, placementId, logId, input, RequestMetadataFactory.from(request)));
    }

    @PostMapping("/student/internships/{placementId}/weekly-logs/{logId}/submit")
    ApiEnvelope<Map<String, Object>> studentSubmit(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId,
            @RequestHeader("Idempotency-Key") UUID commandId, @Valid @RequestBody WeeklyLogSubmitRequest input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.transition(principal, placementId, logId, commandId, WeeklyLogViewer.STUDENT,
                WeeklyLogAction.SUBMIT, input.expectedVersion(), null, null, RequestMetadataFactory.from(request)));
    }

    @GetMapping("/company/internships/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> companyList(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.get(principal, placementId, WeeklyLogViewer.COMPANY));
    }

    @PostMapping("/company/internships/{placementId}/weekly-logs/{logId}/confirm")
    ApiEnvelope<Map<String, Object>> companyConfirm(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId,
            @RequestHeader("Idempotency-Key") UUID commandId, @Valid @RequestBody WeeklyLogReviewRequest input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, logId, commandId, WeeklyLogAction.COMPANY_CONFIRM,
                input, RequestMetadataFactory.from(request)));
    }

    @PostMapping("/company/internships/{placementId}/weekly-logs/{logId}/request-revision")
    ApiEnvelope<Map<String, Object>> companyRevision(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId,
            @RequestHeader("Idempotency-Key") UUID commandId, @Valid @RequestBody WeeklyLogReviewRequest input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, logId, commandId,
                WeeklyLogAction.COMPANY_REQUEST_REVISION, input, RequestMetadataFactory.from(request)));
    }

    @GetMapping("/uit/internship-supervision/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> uitList(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.get(principal, placementId, WeeklyLogViewer.UIT));
    }

    @GetMapping("/uit/internship-supervision/summary")
    ApiEnvelope<Map<String, Long>> summary(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.summary(principal));
    }

    @GetMapping("/uit/internship-supervision/overdue")
    ApiEnvelope<List<Map<String, Object>>> overdue(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.overdue(principal));
    }
}

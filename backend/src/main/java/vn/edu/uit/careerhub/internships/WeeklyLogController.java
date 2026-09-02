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
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Action;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Review;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Save;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Submit;
import vn.edu.uit.careerhub.internships.WeeklyLogService.Viewer;

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
        return ApiEnvelope.of(service.get(principal, placementId, Viewer.STUDENT));
    }

    @PostMapping("/student/internships/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> studentCreate(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @Valid @RequestBody Save input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.create(principal, placementId, input, RequestMetadata.from(request)));
    }

    @PutMapping("/student/internships/{placementId}/weekly-logs/{logId}")
    ApiEnvelope<Map<String, Object>> studentSave(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId, @Valid @RequestBody Save input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.save(principal, placementId, logId, input, RequestMetadata.from(request)));
    }

    @PostMapping("/student/internships/{placementId}/weekly-logs/{logId}/submit")
    ApiEnvelope<Map<String, Object>> studentSubmit(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId,
            @RequestHeader("Idempotency-Key") UUID commandId, @Valid @RequestBody Submit input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.transition(principal, placementId, logId, commandId, Viewer.STUDENT,
                Action.SUBMIT, input.expectedVersion(), null, null, RequestMetadata.from(request)));
    }

    @GetMapping("/company/internships/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> companyList(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.get(principal, placementId, Viewer.COMPANY));
    }

    @PostMapping("/company/internships/{placementId}/weekly-logs/{logId}/confirm")
    ApiEnvelope<Map<String, Object>> companyConfirm(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId,
            @RequestHeader("Idempotency-Key") UUID commandId, @Valid @RequestBody Review input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, logId, commandId, Action.COMPANY_CONFIRM,
                input, RequestMetadata.from(request)));
    }

    @PostMapping("/company/internships/{placementId}/weekly-logs/{logId}/request-revision")
    ApiEnvelope<Map<String, Object>> companyRevision(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @PathVariable UUID logId,
            @RequestHeader("Idempotency-Key") UUID commandId, @Valid @RequestBody Review input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.review(principal, placementId, logId, commandId,
                Action.COMPANY_REQUEST_REVISION, input, RequestMetadata.from(request)));
    }

    @GetMapping("/uit/internship-supervision/{placementId}/weekly-logs")
    ApiEnvelope<Map<String, Object>> uitList(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.get(principal, placementId, Viewer.UIT));
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

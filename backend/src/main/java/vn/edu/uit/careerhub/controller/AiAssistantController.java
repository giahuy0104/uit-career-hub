package vn.edu.uit.careerhub.controller;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.request.AiPlanReviewRequest;
import vn.edu.uit.careerhub.dto.request.AiSettingsRequest;
import vn.edu.uit.careerhub.dto.response.AiSuggestion;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.AiAssistantService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

/** AI suggestions are only ever produced when a user presses the button (POST). */
@RestController
@RequestMapping("/api/v1")
public class AiAssistantController {
    private final AiAssistantService service;

    public AiAssistantController(AiAssistantService service) {
        this.service = service;
    }

    @PostMapping("/student/internships/{placementId}/plan/ai-review")
    ApiEnvelope<AiSuggestion> reviewPlan(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId, @Valid @RequestBody AiPlanReviewRequest input) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.reviewPlan(principal, placementId, input));
    }

    @PostMapping("/company/internships/{placementId}/weekly-logs/ai-summary")
    ApiEnvelope<AiSuggestion> companyLogSummary(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.summarizeWeeklyLogs(principal, placementId));
    }

    @PostMapping("/uit/internship-supervision/{placementId}/weekly-logs/ai-summary")
    ApiEnvelope<AiSuggestion> uitLogSummary(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID placementId) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.summarizeWeeklyLogs(principal, placementId));
    }

    @GetMapping("/uit/ai/settings")
    ApiEnvelope<Map<String, Object>> settings(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.settings());
    }

    @PutMapping("/uit/ai/settings")
    ApiEnvelope<Map<String, Object>> updateSettings(@AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody AiSettingsRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.updateSettings(principal, input.enabled(), RequestMetadataFactory.from(request)));
    }
}

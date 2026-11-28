package vn.edu.uit.careerhub.controller;

import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.request.AiFeatureSettingRequest;
import vn.edu.uit.careerhub.dto.request.AiFeedbackRequest;
import vn.edu.uit.careerhub.dto.request.AiPlanReviewRequest;
import vn.edu.uit.careerhub.dto.request.AiSettingsRequest;
import vn.edu.uit.careerhub.dto.response.AiSuggestion;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.enums.AiFeature;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.AiAssistantService;
import vn.edu.uit.careerhub.service.AiPlatformService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

/** AI suggestions are only ever produced when a user presses the button (POST). */
@RestController
@RequestMapping("/api/v1")
public class AiAssistantController {
    static final int DASHBOARD_DAYS = 30;

    private final AiAssistantService service;
    private final AiPlatformService platform;

    public AiAssistantController(AiAssistantService service, AiPlatformService platform) {
        this.service = service;
        this.platform = platform;
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
        return ApiEnvelope.of(dashboard());
    }

    @PutMapping("/uit/ai/features/{feature}")
    ApiEnvelope<Map<String, Object>> updateFeature(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable AiFeature feature,
            @Valid @RequestBody AiFeatureSettingRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        platform.updateFeature(principal, feature, input, RequestMetadataFactory.from(request));
        return ApiEnvelope.of(dashboard());
    }

    /** Helpful / not helpful on any AI output the caller was shown. */
    @PostMapping("/ai/feedback")
    ResponseEntity<Void> feedback(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody AiFeedbackRequest input) {
        AuthContext.requireRole(principal, UserRole.STUDENT, UserRole.COMPANY, UserRole.UIT_ADMIN);
        platform.feedback(principal, input);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> dashboard() {
        Map<String, Object> base = service.settings();
        @SuppressWarnings("unchecked")
        java.util.List<Map<String, Object>> usage = (java.util.List<Map<String, Object>>) base.get("usage");
        return service.settings(platform.features(DASHBOARD_DAYS, usage));
    }

    @PutMapping("/uit/ai/settings")
    ApiEnvelope<Map<String, Object>> updateSettings(@AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody AiSettingsRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        service.updateSettings(principal, input.enabled(), RequestMetadataFactory.from(request));
        return ApiEnvelope.of(dashboard());
    }
}

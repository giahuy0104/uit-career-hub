package vn.edu.uit.careerhub.controller;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.request.JobPreferencesRequest;
import vn.edu.uit.careerhub.dto.response.AiSuggestion;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.JobRecommendationService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

@RestController
@RequestMapping("/api/v1")
public class JobRecommendationController {
    private final JobRecommendationService service;

    public JobRecommendationController(JobRecommendationService service) { this.service = service; }

    /** Active skills and categories, for the student's profile and the company's job form. */
    @GetMapping("/taxonomy/options")
    ApiEnvelope<Map<String, Object>> taxonomyOptions(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.STUDENT, UserRole.COMPANY);
        return ApiEnvelope.of(service.taxonomyOptions());
    }

    @GetMapping("/students/me/job-preferences")
    ApiEnvelope<JobPreferences> preferences(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.preferences(principal));
    }

    @PutMapping("/students/me/job-preferences")
    ApiEnvelope<JobPreferences> savePreferences(@AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody JobPreferencesRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.savePreferences(principal, input, RequestMetadataFactory.from(request)));
    }

    @GetMapping("/students/me/job-recommendations")
    ApiEnvelope<Map<String, Object>> recommendations(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.recommendations(principal));
    }

    @PostMapping("/students/me/job-recommendations/ai-explanation")
    ApiEnvelope<AiSuggestion> explain(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.explain(principal));
    }
}

package vn.edu.uit.careerhub.controller;

import java.util.Map;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.request.SemanticSearchRequest;
import vn.edu.uit.careerhub.dto.request.TagSuggestionRequest;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.TextIntelligenceService;

@RestController
@RequestMapping("/api/v1")
public class TextIntelligenceController {
    private final TextIntelligenceService service;

    public TextIntelligenceController(TextIntelligenceService service) { this.service = service; }

    /** Skills and categories suggested from the post being written; nothing is saved. */
    @PostMapping("/companies/me/jobs/tag-suggestions")
    ApiEnvelope<Map<String, Object>> tags(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody TagSuggestionRequest input) {
        AuthContext.requireRole(principal, UserRole.COMPANY);
        return ApiEnvelope.of(service.suggestTags(principal, input.title(), input.description(), input.requirements()));
    }

    @PostMapping("/students/me/job-search")
    ApiEnvelope<Map<String, Object>> search(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody SemanticSearchRequest input) {
        AuthContext.requireRole(principal, UserRole.STUDENT);
        return ApiEnvelope.of(service.search(principal, input.query()));
    }
}

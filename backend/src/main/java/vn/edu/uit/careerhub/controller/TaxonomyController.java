package vn.edu.uit.careerhub.controller;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.CategoryDto;
import vn.edu.uit.careerhub.dto.SkillDto;
import vn.edu.uit.careerhub.dto.request.CategoryCreateRequest;
import vn.edu.uit.careerhub.dto.request.SkillCreateRequest;
import vn.edu.uit.careerhub.dto.request.TaxonomyStateRequest;
import vn.edu.uit.careerhub.dto.request.TaxonomyUpdateRequest;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.dto.response.PageEnvelope;
import vn.edu.uit.careerhub.dto.response.PageMeta;
import vn.edu.uit.careerhub.enums.TaxonomyKind;
import vn.edu.uit.careerhub.enums.TaxonomyStatus;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.TaxonomyService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

@Validated
@RestController
@RequestMapping("/api/v1/uit/taxonomy")
public class TaxonomyController {
    private final TaxonomyService service;
    public TaxonomyController(TaxonomyService service) { this.service = service; }

    @GetMapping("/categories")
    PageEnvelope<CategoryDto> categories(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue="1") @Min(1) int page, @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,
            @RequestParam(required=false) @Size(max=100) String query, @RequestParam(required=false) TaxonomyStatus status) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        var result = service.listCategories(page, pageSize, query, status);
        return new PageEnvelope<>(result.items(), PageMeta.of(page, pageSize, result.total()));
    }

    @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Object> createCategory(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody CategoryCreateRequest input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.create(TaxonomyKind.CATEGORY, principal.userId(), input.code().strip().toUpperCase(), input.name().strip(), RequestMetadataFactory.from(request)));
    }

    @PatchMapping("/categories/{id}")
    ApiEnvelope<Object> updateCategory(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody TaxonomyUpdateRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.update(TaxonomyKind.CATEGORY, principal.userId(), id, input.name().strip(), input.expectedVersion(), RequestMetadataFactory.from(request)));
    }

    @PostMapping("/categories/{id}/archive")
    ApiEnvelope<Object> archiveCategory(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody TaxonomyStateRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(TaxonomyKind.CATEGORY, principal.userId(), id, false, input.expectedVersion(), input.reason().strip(), RequestMetadataFactory.from(request)));
    }
    @PostMapping("/categories/{id}/reactivate")
    ApiEnvelope<Object> reactivateCategory(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody TaxonomyStateRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(TaxonomyKind.CATEGORY, principal.userId(), id, true, input.expectedVersion(), input.reason().strip(), RequestMetadataFactory.from(request)));
    }

    @GetMapping("/skills")
    PageEnvelope<SkillDto> skills(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue="1") @Min(1) int page, @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,
            @RequestParam(required=false) @Size(max=100) String query, @RequestParam(required=false) TaxonomyStatus status) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        var result = service.listSkills(page, pageSize, query, status);
        return new PageEnvelope<>(result.items(), PageMeta.of(page, pageSize, result.total()));
    }

    @PostMapping("/skills") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Object> createSkill(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody SkillCreateRequest input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.create(TaxonomyKind.SKILL, principal.userId(), input.slug().strip().toLowerCase(), input.name().strip(), RequestMetadataFactory.from(request)));
    }

    @PatchMapping("/skills/{id}")
    ApiEnvelope<Object> updateSkill(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody TaxonomyUpdateRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.update(TaxonomyKind.SKILL, principal.userId(), id, input.name().strip(), input.expectedVersion(), RequestMetadataFactory.from(request)));
    }
    @PostMapping("/skills/{id}/archive")
    ApiEnvelope<Object> archiveSkill(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody TaxonomyStateRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(TaxonomyKind.SKILL, principal.userId(), id, false, input.expectedVersion(), input.reason().strip(), RequestMetadataFactory.from(request)));
    }
    @PostMapping("/skills/{id}/reactivate")
    ApiEnvelope<Object> reactivateSkill(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody TaxonomyStateRequest input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(TaxonomyKind.SKILL, principal.userId(), id, true, input.expectedVersion(), input.reason().strip(), RequestMetadataFactory.from(request)));
    }
}

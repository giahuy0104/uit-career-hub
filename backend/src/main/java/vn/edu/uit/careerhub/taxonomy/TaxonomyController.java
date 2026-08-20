package vn.edu.uit.careerhub.taxonomy;

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

import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.common.PageEnvelope;
import vn.edu.uit.careerhub.common.PageMeta;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Kind;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Status;
import vn.edu.uit.careerhub.taxonomy.TaxonomyRequests.CategoryCreate;
import vn.edu.uit.careerhub.taxonomy.TaxonomyRequests.SkillCreate;
import vn.edu.uit.careerhub.taxonomy.TaxonomyRequests.State;
import vn.edu.uit.careerhub.taxonomy.TaxonomyRequests.Update;

@Validated
@RestController
@RequestMapping("/api/v1/uit/taxonomy")
public class TaxonomyController {
    private final TaxonomyRepository repository;
    private final TaxonomyService service;
    public TaxonomyController(TaxonomyRepository repository, TaxonomyService service) { this.repository = repository; this.service = service; }

    @GetMapping("/categories")
    PageEnvelope<TaxonomyModels.CategoryDto> categories(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue="1") @Min(1) int page, @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,
            @RequestParam(required=false) @Size(max=100) String query, @RequestParam(required=false) Status status) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        var result = repository.listCategories(page, pageSize, query, status);
        return new PageEnvelope<>(result.items(), PageMeta.of(page, pageSize, result.total()));
    }

    @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Object> createCategory(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody CategoryCreate input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.create(Kind.CATEGORY, principal.userId(), input.code().strip().toUpperCase(), input.name().strip(), RequestMetadata.from(request)));
    }

    @PatchMapping("/categories/{id}")
    ApiEnvelope<Object> updateCategory(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody Update input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.update(Kind.CATEGORY, principal.userId(), id, input.name().strip(), input.expectedVersion(), RequestMetadata.from(request)));
    }

    @PostMapping("/categories/{id}/archive")
    ApiEnvelope<Object> archiveCategory(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody State input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(Kind.CATEGORY, principal.userId(), id, false, input.expectedVersion(), input.reason().strip(), RequestMetadata.from(request)));
    }
    @PostMapping("/categories/{id}/reactivate")
    ApiEnvelope<Object> reactivateCategory(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody State input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(Kind.CATEGORY, principal.userId(), id, true, input.expectedVersion(), input.reason().strip(), RequestMetadata.from(request)));
    }

    @GetMapping("/skills")
    PageEnvelope<TaxonomyModels.SkillDto> skills(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue="1") @Min(1) int page, @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,
            @RequestParam(required=false) @Size(max=100) String query, @RequestParam(required=false) Status status) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        var result = repository.listSkills(page, pageSize, query, status);
        return new PageEnvelope<>(result.items(), PageMeta.of(page, pageSize, result.total()));
    }

    @PostMapping("/skills") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Object> createSkill(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody SkillCreate input,
            HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.create(Kind.SKILL, principal.userId(), input.slug().strip().toLowerCase(), input.name().strip(), RequestMetadata.from(request)));
    }

    @PatchMapping("/skills/{id}")
    ApiEnvelope<Object> updateSkill(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody Update input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.update(Kind.SKILL, principal.userId(), id, input.name().strip(), input.expectedVersion(), RequestMetadata.from(request)));
    }
    @PostMapping("/skills/{id}/archive")
    ApiEnvelope<Object> archiveSkill(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody State input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(Kind.SKILL, principal.userId(), id, false, input.expectedVersion(), input.reason().strip(), RequestMetadata.from(request)));
    }
    @PostMapping("/skills/{id}/reactivate")
    ApiEnvelope<Object> reactivateSkill(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id,
            @Valid @RequestBody State input, HttpServletRequest request) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeState(Kind.SKILL, principal.userId(), id, true, input.expectedVersion(), input.reason().strip(), RequestMetadata.from(request)));
    }
}

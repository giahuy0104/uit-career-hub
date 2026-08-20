package vn.edu.uit.careerhub.companies;

import java.util.Map;
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
import vn.edu.uit.careerhub.companies.CompanyModels.PartnerStatus;
import vn.edu.uit.careerhub.companies.CompanyRequests.Create;
import vn.edu.uit.careerhub.companies.CompanyRequests.ProfileUpdate;
import vn.edu.uit.careerhub.companies.CompanyRequests.Recruiter;
import vn.edu.uit.careerhub.companies.CompanyRequests.RecruiterStateChange;
import vn.edu.uit.careerhub.companies.CompanyRequests.StateChange;
import vn.edu.uit.careerhub.companies.CompanyRequests.Update;

@Validated @RestController @RequestMapping("/api/v1")
public class CompanyController {
    private final CompanyRepository repository;private final CompanyService service;
    public CompanyController(CompanyRepository repository,CompanyService service){this.repository=repository;this.service=service;}

    @GetMapping("/companies")
    PageEnvelope<Map<String,Object>> directory(@AuthenticationPrincipal AuthPrincipal principal,@RequestParam(defaultValue="1") @Min(1) int page,
            @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) @Size(max=100) String query,
            @RequestParam(required=false) @Size(max=120) String industry,@RequestParam(required=false) Boolean hasRecruitingJobs){
        AuthContext.requireRole(principal,UserRole.STUDENT);var result=repository.directory(page,pageSize,query,industry,hasRecruitingJobs);
        return new PageEnvelope<>(result.items(),PageMeta.of(page,pageSize,result.total()));
    }
    @GetMapping("/companies/{companyId}") ApiEnvelope<Map<String,Object>> directoryOne(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID companyId){
        AuthContext.requireRole(principal,UserRole.STUDENT);return ApiEnvelope.of(service.directory(companyId));}

    @GetMapping("/uit/companies")
    PageEnvelope<Map<String,Object>> adminList(@AuthenticationPrincipal AuthPrincipal principal,@RequestParam(defaultValue="1") @Min(1) int page,
            @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) @Size(max=100) String query,
            @RequestParam(required=false) PartnerStatus status){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);var result=repository.list(page,pageSize,query,status);
        return new PageEnvelope<>(result.items(),PageMeta.of(page,pageSize,result.total()));}
    @PostMapping("/uit/companies") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> create(@AuthenticationPrincipal AuthPrincipal principal,@Valid @RequestBody Create input,HttpServletRequest request){
        AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.create(principal.userId(),input,RequestMetadata.from(request)));}
    @GetMapping("/uit/companies/{companyId}") ApiEnvelope<Map<String,Object>> adminOne(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID companyId){
        AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.get(companyId));}
    @PatchMapping("/uit/companies/{companyId}") ApiEnvelope<Map<String,Object>> update(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID companyId,
            @Valid @RequestBody Update input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.update(principal.userId(),companyId,input,RequestMetadata.from(request)));}
    @PostMapping("/uit/companies/{companyId}/suspend") ApiEnvelope<Map<String,Object>> suspend(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID companyId,
            @Valid @RequestBody StateChange input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.changeCompanyState(principal.userId(),companyId,false,input.expectedVersion(),input.reason().strip(),RequestMetadata.from(request)));}
    @PostMapping("/uit/companies/{companyId}/reactivate") ApiEnvelope<Map<String,Object>> reactivate(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID companyId,
            @Valid @RequestBody StateChange input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.changeCompanyState(principal.userId(),companyId,true,input.expectedVersion(),input.reason().strip(),RequestMetadata.from(request)));}
    @PostMapping("/uit/companies/{companyId}/recruiters") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> recruiter(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID companyId,@Valid @RequestBody Recruiter input,HttpServletRequest request){
        AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.addRecruiter(principal.userId(),companyId,input,RequestMetadata.from(request)));}
    @PostMapping("/uit/companies/{companyId}/recruiters/{userId}/suspend") ApiEnvelope<Map<String,Object>> suspendRecruiter(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID companyId,@PathVariable UUID userId,@Valid @RequestBody RecruiterStateChange input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeRecruiterState(principal.userId(),companyId,userId,false,input.reason().strip(),RequestMetadata.from(request)));}
    @PostMapping("/uit/companies/{companyId}/recruiters/{userId}/reactivate") ApiEnvelope<Map<String,Object>> reactivateRecruiter(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID companyId,@PathVariable UUID userId,@Valid @RequestBody RecruiterStateChange input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.changeRecruiterState(principal.userId(),companyId,userId,true,input.reason().strip(),RequestMetadata.from(request)));}
    @PostMapping("/uit/companies/{companyId}/recruiters/{userId}/activation-link") ApiEnvelope<Map<String,Object>> activation(@AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID companyId,@PathVariable UUID userId,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.regenerate(principal.userId(),companyId,userId,RequestMetadata.from(request)));}

    @GetMapping("/companies/me/profile") ApiEnvelope<Map<String,Object>> myProfile(@AuthenticationPrincipal AuthPrincipal principal){AuthContext.requireRole(principal,UserRole.COMPANY);return ApiEnvelope.of(service.getMy(principal.userId()));}
    @PatchMapping("/companies/me/profile") ApiEnvelope<Map<String,Object>> myProfileUpdate(@AuthenticationPrincipal AuthPrincipal principal,@Valid @RequestBody ProfileUpdate input,HttpServletRequest request){
        AuthContext.requireRole(principal,UserRole.COMPANY);return ApiEnvelope.of(service.updateProfile(principal.userId(),principal.companyId(),input,RequestMetadata.from(request)));}
}

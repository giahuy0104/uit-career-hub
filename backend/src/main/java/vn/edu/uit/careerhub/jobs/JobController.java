package vn.edu.uit.careerhub.jobs;

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
import org.springframework.web.bind.annotation.RequestHeader;
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
import vn.edu.uit.careerhub.jobs.JobModels.OpportunityType;
import vn.edu.uit.careerhub.jobs.JobModels.ReviewDecision;
import vn.edu.uit.careerhub.jobs.JobModels.Status;
import vn.edu.uit.careerhub.jobs.JobModels.WorkMode;
import vn.edu.uit.careerhub.jobs.JobRequests.Draft;
import vn.edu.uit.careerhub.jobs.JobRequests.ReviewReason;

@Validated @RestController @RequestMapping("/api/v1")
public class JobController {
    private final JobRepository repository;private final JobService service;
    public JobController(JobRepository repository,JobService service){this.repository=repository;this.service=service;}

    @GetMapping("/jobs")
    PageEnvelope<Map<String,Object>> recruiting(@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,
            @RequestParam(required=false) @Size(max=100) String query,@RequestParam(required=false) @Size(max=100) String category,
            @RequestParam(required=false) UUID companyId,@RequestParam(required=false) WorkMode workMode,@RequestParam(required=false) OpportunityType opportunityType){
        var result=repository.recruiting(page,pageSize,query,category,companyId,workMode,opportunityType);return new PageEnvelope<>(result.items(),PageMeta.of(page,pageSize,result.total()));
    }
    @GetMapping("/jobs/{jobId}") ApiEnvelope<Map<String,Object>> recruitingOne(@PathVariable UUID jobId){return ApiEnvelope.of(service.recruitingJob(jobId));}

    @GetMapping("/companies/me/jobs")
    PageEnvelope<Map<String,Object>> companyJobs(@AuthenticationPrincipal AuthPrincipal principal,@RequestParam(defaultValue="1") @Min(1) int page,
            @RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) Status status){
        AuthContext.requireRole(principal,UserRole.COMPANY);var result=repository.listCompany(principal.companyId(),page,pageSize,status);
        return new PageEnvelope<>(result.items(),PageMeta.of(page,pageSize,result.total()));
    }
    @PostMapping("/companies/me/jobs") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> create(@AuthenticationPrincipal AuthPrincipal principal,@Valid @RequestBody Draft input,HttpServletRequest request){
        AuthContext.requireRole(principal,UserRole.COMPANY);return ApiEnvelope.of(service.createDraft(principal,input,RequestMetadata.from(request)));
    }
    @GetMapping("/companies/me/jobs/{jobId}") ApiEnvelope<Map<String,Object>> companyOne(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID jobId){
        AuthContext.requireRole(principal,UserRole.COMPANY);return ApiEnvelope.of(service.companyJob(principal.companyId(),jobId));
    }
    @PatchMapping("/companies/me/jobs/{jobId}") ApiEnvelope<Map<String,Object>> update(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID jobId,
            @Valid @RequestBody Draft input,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.COMPANY);return ApiEnvelope.of(service.updateDraft(principal,jobId,input,RequestMetadata.from(request)));}
    @PostMapping("/companies/me/jobs/{jobId}/submit") ApiEnvelope<Map<String,Object>> submit(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID jobId,
            @RequestHeader("Idempotency-Key") UUID commandId,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.COMPANY);return ApiEnvelope.of(service.submit(principal,jobId,commandId,RequestMetadata.from(request)));}

    @GetMapping("/uit/jobs/review-queue") PageEnvelope<Map<String,Object>> reviewQueue(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize){
        AuthContext.requireRole(principal,UserRole.UIT_ADMIN);var result=repository.reviewQueue(page,pageSize);return new PageEnvelope<>(result.items(),PageMeta.of(page,pageSize,result.total()));
    }
    @PostMapping("/uit/jobs/{jobId}/approve") ApiEnvelope<Map<String,Object>> approve(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID jobId,
            @RequestHeader("Idempotency-Key") UUID commandId,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.review(principal.userId(),jobId,commandId,ReviewDecision.APPROVE,null,RequestMetadata.from(request)));}
    @PostMapping("/uit/jobs/{jobId}/request-revision") ApiEnvelope<Map<String,Object>> revision(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID jobId,
            @RequestHeader("Idempotency-Key") UUID commandId,@Valid @RequestBody ReviewReason reason,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.review(principal.userId(),jobId,commandId,ReviewDecision.REQUEST_REVISION,reason,RequestMetadata.from(request)));}
    @PostMapping("/uit/jobs/{jobId}/reject") ApiEnvelope<Map<String,Object>> reject(@AuthenticationPrincipal AuthPrincipal principal,@PathVariable UUID jobId,
            @RequestHeader("Idempotency-Key") UUID commandId,@Valid @RequestBody ReviewReason reason,HttpServletRequest request){AuthContext.requireRole(principal,UserRole.UIT_ADMIN);return ApiEnvelope.of(service.review(principal.userId(),jobId,commandId,ReviewDecision.REJECT,reason,RequestMetadata.from(request)));}
}

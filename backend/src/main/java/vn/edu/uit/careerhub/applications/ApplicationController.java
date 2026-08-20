package vn.edu.uit.careerhub.applications;

import java.util.List;
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
import org.springframework.web.bind.annotation.DeleteMapping;
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

import vn.edu.uit.careerhub.applications.ApplicationModels.Status;
import vn.edu.uit.careerhub.applications.ApplicationModels.VerificationStatus;
import vn.edu.uit.careerhub.applications.ApplicationRequests.DocumentReview;
import vn.edu.uit.careerhub.applications.ApplicationRequests.DocumentUpload;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Interview;
import vn.edu.uit.careerhub.applications.ApplicationRequests.OfferUpload;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Placement;
import vn.edu.uit.careerhub.applications.ApplicationRequests.ProfileUpdate;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Reason;
import vn.edu.uit.careerhub.applications.ApplicationRequests.RecruitmentResult;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Resubmit;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Submit;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Supplement;
import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.common.PageEnvelope;
import vn.edu.uit.careerhub.common.PageMeta;

@Validated @RestController @RequestMapping("/api/v1")
public class ApplicationController {
    private final ApplicationService service;
    public ApplicationController(ApplicationService service){this.service=service;}

    @GetMapping("/students/me") ApiEnvelope<Map<String,Object>> profile(@AuthenticationPrincipal AuthPrincipal p){student(p);return ApiEnvelope.of(service.studentProfile(p.studentProfileId()));}
    @PatchMapping("/students/me") ApiEnvelope<Map<String,Object>> updateProfile(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody ProfileUpdate input,HttpServletRequest r){student(p);return ApiEnvelope.of(service.updateProfile(p,input.phone(),meta(r)));}
    @GetMapping("/students/me/documents") ApiEnvelope<List<Map<String,Object>>> documents(@AuthenticationPrincipal AuthPrincipal p){student(p);return ApiEnvelope.of(service.studentDocuments(p.studentProfileId()));}
    @PostMapping("/students/me/documents/uploads") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> createUpload(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody DocumentUpload input){student(p);return ApiEnvelope.of(service.createStudentUpload(p,input));}
    @PostMapping("/students/me/documents/uploads/{uploadId}/complete") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<List<Map<String,Object>>> completeUpload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID uploadId,HttpServletRequest r){student(p);return ApiEnvelope.of(service.completeStudentUpload(p,uploadId,meta(r)));}
    @PostMapping("/students/me/documents/{documentId}/download") ApiEnvelope<Map<String,Object>> studentDocumentDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId){student(p);return ApiEnvelope.of(service.studentDocumentDownload(p.studentProfileId(),documentId));}
    @DeleteMapping("/students/me/documents/{documentId}") ApiEnvelope<List<Map<String,Object>>> deleteDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId,HttpServletRequest r){student(p);return ApiEnvelope.of(service.deleteStudentDocument(p,documentId,meta(r)));}
    @PostMapping("/students/me/documents/{documentId}/default") ApiEnvelope<List<Map<String,Object>>> defaultCv(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId,HttpServletRequest r){student(p);return ApiEnvelope.of(service.setDefaultCv(p,documentId,meta(r)));}

    @GetMapping("/students/me/interviews") PageEnvelope<Map<String,Object>> studentInterviews(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(defaultValue="all") String scope){student(p);var result=service.interviews(p.studentProfileId(),false,page,pageSize,scope);return page(result,page,pageSize);}
    @PostMapping("/students/me/interviews/{interviewId}/confirm") ApiEnvelope<Map<String,Object>> confirmInterview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID interviewId,HttpServletRequest r){student(p);return ApiEnvelope.of(service.confirmInterview(p,interviewId,meta(r)));}

    @GetMapping("/applications") PageEnvelope<Map<String,Object>> applications(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) Status status){student(p);var result=service.applications(p.studentProfileId(),page,pageSize,status);return page(result,page,pageSize);}
    @PostMapping("/applications") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> submit(@AuthenticationPrincipal AuthPrincipal p,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Submit input,HttpServletRequest r){student(p);return ApiEnvelope.of(service.submit(p,input,command,meta(r)));}
    @GetMapping("/applications/{applicationId}") ApiEnvelope<Map<String,Object>> application(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId){student(p);return ApiEnvelope.of(service.application(applicationId,p.studentProfileId()));}
    @PostMapping("/applications/{applicationId}/offer-document/download") ApiEnvelope<Map<String,Object>> studentOfferDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,HttpServletRequest r){student(p);return ApiEnvelope.of(service.offerDownload(p,applicationId,"STUDENT",meta(r)));}
    @PostMapping("/applications/{applicationId}/resubmit") ApiEnvelope<Map<String,Object>> resubmit(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Resubmit input,HttpServletRequest r){student(p);return ApiEnvelope.of(service.resubmit(p,applicationId,command,input,meta(r)));}
    @PostMapping("/applications/{applicationId}/withdraw") ApiEnvelope<Map<String,Object>> withdraw(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Reason input,HttpServletRequest r){student(p);return ApiEnvelope.of(service.withdraw(p,applicationId,command,false,input,meta(r)));}
    @PostMapping("/applications/{applicationId}/cancel-interview") ApiEnvelope<Map<String,Object>> cancelInterview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Reason input,HttpServletRequest r){student(p);return ApiEnvelope.of(service.withdraw(p,applicationId,command,true,input,meta(r)));}
    @PostMapping("/applications/{applicationId}/offer/accept") ApiEnvelope<Map<String,Object>> acceptOffer(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,HttpServletRequest r){student(p);return ApiEnvelope.of(service.respondOffer(p,applicationId,command,true,null,meta(r)));}
    @PostMapping("/applications/{applicationId}/offer/decline") ApiEnvelope<Map<String,Object>> declineOffer(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Reason input,HttpServletRequest r){student(p);return ApiEnvelope.of(service.respondOffer(p,applicationId,command,false,input,meta(r)));}

    @GetMapping("/uit/applications/review-queue") PageEnvelope<Map<String,Object>> reviewQueue(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize){uit(p);return page(service.reviewQueue(page,pageSize,false),page,pageSize);}
    @PostMapping("/uit/applications/{applicationId}/documents/{documentId}/download") ApiEnvelope<Map<String,Object>> uitApplicationDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@PathVariable UUID documentId,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.applicationDocumentDownload(p,applicationId,documentId,true,meta(r)));}
    @GetMapping("/uit/student-documents") PageEnvelope<Map<String,Object>> reviewDocuments(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(defaultValue="PENDING") VerificationStatus status,@RequestParam(required=false) @Size(max=120) String query){uit(p);return page(service.documentsForReview(page,pageSize,status.name(),query),page,pageSize);}
    @PostMapping("/uit/student-documents/{documentId}/download") ApiEnvelope<Map<String,Object>> uitDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId){uit(p);return ApiEnvelope.of(service.uitDocumentDownload(documentId));}
    @PostMapping("/uit/student-documents/{documentId}/review") ApiEnvelope<Map<String,Object>> reviewDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId,@Valid @RequestBody DocumentReview input,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.reviewDocument(p,documentId,input,meta(r)));}
    @GetMapping("/uit/applications/placement-queue") PageEnvelope<Map<String,Object>> placementQueue(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize){uit(p);return page(service.reviewQueue(page,pageSize,true),page,pageSize);}
    @PostMapping("/uit/applications/{applicationId}/offer-document/download") ApiEnvelope<Map<String,Object>> uitOfferDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.offerDownload(p,applicationId,"UIT_ADMIN",meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/request-supplement") ApiEnvelope<Map<String,Object>> supplement(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Supplement input,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.uitReview(p,applicationId,command,"request-supplement",input,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/reject") ApiEnvelope<Map<String,Object>> uitReject(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Reason input,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.uitReview(p,applicationId,command,"reject",input,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/forward") ApiEnvelope<Map<String,Object>> forward(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.uitReview(p,applicationId,command,"forward",null,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/confirm-placement") ApiEnvelope<Map<String,Object>> confirmPlacement(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Placement input,HttpServletRequest r){uit(p);return ApiEnvelope.of(service.confirmPlacement(p,applicationId,command,input,meta(r)));}

    @GetMapping("/companies/me/candidates") PageEnvelope<Map<String,Object>> candidates(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) UUID jobId,@RequestParam(required=false) Status status){company(p);return page(service.companyCandidates(p.companyId(),page,pageSize,jobId,status),page,pageSize);}
    @GetMapping("/companies/me/interviews") PageEnvelope<Map<String,Object>> companyInterviews(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(defaultValue="all") String scope){company(p);return page(service.interviews(p.companyId(),true,page,pageSize,scope),page,pageSize);}
    @PostMapping("/companies/me/applications/{applicationId}/documents/{documentId}/download") ApiEnvelope<Map<String,Object>> companyDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@PathVariable UUID documentId,HttpServletRequest r){company(p);return ApiEnvelope.of(service.applicationDocumentDownload(p,applicationId,documentId,false,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/offer-document/uploads") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> offerUpload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@Valid @RequestBody OfferUpload input){company(p);return ApiEnvelope.of(service.createOfferUpload(p,applicationId,input));}
    @PostMapping("/companies/me/applications/{applicationId}/offer-document/uploads/{uploadId}/complete") ApiEnvelope<Map<String,Object>> completeOfferUpload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@PathVariable UUID uploadId,HttpServletRequest r){company(p);return ApiEnvelope.of(service.completeOfferUpload(p,applicationId,uploadId,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/offer-document/download") ApiEnvelope<Map<String,Object>> companyOfferDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,HttpServletRequest r){company(p);return ApiEnvelope.of(service.offerDownload(p,applicationId,"COMPANY",meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/start-review") ApiEnvelope<Map<String,Object>> startReview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,HttpServletRequest r){company(p);return ApiEnvelope.of(service.companyDecision(p,applicationId,command,false,null,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/reject") ApiEnvelope<Map<String,Object>> companyReject(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Reason input,HttpServletRequest r){company(p);return ApiEnvelope.of(service.companyDecision(p,applicationId,command,true,input,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/interviews") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> scheduleInterview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody Interview input,HttpServletRequest r){company(p);return ApiEnvelope.of(service.scheduleInterview(p,applicationId,command,input,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/results") ApiEnvelope<Map<String,Object>> result(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody RecruitmentResult input,HttpServletRequest r){company(p);return ApiEnvelope.of(service.recordResult(p,applicationId,command,input,meta(r)));}

    private void student(AuthPrincipal p){AuthContext.requireRole(p,UserRole.STUDENT);}private void uit(AuthPrincipal p){AuthContext.requireRole(p,UserRole.UIT_ADMIN);}private void company(AuthPrincipal p){AuthContext.requireRole(p,UserRole.COMPANY);}
    private RequestMetadata meta(HttpServletRequest request){return RequestMetadata.from(request);}
    private PageEnvelope<Map<String,Object>> page(ApplicationModels.PageResult result,int page,int size){return new PageEnvelope<>(result.items(),PageMeta.of(page,size,result.total()));}
}

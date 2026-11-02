package vn.edu.uit.careerhub.controller;

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

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.ApplicationPlacementRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationReasonRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationResubmitRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationSubmitRequest;
import vn.edu.uit.careerhub.dto.request.ApplicationSupplementRequest;
import vn.edu.uit.careerhub.dto.request.DocumentReviewRequest;
import vn.edu.uit.careerhub.dto.request.DocumentUploadRequest;
import vn.edu.uit.careerhub.dto.request.InterviewRequest;
import vn.edu.uit.careerhub.dto.request.OfferUploadRequest;
import vn.edu.uit.careerhub.dto.request.RecruitmentResultRequest;
import vn.edu.uit.careerhub.dto.request.StudentProfileUpdateRequest;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.dto.response.PageEnvelope;
import vn.edu.uit.careerhub.dto.response.PageMeta;
import vn.edu.uit.careerhub.enums.ApplicationStatus;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.VerificationStatus;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.ApplicationService;
import vn.edu.uit.careerhub.service.InterviewService;
import vn.edu.uit.careerhub.service.PlacementConfirmationService;
import vn.edu.uit.careerhub.service.RecruitmentResultService;
import vn.edu.uit.careerhub.service.StudentDocumentService;
import vn.edu.uit.careerhub.service.StudentProfileService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

@Validated @RestController @RequestMapping("/api/v1")
public class ApplicationController {
    private final ApplicationService applications;
    private final StudentProfileService profiles;
    private final StudentDocumentService documents;
    private final InterviewService interviews;
    private final RecruitmentResultService results;
    private final PlacementConfirmationService placements;

    public ApplicationController(ApplicationService applications,StudentProfileService profiles,StudentDocumentService documents,
            InterviewService interviews,RecruitmentResultService results,PlacementConfirmationService placements){
        this.applications=applications;
        this.profiles=profiles;
        this.documents=documents;
        this.interviews=interviews;
        this.results=results;
        this.placements=placements;
    }

    @GetMapping("/students/me") ApiEnvelope<Map<String,Object>> profile(@AuthenticationPrincipal AuthPrincipal p){student(p);return ApiEnvelope.of(profiles.studentProfile(p.studentProfileId()));}
    @PatchMapping("/students/me") ApiEnvelope<Map<String,Object>> updateProfile(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody StudentProfileUpdateRequest input,HttpServletRequest r){student(p);return ApiEnvelope.of(profiles.updateProfile(p,input.phone(),meta(r)));}
    @GetMapping("/students/me/documents") ApiEnvelope<List<Map<String,Object>>> documents(@AuthenticationPrincipal AuthPrincipal p){student(p);return ApiEnvelope.of(documents.studentDocuments(p.studentProfileId()));}
    @PostMapping("/students/me/documents/uploads") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> createUpload(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody DocumentUploadRequest input){student(p);return ApiEnvelope.of(documents.createStudentUpload(p,input));}
    @PostMapping("/students/me/documents/uploads/{uploadId}/complete") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<List<Map<String,Object>>> completeUpload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID uploadId,HttpServletRequest r){student(p);return ApiEnvelope.of(documents.completeStudentUpload(p,uploadId,meta(r)));}
    @PostMapping("/students/me/documents/{documentId}/download") ApiEnvelope<Map<String,Object>> studentDocumentDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId){student(p);return ApiEnvelope.of(documents.studentDocumentDownload(p.studentProfileId(),documentId));}
    @DeleteMapping("/students/me/documents/{documentId}") ApiEnvelope<List<Map<String,Object>>> deleteDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId,HttpServletRequest r){student(p);return ApiEnvelope.of(documents.deleteStudentDocument(p,documentId,meta(r)));}
    @PostMapping("/students/me/documents/{documentId}/default") ApiEnvelope<List<Map<String,Object>>> defaultCv(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId,HttpServletRequest r){student(p);return ApiEnvelope.of(documents.setDefaultCv(p,documentId,meta(r)));}

    @GetMapping("/students/me/interviews") PageEnvelope<Map<String,Object>> studentInterviews(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(defaultValue="all") String scope){student(p);var result=interviews.interviews(p.studentProfileId(),false,page,pageSize,scope);return page(result,page,pageSize);}
    @PostMapping("/students/me/interviews/{interviewId}/confirm") ApiEnvelope<Map<String,Object>> confirmInterview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID interviewId,HttpServletRequest r){student(p);return ApiEnvelope.of(interviews.confirmInterview(p,interviewId,meta(r)));}

    @GetMapping("/applications") PageEnvelope<Map<String,Object>> applications(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) ApplicationStatus status){student(p);var result=applications.applications(p.studentProfileId(),page,pageSize,status);return page(result,page,pageSize);}
    @PostMapping("/applications") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> submit(@AuthenticationPrincipal AuthPrincipal p,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationSubmitRequest input,HttpServletRequest r){student(p);return ApiEnvelope.of(applications.submit(p,input,command,meta(r)));}
    @GetMapping("/applications/{applicationId}") ApiEnvelope<Map<String,Object>> application(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId){student(p);return ApiEnvelope.of(applications.application(applicationId,p.studentProfileId()));}
    @PostMapping("/applications/{applicationId}/offer-document/download") ApiEnvelope<Map<String,Object>> studentOfferDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,HttpServletRequest r){student(p);return ApiEnvelope.of(results.offerDownload(p,applicationId,UserRole.STUDENT,meta(r)));}
    @PostMapping("/applications/{applicationId}/resubmit") ApiEnvelope<Map<String,Object>> resubmit(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationResubmitRequest input,HttpServletRequest r){student(p);return ApiEnvelope.of(applications.resubmit(p,applicationId,command,input,meta(r)));}
    @PostMapping("/applications/{applicationId}/withdraw") ApiEnvelope<Map<String,Object>> withdraw(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationReasonRequest input,HttpServletRequest r){student(p);return ApiEnvelope.of(applications.withdraw(p,applicationId,command,false,input,meta(r)));}
    @PostMapping("/applications/{applicationId}/cancel-interview") ApiEnvelope<Map<String,Object>> cancelInterview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationReasonRequest input,HttpServletRequest r){student(p);return ApiEnvelope.of(applications.withdraw(p,applicationId,command,true,input,meta(r)));}
    @PostMapping("/applications/{applicationId}/offer/accept") ApiEnvelope<Map<String,Object>> acceptOffer(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,HttpServletRequest r){student(p);return ApiEnvelope.of(results.respondOffer(p,applicationId,command,true,null,meta(r)));}
    @PostMapping("/applications/{applicationId}/offer/decline") ApiEnvelope<Map<String,Object>> declineOffer(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationReasonRequest input,HttpServletRequest r){student(p);return ApiEnvelope.of(results.respondOffer(p,applicationId,command,false,input,meta(r)));}

    @GetMapping("/uit/applications/review-queue") PageEnvelope<Map<String,Object>> reviewQueue(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize){uit(p);return page(applications.reviewQueue(page,pageSize,false),page,pageSize);}
    @PostMapping("/uit/applications/{applicationId}/documents/{documentId}/download") ApiEnvelope<Map<String,Object>> uitApplicationDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@PathVariable UUID documentId,HttpServletRequest r){uit(p);return ApiEnvelope.of(applications.applicationDocumentDownload(p,applicationId,documentId,true,meta(r)));}
    @GetMapping("/uit/student-documents") PageEnvelope<Map<String,Object>> reviewDocuments(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(defaultValue="PENDING") VerificationStatus status,@RequestParam(required=false) @Size(max=120) String query){uit(p);return page(documents.documentsForReview(page,pageSize,status.name(),query),page,pageSize);}
    @PostMapping("/uit/student-documents/{documentId}/download") ApiEnvelope<Map<String,Object>> uitDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId){uit(p);return ApiEnvelope.of(documents.uitDocumentDownload(documentId));}
    @PostMapping("/uit/student-documents/{documentId}/review") ApiEnvelope<Map<String,Object>> reviewDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID documentId,@Valid @RequestBody DocumentReviewRequest input,HttpServletRequest r){uit(p);return ApiEnvelope.of(documents.reviewDocument(p,documentId,input,meta(r)));}
    @GetMapping("/uit/applications/placement-queue") PageEnvelope<Map<String,Object>> placementQueue(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize){uit(p);return page(applications.reviewQueue(page,pageSize,true),page,pageSize);}
    @PostMapping("/uit/applications/{applicationId}/offer-document/download") ApiEnvelope<Map<String,Object>> uitOfferDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,HttpServletRequest r){uit(p);return ApiEnvelope.of(results.offerDownload(p,applicationId,UserRole.UIT_ADMIN,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/request-supplement") ApiEnvelope<Map<String,Object>> supplement(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationSupplementRequest input,HttpServletRequest r){uit(p);return ApiEnvelope.of(applications.uitReview(p,applicationId,command,"request-supplement",input,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/reject") ApiEnvelope<Map<String,Object>> uitReject(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationReasonRequest input,HttpServletRequest r){uit(p);return ApiEnvelope.of(applications.uitReview(p,applicationId,command,"reject",input,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/forward") ApiEnvelope<Map<String,Object>> forward(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,HttpServletRequest r){uit(p);return ApiEnvelope.of(applications.uitReview(p,applicationId,command,"forward",null,meta(r)));}
    @PostMapping("/uit/applications/{applicationId}/confirm-placement") ApiEnvelope<Map<String,Object>> confirmPlacement(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationPlacementRequest input,HttpServletRequest r){uit(p);return ApiEnvelope.of(placements.confirmPlacement(p,applicationId,command,input,meta(r)));}

    @GetMapping("/companies/me/candidates") PageEnvelope<Map<String,Object>> candidates(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) UUID jobId,@RequestParam(required=false) ApplicationStatus status){company(p);return page(applications.companyCandidates(p.companyId(),page,pageSize,jobId,status),page,pageSize);}
    @GetMapping("/companies/me/interviews") PageEnvelope<Map<String,Object>> companyInterviews(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int pageSize,@RequestParam(defaultValue="all") String scope){company(p);return page(interviews.interviews(p.companyId(),true,page,pageSize,scope),page,pageSize);}
    @PostMapping("/companies/me/applications/{applicationId}/documents/{documentId}/download") ApiEnvelope<Map<String,Object>> companyDocument(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@PathVariable UUID documentId,HttpServletRequest r){company(p);return ApiEnvelope.of(applications.applicationDocumentDownload(p,applicationId,documentId,false,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/offer-document/uploads") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> offerUpload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@Valid @RequestBody OfferUploadRequest input){company(p);return ApiEnvelope.of(results.createOfferUpload(p,applicationId,input));}
    @PostMapping("/companies/me/applications/{applicationId}/offer-document/uploads/{uploadId}/complete") ApiEnvelope<Map<String,Object>> completeOfferUpload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@PathVariable UUID uploadId,HttpServletRequest r){company(p);return ApiEnvelope.of(results.completeOfferUpload(p,applicationId,uploadId,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/offer-document/download") ApiEnvelope<Map<String,Object>> companyOfferDownload(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,HttpServletRequest r){company(p);return ApiEnvelope.of(results.offerDownload(p,applicationId,UserRole.COMPANY,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/start-review") ApiEnvelope<Map<String,Object>> startReview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,HttpServletRequest r){company(p);return ApiEnvelope.of(applications.companyDecision(p,applicationId,command,false,null,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/reject") ApiEnvelope<Map<String,Object>> companyReject(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody ApplicationReasonRequest input,HttpServletRequest r){company(p);return ApiEnvelope.of(applications.companyDecision(p,applicationId,command,true,input,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/interviews") @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<Map<String,Object>> scheduleInterview(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody InterviewRequest input,HttpServletRequest r){company(p);return ApiEnvelope.of(interviews.scheduleInterview(p,applicationId,command,input,meta(r)));}
    @PostMapping("/companies/me/applications/{applicationId}/results") ApiEnvelope<Map<String,Object>> result(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID applicationId,@RequestHeader("Idempotency-Key") UUID command,@Valid @RequestBody RecruitmentResultRequest input,HttpServletRequest r){company(p);return ApiEnvelope.of(results.recordResult(p,applicationId,command,input,meta(r)));}

    private void student(AuthPrincipal p){AuthContext.requireRole(p,UserRole.STUDENT);}private void uit(AuthPrincipal p){AuthContext.requireRole(p,UserRole.UIT_ADMIN);}private void company(AuthPrincipal p){AuthContext.requireRole(p,UserRole.COMPANY);}
    private RequestMetadata meta(HttpServletRequest request){return RequestMetadataFactory.from(request);}
    private PageEnvelope<Map<String,Object>> page(PageResult result,int page,int size){return new PageEnvelope<>(result.items(),PageMeta.of(page,size,result.total()));}
}

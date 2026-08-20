package vn.edu.uit.careerhub.applications;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ApplicationModels {
    private ApplicationModels() {}

    public enum Status {
        UIT_REVIEWING, NEEDS_SUPPLEMENT, FORWARDED_TO_COMPANY, COMPANY_REVIEWING,
        INTERVIEW_INVITED, NOT_SUITABLE, INTERVIEW_FAILED, OFFER_PENDING_STUDENT,
        ACCEPTED_PENDING_UIT_CONFIRMATION, HIRED, OFFER_DECLINED, UIT_REJECTED, WITHDRAWN
    }
    public enum DocumentType { CV, TRANSCRIPT, STUDENT_CONFIRMATION, OTHER }
    public enum VerificationStatus { PENDING, VERIFIED, REJECTED }
    public enum InterviewScope { upcoming, history, all }
    public enum InterviewMode { ONSITE, ONLINE, PHONE }
    public enum ResultOutcome { PASS, FAIL }

    public record PageResult(List<Map<String,Object>> items,long total) {}
    public record LockedApplication(UUID id,Status status,int version,UUID studentProfileId,UUID studentUserId,
            String studentFullName,UUID jobId,String jobTitle,UUID companyId,String companyName) {}
}

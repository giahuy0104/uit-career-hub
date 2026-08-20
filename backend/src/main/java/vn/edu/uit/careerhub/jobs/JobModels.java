package vn.edu.uit.careerhub.jobs;

import java.time.LocalDate;
import java.util.UUID;

public final class JobModels {
    private JobModels() {}
    public enum Status { DRAFT, PENDING_UIT_REVIEW, REVISION_REQUIRED, RECRUITING, PAUSED, EXPIRED, REJECTED, CLOSED }
    public enum OpportunityType { INTERNSHIP, PART_TIME, FULL_TIME, FRESHER }
    public enum WorkMode { ONSITE, REMOTE, HYBRID }
    public enum ReviewDecision { APPROVE, REQUEST_REVISION, REJECT }
    public record LockedJob(UUID id, UUID companyId, Status status, int version, LocalDate deadline, String partnerStatus) {}
    public record PageResult(java.util.List<java.util.Map<String, Object>> items, long total) {}
}

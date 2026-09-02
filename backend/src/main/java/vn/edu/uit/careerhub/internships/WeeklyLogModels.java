package vn.edu.uit.careerhub.internships;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.placements.PlacementModels;

public final class WeeklyLogModels {
    private WeeklyLogModels() {}

    public enum Status { DRAFT, SUBMITTED, COMPANY_REVISION_REQUIRED, COMPANY_CONFIRMED, CANCELLED }
    public enum ActorType { STUDENT, COMPANY, SYSTEM }
    public enum Action { SUBMIT, COMPANY_CONFIRM, COMPANY_REQUEST_REVISION, CANCEL }

    public record PlacementContext(
            UUID placementId,
            UUID applicationId,
            PlacementModels.Status placementStatus,
            LocalDate expectedStartDate,
            LocalDate actualStartDate,
            UUID studentProfileId,
            UUID studentUserId,
            String studentName,
            String studentCode,
            UUID companyId,
            String companyName,
            String jobTitle) {}

    public record LogContext(
            UUID id,
            UUID placementId,
            int weekNumber,
            LocalDate periodStart,
            LocalDate periodEnd,
            LocalDate dueDate,
            Status status,
            int version,
            int currentSubmissionNo,
            String workSummary,
            String outcomes,
            String difficulties,
            String nextPlan) {}
}

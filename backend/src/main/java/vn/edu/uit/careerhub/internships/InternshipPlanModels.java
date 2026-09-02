package vn.edu.uit.careerhub.internships;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.placements.PlacementModels;

public final class InternshipPlanModels {
    private InternshipPlanModels() {}

    public enum Status {
        DRAFT,
        PENDING_COMPANY_REVIEW,
        COMPANY_REVISION_REQUIRED,
        PENDING_UIT_REVIEW,
        UIT_REVISION_REQUIRED,
        APPROVED,
        CANCELLED
    }

    public enum ActorType { STUDENT, COMPANY, UIT_ADMIN, SYSTEM }

    public enum Action {
        SUBMIT,
        COMPANY_CONFIRM,
        COMPANY_REQUEST_REVISION,
        UIT_APPROVE,
        UIT_REQUEST_REVISION,
        CANCEL
    }

    public record Context(
            UUID placementId,
            UUID applicationId,
            PlacementModels.Status placementStatus,
            UUID studentProfileId,
            UUID studentUserId,
            String studentName,
            UUID companyId,
            String companyName,
            String jobTitle,
            UUID planId,
            Status planStatus,
            Integer planVersion,
            int currentSubmissionNo,
            String title,
            String department,
            String companySupervisorName,
            String companySupervisorEmail,
            String objectives,
            String expectedTasks,
            String expectedSkills,
            LocalDate startDate,
            LocalDate endDate) {

        public boolean hasPlan() { return planId != null; }
    }
}

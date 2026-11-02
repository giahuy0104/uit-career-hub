package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.enums.PlacementStatus;

public record InternshipPlanContext(
        UUID placementId,
        UUID applicationId,
        PlacementStatus placementStatus,
        UUID studentProfileId,
        UUID studentUserId,
        String studentName,
        UUID companyId,
        String companyName,
        String jobTitle,
        UUID planId,
        InternshipPlanStatus planStatus,
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

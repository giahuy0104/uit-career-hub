package vn.edu.uit.careerhub.entity;

import java.util.UUID;

import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.enums.PlacementStatus;

/**
 * What the AI features need about one placement: ownership keys, the job text the plan is compared
 * against, and personal values that must be masked before anything is sent to the model.
 */
public record AiPlacementContext(
        UUID placementId,
        PlacementStatus placementStatus,
        UUID studentProfileId,
        UUID companyId,
        String studentName,
        String studentCode,
        String studentEmail,
        String jobTitle,
        String jobDescription,
        String jobRequirements,
        InternshipPlanStatus planStatus,
        String supervisorName,
        String supervisorEmail) {}

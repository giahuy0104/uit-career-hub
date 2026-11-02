package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.PlacementStatus;

public record WeeklyLogPlacementContext(
        UUID placementId,
        UUID applicationId,
        PlacementStatus placementStatus,
        LocalDate expectedStartDate,
        LocalDate actualStartDate,
        UUID studentProfileId,
        UUID studentUserId,
        String studentName,
        String studentCode,
        UUID companyId,
        String companyName,
        String jobTitle) {}

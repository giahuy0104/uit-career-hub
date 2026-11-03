package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.PlacementStatus;

public record PlacementContext(UUID placementId,UUID applicationId,PlacementStatus status,LocalDate expectedStartDate,LocalDate actualStartDate,
        LocalDate completedDate,UUID studentProfileId,UUID studentUserId,String studentName,UUID companyId,String companyName,String jobTitle) {}

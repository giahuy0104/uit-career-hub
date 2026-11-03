package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.WeeklyLogStatus;

public record WeeklyLogContext(
        UUID id,
        UUID placementId,
        int weekNumber,
        LocalDate periodStart,
        LocalDate periodEnd,
        LocalDate dueDate,
        WeeklyLogStatus status,
        int version,
        int currentSubmissionNo,
        String workSummary,
        String outcomes,
        String difficulties,
        String nextPlan) {}

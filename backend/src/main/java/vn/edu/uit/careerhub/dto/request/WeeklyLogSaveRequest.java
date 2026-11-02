package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record WeeklyLogSaveRequest(
        @Positive Integer expectedVersion,
        @Positive Integer weekNumber,
        @Size(max = 6_000) String workSummary,
        @Size(max = 4_000) String outcomes,
        @Size(max = 4_000) String difficulties,
        @Size(max = 4_000) String nextPlan) {}

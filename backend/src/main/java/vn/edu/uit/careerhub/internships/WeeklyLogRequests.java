package vn.edu.uit.careerhub.internships;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class WeeklyLogRequests {
    private WeeklyLogRequests() {}

    public record Save(
            @Positive Integer expectedVersion,
            @Positive Integer weekNumber,
            @Size(max = 6_000) String workSummary,
            @Size(max = 4_000) String outcomes,
            @Size(max = 4_000) String difficulties,
            @Size(max = 4_000) String nextPlan) {}

    public record Submit(@Positive int expectedVersion) {}

    public record Review(
            @Positive int expectedVersion,
            @Size(max = 80) String reasonCode,
            @Size(max = 2_000) String note) {}
}

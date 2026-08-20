package vn.edu.uit.careerhub.jobs;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.jobs.JobModels.OpportunityType;
import vn.edu.uit.careerhub.jobs.JobModels.WorkMode;

public final class JobRequests {
    private JobRequests() {}

    public record Draft(
            @NotBlank @Size(min=5,max=180) String title,
            @NotNull OpportunityType opportunityType,
            @NotNull WorkMode workMode,
            @NotBlank @Size(min=2,max=255) String location,
            @NotBlank @Size(min=20,max=20_000) String description,
            @NotBlank @Size(min=10,max=20_000) String requirements,
            @Size(max=10_000) String benefits,
            @Min(1) @Max(1000) int positions,
            @NotNull LocalDate deadline,
            @Size(max=20) List<UUID> categoryIds,
            @Size(max=50) List<UUID> skillIds,
            @Positive Integer expectedVersion) {
        public Draft {
            categoryIds = categoryIds == null ? List.of() : List.copyOf(categoryIds);
            skillIds = skillIds == null ? List.of() : List.copyOf(skillIds);
        }
    }

    public record ReviewReason(
            @NotBlank @Size(min=2,max=80) String reasonCode,
            @NotBlank @Size(min=5,max=2_000) String note) {}
}

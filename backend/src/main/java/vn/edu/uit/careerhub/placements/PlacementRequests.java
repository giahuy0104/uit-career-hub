package vn.edu.uit.careerhub.placements;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class PlacementRequests {
    private PlacementRequests() {}
    public record Transition(@Positive int expectedVersion,@NotNull LocalDate effectiveDate,@Size(min=5,max=1_000) String note) {}
    public record Evaluation(@Min(1) @Max(5) int workQualityRating,@Min(1) @Max(5) int collaborationRating,
            @Min(1) @Max(5) int professionalismRating,@Min(1) @Max(5) int overallRating,boolean recommendation,
            @NotBlank @Size(min=10,max=2_000) String strengths,@Size(min=5,max=2_000) String improvements) {}
}

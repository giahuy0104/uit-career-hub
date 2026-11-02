package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EvaluationRequest(@Min(1) @Max(5) int workQualityRating,@Min(1) @Max(5) int collaborationRating,
        @Min(1) @Max(5) int professionalismRating,@Min(1) @Max(5) int overallRating,boolean recommendation,
        @NotBlank @Size(min=10,max=2_000) String strengths,@Size(min=5,max=2_000) String improvements) {}

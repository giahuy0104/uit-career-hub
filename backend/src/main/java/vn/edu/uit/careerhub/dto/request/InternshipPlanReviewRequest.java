package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record InternshipPlanReviewRequest(
        @Positive int expectedVersion,
        @Size(max = 80) String reasonCode,
        @Size(max = 2_000) String note) {}

package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Positive;

public record InternshipPlanSubmitRequest(@Positive int expectedVersion) {}

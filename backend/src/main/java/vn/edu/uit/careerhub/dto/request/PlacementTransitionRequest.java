package vn.edu.uit.careerhub.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PlacementTransitionRequest(@Positive int expectedVersion,@NotNull LocalDate effectiveDate,@Size(min=5,max=1_000) String note) {}

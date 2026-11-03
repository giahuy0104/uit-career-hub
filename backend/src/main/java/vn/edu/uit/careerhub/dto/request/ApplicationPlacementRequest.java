package vn.edu.uit.careerhub.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ApplicationPlacementRequest(@NotNull LocalDate startDate,@Size(max=500) String note) {}

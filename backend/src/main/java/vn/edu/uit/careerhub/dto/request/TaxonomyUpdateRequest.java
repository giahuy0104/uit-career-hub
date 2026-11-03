package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record TaxonomyUpdateRequest(@NotBlank @Size(min = 2, max = 120) String name, @Positive int expectedVersion) {}

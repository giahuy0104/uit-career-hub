package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CategoryCreateRequest(
        @NotBlank @Size(min = 2, max = 50) @Pattern(regexp = "^[A-Z0-9_]+$") String code,
        @NotBlank @Size(min = 2, max = 120) String name) {}

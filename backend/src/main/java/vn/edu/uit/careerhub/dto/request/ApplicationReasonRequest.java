package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApplicationReasonRequest(@NotBlank @Size(min=2,max=80) String reasonCode,
        @NotBlank @Size(min=5,max=2_000) String note) {}

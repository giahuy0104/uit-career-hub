package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecruiterStateChangeRequest(@NotBlank @Size(min=5,max=1_000) String reason) {}

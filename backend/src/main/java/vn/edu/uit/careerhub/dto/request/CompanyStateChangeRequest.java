package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CompanyStateChangeRequest(@Positive int expectedVersion,@NotBlank @Size(min=5,max=1_000) String reason) {}

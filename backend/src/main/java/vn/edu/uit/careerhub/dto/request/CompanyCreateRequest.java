package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CompanyCreateRequest(
        @NotBlank @Size(min=2,max=30) @Pattern(regexp="^[A-Z0-9_-]+$") String code,
        @NotBlank @Size(min=2,max=180) String name,
        @Size(max=255) String legalName,@Size(max=50) String taxCode,@Size(max=120) String industry,
        @Size(max=80) String companySize,@Size(max=5_000) String description,
        @Size(max=500) @Pattern(regexp="^$|https?://.+",message="Website không hợp lệ.") String website,
        @Size(max=500) String address,@NotNull @Valid CompanyRecruiterRequest primaryRecruiter) {}

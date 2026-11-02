package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompanyRecruiterRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min=2,max=180) String fullName,
        @Size(max=120) String title) {}

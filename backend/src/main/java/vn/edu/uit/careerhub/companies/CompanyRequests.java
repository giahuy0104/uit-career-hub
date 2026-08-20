package vn.edu.uit.careerhub.companies;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class CompanyRequests {
    private CompanyRequests() {}
    public record Recruiter(
            @NotBlank @Email String email,
            @NotBlank @Size(min=2,max=180) String fullName,
            @Size(max=120) String title) {}
    public record Create(
            @NotBlank @Size(min=2,max=30) @Pattern(regexp="^[A-Z0-9_-]+$") String code,
            @NotBlank @Size(min=2,max=180) String name,
            @Size(max=255) String legalName,@Size(max=50) String taxCode,@Size(max=120) String industry,
            @Size(max=80) String companySize,@Size(max=5_000) String description,
            @Size(max=500) @Pattern(regexp="^$|https?://.+",message="Website không hợp lệ.") String website,
            @Size(max=500) String address,@NotNull @Valid Recruiter primaryRecruiter) {}
    public record Update(
            @NotBlank @Size(min=2,max=30) @Pattern(regexp="^[A-Z0-9_-]+$") String code,
            @NotBlank @Size(min=2,max=180) String name,
            @Size(max=255) String legalName,@Size(max=50) String taxCode,@Size(max=120) String industry,
            @Size(max=80) String companySize,@Size(max=5_000) String description,
            @Size(max=500) @Pattern(regexp="^$|https?://.+",message="Website không hợp lệ.") String website,
            @Size(max=500) String address,@Positive int expectedVersion) {}
    public record ProfileUpdate(
            @NotBlank @Size(min=2,max=180) String name,@Size(max=120) String industry,@Size(max=80) String companySize,
            @Size(max=5_000) String description,@Size(max=500) @Pattern(regexp="^$|https?://.+",message="Website không hợp lệ.") String website,
            @Size(max=500) String address,@Positive int expectedVersion) {}
    public record StateChange(@Positive int expectedVersion,@NotBlank @Size(min=5,max=1_000) String reason) {}
    public record RecruiterStateChange(@NotBlank @Size(min=5,max=1_000) String reason) {}
}

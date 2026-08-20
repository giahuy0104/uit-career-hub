package vn.edu.uit.careerhub.taxonomy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class TaxonomyRequests {
    private TaxonomyRequests() {}

    public record CategoryCreate(
            @NotBlank @Size(min = 2, max = 50) @Pattern(regexp = "^[A-Z0-9_]+$") String code,
            @NotBlank @Size(min = 2, max = 120) String name) {}
    public record SkillCreate(
            @NotBlank @Size(min = 2, max = 80) @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$") String slug,
            @NotBlank @Size(min = 2, max = 120) String name) {}
    public record Update(@NotBlank @Size(min = 2, max = 120) String name, @Positive int expectedVersion) {}
    public record State(@Positive int expectedVersion, @NotBlank @Size(min = 5, max = 500) String reason) {}
}

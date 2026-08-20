package vn.edu.uit.careerhub.taxonomy;

import java.time.Instant;
import java.util.UUID;

public final class TaxonomyModels {
    private TaxonomyModels() {}

    public enum Status { ACTIVE, INACTIVE }
    public enum Kind { CATEGORY, SKILL }

    public record CategoryDto(UUID id, String code, String name, Status status, int version,
            long jobCount, long openJobCount, Instant createdAt, Instant updatedAt) {}
    public record SkillDto(UUID id, String slug, String name, Status status, int version,
            long jobCount, long openJobCount, Instant createdAt, Instant updatedAt) {}
    public record ListResult<T>(java.util.List<T> items, long total) {}
    public record LockedItem(UUID id, String key, String name, boolean active, int version) {}
}

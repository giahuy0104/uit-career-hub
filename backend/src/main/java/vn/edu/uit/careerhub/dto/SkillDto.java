package vn.edu.uit.careerhub.dto;

import java.time.Instant;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.TaxonomyStatus;

public record SkillDto(UUID id, String slug, String name, TaxonomyStatus status, int version,
        long jobCount, long openJobCount, Instant createdAt, Instant updatedAt) {}

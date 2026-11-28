package vn.edu.uit.careerhub.entity;

import java.time.OffsetDateTime;

import vn.edu.uit.careerhub.enums.AiFeature;

/** dailyLimitPerUser null = only the global limit applies. */
public record AiFeatureSetting(AiFeature feature, boolean enabled, Integer dailyLimitPerUser, OffsetDateTime updatedAt, String updatedBy) {}

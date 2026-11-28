package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** dailyLimitPerUser null = no limit of its own (the global one still applies). */
public record AiFeatureSettingRequest(@NotNull Boolean enabled, @Min(1) @Max(1000) Integer dailyLimitPerUser) {}

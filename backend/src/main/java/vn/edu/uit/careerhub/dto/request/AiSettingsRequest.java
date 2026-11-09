package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotNull;

public record AiSettingsRequest(@NotNull Boolean enabled) {}

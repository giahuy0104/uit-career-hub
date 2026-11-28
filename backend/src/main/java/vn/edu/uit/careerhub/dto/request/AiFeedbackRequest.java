package vn.edu.uit.careerhub.dto.request;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.enums.AiFeature;

public record AiFeedbackRequest(@NotNull AiFeature feature, @NotNull UUID subjectId, @NotNull Boolean helpful,
        @Size(max = 80) String modelVersion) {}

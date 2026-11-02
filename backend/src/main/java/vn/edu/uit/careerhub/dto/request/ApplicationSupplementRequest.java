package vn.edu.uit.careerhub.dto.request;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.enums.DocumentType;

public record ApplicationSupplementRequest(@NotBlank @Size(min=2,max=80) String reasonCode,
        @NotBlank @Size(min=5,max=2_000) String note,
        @NotNull @Size(min=1,max=4) List<@NotNull DocumentType> requiredDocumentTypes,
        @NotNull OffsetDateTime dueAt) {}

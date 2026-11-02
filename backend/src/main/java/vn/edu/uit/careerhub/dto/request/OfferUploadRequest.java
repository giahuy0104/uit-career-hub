package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record OfferUploadRequest(@NotBlank @Size(max=255) @Pattern(regexp="(?i)^[^\\\\/\\r\\n\\x00]+\\.pdf$") String fileName,
        @NotBlank @Pattern(regexp="application/pdf") String mimeType,
        @Positive @Max(10 * 1024 * 1024) long fileSizeBytes) {}

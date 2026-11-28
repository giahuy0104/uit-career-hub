package vn.edu.uit.careerhub.dto.request;

import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.enums.JobEventSource;
import vn.edu.uit.careerhub.enums.JobEventType;

public record JobEventRequest(
        @NotNull UUID jobId,
        @NotNull JobEventType type,
        @NotNull JobEventSource source,
        @Min(0) @Max(100) Integer position,
        @Size(max = 80) String modelVersion) {}

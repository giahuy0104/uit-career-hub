package vn.edu.uit.careerhub.dto.request;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ApplicationSubmitRequest(@NotNull UUID jobId,@NotNull @Size(min=1,max=10) List<@NotNull @Valid DocumentRefRequest> documents,
        @AssertTrue boolean consentToShare) {}

package vn.edu.uit.careerhub.dto.request;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.enums.ResultOutcome;

public record RecruitmentResultRequest(@NotNull ResultOutcome outcome,LocalDate startDate,UUID offerUploadId,
        @Size(max=2_000) String internalNote,@Size(min=2,max=80) String reasonCode,
        @Size(min=5,max=2_000) String note) {}

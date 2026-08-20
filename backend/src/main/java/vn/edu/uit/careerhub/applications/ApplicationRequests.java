package vn.edu.uit.careerhub.applications;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import vn.edu.uit.careerhub.applications.ApplicationModels.DocumentType;
import vn.edu.uit.careerhub.applications.ApplicationModels.InterviewMode;
import vn.edu.uit.careerhub.applications.ApplicationModels.ResultOutcome;

public final class ApplicationRequests {
    private ApplicationRequests() {}

    public record ProfileUpdate(
            @Size(min=8,max=30) @Pattern(regexp="^\\+?[0-9][0-9 .()\\-]*$") String phone) {}

    public record DocumentUpload(@NotNull DocumentType documentType,
            @NotBlank @Size(max=255) @Pattern(regexp="(?i)^[^\\\\/\\r\\n\\x00]+\\.pdf$") String fileName,
            @NotBlank @Pattern(regexp="application/pdf") String mimeType,
            @Positive @Max(10 * 1024 * 1024) long fileSizeBytes) {}

    public record DocumentRef(@NotNull UUID documentId) {}
    public record Submit(@NotNull UUID jobId,@Valid @Size(min=1,max=10) List<DocumentRef> documents,
            @AssertTrue boolean consentToShare) {}
    public record Resubmit(@Valid @Size(min=1,max=10) List<DocumentRef> documents,
            @AssertTrue boolean consentToShare) {}

    public record Reason(@NotBlank @Size(min=2,max=80) String reasonCode,
            @NotBlank @Size(min=5,max=2_000) String note) {}
    public record Supplement(@NotBlank @Size(min=2,max=80) String reasonCode,
            @NotBlank @Size(min=5,max=2_000) String note,
            @Size(min=1,max=4) List<@NotNull DocumentType> requiredDocumentTypes,
            @NotNull OffsetDateTime dueAt) {}
    public record Placement(@NotNull LocalDate startDate,@Size(max=500) String note) {}
    public record DocumentReview(@NotBlank @Pattern(regexp="VERIFY|REJECT") String decision,
            @Size(max=2_000) String note) {}

    public record Interview(@NotNull OffsetDateTime scheduledAt,@NotBlank @Size(min=2,max=80) String timeZone,
            @NotNull InterviewMode mode,@Size(min=3,max=500) String location,
            @Size(max=2_000) @Pattern(regexp="^$|https?://.+") String meetingUrl,
            @NotBlank @Size(min=2,max=150) String interviewerName) {
        public Interview {
            if (timeZone == null || timeZone.isBlank()) timeZone = "Asia/Ho_Chi_Minh";
        }
    }

    public record OfferUpload(@NotBlank @Size(max=255) @Pattern(regexp="(?i)^[^\\\\/\\r\\n\\x00]+\\.pdf$") String fileName,
            @NotBlank @Pattern(regexp="application/pdf") String mimeType,
            @Positive @Max(10 * 1024 * 1024) long fileSizeBytes) {}

    public record RecruitmentResult(@NotNull ResultOutcome outcome,LocalDate startDate,UUID offerUploadId,
            @Size(max=2_000) String internalNote,@Size(min=2,max=80) String reasonCode,
            @Size(min=5,max=2_000) String note) {}
}

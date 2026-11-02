package vn.edu.uit.careerhub.dto.request;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.enums.InterviewMode;

public record InterviewRequest(@NotNull OffsetDateTime scheduledAt,@NotBlank @Size(min=2,max=80) String timeZone,
        @NotNull InterviewMode mode,@Size(min=3,max=500) String location,
        @Size(max=2_000) @Pattern(regexp="^$|https?://.+") String meetingUrl,
        @NotBlank @Size(min=2,max=150) String interviewerName) {
    public InterviewRequest {
        if (timeZone == null || timeZone.isBlank()) timeZone = "Asia/Ho_Chi_Minh";
    }
}

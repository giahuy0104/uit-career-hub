package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DocumentReviewRequest(@NotBlank @Pattern(regexp="VERIFY|REJECT") String decision,
        @Size(max=2_000) String note) {}

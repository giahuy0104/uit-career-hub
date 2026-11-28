package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TagSuggestionRequest(@NotBlank @Size(max = 180) String title, @Size(max = 20_000) String description,
        @Size(max = 20_000) String requirements) {}

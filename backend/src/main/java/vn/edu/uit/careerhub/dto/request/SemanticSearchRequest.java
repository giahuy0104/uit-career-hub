package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SemanticSearchRequest(@NotBlank @Size(min = 2, max = 200) String query) {}

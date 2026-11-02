package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record StudentProfileUpdateRequest(
        @Size(min=8,max=30) @Pattern(regexp="^\\+?[0-9][0-9 .()\\-]*$") String phone) {}

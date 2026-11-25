package vn.edu.uit.careerhub.dto.request;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import vn.edu.uit.careerhub.enums.OpportunityType;

public record JobPreferencesRequest(
        @NotNull @Size(max = 30) List<@NotNull UUID> skillIds,
        @NotNull @Size(max = 10) List<@NotNull UUID> categoryIds,
        @NotNull @Size(max = 4) List<@NotNull OpportunityType> opportunityTypes) {}

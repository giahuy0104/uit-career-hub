package vn.edu.uit.careerhub.dto.request;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public record DocumentRefRequest(@NotNull UUID documentId) {}

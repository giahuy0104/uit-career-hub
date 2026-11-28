package vn.edu.uit.careerhub.entity;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AiCachedSuggestion(UUID id, String model, Map<String, Object> result, OffsetDateTime createdAt) {}

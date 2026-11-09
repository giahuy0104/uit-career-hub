package vn.edu.uit.careerhub.entity;

import java.time.OffsetDateTime;
import java.util.Map;

public record AiCachedSuggestion(String model, Map<String, Object> result, OffsetDateTime createdAt) {}

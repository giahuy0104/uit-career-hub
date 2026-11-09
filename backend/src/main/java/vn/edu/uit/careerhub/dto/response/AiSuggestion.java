package vn.edu.uit.careerhub.dto.response;

import java.util.Map;

/**
 * Result of one AI request. When {@code available} is false the UI shows {@code message}
 * ("chưa có gợi ý") and the internship workflow carries on unaffected.
 */
public record AiSuggestion(
        boolean available,
        String feature,
        String status,
        String message,
        Map<String, Object> result,
        String model,
        String generatedAt) {}

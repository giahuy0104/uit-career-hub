package vn.edu.uit.careerhub.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Gemini settings. AI counts as configured only when an API key is present. */
@ConfigurationProperties(prefix = "app.ai")
public record AiProperties(
        String apiKey,
        String model,
        String baseUrl,
        int timeoutSeconds,
        int dailyLimitPerUser) {

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }
}

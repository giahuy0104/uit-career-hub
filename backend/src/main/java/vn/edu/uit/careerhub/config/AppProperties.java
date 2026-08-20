package vn.edu.uit.careerhub.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String environment,
        String corsOrigin,
        String publicUrl,
        Database database,
        Security security,
        Email email,
        Storage storage,
        String cronSecret) {

    public record Database(String url, String directUrl, int poolMax) {}

    public record Security(
            String jwtSecret,
            String jwtIssuer,
            String jwtAudience,
            long accessTokenTtlSeconds,
            long refreshTokenTtlDays,
            String refreshCookieName,
            boolean refreshCookieSecure,
            String refreshCookieSameSite,
            String uitEmailDomains) {
        public List<String> allowedStudentEmailDomains() {
            return Arrays.stream(uitEmailDomains.split(","))
                    .map(String::strip)
                    .map(String::toLowerCase)
                    .filter(value -> !value.isBlank())
                    .toList();
        }
    }

    public record Email(boolean enabled, String apiKey, String from, int batchSize, int maxAttempts) {}

    public record Storage(
            boolean enabled,
            String accountId,
            String accessKeyId,
            String secretAccessKey,
            String bucket,
            long uploadUrlTtlSeconds,
            long downloadUrlTtlSeconds) {}
}

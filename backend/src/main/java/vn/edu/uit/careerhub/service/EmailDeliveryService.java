package vn.edu.uit.careerhub.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.entity.EmailDelivery;
import vn.edu.uit.careerhub.repository.EmailDeliveryRepository;
import vn.edu.uit.careerhub.util.JsonSupport;

@Service
public class EmailDeliveryService {
    private final EmailDeliveryRepository repository;
    private final AppProperties properties;
    private final JsonSupport json;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public EmailDeliveryService(EmailDeliveryRepository repository, AppProperties properties, JsonSupport json) {
        this.repository = repository;
        this.properties = properties;
        this.json = json;
    }

    public Map<String, Object> dispatchPending(UUID resourceId) {
        if (!properties.email().enabled()) return Map.of("enabled", false, "claimed", 0, "sent", 0, "failed", 0);
        int claimed = 0, sent = 0, failed = 0;
        while (true) {
            List<EmailDelivery> batch = repository.claim(resourceId, properties.email().maxAttempts(), properties.email().batchSize());
            claimed += batch.size();
            for (var delivery : batch) {
                try {
                    repository.markSent(delivery.id(), send(delivery));
                    sent++;
                } catch (Exception error) {
                    repository.markFailed(delivery.id(), error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage());
                    failed++;
                }
            }
            if (batch.size() < properties.email().batchSize()) break;
        }
        return Map.of("enabled", true, "claimed", claimed, "sent", sent, "failed", failed);
    }

    private String send(EmailDelivery d) throws Exception {
        String base = properties.publicUrl().endsWith("/") ? properties.publicUrl() : properties.publicUrl() + "/";
        String link = URI.create(base).resolve(d.deepLink().replaceFirst("^/", "")).toString();
        String html = "<!doctype html><html lang=\"vi\"><body><h1>" + escape(d.title()) + "</h1><p>" + escape(d.body()) + "</p><p><a href=\"" + escape(link) + "\">Xem chi tiết</a></p></body></html>";
        Map<String, Object> payload = Map.of("from", properties.email().from(), "to", List.of(d.recipient()), "subject", "[UIT Career Hub] " + d.title(), "html", html, "text", d.title() + "\n\n" + d.body() + "\n\nXem chi tiết: " + link);
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails")).timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + properties.email().apiKey()).header("Content-Type", "application/json")
                .header("Idempotency-Key", "notification/" + d.id())
                .POST(HttpRequest.BodyPublishers.ofString(json.stringify(payload))).build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) throw new IllegalStateException("Resend từ chối email (HTTP " + response.statusCode() + ").");
        Object id = json.object(response.body()).get("id");
        if (id == null) throw new IllegalStateException("Resend không trả về mã email.");
        return id.toString();
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#039;");
    }
}

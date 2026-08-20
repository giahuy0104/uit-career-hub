package vn.edu.uit.careerhub.health;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.config.DatabaseUrl;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    private final JdbcClient database;
    private final AppProperties properties;

    public HealthController(JdbcClient database, AppProperties properties) {
        this.database = database;
        this.properties = properties;
    }

    @GetMapping
    Map<String, Object> health() {
        return Map.of("status", "ok", "service", "uit-career-hub-backend", "timestamp", Instant.now().toString());
    }

    @GetMapping("/database")
    ResponseEntity<Map<String, Object>> database() {
        try {
            database.sql("SELECT 1").query(Integer.class).single();
            DatabaseUrl url = DatabaseUrl.parse(properties.database().url());
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "ok");
            body.put("database", "connected");
            body.put("provider", url.neonPooler() || properties.database().url().contains(".neon.tech") ? "neon" : "postgresql");
            return ResponseEntity.ok(body);
        } catch (Exception error) {
            return ResponseEntity.status(503).body(Map.of("status", "degraded", "database", "unavailable"));
        }
    }
}

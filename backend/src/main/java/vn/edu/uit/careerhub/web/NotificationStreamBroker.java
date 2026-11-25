package vn.edu.uit.careerhub.web;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArraySet;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import vn.edu.uit.careerhub.dto.NotificationSnapshot;
import vn.edu.uit.careerhub.service.NotificationService;

/** Keeps the open SSE connections. Lives in the web layer because it works with {@link SseEmitter}. */
@Component
public class NotificationStreamBroker {
    private static final Logger log = LoggerFactory.getLogger(NotificationStreamBroker.class);

    private final NotificationService notifications;
    private final long streamTimeoutMs;
    private final long heartbeatMs;
    private final ConcurrentMap<UUID, CopyOnWriteArraySet<Client>> clients = new ConcurrentHashMap<>();

    public NotificationStreamBroker(
            NotificationService notifications,
            @Value("${app.notifications.stream-timeout-ms:300000}") long streamTimeoutMs,
            @Value("${app.notifications.heartbeat-ms:15000}") long heartbeatMs) {
        this.notifications = notifications;
        this.streamTimeoutMs = streamTimeoutMs;
        this.heartbeatMs = heartbeatMs;
    }

    public SseEmitter subscribe(UUID userId) {
        NotificationSnapshot snapshot = notifications.snapshot(userId);
        SseEmitter emitter = new SseEmitter(streamTimeoutMs);
        Client client = new Client(userId, emitter, snapshot);

        clients.computeIfAbsent(userId, ignored -> new CopyOnWriteArraySet<>()).add(client);
        emitter.onCompletion(() -> remove(client));
        emitter.onTimeout(() -> remove(client));
        emitter.onError(error -> remove(client));

        if (!sendSnapshot(client, snapshot)) {
            emitter.complete();
        }
        return emitter;
    }

    @Scheduled(
            fixedDelayString = "${app.notifications.realtime-poll-ms:1500}",
            initialDelayString = "${app.notifications.realtime-poll-ms:1500}")
    void publishUpdates() {
        clients.forEach((userId, userClients) -> {
            if (userClients.isEmpty()) return;
            try {
                NotificationSnapshot snapshot = notifications.snapshot(userId);
                long now = System.currentTimeMillis();
                for (Client client : userClients) {
                    if (!snapshot.equals(client.snapshot)) {
                        sendSnapshot(client, snapshot);
                    } else if (now - client.lastSentAt >= heartbeatMs) {
                        sendHeartbeat(client);
                    }
                }
            } catch (RuntimeException error) {
                log.warn("Không thể kiểm tra thông báo realtime cho user {}.", userId, error);
            }
        });
    }

    private boolean sendSnapshot(Client client, NotificationSnapshot snapshot) {
        try {
            client.emitter.send(SseEmitter.event()
                    .id(snapshot.cursor())
                    .name("notifications")
                    .data(new StreamPayload(
                            snapshot.cursor(),
                            snapshot.unreadCount(),
                            snapshot.latestNotificationId(),
                            snapshot.latestCreatedAt())));
            client.snapshot = snapshot;
            client.lastSentAt = System.currentTimeMillis();
            return true;
        } catch (IOException | IllegalStateException error) {
            remove(client);
            return false;
        }
    }

    private void sendHeartbeat(Client client) {
        try {
            client.emitter.send(SseEmitter.event().comment("keep-alive"));
            client.lastSentAt = System.currentTimeMillis();
        } catch (IOException | IllegalStateException error) {
            remove(client);
        }
    }

    private void remove(Client client) {
        Set<Client> userClients = clients.get(client.userId);
        if (userClients == null) return;
        userClients.remove(client);
        if (userClients.isEmpty()) clients.remove(client.userId, userClients);
    }

    @PreDestroy
    void shutdown() {
        clients.values().forEach(userClients -> userClients.forEach(client -> client.emitter.complete()));
        clients.clear();
    }

    private static final class Client {
        private final UUID userId;
        private final SseEmitter emitter;
        private volatile NotificationSnapshot snapshot;
        private volatile long lastSentAt;

        private Client(UUID userId, SseEmitter emitter, NotificationSnapshot snapshot) {
            this.userId = userId;
            this.emitter = emitter;
            this.snapshot = snapshot;
            this.lastSentAt = System.currentTimeMillis();
        }
    }

    public record StreamPayload(
            String cursor,
            long unreadCount,
            UUID latestNotificationId,
            Instant latestCreatedAt) {}
}

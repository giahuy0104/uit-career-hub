package vn.edu.uit.careerhub.notifications;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record NotificationDto(
        UUID id,
        String type,
        String title,
        String body,
        String resourceType,
        UUID resourceId,
        String deepLink,
        Map<String, Object> payload,
        Instant readAt,
        Instant createdAt) {}

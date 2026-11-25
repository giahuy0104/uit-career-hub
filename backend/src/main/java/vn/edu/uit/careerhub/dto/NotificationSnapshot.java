package vn.edu.uit.careerhub.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationSnapshot(long unreadCount, UUID latestNotificationId, Instant latestCreatedAt) {
    public String cursor() {
        return (latestNotificationId == null ? "empty" : latestNotificationId.toString()) + "-" + unreadCount;
    }
}

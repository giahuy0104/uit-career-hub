package vn.edu.uit.careerhub.notifications;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.common.JsonSupport;

@Repository
public class NotificationRepository {
    private final JdbcClient database;
    private final JsonSupport json;

    public NotificationRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public Result list(UUID recipientUserId, int page, int pageSize, boolean unreadOnly) {
        String unread = unreadOnly ? " AND read_at IS NULL" : "";
        List<NotificationDto> items = database.sql("""
                SELECT id, type, title, body, resource_type, resource_id, deep_link,
                       payload, read_at, created_at
                FROM notifications
                WHERE recipient_user_id = :userId
                """ + unread + " ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset")
                .param("userId", recipientUserId).param("limit", pageSize).param("offset", (page - 1) * pageSize)
                .query(this::map).list();
        Long total = database.sql("SELECT count(*) FROM notifications WHERE recipient_user_id = :userId" + unread)
                .param("userId", recipientUserId).query(Long.class).single();
        return new Result(items, total == null ? 0 : total);
    }

    public long unreadCount(UUID recipientUserId) {
        Long count = database.sql("SELECT count(*) FROM notifications WHERE recipient_user_id = :userId AND read_at IS NULL")
                .param("userId", recipientUserId).query(Long.class).single();
        return count == null ? 0 : count;
    }

    public boolean markRead(UUID recipientUserId, UUID notificationId) {
        return database.sql("""
                UPDATE notifications SET read_at = COALESCE(read_at, now())
                WHERE id = :notificationId AND recipient_user_id = :userId
                """).param("notificationId", notificationId).param("userId", recipientUserId).update() > 0;
    }

    public void markAllRead(UUID recipientUserId) {
        database.sql("UPDATE notifications SET read_at = now() WHERE recipient_user_id = :userId AND read_at IS NULL")
                .param("userId", recipientUserId).update();
    }

    private NotificationDto map(ResultSet result, int row) throws SQLException {
        return new NotificationDto(result.getObject("id", UUID.class), result.getString("type"),
                result.getString("title"), result.getString("body"), result.getString("resource_type"),
                result.getObject("resource_id", UUID.class), result.getString("deep_link"),
                json.object(result.getObject("payload")), instant(result, "read_at"), instant(result, "created_at"));
    }

    private java.time.Instant instant(ResultSet result, String name) throws SQLException {
        Timestamp value = result.getTimestamp(name);
        return value == null ? null : value.toInstant();
    }

    public record Result(List<NotificationDto> items, long total) {}
}

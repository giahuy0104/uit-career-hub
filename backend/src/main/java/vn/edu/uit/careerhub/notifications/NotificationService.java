package vn.edu.uit.careerhub.notifications;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.common.AppException;

@Service
public class NotificationService {
    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) { this.repository = repository; }

    public NotificationRepository.Result list(UUID userId, int page, int pageSize, boolean unreadOnly) {
        return repository.list(userId, page, pageSize, unreadOnly);
    }
    public long unreadCount(UUID userId) { return repository.unreadCount(userId); }
    public void markRead(UUID userId, UUID notificationId) {
        if (!repository.markRead(userId, notificationId)) {
            throw new AppException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.");
        }
    }
    public void markAllRead(UUID userId) { repository.markAllRead(userId); }
}

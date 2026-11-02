package vn.edu.uit.careerhub.service;

import java.util.UUID;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.dto.NotificationPageResult;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.NotificationRepository;

@Service
public class NotificationService {
    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) { this.repository = repository; }

    public NotificationPageResult list(UUID userId, int page, int pageSize, boolean unreadOnly) {
        return repository.list(userId, page, pageSize, unreadOnly);
    }
    public long unreadCount(UUID userId) { return repository.unreadCount(userId); }
    public void markRead(UUID userId, UUID notificationId) {
        if (!repository.markRead(userId, notificationId)) {
            throw new AppException(ErrorType.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.");
        }
    }
    public void markAllRead(UUID userId) { repository.markAllRead(userId); }
}

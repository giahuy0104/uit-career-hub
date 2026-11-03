package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.repository.NotificationRepository;

@Service
public class DailyPendingService {
    private final NotificationRepository notifications;
    private final EmailDeliveryService email;

    public DailyPendingService(NotificationRepository notifications, EmailDeliveryService email) {
        this.notifications = notifications;
        this.email = email;
    }

    public Map<String, Object> run() {
        Map<String, Object> summary = notifications.createDailyPendingSummaries(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        summary.put("emailDelivery", email.dispatchPending(null));
        return summary;
    }
}

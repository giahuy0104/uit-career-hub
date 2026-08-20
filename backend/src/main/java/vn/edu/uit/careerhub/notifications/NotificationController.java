package vn.edu.uit.careerhub.notifications;

import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.common.PageEnvelope;
import vn.edu.uit.careerhub.common.PageMeta;

@Validated
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service) { this.service = service; }

    @GetMapping
    PageEnvelope<NotificationDto> list(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        NotificationRepository.Result result = service.list(principal.userId(), page, pageSize, unreadOnly);
        return new PageEnvelope<>(result.items(), PageMeta.of(page, pageSize, result.total()));
    }

    @GetMapping("/unread-count")
    ApiEnvelope<Map<String, Long>> unread(@AuthenticationPrincipal AuthPrincipal principal) {
        return ApiEnvelope.of(Map.of("count", service.unreadCount(principal.userId())));
    }

    @PostMapping("/read-all")
    ResponseEntity<Void> readAll(@AuthenticationPrincipal AuthPrincipal principal) {
        service.markAllRead(principal.userId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{notificationId}/read")
    ResponseEntity<Void> read(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID notificationId) {
        service.markRead(principal.userId(), notificationId);
        return ResponseEntity.noContent().build();
    }
}

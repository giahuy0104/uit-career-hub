package vn.edu.uit.careerhub.controller;

import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import vn.edu.uit.careerhub.dto.NotificationDto;
import vn.edu.uit.careerhub.dto.NotificationPageResult;
import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.dto.response.PageEnvelope;
import vn.edu.uit.careerhub.dto.response.PageMeta;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.NotificationService;
import vn.edu.uit.careerhub.web.NotificationStreamBroker;

@Validated
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService service;
    private final NotificationStreamBroker streams;

    public NotificationController(NotificationService service, NotificationStreamBroker streams) {
        this.service = service;
        this.streams = streams;
    }

    @GetMapping
    PageEnvelope<NotificationDto> list(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        NotificationPageResult result = service.list(principal.userId(), page, pageSize, unreadOnly);
        return new PageEnvelope<>(result.items(), PageMeta.of(page, pageSize, result.total()));
    }

    @GetMapping("/unread-count")
    ApiEnvelope<Map<String, Long>> unread(@AuthenticationPrincipal AuthPrincipal principal) {
        return ApiEnvelope.of(Map.of("count", service.unreadCount(principal.userId())));
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    SseEmitter stream(@AuthenticationPrincipal AuthPrincipal principal, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("X-Accel-Buffering", "no");
        return streams.subscribe(principal.userId());
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

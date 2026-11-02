package vn.edu.uit.careerhub.dto;

import java.util.List;

public record NotificationPageResult(List<NotificationDto> items, long total) {}

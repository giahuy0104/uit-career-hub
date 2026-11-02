package vn.edu.uit.careerhub.entity;

import java.util.UUID;

public record EmailDelivery(UUID id, String recipient, String title, String body, String deepLink, String dedupeKey) {}

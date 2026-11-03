package vn.edu.uit.careerhub.entity;

import java.time.Instant;
import java.util.UUID;

public record DocumentUpload(UUID id, UUID ownerId, UUID applicationId, String documentType, String fileName,
        String mimeType, long size, String storageKey, String status, Instant expiresAt, UUID documentId) {}

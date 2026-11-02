package vn.edu.uit.careerhub.entity;

import java.util.UUID;

public record LockedDocument(UUID id,String documentType,String verificationStatus,boolean isDefault,
        String storageKey,boolean usedByApplication) {}

package vn.edu.uit.careerhub.entity;

import java.util.UUID;

public record SourceDocument(UUID id,String documentType,String fileName,String mimeType,long fileSizeBytes,
        String storageKey,String checksum,int version,String verificationStatus) {}

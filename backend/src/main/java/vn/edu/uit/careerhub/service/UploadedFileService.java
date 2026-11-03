package vn.edu.uit.careerhub.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.entity.DocumentUpload;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.exception.UploadExpiredException;
import vn.edu.uit.careerhub.storage.ObjectStorage;

/** Object-storage rules shared by student documents and offer documents. */
@Service
public class UploadedFileService {
    private static final byte[] PDF_HEADER = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final int PDF_HEADER_SCAN_BYTES = 1024;

    private final ObjectStorage storage;
    private final AppProperties properties;

    public UploadedFileService(ObjectProvider<ObjectStorage> storage, AppProperties properties) {
        this.storage = storage.getIfAvailable();
        this.properties = properties;
    }

    public ObjectStorage storage() {
        if (storage == null) throw new AppException(ErrorType.UNAVAILABLE, "OBJECT_STORAGE_NOT_CONFIGURED", "Chức năng tải tài liệu chưa được cấu hình.");
        return storage;
    }

    public long uploadTtlSeconds() { return properties.storage().uploadUrlTtlSeconds(); }

    public Instant uploadExpiry() { return Instant.now().plusSeconds(uploadTtlSeconds()); }

    public Map<String, Object> uploadIntent(UUID id, String url, Instant expires) {
        return Map.of("uploadId", id, "uploadUrl", url, "method", "PUT", "headers", Map.of("Content-Type", "application/pdf"), "expiresAt", expires.toString());
    }

    public Map<String, Object> download(String key, String fileName) {
        ObjectStorage objects = storage();
        Instant expires = Instant.now().plusSeconds(properties.storage().downloadUrlTtlSeconds());
        return Map.of("downloadUrl", objects.createDownloadUrl(key, fileName, properties.storage().downloadUrlTtlSeconds()), "expiresAt", expires.toString());
    }

    public void ensureOpen(DocumentUpload upload, String prefix, Consumer<UUID> markExpired) {
        if ("EXPIRED".equals(upload.status())) throw expired(prefix);
        if (!"PENDING".equals(upload.status())) throw new AppException(ErrorType.CONFLICT, prefix + "_UPLOAD_CLOSED", "Phiên tải tệp không còn hiệu lực.");
        if (!upload.expiresAt().isAfter(Instant.now())) {
            markExpired.accept(upload.id());
            throw expired(prefix);
        }
    }

    private UploadExpiredException expired(String prefix) {
        return new UploadExpiredException(prefix + "_UPLOAD_EXPIRED", "URL tải tệp đã hết hạn.");
    }

    public void verifyPdf(DocumentUpload upload, String prefix) {
        ObjectStorage objects = storage();
        var metadata = objects.headObject(upload.storageKey());
        if (metadata == null) throw new AppException(ErrorType.CONFLICT, prefix + "_UPLOAD_MISSING", "Kho lưu trữ chưa nhận được tệp.");
        String type = metadata.contentType() == null ? null : metadata.contentType().split(";")[0].strip().toLowerCase();
        if (metadata.contentLength() != upload.size() || !upload.mimeType().equals(type)) {
            objects.deleteObject(upload.storageKey());
            throw new AppException(ErrorType.CONFLICT, prefix + "_UPLOAD_MISMATCH", "Tệp không khớp dung lượng hoặc định dạng đã đăng ký.");
        }
        if (!hasPdfHeader(objects.readObjectPrefix(upload.storageKey(), PDF_HEADER_SCAN_BYTES))) {
            objects.deleteObject(upload.storageKey());
            throw new AppException(ErrorType.CONFLICT, prefix + "_INVALID_PDF", "Nội dung tệp không phải PDF hợp lệ.");
        }
    }

    static boolean hasPdfHeader(byte[] prefix) {
        if (prefix == null || prefix.length < PDF_HEADER.length) return false;
        int lastStart = Math.min(prefix.length, PDF_HEADER_SCAN_BYTES) - PDF_HEADER.length;
        for (int start = 0; start <= lastStart; start++) {
            boolean matches = true;
            for (int offset = 0; offset < PDF_HEADER.length; offset++) {
                if (prefix[start + offset] != PDF_HEADER[offset]) { matches = false; break; }
            }
            if (matches) return true;
        }
        return false;
    }
}

package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import vn.edu.uit.careerhub.entity.DocumentUpload;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.UploadExpiredException;

class UploadedFileServiceTest {
    @SuppressWarnings("unchecked")
    private final UploadedFileService files = new UploadedFileService(mock(ObjectProvider.class), null);
    private final List<UUID> marked = new ArrayList<>();

    private DocumentUpload upload(String status, Instant expires) {
        return new DocumentUpload(UUID.randomUUID(), null, null, "CV", "cv.pdf", "application/pdf", 1, "key", status, expires, null);
    }

    @Test void marksAnOverdueUploadAndReportsItExpired() {
        DocumentUpload upload = upload("PENDING", Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> files.ensureOpen(upload, "X", marked::add))
                .isInstanceOf(UploadExpiredException.class)
                .extracting(error -> ((AppException) error).code()).isEqualTo("X_UPLOAD_EXPIRED");
        assertThat(marked).containsExactly(upload.id());
    }

    @Test void aRetryAfterExpiryStillReportsExpiredWithoutWritingAgain() {
        assertThatThrownBy(() -> files.ensureOpen(upload("EXPIRED", Instant.now().minusSeconds(1)), "X", marked::add))
                .isInstanceOf(UploadExpiredException.class);
        assertThat(marked).isEmpty();
    }

    @Test void aPendingUploadInTimeIsOpen() {
        files.ensureOpen(upload("PENDING", Instant.now().plusSeconds(60)), "X", marked::add);
        assertThat(marked).isEmpty();
    }

    @Test void aCompletedUploadIsClosed() {
        assertThatThrownBy(() -> files.ensureOpen(upload("COMPLETED", Instant.now().plusSeconds(60)), "X", marked::add))
                .extracting(error -> ((AppException) error).code()).isEqualTo("X_UPLOAD_CLOSED");
    }
}

package vn.edu.uit.careerhub.dto.request;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.enums.DocumentType;

class ApplicationRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    private final DocumentRefRequest document = new DocumentRefRequest(UUID.randomUUID());

    @Test void submitRequiresADocumentList() {
        assertThat(validator.validate(new ApplicationSubmitRequest(UUID.randomUUID(), null, true))).isNotEmpty();
        assertThat(validator.validate(new ApplicationSubmitRequest(UUID.randomUUID(), Arrays.asList(document, null), true))).isNotEmpty();
        assertThat(validator.validate(new ApplicationSubmitRequest(UUID.randomUUID(), List.of(document), true))).isEmpty();
    }

    @Test void resubmitRequiresADocumentList() {
        assertThat(validator.validate(new ApplicationResubmitRequest(null, true))).isNotEmpty();
        assertThat(validator.validate(new ApplicationResubmitRequest(Arrays.asList((DocumentRefRequest) null), true))).isNotEmpty();
        assertThat(validator.validate(new ApplicationResubmitRequest(List.of(document), true))).isEmpty();
    }

    @Test void nestedDocumentIdsAreStillValidated() {
        assertThat(validator.validate(new ApplicationResubmitRequest(List.of(new DocumentRefRequest(null)), true))).isNotEmpty();
    }

    @Test void supplementRequiresDocumentTypes() {
        OffsetDateTime due = OffsetDateTime.now().plusDays(1);
        assertThat(validator.validate(new ApplicationSupplementRequest("MISSING", "Thiếu bảng điểm", null, due))).isNotEmpty();
        assertThat(validator.validate(new ApplicationSupplementRequest("MISSING", "Thiếu bảng điểm", List.of(DocumentType.TRANSCRIPT), due))).isEmpty();
    }
}

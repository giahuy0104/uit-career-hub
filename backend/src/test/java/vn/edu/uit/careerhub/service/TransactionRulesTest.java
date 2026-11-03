package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Arrays;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionAttribute;

import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.exception.UploadExpiredException;

/** Evaluates the same rules Spring's transaction proxy applies at runtime. */
class TransactionRulesTest {
    private final AnnotationTransactionAttributeSource source = new AnnotationTransactionAttributeSource();

    private TransactionAttribute attribute(Class<?> type, String method) {
        Method found = Arrays.stream(type.getMethods()).filter(m -> m.getName().equals(method)).findFirst().orElseThrow();
        return source.getTransactionAttribute(found, type);
    }

    @Test void reviewEndpointsRunInATransaction() {
        assertThat(attribute(InternshipPlanService.class, "review")).isNotNull();
        assertThat(attribute(WeeklyLogService.class, "review")).isNotNull();
    }

    @Test void expiringAnUploadCommitsButOtherFailuresRollBack() {
        for (Class<?> type : new Class<?>[] {StudentDocumentService.class, RecruitmentResultService.class}) {
            String method = type == StudentDocumentService.class ? "completeStudentUpload" : "completeOfferUpload";
            TransactionAttribute attribute = attribute(type, method);
            assertThat(attribute.rollbackOn(new UploadExpiredException("X_UPLOAD_EXPIRED", "expired"))).isFalse();
            assertThat(attribute.rollbackOn(new AppException(ErrorType.CONFLICT, "X", "conflict"))).isTrue();
        }
    }
}

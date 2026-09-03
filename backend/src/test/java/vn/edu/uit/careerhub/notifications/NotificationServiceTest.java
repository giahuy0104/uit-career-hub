package vn.edu.uit.careerhub.notifications;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import vn.edu.uit.careerhub.common.AppException;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock private NotificationRepository repository;

    @Test void markReadRejectsANotificationThatDoesNotBelongToTheUser() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        when(repository.markRead(userId, notificationId)).thenReturn(false);
        NotificationService service = new NotificationService(repository);

        assertThatThrownBy(() -> service.markRead(userId, notificationId))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("NOTIFICATION_NOT_FOUND");
    }

    @Test void markReadSucceedsWhenTheRepositoryConfirmsTheUpdate() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();
        when(repository.markRead(userId, notificationId)).thenReturn(true);
        NotificationService service = new NotificationService(repository);

        assertThatCode(() -> service.markRead(userId, notificationId)).doesNotThrowAnyException();
    }
}

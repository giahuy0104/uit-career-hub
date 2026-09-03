package vn.edu.uit.careerhub.placements;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.placements.PlacementModels.Locked;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;
import vn.edu.uit.careerhub.placements.PlacementRequests.Transition;

/**
 * Covers the internship-placement lifecycle from the handoff doc section 4.5
 * (HIRED -> STARTED -> COMPLETED) guard rules: idempotency, the from-state check, optimistic
 * locking, and the effective-date bounds.
 */
@ExtendWith(MockitoExtension.class)
class PlacementServiceTest {
    @Mock private PlacementRepository repository;
    @Mock private TransactionTemplate transactions;

    private PlacementService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final UUID placementId = UUID.randomUUID();

    @BeforeEach void wireTransactionTemplateToRunTheCallbackImmediately() {
        when(transactions.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(new SimpleTransactionStatus());
        });
        service = new PlacementService(repository, transactions);
    }

    @Test void startIsIdempotentWhenTheCommandWasAlreadyApplied() {
        UUID commandId = UUID.randomUUID();
        Map<String, Object> found = Map.of("id", placementId.toString());
        when(repository.lock(placementId)).thenReturn(Optional.of(locked(Status.HIRED, 1, null)));
        when(repository.command(placementId, commandId)).thenReturn(Optional.of(Status.STARTED));
        when(repository.find(placementId)).thenReturn(Optional.of(found));

        Map<String, Object> result = service.transition(UUID.randomUUID(), placementId, commandId, false,
                transition(1, LocalDate.now(), null), request);

        assertThat(result).isEqualTo(found);
        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any());
    }

    @Test void startRejectsAReusedIdempotencyKeyForADifferentTransition() {
        UUID commandId = UUID.randomUUID();
        when(repository.lock(placementId)).thenReturn(Optional.of(locked(Status.HIRED, 1, null)));
        when(repository.command(placementId, commandId)).thenReturn(Optional.of(Status.COMPLETED));

        assertThatThrownBy(() -> service.transition(UUID.randomUUID(), placementId, commandId, false,
                transition(1, LocalDate.now(), null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("IDEMPOTENCY_KEY_REUSED");
    }

    @Test void startRejectsAPlacementThatIsNotHired() {
        when(repository.lock(placementId)).thenReturn(Optional.of(locked(Status.STARTED, 1, LocalDate.now())));
        when(repository.command(eq(placementId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(UUID.randomUUID(), placementId, UUID.randomUUID(), false,
                transition(1, LocalDate.now(), null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLACEMENT_STATE_CONFLICT");
    }

    @Test void startRejectsAStaleVersion() {
        when(repository.lock(placementId)).thenReturn(Optional.of(locked(Status.HIRED, 3, null)));
        when(repository.command(eq(placementId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(UUID.randomUUID(), placementId, UUID.randomUUID(), false,
                transition(2, LocalDate.now(), null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLACEMENT_VERSION_CONFLICT");
    }

    @Test void startRejectsAnEffectiveDateInTheFuture() {
        when(repository.lock(placementId)).thenReturn(Optional.of(locked(Status.HIRED, 1, null)));
        when(repository.command(eq(placementId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(UUID.randomUUID(), placementId, UUID.randomUUID(), false,
                transition(1, LocalDate.now().plusDays(1), null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLACEMENT_DATE_IN_FUTURE");
    }

    @Test void completeRejectsAnEffectiveDateBeforeTheActualStartDate() {
        LocalDate started = LocalDate.now().minusDays(30);
        when(repository.lock(placementId)).thenReturn(Optional.of(locked(Status.STARTED, 1, started)));
        when(repository.command(eq(placementId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(UUID.randomUUID(), placementId, UUID.randomUUID(), true,
                transition(1, started.minusDays(1), null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLACEMENT_DATE_ORDER_INVALID");
        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any());
    }

    private Locked locked(Status status, int version, LocalDate actualStartDate) {
        return new Locked(placementId, UUID.randomUUID(), status, version, actualStartDate, UUID.randomUUID(),
                "Nguyen Van A", "Thực tập sinh Backend", UUID.randomUUID(), "VNG Corporation");
    }

    private Transition transition(int expectedVersion, LocalDate effectiveDate, String note) {
        return new Transition(expectedVersion, effectiveDate, note);
    }
}

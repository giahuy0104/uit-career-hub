package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.WeeklyLogSaveRequest;
import vn.edu.uit.careerhub.entity.WeeklyLogContext;
import vn.edu.uit.careerhub.entity.WeeklyLogPlacementContext;
import vn.edu.uit.careerhub.enums.PlacementStatus;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.WeeklyLogAction;
import vn.edu.uit.careerhub.enums.WeeklyLogStatus;
import vn.edu.uit.careerhub.enums.WeeklyLogViewer;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.repository.WeeklyLogRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/**
 * Covers the weekly-log guard rules from the handoff doc section 4.7 (week sequencing, the
 * STARTED-only edit window, optimistic-lock versioning, submission completeness, and the
 * UIT-cannot-review restriction) using a mocked repository and the real WeeklyLogWorkflow (pure,
 * already covered by WeeklyLogWorkflowTest).
 */
@ExtendWith(MockitoExtension.class)
class WeeklyLogServiceTest {
    @Mock private WeeklyLogRepository repository;

    private WeeklyLogService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final UUID placementId = UUID.randomUUID();
    private final UUID studentProfileId = UUID.randomUUID();
    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), "student@student.uit.edu.vn", UserRole.STUDENT, UUID.randomUUID(), studentProfileId, null);

    @BeforeEach void wireService() {
        service = new WeeklyLogService(repository, new WeeklyLogWorkflow());
    }

    @Test void createRejectsWhenThePlacementHasNotStartedYet() {
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.HIRED, null)));

        assertThatThrownBy(() -> service.create(student, placementId, save(null, 1, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_PLACEMENT_NOT_STARTED");
    }

    @Test void createRejectsAnExpectedVersionOrAMissingWeekNumber() {
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));

        assertThatThrownBy(() -> service.create(student, placementId, save(1, 1, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_CREATE_INVALID");
        assertThatThrownBy(() -> service.create(student, placementId, save(null, null, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_CREATE_INVALID");
    }

    @Test void createRejectsAWeekNumberOutOfSequence() {
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.nextWeekNumber(placementId)).thenReturn(3);

        assertThatThrownBy(() -> service.create(student, placementId, save(null, 5, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_WEEK_SEQUENCE_CONFLICT");
        verify(repository, never()).create(any(), any(), anyInt(), any(), any(), any(), any(), any());
    }

    @Test void createRejectsAWeekThatHasNotStartedYet() {
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.nextWeekNumber(placementId)).thenReturn(10);

        assertThatThrownBy(() -> service.create(student, placementId, save(null, 10, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_WEEK_TOO_EARLY");
    }

    @Test void saveRejectsALogThatIsAlreadyConfirmedOrSubmitted() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.SUBMITTED, 1)));

        assertThatThrownBy(() -> service.save(student, placementId, logId, save(1, null, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT");
    }

    @Test void saveRejectsAStaleVersion() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.DRAFT, 4)));

        assertThatThrownBy(() -> service.save(student, placementId, logId, save(3, null, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_VERSION_CONFLICT");
    }

    @Test void saveRejectsChangingTheWeekNumberOfAnExistingLog() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.DRAFT, 2)));

        assertThatThrownBy(() -> service.save(student, placementId, logId, save(2, 9, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_WEEK_IMMUTABLE");
    }

    @Test void transitionIsIdempotentWhenTheSameCommandIsReplayed() {
        UUID logId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.SUBMITTED, 1)));
        when(repository.command(logId, commandId)).thenReturn(Optional.of(WeeklyLogAction.SUBMIT));
        when(repository.logs(placementId)).thenReturn(List.of());
        when(repository.nextWeekNumber(placementId)).thenReturn(2);

        service.transition(student, placementId, logId, commandId, WeeklyLogViewer.STUDENT, WeeklyLogAction.SUBMIT, 1, null, null, request);

        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void transitionRejectsAReusedIdempotencyKeyForADifferentAction() {
        UUID logId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.SUBMITTED, 1)));
        when(repository.command(logId, commandId)).thenReturn(Optional.of(WeeklyLogAction.CANCEL));

        assertThatThrownBy(() -> service.transition(student, placementId, logId, commandId, WeeklyLogViewer.STUDENT, WeeklyLogAction.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("IDEMPOTENCY_KEY_REUSED");
    }

    @Test void transitionRejectsAStaleVersion() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.DRAFT, 5)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, logId, UUID.randomUUID(), WeeklyLogViewer.STUDENT, WeeklyLogAction.SUBMIT, 4, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_VERSION_CONFLICT");
    }

    @Test void transitionRejectsUitActingAsAReviewer() {
        AuthPrincipal uit = new AuthPrincipal(UUID.randomUUID(), "admin.career@uit.edu.vn", UserRole.UIT_ADMIN, UUID.randomUUID(), null, null);
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.SUBMITTED, 1)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(uit, placementId, logId, UUID.randomUUID(), WeeklyLogViewer.UIT, WeeklyLogAction.COMPANY_CONFIRM, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_FORBIDDEN");
    }

    @Test void transitionRejectsAnIncompleteSubmission() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(new WeeklyLogContext(logId, placementId, 1,
                LocalDate.now(), LocalDate.now().plusDays(6), LocalDate.now().plusDays(8), WeeklyLogStatus.DRAFT, 1, 0, null, null, null, null)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, logId, UUID.randomUUID(), WeeklyLogViewer.STUDENT, WeeklyLogAction.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_INCOMPLETE");
    }

    @Test void transitionRejectsARevisionRequestWithATooShortNote() {
        UUID companyId = UUID.randomUUID();
        AuthPrincipal company = new AuthPrincipal(UUID.randomUUID(), "recruiter@vng.example", UserRole.COMPANY, UUID.randomUUID(), null, companyId);
        UUID logId = UUID.randomUUID();
        when(repository.placement(eq(placementId), any(Boolean.class))).thenReturn(Optional.of(
                new WeeklyLogPlacementContext(placementId, UUID.randomUUID(), PlacementStatus.STARTED, LocalDate.now(),
                        LocalDate.now(), studentProfileId, UUID.randomUUID(), "Nguyen Van A", "20521067",
                        companyId, "VNG Corporation", "Thực tập sinh Backend")));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.SUBMITTED, 1)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(company, placementId, logId, UUID.randomUUID(), WeeklyLogViewer.COMPANY,
                WeeklyLogAction.COMPANY_REQUEST_REVISION, 1, "content", "bad", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_REVISION_REASON_REQUIRED");
    }

    @Test void transitionPropagatesAnInvalidWorkflowMove() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementStatus.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, WeeklyLogStatus.DRAFT, 1)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, logId, UUID.randomUUID(), WeeklyLogViewer.STUDENT,
                WeeklyLogAction.COMPANY_CONFIRM, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT");
        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private WeeklyLogPlacementContext placement(PlacementStatus status, LocalDate actualStartDate) {
        return new WeeklyLogPlacementContext(placementId, UUID.randomUUID(), status, LocalDate.now(), actualStartDate,
                studentProfileId, UUID.randomUUID(), "Nguyen Van A", "20521067", UUID.randomUUID(), "VNG Corporation",
                "Thực tập sinh Backend");
    }

    private WeeklyLogContext log(UUID id, WeeklyLogStatus status, int version) {
        return new WeeklyLogContext(id, placementId, 1, LocalDate.now().minusDays(7), LocalDate.now().minusDays(1),
                LocalDate.now().plusDays(1), status, version, 0, "Tóm tắt công việc", "Kết quả đạt được", null, "Kế hoạch tuần sau");
    }

    private WeeklyLogSaveRequest save(Integer expectedVersion, Integer weekNumber, String workSummary, String outcomes, String difficulties, String nextPlan) {
        return new WeeklyLogSaveRequest(expectedVersion, weekNumber, workSummary, outcomes, difficulties, nextPlan);
    }
}

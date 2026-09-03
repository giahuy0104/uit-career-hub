package vn.edu.uit.careerhub.internships;

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

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Action;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.LogContext;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.PlacementContext;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Status;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Save;
import vn.edu.uit.careerhub.placements.PlacementModels;

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
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.HIRED, null)));

        assertThatThrownBy(() -> service.create(student, placementId, save(null, 1, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_PLACEMENT_NOT_STARTED");
    }

    @Test void createRejectsAnExpectedVersionOrAMissingWeekNumber() {
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));

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
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.nextWeekNumber(placementId)).thenReturn(3);

        assertThatThrownBy(() -> service.create(student, placementId, save(null, 5, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_WEEK_SEQUENCE_CONFLICT");
        verify(repository, never()).create(any(), any(), anyInt(), any(), any(), any(), any(), any());
    }

    @Test void createRejectsAWeekThatHasNotStartedYet() {
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.nextWeekNumber(placementId)).thenReturn(10);

        assertThatThrownBy(() -> service.create(student, placementId, save(null, 10, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_WEEK_TOO_EARLY");
    }

    @Test void saveRejectsALogThatIsAlreadyConfirmedOrSubmitted() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.SUBMITTED, 1)));

        assertThatThrownBy(() -> service.save(student, placementId, logId, save(1, null, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT");
    }

    @Test void saveRejectsAStaleVersion() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.DRAFT, 4)));

        assertThatThrownBy(() -> service.save(student, placementId, logId, save(3, null, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_VERSION_CONFLICT");
    }

    @Test void saveRejectsChangingTheWeekNumberOfAnExistingLog() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.DRAFT, 2)));

        assertThatThrownBy(() -> service.save(student, placementId, logId, save(2, 9, "a", "b", null, "c"), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_WEEK_IMMUTABLE");
    }

    @Test void transitionIsIdempotentWhenTheSameCommandIsReplayed() {
        UUID logId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.SUBMITTED, 1)));
        when(repository.command(logId, commandId)).thenReturn(Optional.of(Action.SUBMIT));
        when(repository.logs(placementId)).thenReturn(List.of());
        when(repository.nextWeekNumber(placementId)).thenReturn(2);

        service.transition(student, placementId, logId, commandId, WeeklyLogService.Viewer.STUDENT, Action.SUBMIT, 1, null, null, request);

        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void transitionRejectsAReusedIdempotencyKeyForADifferentAction() {
        UUID logId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.SUBMITTED, 1)));
        when(repository.command(logId, commandId)).thenReturn(Optional.of(Action.CANCEL));

        assertThatThrownBy(() -> service.transition(student, placementId, logId, commandId, WeeklyLogService.Viewer.STUDENT, Action.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("IDEMPOTENCY_KEY_REUSED");
    }

    @Test void transitionRejectsAStaleVersion() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.DRAFT, 5)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, logId, UUID.randomUUID(), WeeklyLogService.Viewer.STUDENT, Action.SUBMIT, 4, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_VERSION_CONFLICT");
    }

    @Test void transitionRejectsUitActingAsAReviewer() {
        AuthPrincipal uit = new AuthPrincipal(UUID.randomUUID(), "admin.career@uit.edu.vn", UserRole.UIT_ADMIN, UUID.randomUUID(), null, null);
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.SUBMITTED, 1)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(uit, placementId, logId, UUID.randomUUID(), WeeklyLogService.Viewer.UIT, Action.COMPANY_CONFIRM, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("AUTH_FORBIDDEN");
    }

    @Test void transitionRejectsAnIncompleteSubmission() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(new LogContext(logId, placementId, 1,
                LocalDate.now(), LocalDate.now().plusDays(6), LocalDate.now().plusDays(8), Status.DRAFT, 1, 0, null, null, null, null)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, logId, UUID.randomUUID(), WeeklyLogService.Viewer.STUDENT, Action.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_INCOMPLETE");
    }

    @Test void transitionRejectsARevisionRequestWithATooShortNote() {
        UUID companyId = UUID.randomUUID();
        AuthPrincipal company = new AuthPrincipal(UUID.randomUUID(), "recruiter@vng.example", UserRole.COMPANY, UUID.randomUUID(), null, companyId);
        UUID logId = UUID.randomUUID();
        when(repository.placement(eq(placementId), any(Boolean.class))).thenReturn(Optional.of(
                new PlacementContext(placementId, UUID.randomUUID(), PlacementModels.Status.STARTED, LocalDate.now(),
                        LocalDate.now(), studentProfileId, UUID.randomUUID(), "Nguyen Van A", "20521067",
                        companyId, "VNG Corporation", "Thực tập sinh Backend")));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.SUBMITTED, 1)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(company, placementId, logId, UUID.randomUUID(), WeeklyLogService.Viewer.COMPANY,
                Action.COMPANY_REQUEST_REVISION, 1, "content", "bad", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_REVISION_REASON_REQUIRED");
    }

    @Test void transitionPropagatesAnInvalidWorkflowMove() {
        UUID logId = UUID.randomUUID();
        when(repository.placement(placementId, true)).thenReturn(Optional.of(placement(PlacementModels.Status.STARTED, LocalDate.now())));
        when(repository.lockLog(placementId, logId)).thenReturn(Optional.of(log(logId, Status.DRAFT, 1)));
        when(repository.command(eq(logId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, logId, UUID.randomUUID(), WeeklyLogService.Viewer.STUDENT,
                Action.COMPANY_CONFIRM, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT");
        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private PlacementContext placement(PlacementModels.Status status, LocalDate actualStartDate) {
        return new PlacementContext(placementId, UUID.randomUUID(), status, LocalDate.now(), actualStartDate,
                studentProfileId, UUID.randomUUID(), "Nguyen Van A", "20521067", UUID.randomUUID(), "VNG Corporation",
                "Thực tập sinh Backend");
    }

    private LogContext log(UUID id, Status status, int version) {
        return new LogContext(id, placementId, 1, LocalDate.now().minusDays(7), LocalDate.now().minusDays(1),
                LocalDate.now().plusDays(1), status, version, 0, "Tóm tắt công việc", "Kết quả đạt được", null, "Kế hoạch tuần sau");
    }

    private Save save(Integer expectedVersion, Integer weekNumber, String workSummary, String outcomes, String difficulties, String nextPlan) {
        return new Save(expectedVersion, weekNumber, workSummary, outcomes, difficulties, nextPlan);
    }
}

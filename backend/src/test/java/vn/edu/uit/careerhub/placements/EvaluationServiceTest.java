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

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.placements.PlacementModels.Context;
import vn.edu.uit.careerhub.placements.PlacementModels.EvaluationRole;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;
import vn.edu.uit.careerhub.placements.PlacementRequests.Evaluation;

/**
 * Covers the end-of-internship evaluation rules from the handoff doc section 4.8: only
 * available once the placement is COMPLETED, one immutable submission per role, and ownership
 * scoping between student and company.
 */
@ExtendWith(MockitoExtension.class)
class EvaluationServiceTest {
    @Mock private EvaluationRepository repository;

    private EvaluationService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final UUID applicationId = UUID.randomUUID();
    private final UUID studentProfileId = UUID.randomUUID();
    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), "student@student.uit.edu.vn", UserRole.STUDENT, UUID.randomUUID(), studentProfileId, null);

    @BeforeEach void wireService() {
        service = new EvaluationService(repository);
    }

    @Test void getRejectsWhenTheStudentDoesNotOwnThePlacement() {
        when(repository.context(applicationId, false)).thenReturn(Optional.of(context(Status.COMPLETED, UUID.randomUUID(), null)));

        assertThatThrownBy(() -> service.get(student, applicationId, EvaluationRole.STUDENT))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLACEMENT_NOT_FOUND");
    }

    @Test void submitIsIdempotentWhenTheSameCommandIsReplayed() {
        UUID commandId = UUID.randomUUID();
        UUID placementId = UUID.randomUUID();
        Context context = context(Status.COMPLETED, studentProfileId, placementId);
        Map<String, Object> view = Map.of("respondentRole", "STUDENT");
        when(repository.context(applicationId, true)).thenReturn(Optional.of(context));
        when(repository.byCommand(placementId, commandId)).thenReturn(Optional.of(view));
        when(repository.view(context, EvaluationRole.STUDENT)).thenReturn(view);

        Map<String, Object> result = service.submit(student, applicationId, commandId, EvaluationRole.STUDENT, evaluation(), request);

        assertThat(result).isEqualTo(view);
        verify(repository, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @Test void submitRejectsAReusedIdempotencyKeyForTheOtherRole() {
        UUID commandId = UUID.randomUUID();
        UUID placementId = UUID.randomUUID();
        Context context = context(Status.COMPLETED, studentProfileId, placementId);
        when(repository.context(applicationId, true)).thenReturn(Optional.of(context));
        when(repository.byCommand(placementId, commandId)).thenReturn(Optional.of(Map.of("respondentRole", "COMPANY")));

        assertThatThrownBy(() -> service.submit(student, applicationId, commandId, EvaluationRole.STUDENT, evaluation(), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("IDEMPOTENCY_KEY_REUSED");
    }

    @Test void submitRejectsWhenThePlacementIsNotYetCompleted() {
        UUID placementId = UUID.randomUUID();
        Context context = context(Status.STARTED, studentProfileId, placementId);
        when(repository.context(applicationId, true)).thenReturn(Optional.of(context));
        when(repository.byCommand(eq(placementId), any())).thenReturn(Optional.empty());
        when(repository.view(context, EvaluationRole.STUDENT)).thenReturn(Map.of("canSubmit", false));

        assertThatThrownBy(() -> service.submit(student, applicationId, UUID.randomUUID(), EvaluationRole.STUDENT, evaluation(), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_EVALUATION_NOT_AVAILABLE");
    }

    @Test void submitRejectsASecondSubmissionForTheSameRole() {
        UUID placementId = UUID.randomUUID();
        Context context = context(Status.COMPLETED, studentProfileId, placementId);
        when(repository.context(applicationId, true)).thenReturn(Optional.of(context));
        when(repository.byCommand(eq(placementId), any())).thenReturn(Optional.empty());
        when(repository.view(context, EvaluationRole.STUDENT)).thenReturn(Map.of("canSubmit", false));

        assertThatThrownBy(() -> service.submit(student, applicationId, UUID.randomUUID(), EvaluationRole.STUDENT, evaluation(), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_EVALUATION_ALREADY_SUBMITTED");
    }

    @Test void submitInsertsAndReturnsTheUpdatedViewWhenAllowed() {
        UUID commandId = UUID.randomUUID();
        UUID placementId = UUID.randomUUID();
        Context context = context(Status.COMPLETED, studentProfileId, placementId);
        Map<String, Object> before = Map.of("canSubmit", true);
        Map<String, Object> after = Map.of("canSubmit", false, "respondentRole", "STUDENT");
        when(repository.context(applicationId, true)).thenReturn(Optional.of(context));
        when(repository.byCommand(placementId, commandId)).thenReturn(Optional.empty());
        when(repository.view(context, EvaluationRole.STUDENT)).thenReturn(before, after);

        Map<String, Object> result = service.submit(student, applicationId, commandId, EvaluationRole.STUDENT, evaluation(), request);

        assertThat(result).isEqualTo(after);
        verify(repository).insert(context, EvaluationRole.STUDENT, student.userId(), commandId, evaluation(), request);
    }

    private Context context(Status status, UUID owningStudentProfileId, UUID placementId) {
        return new Context(placementId == null ? UUID.randomUUID() : placementId, applicationId, status,
                LocalDate.now().minusDays(90), LocalDate.now().minusDays(90), status == Status.COMPLETED ? LocalDate.now() : null,
                owningStudentProfileId, UUID.randomUUID(), "Nguyen Van A", UUID.randomUUID(), "VNG Corporation", "Thực tập sinh Backend");
    }

    private Evaluation evaluation() {
        return new Evaluation(5, 5, 5, 5, true, "Sinh viên chủ động và hoàn thành tốt nhiệm vụ được giao.", null);
    }
}

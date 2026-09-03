package vn.edu.uit.careerhub.internships;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.LinkedHashMap;
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
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Action;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.ActorType;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Context;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Status;
import vn.edu.uit.careerhub.internships.InternshipPlanRequests.SaveDraft;
import vn.edu.uit.careerhub.placements.PlacementModels;

/**
 * Covers the internship-plan guard rules from the handoff doc section 4.6
 * (draft editability, optimistic-lock versioning, submission completeness, revision-reason
 * requirement) using a mocked repository and the real InternshipPlanWorkflow (pure, already
 * covered by InternshipPlanWorkflowTest).
 */
@ExtendWith(MockitoExtension.class)
class InternshipPlanServiceTest {
    @Mock private InternshipPlanRepository repository;

    private InternshipPlanService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final UUID placementId = UUID.randomUUID();
    private final UUID studentProfileId = UUID.randomUUID();
    private final UUID companyId = UUID.randomUUID();
    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), "student@student.uit.edu.vn", UserRole.STUDENT, UUID.randomUUID(), studentProfileId, null);

    @BeforeEach void wireService() {
        service = new InternshipPlanService(repository, new InternshipPlanWorkflow());
    }

    @Test void saveRejectsWhenThePlacementIsAlreadyCompleted() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.COMPLETED, null, null, null, false, null, null)));

        assertThatThrownBy(() -> service.save(student, placementId, draft(null, LocalDate.now(), LocalDate.now().plusDays(60)), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_PLACEMENT_COMPLETED");
    }

    @Test void saveRejectsAnEndDateBeforeTheStartDate() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, null, null, null, false, null, null)));

        LocalDate start = LocalDate.now();
        assertThatThrownBy(() -> service.save(student, placementId, draft(null, start, start.minusDays(1)), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_DATE_ORDER_INVALID");
    }

    @Test void saveRejectsAnExpectedVersionOnTheFirstDraft() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, null, null, null, false, null, null)));

        assertThatThrownBy(() -> service.save(student, placementId, draft(1, LocalDate.now(), LocalDate.now().plusDays(60)), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_VERSION_CONFLICT");
        verify(repository, never()).create(any(), any(), any(), any());
    }

    @Test void saveRejectsEditingAPlanThatIsUnderReview() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, UUID.randomUUID(), Status.PENDING_UIT_REVIEW, 2, false, null, null)));

        assertThatThrownBy(() -> service.save(student, placementId, draft(2, LocalDate.now(), LocalDate.now().plusDays(60)), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_STATE_CONFLICT");
    }

    @Test void saveRejectsAStaleVersionOnUpdate() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, UUID.randomUUID(), Status.DRAFT, 3, false, null, null)));

        assertThatThrownBy(() -> service.save(student, placementId, draft(2, LocalDate.now(), LocalDate.now().plusDays(60)), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_VERSION_CONFLICT");
        verify(repository, never()).update(any(), any(), any(), any());
    }

    @Test void transitionRejectsWhenTheStudentDoesNotOwnThePlacement() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, null, null, null, false, UUID.randomUUID(), null)));

        assertThatThrownBy(() -> service.transition(student, placementId, UUID.randomUUID(), ActorType.STUDENT,
                Action.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLACEMENT_NOT_FOUND");
    }

    @Test void transitionRejectsWhenNoPlanHasBeenCreatedYet() {
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, null, null, null, false, null, null)));

        assertThatThrownBy(() -> service.transition(student, placementId, UUID.randomUUID(), ActorType.STUDENT,
                Action.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_NOT_FOUND");
    }

    @Test void transitionIsIdempotentWhenTheSameCommandIsReplayed() {
        UUID planId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.context(eq(placementId), anyBoolean())).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, planId, Status.PENDING_COMPANY_REVIEW, 1, true, null, null)));
        when(repository.command(planId, commandId)).thenReturn(Optional.of(Action.SUBMIT));
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("placement", Map.of("status", "STARTED"));
        view.put("plan", Map.of("status", "PENDING_COMPANY_REVIEW"));
        when(repository.find(placementId)).thenReturn(Optional.of(view));

        Map<String, Object> result = service.transition(student, placementId, commandId, ActorType.STUDENT, Action.SUBMIT, 1, null, null, request);

        assertThat(result).containsKey("availableActions");
        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void transitionRejectsAReusedIdempotencyKeyForADifferentAction() {
        UUID planId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, planId, Status.PENDING_COMPANY_REVIEW, 1, true, null, null)));
        when(repository.command(planId, commandId)).thenReturn(Optional.of(Action.CANCEL));

        assertThatThrownBy(() -> service.transition(student, placementId, commandId, ActorType.STUDENT, Action.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("IDEMPOTENCY_KEY_REUSED");
    }

    @Test void transitionRejectsAStaleVersion() {
        UUID planId = UUID.randomUUID();
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, planId, Status.DRAFT, 5, true, null, null)));
        when(repository.command(eq(planId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, UUID.randomUUID(), ActorType.STUDENT, Action.SUBMIT, 4, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_VERSION_CONFLICT");
    }

    @Test void transitionRejectsAnIncompleteSubmission() {
        UUID planId = UUID.randomUUID();
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, planId, Status.DRAFT, 1, false, null, null)));
        when(repository.command(eq(planId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, UUID.randomUUID(), ActorType.STUDENT, Action.SUBMIT, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_INCOMPLETE");
    }

    @Test void transitionRejectsARevisionRequestWithoutAReason() {
        UUID planId = UUID.randomUUID();
        AuthPrincipal company = new AuthPrincipal(UUID.randomUUID(), "recruiter@vng.example", UserRole.COMPANY, UUID.randomUUID(), null, companyId);
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, planId, Status.PENDING_COMPANY_REVIEW, 1, true, null, companyId)));
        when(repository.command(eq(planId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(company, placementId, UUID.randomUUID(), ActorType.COMPANY,
                Action.COMPANY_REQUEST_REVISION, 1, "scope", "bad", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_REVISION_REASON_REQUIRED");
    }

    @Test void transitionPropagatesAnInvalidWorkflowMove() {
        UUID planId = UUID.randomUUID();
        when(repository.context(placementId, true)).thenReturn(Optional.of(
                context(PlacementModels.Status.STARTED, planId, Status.DRAFT, 1, true, null, null)));
        when(repository.command(eq(planId), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(student, placementId, UUID.randomUUID(), ActorType.STUDENT,
                Action.UIT_APPROVE, 1, null, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_STATE_CONFLICT");
        verify(repository, never()).transition(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private Context context(PlacementModels.Status placementStatus, UUID planId, Status planStatus, Integer planVersion,
            boolean complete, UUID studentProfileIdOverride, UUID companyIdOverride) {
        return new Context(placementId, UUID.randomUUID(), placementStatus,
                studentProfileIdOverride != null ? studentProfileIdOverride : studentProfileId, UUID.randomUUID(), "Nguyen Van A",
                companyIdOverride != null ? companyIdOverride : companyId, "VNG Corporation", "Thực tập sinh Backend",
                planId, planStatus, planVersion, 0,
                complete ? "Kế hoạch thực tập" : null, complete ? "Phòng CNTT" : null, complete ? "Người hướng dẫn" : null,
                complete ? "mentor@company.example" : null, complete ? "Mục tiêu" : null,
                complete ? "Công việc dự kiến" : null, complete ? "Kỹ năng dự kiến" : null,
                complete ? LocalDate.now() : null, complete ? LocalDate.now().plusDays(60) : null);
    }

    private SaveDraft draft(Integer expectedVersion, LocalDate start, LocalDate end) {
        return new SaveDraft(expectedVersion, "Kế hoạch", "Phòng CNTT", "Người hướng dẫn", "mentor@company.example",
                "Mục tiêu", "Công việc dự kiến", "Kỹ năng dự kiến", start, end);
    }
}

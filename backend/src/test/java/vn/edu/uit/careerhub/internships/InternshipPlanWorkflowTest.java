package vn.edu.uit.careerhub.internships;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Action;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.ActorType;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Status;

class InternshipPlanWorkflowTest {
    private final InternshipPlanWorkflow workflow = new InternshipPlanWorkflow();

    @Test
    void studentSubmissionRoutesToTheCorrectReviewer() {
        assertThat(workflow.next(Status.DRAFT, Action.SUBMIT, ActorType.STUDENT))
                .isEqualTo(Status.PENDING_COMPANY_REVIEW);
        assertThat(workflow.next(Status.COMPANY_REVISION_REQUIRED, Action.SUBMIT, ActorType.STUDENT))
                .isEqualTo(Status.PENDING_COMPANY_REVIEW);
        assertThat(workflow.next(Status.UIT_REVISION_REQUIRED, Action.SUBMIT, ActorType.STUDENT))
                .isEqualTo(Status.PENDING_UIT_REVIEW);
    }

    @Test
    void companyCanConfirmOrRequestRevisionOnlyFromItsQueue() {
        assertThat(workflow.next(Status.PENDING_COMPANY_REVIEW, Action.COMPANY_CONFIRM, ActorType.COMPANY))
                .isEqualTo(Status.PENDING_UIT_REVIEW);
        assertThat(workflow.next(Status.PENDING_COMPANY_REVIEW, Action.COMPANY_REQUEST_REVISION, ActorType.COMPANY))
                .isEqualTo(Status.COMPANY_REVISION_REQUIRED);
    }

    @Test
    void uitCanApproveOrRequestRevisionOnlyFromItsQueue() {
        assertThat(workflow.next(Status.PENDING_UIT_REVIEW, Action.UIT_APPROVE, ActorType.UIT_ADMIN))
                .isEqualTo(Status.APPROVED);
        assertThat(workflow.next(Status.PENDING_UIT_REVIEW, Action.UIT_REQUEST_REVISION, ActorType.UIT_ADMIN))
                .isEqualTo(Status.UIT_REVISION_REQUIRED);
    }

    @Test
    void invalidRoleOrStateIsRejected() {
        assertThatThrownBy(() -> workflow.next(Status.DRAFT, Action.UIT_APPROVE, ActorType.UIT_ADMIN))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_STATE_CONFLICT");
        assertThatThrownBy(() -> workflow.next(Status.PENDING_COMPANY_REVIEW, Action.COMPANY_CONFIRM,
                ActorType.STUDENT)).isInstanceOf(AppException.class);
    }
}

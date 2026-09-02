package vn.edu.uit.careerhub.internships;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Action;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.ActorType;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Status;

class WeeklyLogWorkflowTest {
    private final WeeklyLogWorkflow workflow = new WeeklyLogWorkflow();

    @Test
    void studentCanSubmitDraftOrRevisedLog() {
        assertThat(workflow.next(Status.DRAFT, Action.SUBMIT, ActorType.STUDENT))
                .isEqualTo(Status.SUBMITTED);
        assertThat(workflow.next(Status.COMPANY_REVISION_REQUIRED, Action.SUBMIT, ActorType.STUDENT))
                .isEqualTo(Status.SUBMITTED);
    }

    @Test
    void companyCanConfirmOrRequestRevisionFromSubmittedLog() {
        assertThat(workflow.next(Status.SUBMITTED, Action.COMPANY_CONFIRM, ActorType.COMPANY))
                .isEqualTo(Status.COMPANY_CONFIRMED);
        assertThat(workflow.next(Status.SUBMITTED, Action.COMPANY_REQUEST_REVISION, ActorType.COMPANY))
                .isEqualTo(Status.COMPANY_REVISION_REQUIRED);
    }

    @Test
    void invalidRoleOrStateIsRejected() {
        assertThatThrownBy(() -> workflow.next(Status.DRAFT, Action.COMPANY_CONFIRM, ActorType.COMPANY))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT");
        assertThatThrownBy(() -> workflow.next(Status.SUBMITTED, Action.COMPANY_CONFIRM, ActorType.STUDENT))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> workflow.next(Status.COMPANY_CONFIRMED, Action.SUBMIT, ActorType.STUDENT))
                .isInstanceOf(AppException.class);
    }
}

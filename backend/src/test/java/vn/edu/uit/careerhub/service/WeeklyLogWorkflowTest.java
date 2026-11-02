package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.enums.WeeklyLogAction;
import vn.edu.uit.careerhub.enums.WeeklyLogActorType;
import vn.edu.uit.careerhub.enums.WeeklyLogStatus;
import vn.edu.uit.careerhub.exception.AppException;

class WeeklyLogWorkflowTest {
    private final WeeklyLogWorkflow workflow = new WeeklyLogWorkflow();

    @Test
    void studentCanSubmitDraftOrRevisedLog() {
        assertThat(workflow.next(WeeklyLogStatus.DRAFT, WeeklyLogAction.SUBMIT, WeeklyLogActorType.STUDENT))
                .isEqualTo(WeeklyLogStatus.SUBMITTED);
        assertThat(workflow.next(WeeklyLogStatus.COMPANY_REVISION_REQUIRED, WeeklyLogAction.SUBMIT, WeeklyLogActorType.STUDENT))
                .isEqualTo(WeeklyLogStatus.SUBMITTED);
    }

    @Test
    void companyCanConfirmOrRequestRevisionFromSubmittedLog() {
        assertThat(workflow.next(WeeklyLogStatus.SUBMITTED, WeeklyLogAction.COMPANY_CONFIRM, WeeklyLogActorType.COMPANY))
                .isEqualTo(WeeklyLogStatus.COMPANY_CONFIRMED);
        assertThat(workflow.next(WeeklyLogStatus.SUBMITTED, WeeklyLogAction.COMPANY_REQUEST_REVISION, WeeklyLogActorType.COMPANY))
                .isEqualTo(WeeklyLogStatus.COMPANY_REVISION_REQUIRED);
    }

    @Test
    void invalidRoleOrStateIsRejected() {
        assertThatThrownBy(() -> workflow.next(WeeklyLogStatus.DRAFT, WeeklyLogAction.COMPANY_CONFIRM, WeeklyLogActorType.COMPANY))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT");
        assertThatThrownBy(() -> workflow.next(WeeklyLogStatus.SUBMITTED, WeeklyLogAction.COMPANY_CONFIRM, WeeklyLogActorType.STUDENT))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> workflow.next(WeeklyLogStatus.COMPANY_CONFIRMED, WeeklyLogAction.SUBMIT, WeeklyLogActorType.STUDENT))
                .isInstanceOf(AppException.class);
    }
}

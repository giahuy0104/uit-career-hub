package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.enums.InternshipPlanAction;
import vn.edu.uit.careerhub.enums.InternshipPlanActorType;
import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.exception.AppException;

class InternshipPlanWorkflowTest {
    private final InternshipPlanWorkflow workflow = new InternshipPlanWorkflow();

    @Test
    void studentSubmissionRoutesToTheCorrectReviewer() {
        assertThat(workflow.next(InternshipPlanStatus.DRAFT, InternshipPlanAction.SUBMIT, InternshipPlanActorType.STUDENT))
                .isEqualTo(InternshipPlanStatus.PENDING_COMPANY_REVIEW);
        assertThat(workflow.next(InternshipPlanStatus.COMPANY_REVISION_REQUIRED, InternshipPlanAction.SUBMIT, InternshipPlanActorType.STUDENT))
                .isEqualTo(InternshipPlanStatus.PENDING_COMPANY_REVIEW);
        assertThat(workflow.next(InternshipPlanStatus.UIT_REVISION_REQUIRED, InternshipPlanAction.SUBMIT, InternshipPlanActorType.STUDENT))
                .isEqualTo(InternshipPlanStatus.PENDING_UIT_REVIEW);
    }

    @Test
    void companyCanConfirmOrRequestRevisionOnlyFromItsQueue() {
        assertThat(workflow.next(InternshipPlanStatus.PENDING_COMPANY_REVIEW, InternshipPlanAction.COMPANY_CONFIRM, InternshipPlanActorType.COMPANY))
                .isEqualTo(InternshipPlanStatus.PENDING_UIT_REVIEW);
        assertThat(workflow.next(InternshipPlanStatus.PENDING_COMPANY_REVIEW, InternshipPlanAction.COMPANY_REQUEST_REVISION, InternshipPlanActorType.COMPANY))
                .isEqualTo(InternshipPlanStatus.COMPANY_REVISION_REQUIRED);
    }

    @Test
    void uitCanApproveOrRequestRevisionOnlyFromItsQueue() {
        assertThat(workflow.next(InternshipPlanStatus.PENDING_UIT_REVIEW, InternshipPlanAction.UIT_APPROVE, InternshipPlanActorType.UIT_ADMIN))
                .isEqualTo(InternshipPlanStatus.APPROVED);
        assertThat(workflow.next(InternshipPlanStatus.PENDING_UIT_REVIEW, InternshipPlanAction.UIT_REQUEST_REVISION, InternshipPlanActorType.UIT_ADMIN))
                .isEqualTo(InternshipPlanStatus.UIT_REVISION_REQUIRED);
    }

    @Test
    void invalidRoleOrStateIsRejected() {
        assertThatThrownBy(() -> workflow.next(InternshipPlanStatus.DRAFT, InternshipPlanAction.UIT_APPROVE, InternshipPlanActorType.UIT_ADMIN))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERNSHIP_PLAN_STATE_CONFLICT");
        assertThatThrownBy(() -> workflow.next(InternshipPlanStatus.PENDING_COMPANY_REVIEW, InternshipPlanAction.COMPANY_CONFIRM,
                InternshipPlanActorType.STUDENT)).isInstanceOf(AppException.class);
    }
}

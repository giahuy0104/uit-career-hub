package vn.edu.uit.careerhub.service;

import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.enums.InternshipPlanAction;
import vn.edu.uit.careerhub.enums.InternshipPlanActorType;
import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;

@Component
public class InternshipPlanWorkflow {
    public InternshipPlanStatus next(InternshipPlanStatus current, InternshipPlanAction action, InternshipPlanActorType actor) {
        InternshipPlanStatus next = switch (action) {
            case SUBMIT -> actor != InternshipPlanActorType.STUDENT ? null : switch (current) {
                case DRAFT, COMPANY_REVISION_REQUIRED -> InternshipPlanStatus.PENDING_COMPANY_REVIEW;
                case UIT_REVISION_REQUIRED -> InternshipPlanStatus.PENDING_UIT_REVIEW;
                default -> null;
            };
            case COMPANY_CONFIRM -> actor == InternshipPlanActorType.COMPANY && current == InternshipPlanStatus.PENDING_COMPANY_REVIEW
                    ? InternshipPlanStatus.PENDING_UIT_REVIEW : null;
            case COMPANY_REQUEST_REVISION -> actor == InternshipPlanActorType.COMPANY && current == InternshipPlanStatus.PENDING_COMPANY_REVIEW
                    ? InternshipPlanStatus.COMPANY_REVISION_REQUIRED : null;
            case UIT_APPROVE -> actor == InternshipPlanActorType.UIT_ADMIN && current == InternshipPlanStatus.PENDING_UIT_REVIEW
                    ? InternshipPlanStatus.APPROVED : null;
            case UIT_REQUEST_REVISION -> actor == InternshipPlanActorType.UIT_ADMIN && current == InternshipPlanStatus.PENDING_UIT_REVIEW
                    ? InternshipPlanStatus.UIT_REVISION_REQUIRED : null;
            case CANCEL -> null;
        };
        if (next == null) {
            throw new AppException(ErrorType.CONFLICT, "INTERNSHIP_PLAN_STATE_CONFLICT",
                    "Trạng thái kế hoạch đã thay đổi hoặc không cho phép thao tác này.");
        }
        return next;
    }
}

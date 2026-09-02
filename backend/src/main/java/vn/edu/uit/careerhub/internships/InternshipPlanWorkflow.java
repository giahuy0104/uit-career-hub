package vn.edu.uit.careerhub.internships;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Action;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.ActorType;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Status;

@Component
public class InternshipPlanWorkflow {
    public Status next(Status current, Action action, ActorType actor) {
        Status next = switch (action) {
            case SUBMIT -> actor != ActorType.STUDENT ? null : switch (current) {
                case DRAFT, COMPANY_REVISION_REQUIRED -> Status.PENDING_COMPANY_REVIEW;
                case UIT_REVISION_REQUIRED -> Status.PENDING_UIT_REVIEW;
                default -> null;
            };
            case COMPANY_CONFIRM -> actor == ActorType.COMPANY && current == Status.PENDING_COMPANY_REVIEW
                    ? Status.PENDING_UIT_REVIEW : null;
            case COMPANY_REQUEST_REVISION -> actor == ActorType.COMPANY && current == Status.PENDING_COMPANY_REVIEW
                    ? Status.COMPANY_REVISION_REQUIRED : null;
            case UIT_APPROVE -> actor == ActorType.UIT_ADMIN && current == Status.PENDING_UIT_REVIEW
                    ? Status.APPROVED : null;
            case UIT_REQUEST_REVISION -> actor == ActorType.UIT_ADMIN && current == Status.PENDING_UIT_REVIEW
                    ? Status.UIT_REVISION_REQUIRED : null;
            case CANCEL -> null;
        };
        if (next == null) {
            throw new AppException(HttpStatus.CONFLICT, "INTERNSHIP_PLAN_STATE_CONFLICT",
                    "Trạng thái kế hoạch đã thay đổi hoặc không cho phép thao tác này.");
        }
        return next;
    }
}

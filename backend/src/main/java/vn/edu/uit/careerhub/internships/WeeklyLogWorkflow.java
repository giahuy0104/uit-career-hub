package vn.edu.uit.careerhub.internships;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Action;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.ActorType;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Status;

@Component
public class WeeklyLogWorkflow {
    public Status next(Status current, Action action, ActorType actor) {
        Status next = switch (action) {
            case SUBMIT -> actor == ActorType.STUDENT
                    && (current == Status.DRAFT || current == Status.COMPANY_REVISION_REQUIRED)
                    ? Status.SUBMITTED : null;
            case COMPANY_CONFIRM -> actor == ActorType.COMPANY && current == Status.SUBMITTED
                    ? Status.COMPANY_CONFIRMED : null;
            case COMPANY_REQUEST_REVISION -> actor == ActorType.COMPANY && current == Status.SUBMITTED
                    ? Status.COMPANY_REVISION_REQUIRED : null;
            case CANCEL -> null;
        };
        if (next == null) {
            throw new AppException(HttpStatus.CONFLICT, "INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT",
                    "Trạng thái nhật ký đã thay đổi hoặc không cho phép thao tác này.");
        }
        return next;
    }
}

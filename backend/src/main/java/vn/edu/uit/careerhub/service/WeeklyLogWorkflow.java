package vn.edu.uit.careerhub.service;

import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.enums.WeeklyLogAction;
import vn.edu.uit.careerhub.enums.WeeklyLogActorType;
import vn.edu.uit.careerhub.enums.WeeklyLogStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;

@Component
public class WeeklyLogWorkflow {
    public WeeklyLogStatus next(WeeklyLogStatus current, WeeklyLogAction action, WeeklyLogActorType actor) {
        WeeklyLogStatus next = switch (action) {
            case SUBMIT -> actor == WeeklyLogActorType.STUDENT
                    && (current == WeeklyLogStatus.DRAFT || current == WeeklyLogStatus.COMPANY_REVISION_REQUIRED)
                    ? WeeklyLogStatus.SUBMITTED : null;
            case COMPANY_CONFIRM -> actor == WeeklyLogActorType.COMPANY && current == WeeklyLogStatus.SUBMITTED
                    ? WeeklyLogStatus.COMPANY_CONFIRMED : null;
            case COMPANY_REQUEST_REVISION -> actor == WeeklyLogActorType.COMPANY && current == WeeklyLogStatus.SUBMITTED
                    ? WeeklyLogStatus.COMPANY_REVISION_REQUIRED : null;
            case CANCEL -> null;
        };
        if (next == null) {
            throw new AppException(ErrorType.CONFLICT, "INTERNSHIP_WEEKLY_LOG_STATE_CONFLICT",
                    "Trạng thái nhật ký đã thay đổi hoặc không cho phép thao tác này.");
        }
        return next;
    }
}

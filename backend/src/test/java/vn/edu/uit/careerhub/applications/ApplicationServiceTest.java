package vn.edu.uit.careerhub.applications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import vn.edu.uit.careerhub.applications.ApplicationModels.InterviewMode;
import vn.edu.uit.careerhub.applications.ApplicationModels.ResultOutcome;
import vn.edu.uit.careerhub.applications.ApplicationRequests.DocumentReview;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Interview;
import vn.edu.uit.careerhub.applications.ApplicationRequests.RecruitmentResult;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.storage.ObjectStorage;

/**
 * ApplicationService (docs/domain/application-state-machine.md) drives most of its state
 * machine directly against JdbcClient SQL inside the service methods, which cannot be
 * meaningfully unit-tested without a real database (see the integration-test note in
 * CLAUDE.md/handoff). This class covers only the input-validation guards that run before any
 * repository access — recording an interview result, requesting document review, and scheduling
 * an interview — using a no-op repository since those branches never reach it.
 */
class ApplicationServiceTest {
    @SuppressWarnings("unchecked")
    private final ApplicationService service = new ApplicationService(null, mock(ObjectProvider.class), null, null);
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final AuthPrincipal recruiter = new AuthPrincipal(UUID.randomUUID(), "recruiter@vng.example", UserRole.COMPANY, UUID.randomUUID(), null, UUID.randomUUID());

    @Test void acceptsAPdfHeaderAfterLeadingWhitespace() {
        assertThat(ApplicationService.hasPdfHeader("\n%PDF-1.7\n".getBytes())).isTrue();
    }

    @Test void rejectsContentWithoutAPdfHeader() {
        assertThat(ApplicationService.hasPdfHeader("not really a pdf".getBytes())).isFalse();
    }

    @Test void recordResultRequiresAStartDateWhenPassing() {
        RecruitmentResult input = new RecruitmentResult(ResultOutcome.PASS, null, null, null, null, null);
        assertThatThrownBy(() -> service.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void recordResultRejectsAStartDateInThePast() {
        RecruitmentResult input = new RecruitmentResult(ResultOutcome.PASS, LocalDate.now().minusDays(1), null, null, null, null);
        assertThatThrownBy(() -> service.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("OFFER_START_DATE_INVALID");
    }

    @Test void recordResultRequiresAReasonAndNoteWhenFailing() {
        RecruitmentResult missingReason = new RecruitmentResult(ResultOutcome.FAIL, null, null, null, null, "Không đạt yêu cầu kỹ thuật.");
        assertThatThrownBy(() -> service.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), missingReason, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");

        RecruitmentResult missingNote = new RecruitmentResult(ResultOutcome.FAIL, null, null, null, "SKILL_GAP", null);
        assertThatThrownBy(() -> service.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), missingNote, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void reviewDocumentRequiresANoteOfAtLeastFiveCharactersToReject() {
        DocumentReview blank = new DocumentReview("REJECT", null);
        assertThatThrownBy(() -> service.reviewDocument(recruiter, UUID.randomUUID(), blank, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");

        DocumentReview tooShort = new DocumentReview("REJECT", "bad");
        assertThatThrownBy(() -> service.reviewDocument(recruiter, UUID.randomUUID(), tooShort, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void scheduleInterviewRejectsATimeLessThan15MinutesOut() {
        Interview input = new Interview(OffsetDateTime.now().plusMinutes(5), "Asia/Ho_Chi_Minh", InterviewMode.ONSITE,
                "Toà nhà VNG, Q7", null, "Nguyen Van Tuyen");
        assertThatThrownBy(() -> service.scheduleInterview(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERVIEW_TIME_INVALID");
    }

    @Test void scheduleInterviewRequiresAMeetingUrlWhenOnline() {
        Interview input = new Interview(OffsetDateTime.now().plusHours(1), "Asia/Ho_Chi_Minh", InterviewMode.ONLINE,
                null, null, "Nguyen Van Tuyen");
        assertThatThrownBy(() -> service.scheduleInterview(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void scheduleInterviewRequiresALocationWhenOnsite() {
        Interview input = new Interview(OffsetDateTime.now().plusHours(1), "Asia/Ho_Chi_Minh", InterviewMode.ONSITE,
                null, null, "Nguyen Van Tuyen");
        assertThatThrownBy(() -> service.scheduleInterview(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }
}

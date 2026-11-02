package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.DocumentReviewRequest;
import vn.edu.uit.careerhub.dto.request.InterviewRequest;
import vn.edu.uit.careerhub.dto.request.RecruitmentResultRequest;
import vn.edu.uit.careerhub.enums.InterviewMode;
import vn.edu.uit.careerhub.enums.ResultOutcome;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/**
 * ApplicationService (docs/domain/application-state-machine.md) drives its state machine
 * through several repositories, which is not meaningfully unit-tested without a real database (see the integration-test note in
 * CLAUDE.md/handoff). This class covers only the input-validation guards that run before any
 * repository access — recording an interview result, requesting document review, and scheduling
 * an interview — using a no-op repository since those branches never reach it.
 */
class ApplicationServiceTest {
    private final RecruitmentResultService results = new RecruitmentResultService(null, null, null, null, null, null, null, null);
    private final StudentDocumentService documents = new StudentDocumentService(null, null, null, null);
    private final InterviewService interviews = new InterviewService(null, null, null, null, null);
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final AuthPrincipal recruiter = new AuthPrincipal(UUID.randomUUID(), "recruiter@vng.example", UserRole.COMPANY, UUID.randomUUID(), null, UUID.randomUUID());

    @Test void acceptsAPdfHeaderAfterLeadingWhitespace() {
        assertThat(UploadedFileService.hasPdfHeader("\n%PDF-1.7\n".getBytes())).isTrue();
    }

    @Test void rejectsContentWithoutAPdfHeader() {
        assertThat(UploadedFileService.hasPdfHeader("not really a pdf".getBytes())).isFalse();
    }

    @Test void recordResultRequiresAStartDateWhenPassing() {
        RecruitmentResultRequest input = new RecruitmentResultRequest(ResultOutcome.PASS, null, null, null, null, null);
        assertThatThrownBy(() -> results.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void recordResultRejectsAStartDateInThePast() {
        RecruitmentResultRequest input = new RecruitmentResultRequest(ResultOutcome.PASS, LocalDate.now().minusDays(1), null, null, null, null);
        assertThatThrownBy(() -> results.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("OFFER_START_DATE_INVALID");
    }

    @Test void recordResultRequiresAReasonAndNoteWhenFailing() {
        RecruitmentResultRequest missingReason = new RecruitmentResultRequest(ResultOutcome.FAIL, null, null, null, null, "Không đạt yêu cầu kỹ thuật.");
        assertThatThrownBy(() -> results.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), missingReason, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");

        RecruitmentResultRequest missingNote = new RecruitmentResultRequest(ResultOutcome.FAIL, null, null, null, "SKILL_GAP", null);
        assertThatThrownBy(() -> results.recordResult(recruiter, UUID.randomUUID(), UUID.randomUUID(), missingNote, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void reviewDocumentRequiresANoteOfAtLeastFiveCharactersToReject() {
        DocumentReviewRequest blank = new DocumentReviewRequest("REJECT", null);
        assertThatThrownBy(() -> documents.reviewDocument(recruiter, UUID.randomUUID(), blank, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");

        DocumentReviewRequest tooShort = new DocumentReviewRequest("REJECT", "bad");
        assertThatThrownBy(() -> documents.reviewDocument(recruiter, UUID.randomUUID(), tooShort, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void scheduleInterviewRejectsATimeLessThan15MinutesOut() {
        InterviewRequest input = new InterviewRequest(OffsetDateTime.now().plusMinutes(5), "Asia/Ho_Chi_Minh", InterviewMode.ONSITE,
                "Toà nhà VNG, Q7", null, "Nguyen Van Tuyen");
        assertThatThrownBy(() -> interviews.scheduleInterview(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("INTERVIEW_TIME_INVALID");
    }

    @Test void scheduleInterviewRequiresAMeetingUrlWhenOnline() {
        InterviewRequest input = new InterviewRequest(OffsetDateTime.now().plusHours(1), "Asia/Ho_Chi_Minh", InterviewMode.ONLINE,
                null, null, "Nguyen Van Tuyen");
        assertThatThrownBy(() -> interviews.scheduleInterview(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void scheduleInterviewRequiresALocationWhenOnsite() {
        InterviewRequest input = new InterviewRequest(OffsetDateTime.now().plusHours(1), "Asia/Ho_Chi_Minh", InterviewMode.ONSITE,
                null, null, "Nguyen Van Tuyen");
        assertThatThrownBy(() -> interviews.scheduleInterview(recruiter, UUID.randomUUID(), UUID.randomUUID(), input, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }
}

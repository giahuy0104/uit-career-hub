package vn.edu.uit.careerhub.jobs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.AuthRepository;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.jobs.JobModels.LockedJob;
import vn.edu.uit.careerhub.jobs.JobModels.OpportunityType;
import vn.edu.uit.careerhub.jobs.JobModels.ReviewDecision;
import vn.edu.uit.careerhub.jobs.JobModels.Status;
import vn.edu.uit.careerhub.jobs.JobModels.WorkMode;
import vn.edu.uit.careerhub.jobs.JobRequests.Draft;

/**
 * Covers the job-post lifecycle from the handoff doc section 4.2
 * (DRAFT -> PENDING_UIT_REVIEW -> RECRUITING/REVISION_REQUIRED/REJECTED) plus the
 * ownership/version/deadline guards, using mocked repository/audit/transaction
 * dependencies. `database` (raw JdbcClient) is left unstubbed since every scenario here
 * throws before the notification INSERTs that use it.
 */
@ExtendWith(MockitoExtension.class)
class JobServiceTest {
    @Mock private JobRepository repository;
    @Mock private AuthRepository audit;
    @Mock private JdbcClient database;
    @Mock private TransactionTemplate transactions;

    private JobService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final UUID companyId = UUID.randomUUID();
    private final AuthPrincipal recruiter = new AuthPrincipal(UUID.randomUUID(), "recruiter@vng.example", UserRole.COMPANY, UUID.randomUUID(), null, companyId);

    @BeforeEach void wireTransactionTemplateToRunTheCallbackImmediately() {
        org.mockito.Mockito.lenient().when(transactions.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(new SimpleTransactionStatus());
        });
        service = new JobService(repository, audit, database, transactions);
    }

    @Test void createDraftRejectsWhenCompanyIsUnknown() {
        when(repository.companyStatus(companyId)).thenReturn(null);
        assertThatThrownBy(() -> service.createDraft(recruiter, draft(null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_NOT_FOUND");
    }

    @Test void createDraftRejectsWhenCompanyIsNotAnActivePartner() {
        when(repository.companyStatus(companyId)).thenReturn("SUSPENDED");
        assertThatThrownBy(() -> service.createDraft(recruiter, draft(null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_NOT_ACTIVE");
    }

    @Test void createDraftRejectsInvalidCategoryOrSkillReferences() {
        when(repository.companyStatus(companyId)).thenReturn("ACTIVE");
        when(repository.referencesValid(any(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.createDraft(recruiter, draft(null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_REFERENCE_INVALID");
        verify(repository, never()).createDraft(any(), any(), any());
    }

    @Test void updateDraftRequiresAnExpectedVersion() {
        assertThatThrownBy(() -> service.updateDraft(recruiter, UUID.randomUUID(), draft(null), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void updateDraftRejectsWhenCompanyDoesNotOwnTheJob() {
        UUID jobId = UUID.randomUUID();
        when(repository.lock(jobId)).thenReturn(Optional.of(lockedJob(UUID.randomUUID(), Status.DRAFT, 1)));
        assertThatThrownBy(() -> service.updateDraft(recruiter, jobId, draft(1), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_NOT_FOUND");
    }

    @Test void updateDraftRejectsWhenJobIsNoLongerEditable() {
        UUID jobId = UUID.randomUUID();
        when(repository.lock(jobId)).thenReturn(Optional.of(lockedJob(companyId, Status.RECRUITING, 1)));
        assertThatThrownBy(() -> service.updateDraft(recruiter, jobId, draft(1), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_STATE_CONFLICT");
    }

    @Test void updateDraftRejectsAStaleVersion() {
        UUID jobId = UUID.randomUUID();
        when(repository.lock(jobId)).thenReturn(Optional.of(lockedJob(companyId, Status.DRAFT, 3)));
        assertThatThrownBy(() -> service.updateDraft(recruiter, jobId, draft(2), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_STATE_CONFLICT");
        verify(repository, never()).updateDraft(any(), any());
    }

    @Test void submitRejectsWhenCompanyDoesNotOwnTheJob() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.commandExists(jobId, commandId)).thenReturn(false);
        when(repository.lock(jobId)).thenReturn(Optional.of(lockedJob(UUID.randomUUID(), Status.DRAFT, 1)));
        assertThatThrownBy(() -> service.submit(recruiter, jobId, commandId, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_NOT_FOUND");
    }

    @Test void submitRejectsAJobThatIsNotDraftOrRevisionRequired() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.commandExists(jobId, commandId)).thenReturn(false);
        when(repository.lock(jobId)).thenReturn(Optional.of(lockedJob(companyId, Status.PENDING_UIT_REVIEW, 1)));
        assertThatThrownBy(() -> service.submit(recruiter, jobId, commandId, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_STATE_CONFLICT");
    }

    @Test void submitRejectsWhenCompanyIsNoLongerAnActivePartner() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.commandExists(jobId, commandId)).thenReturn(false);
        when(repository.lock(jobId)).thenReturn(Optional.of(new LockedJob(jobId, companyId, Status.DRAFT, 1, LocalDate.now().plusDays(30), "SUSPENDED")));
        assertThatThrownBy(() -> service.submit(recruiter, jobId, commandId, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_NOT_ACTIVE");
    }

    @Test void submitRejectsAnExpiredDeadline() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.commandExists(jobId, commandId)).thenReturn(false);
        when(repository.lock(jobId)).thenReturn(Optional.of(new LockedJob(jobId, companyId, Status.DRAFT, 1, LocalDate.now().minusDays(1), "ACTIVE")));
        assertThatThrownBy(() -> service.submit(recruiter, jobId, commandId, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_DEADLINE_EXPIRED");
        verify(repository, never()).submit(any());
    }

    @Test void reviewIsIdempotentWhenTheCommandWasAlreadyApplied() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        Map<String, Object> found = Map.of("id", jobId.toString());
        when(repository.commandExists(jobId, commandId)).thenReturn(true);
        when(repository.findById(jobId)).thenReturn(Optional.of(found));

        Map<String, Object> result = service.review(UUID.randomUUID(), jobId, commandId, ReviewDecision.APPROVE, null, request);

        assertThat(result).isEqualTo(found);
        verify(repository, never()).lock(any());
    }

    @Test void reviewRejectsAJobThatIsNotPendingReview() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.commandExists(jobId, commandId)).thenReturn(false);
        when(repository.lock(jobId)).thenReturn(Optional.of(lockedJob(companyId, Status.RECRUITING, 1)));
        assertThatThrownBy(() -> service.review(UUID.randomUUID(), jobId, commandId, ReviewDecision.APPROVE, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_STATE_CONFLICT");
    }

    @Test void reviewRejectsApprovingAnAlreadyExpiredJob() {
        UUID jobId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        when(repository.commandExists(jobId, commandId)).thenReturn(false);
        when(repository.lock(jobId)).thenReturn(Optional.of(new LockedJob(jobId, companyId, Status.PENDING_UIT_REVIEW, 1, LocalDate.now().minusDays(1), "ACTIVE")));
        assertThatThrownBy(() -> service.review(UUID.randomUUID(), jobId, commandId, ReviewDecision.APPROVE, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("JOB_DEADLINE_EXPIRED");
        verify(repository, never()).review(any(), any(), any());
    }

    private LockedJob lockedJob(UUID owningCompanyId, Status status, int version) {
        return new LockedJob(UUID.randomUUID(), owningCompanyId, status, version, LocalDate.now().plusDays(30), "ACTIVE");
    }

    private Draft draft(Integer expectedVersion) {
        return new Draft("Thực tập sinh Backend", OpportunityType.INTERNSHIP, WorkMode.ONSITE, "Hồ Chí Minh",
                "Mô tả công việc đủ dài theo yêu cầu validate của form tạo tin.",
                "Yêu cầu ứng viên đủ dài theo yêu cầu validate.", null, 2, LocalDate.now().plusDays(30),
                List.of(), List.of(), expectedVersion);
    }
}

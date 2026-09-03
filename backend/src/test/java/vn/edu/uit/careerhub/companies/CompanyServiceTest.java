package vn.edu.uit.careerhub.companies;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

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

import vn.edu.uit.careerhub.auth.AuthRepository;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.TokenService;
import vn.edu.uit.careerhub.auth.UserStatus;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.companies.CompanyModels.LockedCompany;
import vn.edu.uit.careerhub.companies.CompanyModels.LockedRecruiter;
import vn.edu.uit.careerhub.companies.CompanyModels.PartnerStatus;
import vn.edu.uit.careerhub.companies.CompanyRequests.ProfileUpdate;
import vn.edu.uit.careerhub.companies.CompanyRequests.Recruiter;
import vn.edu.uit.careerhub.companies.CompanyRequests.Update;
import vn.edu.uit.careerhub.config.AppProperties;

/**
 * Covers the partner/recruiter lifecycle guards from the handoff doc section 3.4
 * (only an ACTIVE company can be edited/staffed, only an ACTIVE company can be suspended and
 * only a SUSPENDED one reactivated, optimistic-lock versioning, and the one-time activation-link
 * regeneration rule) using a mocked repository/audit/transaction-template.
 */
@ExtendWith(MockitoExtension.class)
class CompanyServiceTest {
    @Mock private CompanyRepository repository;
    @Mock private JdbcClient database;
    @Mock private TransactionTemplate transactions;
    @Mock private AuthRepository audit;

    private CompanyService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");
    private final UUID companyId = UUID.randomUUID();

    @BeforeEach void wireService() {
        org.mockito.Mockito.lenient().when(transactions.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(new SimpleTransactionStatus());
        });
        AppProperties properties = new AppProperties("test", "http://localhost:5173", "http://localhost:5173",
                new AppProperties.Database("postgresql://localhost/test", "", 5),
                new AppProperties.Security("0123456789abcdefghijklmnopqrstuvwxyz", "issuer", "audience", 900, 7,
                        "refresh", false, "lax", "student.uit.edu.vn"),
                new AppProperties.Email(false, "", "", 10, 5),
                new AppProperties.Storage(false, "", "", "", "bucket", 600, 300), "cron-secret");
        service = new CompanyService(repository, database, transactions, new TokenService(properties), audit);
    }

    @Test void updateRejectsAStaleVersion() {
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.ACTIVE, 3)));

        assertThatThrownBy(() -> service.update(UUID.randomUUID(), companyId, update(2), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_VERSION_CONFLICT");
    }

    @Test void updateProfileRejectsASuspendedCompany() {
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.SUSPENDED, 1)));

        assertThatThrownBy(() -> service.updateProfile(UUID.randomUUID(), companyId, profileUpdate(1), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void suspendRejectsACompanyThatIsNotActive() {
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.SUSPENDED, 1)));

        assertThatThrownBy(() -> service.changeCompanyState(UUID.randomUUID(), companyId, false, 1, "vi phạm hợp đồng", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void reactivateRejectsACompanyThatIsNotSuspended() {
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.ACTIVE, 1)));

        assertThatThrownBy(() -> service.changeCompanyState(UUID.randomUUID(), companyId, true, 1, "khôi phục hợp tác", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void addRecruiterRejectsANonActiveCompany() {
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.SUSPENDED, 1)));

        assertThatThrownBy(() -> service.addRecruiter(UUID.randomUUID(), companyId, recruiter(), request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void suspendRecruiterRejectsAnAlreadySuspendedAccount() {
        UUID userId = UUID.randomUUID();
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.ACTIVE, 1)));
        when(repository.lockRecruiter(companyId, userId)).thenReturn(Optional.of(
                new LockedRecruiter(userId, companyId, UserStatus.SUSPENDED, "hash", "ADMIN_SUSPENDED")));

        assertThatThrownBy(() -> service.changeRecruiterState(UUID.randomUUID(), companyId, userId, false, "vi phạm quy định", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void reactivateRecruiterRejectsWhenTheCompanyItselfIsSuspended() {
        UUID userId = UUID.randomUUID();
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.SUSPENDED, 1)));
        when(repository.lockRecruiter(companyId, userId)).thenReturn(Optional.of(
                new LockedRecruiter(userId, companyId, UserStatus.SUSPENDED, "hash", "ADMIN_SUSPENDED")));

        assertThatThrownBy(() -> service.changeRecruiterState(UUID.randomUUID(), companyId, userId, true, "khôi phục", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void reactivateRecruiterRejectsAnAccountNotSuspendedByAnAdmin() {
        UUID userId = UUID.randomUUID();
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.ACTIVE, 1)));
        when(repository.lockRecruiter(companyId, userId)).thenReturn(Optional.of(
                new LockedRecruiter(userId, companyId, UserStatus.ACTIVE, "hash", null)));

        assertThatThrownBy(() -> service.changeRecruiterState(UUID.randomUUID(), companyId, userId, true, "khôi phục", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void regenerateRejectsWhenTheCompanyIsSuspended() {
        UUID userId = UUID.randomUUID();
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.SUSPENDED, 1)));
        when(repository.lockRecruiter(companyId, userId)).thenReturn(Optional.of(
                new LockedRecruiter(userId, companyId, UserStatus.PENDING_ACTIVATION, null, null)));

        assertThatThrownBy(() -> service.regenerate(UUID.randomUUID(), companyId, userId, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_STATE_CONFLICT");
    }

    @Test void regenerateRejectsAnAccountThatAlreadyHasAPassword() {
        UUID userId = UUID.randomUUID();
        when(repository.lockCompany(companyId)).thenReturn(Optional.of(new LockedCompany(companyId, PartnerStatus.ACTIVE, 1)));
        when(repository.lockRecruiter(companyId, userId)).thenReturn(Optional.of(
                new LockedRecruiter(userId, companyId, UserStatus.ACTIVE, "hash", null)));

        assertThatThrownBy(() -> service.regenerate(UUID.randomUUID(), companyId, userId, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("COMPANY_ACTIVATION_NOT_ALLOWED");
    }

    private Update update(int expectedVersion) {
        return new Update("VNG", "VNG Corporation", null, null, null, null, null, null, null, expectedVersion);
    }

    private ProfileUpdate profileUpdate(int expectedVersion) {
        return new ProfileUpdate("VNG Corporation", null, null, null, null, null, expectedVersion);
    }

    private Recruiter recruiter() {
        return new Recruiter("recruiter@vng.example", "Le Thu Ha", null);
    }
}

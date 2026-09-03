package vn.edu.uit.careerhub.taxonomy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.AuthRepository;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Kind;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.LockedItem;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.SkillDto;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Status;

/**
 * Covers the category/skill versioning and lifecycle rules from the handoff doc section 3.4:
 * optimistic-lock version conflicts and the block on archiving a taxonomy item still referenced
 * by an open job post.
 */
@ExtendWith(MockitoExtension.class)
class TaxonomyServiceTest {
    @Mock private TaxonomyRepository repository;
    @Mock private AuthRepository audit;
    @Mock private TransactionTemplate transactions;

    private TaxonomyService service;
    private final RequestMetadata request = new RequestMetadata("127.0.0.1", "JUnit");

    @BeforeEach void wireTransactionTemplateToRunTheCallbackImmediately() {
        when(transactions.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(new SimpleTransactionStatus());
        });
        service = new TaxonomyService(repository, audit, transactions);
    }

    @Test void rejectsChangingStateToTheStateItIsAlreadyIn() {
        UUID id = UUID.randomUUID();
        when(repository.lock(Kind.SKILL, id)).thenReturn(Optional.of(new LockedItem(id, "java", "Java", true, 3)));

        assertThatThrownBy(() -> service.changeState(Kind.SKILL, UUID.randomUUID(), id, true, 3, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("TAXONOMY_STATE_CONFLICT");
        verify(repository, never()).updateState(any(), any(), anyBoolean());
    }

    @Test void blocksArchivingATaxonomyItemStillUsedByAnOpenJob() {
        UUID id = UUID.randomUUID();
        when(repository.lock(Kind.CATEGORY, id)).thenReturn(Optional.of(new LockedItem(id, "backend", "Backend", true, 1)));
        when(repository.countOpenJobReferences(Kind.CATEGORY, id)).thenReturn(2L);

        assertThatThrownBy(() -> service.changeState(Kind.CATEGORY, UUID.randomUUID(), id, false, 1, "cleanup", request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("TAXONOMY_IN_USE");
        verify(repository, never()).updateState(any(), any(), anyBoolean());
    }

    @Test void reactivatesAnInactiveItemWithoutCheckingOpenJobReferences() {
        UUID id = UUID.randomUUID();
        UUID actor = UUID.randomUUID();
        when(repository.lock(Kind.SKILL, id)).thenReturn(Optional.of(new LockedItem(id, "java", "Java", false, 4)));
        when(repository.findSkill(id)).thenReturn(Optional.of(
                new SkillDto(id, "java", "Java", Status.ACTIVE, 5, 0, 0, null, null)));

        Object result = service.changeState(Kind.SKILL, actor, id, true, 4, "Kích hoạt lại theo yêu cầu UIT", request);

        assertThat(result).isNotNull();
        verify(repository).updateState(Kind.SKILL, id, true);
        verify(repository, never()).countOpenJobReferences(any(), any());
        verify(audit).recordAudit(eq(actor), eq("SKILL_REACTIVATED"), eq("SKILL"), eq(id), any(), eq(request));
    }

    @Test void rejectsUpdatingWithAStaleVersion() {
        UUID id = UUID.randomUUID();
        when(repository.lock(Kind.CATEGORY, id)).thenReturn(Optional.of(new LockedItem(id, "backend", "Backend", true, 2)));

        assertThatThrownBy(() -> service.update(Kind.CATEGORY, UUID.randomUUID(), id, "Back-end", 1, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("TAXONOMY_VERSION_CONFLICT");
        verify(repository, never()).updateName(any(), any(), any());
    }

    @Test void changeStateOnAMissingItemIsReportedAsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.lock(Kind.SKILL, id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeState(Kind.SKILL, UUID.randomUUID(), id, false, 1, null, request))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("RESOURCE_NOT_FOUND");
    }
}

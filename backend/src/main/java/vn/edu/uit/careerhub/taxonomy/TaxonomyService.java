package vn.edu.uit.careerhub.taxonomy;

import java.util.Map;
import java.util.UUID;

import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.AuthRepository;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Kind;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.LockedItem;

@Service
public class TaxonomyService {
    private final TaxonomyRepository repository;
    private final AuthRepository audit;
    private final TransactionTemplate transactions;

    public TaxonomyService(TaxonomyRepository repository, AuthRepository audit, TransactionTemplate transactions) {
        this.repository = repository; this.audit = audit; this.transactions = transactions;
    }

    public Object create(Kind kind, UUID actorId, String key, String name, RequestMetadata request) {
        try {
            return transactions.execute(status -> {
                UUID id = repository.create(kind, key, name);
                audit.recordAudit(actorId, kind == Kind.CATEGORY ? "CATEGORY_CREATED" : "SKILL_CREATED",
                        kind.name(), id, Map.of("key", key, "name", name), request);
                return find(kind, id);
            });
        } catch (DataIntegrityViolationException error) { throw translate(error); }
    }

    public Object update(Kind kind, UUID actorId, UUID id, String name, int expectedVersion, RequestMetadata request) {
        try {
            return transactions.execute(status -> {
                LockedItem item = requireVersion(kind, id, expectedVersion);
                repository.updateName(kind, id, name);
                audit.recordAudit(actorId, kind == Kind.CATEGORY ? "CATEGORY_UPDATED" : "SKILL_UPDATED", kind.name(), id,
                        Map.of("key", item.key(), "previousName", item.name(), "name", name, "fromVersion", item.version()), request);
                return find(kind, id);
            });
        } catch (DataIntegrityViolationException error) { throw translate(error); }
    }

    public Object changeState(Kind kind, UUID actorId, UUID id, boolean active, int expectedVersion,
            String reason, RequestMetadata request) {
        return transactions.execute(status -> {
            LockedItem item = requireVersion(kind, id, expectedVersion);
            if (item.active() == active) throw conflict(active ? "Mục này đang hoạt động." : "Mục này đã ngừng hoạt động.");
            if (!active) {
                long inUse = repository.countOpenJobReferences(kind, id);
                if (inUse > 0) throw new AppException(HttpStatus.CONFLICT, "TAXONOMY_IN_USE",
                        "Không thể ngừng hoạt động vì còn " + inUse + " tin chưa kết thúc đang sử dụng mục này.");
            }
            repository.updateState(kind, id, active);
            audit.recordAudit(actorId, kind.name() + "_" + (active ? "REACTIVATED" : "ARCHIVED"), kind.name(), id,
                    Map.of("key", item.key(), "reason", reason, "fromStatus", active ? "INACTIVE" : "ACTIVE",
                            "toStatus", active ? "ACTIVE" : "INACTIVE", "fromVersion", item.version()), request);
            return find(kind, id);
        });
    }

    private LockedItem requireVersion(Kind kind, UUID id, int version) {
        LockedItem item = repository.lock(kind, id).orElseThrow(this::notFound);
        if (item.version() != version) throw new AppException(HttpStatus.CONFLICT, "TAXONOMY_VERSION_CONFLICT",
                "Dữ liệu vừa được cập nhật. Vui lòng tải lại trước khi tiếp tục.");
        return item;
    }
    private Object find(Kind kind, UUID id) {
        return kind == Kind.CATEGORY ? repository.findCategory(id).orElseThrow(this::notFound)
                : repository.findSkill(id).orElseThrow(this::notFound);
    }
    private AppException notFound() { return new AppException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Không tìm thấy danh mục hoặc kỹ năng."); }
    private AppException conflict(String message) { return new AppException(HttpStatus.CONFLICT, "TAXONOMY_STATE_CONFLICT", message); }
    private AppException translate(DataIntegrityViolationException error) {
        Throwable cause = error.getMostSpecificCause();
        if (cause instanceof PSQLException postgres && "23505".equals(postgres.getSQLState())) {
            String constraint = postgres.getServerErrorMessage() == null ? "" : postgres.getServerErrorMessage().getConstraint();
            if (constraint != null && constraint.contains("name_normalized"))
                return new AppException(HttpStatus.CONFLICT, "TAXONOMY_NAME_EXISTS", "Tên hiển thị đã tồn tại trong cùng loại danh mục.");
            return new AppException(HttpStatus.CONFLICT, "TAXONOMY_KEY_EXISTS", "Mã định danh đã tồn tại.");
        }
        throw error;
    }
}

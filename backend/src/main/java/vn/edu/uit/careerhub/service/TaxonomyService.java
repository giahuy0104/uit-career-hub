package vn.edu.uit.careerhub.service;

import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.dto.CategoryDto;
import vn.edu.uit.careerhub.dto.ListResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.SkillDto;
import vn.edu.uit.careerhub.entity.LockedTaxonomyItem;
import vn.edu.uit.careerhub.enums.TaxonomyKind;
import vn.edu.uit.careerhub.enums.TaxonomyStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.TaxonomyRepository;
import vn.edu.uit.careerhub.repository.UniqueConstraints;

@Service
public class TaxonomyService {
    private final TaxonomyRepository repository;
    private final AuditRepository audit;
    private final TransactionTemplate transactions;

    public TaxonomyService(TaxonomyRepository repository, AuditRepository audit, TransactionTemplate transactions) {
        this.repository = repository; this.audit = audit; this.transactions = transactions;
    }

    public ListResult<CategoryDto> listCategories(int page, int pageSize, String query, TaxonomyStatus status) { return repository.listCategories(page, pageSize, query, status); }
    public ListResult<SkillDto> listSkills(int page, int pageSize, String query, TaxonomyStatus status) { return repository.listSkills(page, pageSize, query, status); }

    public Object create(TaxonomyKind kind, UUID actorId, String key, String name, RequestMetadata request) {
        try {
            return transactions.execute(status -> {
                UUID id = repository.create(kind, key, name);
                audit.record(actorId, kind == TaxonomyKind.CATEGORY ? "CATEGORY_CREATED" : "SKILL_CREATED",
                        kind.name(), id, Map.of("key", key, "name", name), request);
                return find(kind, id);
            });
        } catch (DataIntegrityViolationException error) { throw translate(error); }
    }

    public Object update(TaxonomyKind kind, UUID actorId, UUID id, String name, int expectedVersion, RequestMetadata request) {
        try {
            return transactions.execute(status -> {
                LockedTaxonomyItem item = requireVersion(kind, id, expectedVersion);
                repository.updateName(kind, id, name);
                audit.record(actorId, kind == TaxonomyKind.CATEGORY ? "CATEGORY_UPDATED" : "SKILL_UPDATED", kind.name(), id,
                        Map.of("key", item.key(), "previousName", item.name(), "name", name, "fromVersion", item.version()), request);
                return find(kind, id);
            });
        } catch (DataIntegrityViolationException error) { throw translate(error); }
    }

    public Object changeState(TaxonomyKind kind, UUID actorId, UUID id, boolean active, int expectedVersion,
            String reason, RequestMetadata request) {
        return transactions.execute(status -> {
            LockedTaxonomyItem item = requireVersion(kind, id, expectedVersion);
            if (item.active() == active) throw conflict(active ? "Mục này đang hoạt động." : "Mục này đã ngừng hoạt động.");
            if (!active) {
                long inUse = repository.countOpenJobReferences(kind, id);
                if (inUse > 0) throw new AppException(ErrorType.CONFLICT, "TAXONOMY_IN_USE",
                        "Không thể ngừng hoạt động vì còn " + inUse + " tin chưa kết thúc đang sử dụng mục này.");
            }
            repository.updateState(kind, id, active);
            audit.record(actorId, kind.name() + "_" + (active ? "REACTIVATED" : "ARCHIVED"), kind.name(), id,
                    Map.of("key", item.key(), "reason", reason, "fromStatus", active ? "INACTIVE" : "ACTIVE",
                            "toStatus", active ? "ACTIVE" : "INACTIVE", "fromVersion", item.version()), request);
            return find(kind, id);
        });
    }

    private LockedTaxonomyItem requireVersion(TaxonomyKind kind, UUID id, int version) {
        LockedTaxonomyItem item = repository.lock(kind, id).orElseThrow(this::notFound);
        if (item.version() != version) throw new AppException(ErrorType.CONFLICT, "TAXONOMY_VERSION_CONFLICT",
                "Dữ liệu vừa được cập nhật. Vui lòng tải lại trước khi tiếp tục.");
        return item;
    }
    private Object find(TaxonomyKind kind, UUID id) {
        return kind == TaxonomyKind.CATEGORY ? repository.findCategory(id).orElseThrow(this::notFound)
                : repository.findSkill(id).orElseThrow(this::notFound);
    }
    private AppException notFound() { return new AppException(ErrorType.NOT_FOUND, "RESOURCE_NOT_FOUND", "Không tìm thấy danh mục hoặc kỹ năng."); }
    private AppException conflict(String message) { return new AppException(ErrorType.CONFLICT, "TAXONOMY_STATE_CONFLICT", message); }

    private AppException translate(DataIntegrityViolationException error) {
        String constraint = UniqueConstraints.violatedBy(error).orElseThrow(() -> error);
        if (constraint.contains("name_normalized"))
            return new AppException(ErrorType.CONFLICT, "TAXONOMY_NAME_EXISTS", "Tên hiển thị đã tồn tại trong cùng loại danh mục.");
        return new AppException(ErrorType.CONFLICT, "TAXONOMY_KEY_EXISTS", "Mã định danh đã tồn tại.");
    }
}

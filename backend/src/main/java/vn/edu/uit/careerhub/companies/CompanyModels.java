package vn.edu.uit.careerhub.companies;

import java.util.UUID;

import vn.edu.uit.careerhub.auth.UserStatus;

public final class CompanyModels {
    private CompanyModels() {}
    public enum PartnerStatus { PENDING, ACTIVE, SUSPENDED, ENDED }
    public record LockedCompany(UUID id, PartnerStatus partnerStatus, int version) {}
    public record LockedRecruiter(UUID userId, UUID companyId, UserStatus status, String passwordHash, String suspensionReason) {}
    public record PageResult(java.util.List<java.util.Map<String,Object>> items,long total) {}
}

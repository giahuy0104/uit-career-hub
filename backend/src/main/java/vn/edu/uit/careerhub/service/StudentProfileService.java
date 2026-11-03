package vn.edu.uit.careerhub.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.StudentProfileRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

@Service
public class StudentProfileService {
    private final StudentProfileRepository repository;
    private final AuditRepository audit;
    private final ApplicationAccess access;

    public StudentProfileService(StudentProfileRepository repository, AuditRepository audit, ApplicationAccess access) {
        this.repository = repository;
        this.audit = audit;
        this.access = access;
    }

    public Map<String, Object> studentProfile(UUID id) {
        return repository.studentProfile(id).orElseThrow(access::studentNotFound);
    }

    @Transactional
    public Map<String, Object> updateProfile(AuthPrincipal principal, String phone, RequestMetadata request) {
        int changed = repository.updatePhone(principal.studentProfileId(), phone == null || phone.isBlank() ? null : phone.strip());
        if (changed == 0) throw access.studentNotFound();
        audit.record(principal.userId(), "STUDENT_PROFILE_UPDATED", "STUDENT_PROFILE", principal.studentProfileId(), Map.of("changedFields", List.of("phone")), request);
        return studentProfile(principal.studentProfileId());
    }
}

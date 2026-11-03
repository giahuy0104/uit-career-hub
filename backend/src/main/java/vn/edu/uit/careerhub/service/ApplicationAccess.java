package vn.edu.uit.careerhub.service;

import java.util.UUID;

import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.entity.LockedApplication;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.ApplicationRepository;

/** Row locking with ownership checks, plus the errors shared by the application use cases. */
@Component
public class ApplicationAccess {
    private final ApplicationRepository repository;

    public ApplicationAccess(ApplicationRepository repository) { this.repository = repository; }

    public LockedApplication lock(UUID applicationId) {
        return repository.lockApplication(applicationId).orElseThrow(this::applicationNotFound);
    }

    public LockedApplication lockOwnedByStudent(UUID applicationId, UUID studentId) {
        LockedApplication application = lock(applicationId);
        if (!application.studentProfileId().equals(studentId)) throw applicationNotFound();
        return application;
    }

    public LockedApplication lockOwnedByCompany(UUID applicationId, UUID companyId) {
        LockedApplication application = lock(applicationId);
        if (!application.companyId().equals(companyId)) throw applicationNotFound();
        return application;
    }

    public AppException stateConflict(String message) {
        return new AppException(ErrorType.CONFLICT, "APPLICATION_STATE_CONFLICT", message);
    }

    public AppException studentNotFound() {
        return new AppException(ErrorType.NOT_FOUND, "STUDENT_PROFILE_NOT_FOUND", "Không tìm thấy hồ sơ sinh viên.");
    }

    public AppException applicationNotFound() {
        return new AppException(ErrorType.NOT_FOUND, "APPLICATION_NOT_FOUND", "Không tìm thấy đơn ứng tuyển.");
    }
}

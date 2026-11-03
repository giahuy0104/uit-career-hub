package vn.edu.uit.careerhub.dto;

import java.util.UUID;

import vn.edu.uit.careerhub.entity.AuthUser;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.UserStatus;

public record UserDto(
        UUID id,
        String email,
        UserRole role,
        UserStatus status,
        String displayName,
        String organization,
        UUID studentProfileId,
        UUID companyId) {

    public static UserDto from(AuthUser user) {
        return new UserDto(user.id(), user.email(), user.role(), user.status(), user.displayName(),
                user.organization(), user.studentProfileId(), user.companyId());
    }
}

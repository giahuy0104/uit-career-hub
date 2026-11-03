package vn.edu.uit.careerhub.security;

import java.security.Principal;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.UserRole;

public record AuthPrincipal(
        UUID userId,
        String email,
        UserRole role,
        UUID tokenId,
        UUID studentProfileId,
        UUID companyId) implements Principal {
    @Override
    public String getName() { return userId.toString(); }
}

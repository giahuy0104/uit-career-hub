package vn.edu.uit.careerhub.auth;

import java.security.Principal;
import java.util.UUID;

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

package vn.edu.uit.careerhub.security;

import java.util.Optional;
import java.util.UUID;

import vn.edu.uit.careerhub.entity.AuthUser;

/** Port used by the authentication filter to re-check the account behind a token. */
public interface UserLookup {
    Optional<AuthUser> findById(UUID userId);
}

package vn.edu.uit.careerhub.service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.entity.AuthUser;
import vn.edu.uit.careerhub.repository.AuthRepository;
import vn.edu.uit.careerhub.security.UserLookup;

@Service
public class CurrentUserService implements UserLookup {
    private final AuthRepository repository;

    public CurrentUserService(AuthRepository repository) { this.repository = repository; }

    @Override
    public Optional<AuthUser> findById(UUID userId) { return repository.findUserById(userId); }
}

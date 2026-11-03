package vn.edu.uit.careerhub.service;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.repository.HealthRepository;

@Service
public class HealthService {
    private final HealthRepository repository;

    public HealthService(HealthRepository repository) { this.repository = repository; }

    public void checkDatabase() { repository.ping(); }
}

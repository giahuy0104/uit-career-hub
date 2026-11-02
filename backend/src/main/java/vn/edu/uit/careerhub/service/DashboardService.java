package vn.edu.uit.careerhub.service;

import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.repository.DashboardRepository;

@Service
public class DashboardService {
    private final DashboardRepository repository;

    public DashboardService(DashboardRepository repository) { this.repository = repository; }

    public Map<String, Object> admin() { return repository.admin(); }
    public Map<String, Object> company(UUID companyId) { return repository.company(companyId); }
    public Map<String, Object> student(UUID studentProfileId) { return repository.student(studentProfileId); }
}

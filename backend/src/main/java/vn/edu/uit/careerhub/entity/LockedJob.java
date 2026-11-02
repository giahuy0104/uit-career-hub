package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

import vn.edu.uit.careerhub.enums.JobStatus;

public record LockedJob(UUID id, UUID companyId, JobStatus status, int version, LocalDate deadline, String partnerStatus) {}

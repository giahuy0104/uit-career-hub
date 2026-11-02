package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;

public record ApplicationTargetJob(String title, String status, LocalDate deadline, String partnerStatus) {}

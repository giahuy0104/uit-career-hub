package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

public record RiskPlacement(UUID placementId, LocalDate startDate, int planRevisions) {}

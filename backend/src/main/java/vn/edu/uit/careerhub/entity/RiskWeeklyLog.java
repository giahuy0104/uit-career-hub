package vn.edu.uit.careerhub.entity;

import java.time.LocalDate;
import java.util.UUID;

/** A weekly log as last submitted; text fields are empty while it was never submitted. */
public record RiskWeeklyLog(UUID placementId, int weekNumber, boolean submitted, boolean late, boolean revised,
        LocalDate submittedOn, String workSummary, String outcomes, String difficulties) {}

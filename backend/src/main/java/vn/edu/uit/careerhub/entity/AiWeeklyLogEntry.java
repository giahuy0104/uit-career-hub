package vn.edu.uit.careerhub.entity;

import vn.edu.uit.careerhub.enums.WeeklyLogStatus;

/** Content of one submitted weekly log, as sent (after masking) to the summary prompt. */
public record AiWeeklyLogEntry(
        int weekNumber,
        WeeklyLogStatus status,
        String workSummary,
        String outcomes,
        String difficulties,
        String nextPlan) {}

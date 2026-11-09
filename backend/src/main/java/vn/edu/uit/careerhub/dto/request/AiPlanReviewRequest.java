package vn.edu.uit.careerhub.dto.request;

import jakarta.validation.constraints.Size;

/** The plan fields currently in the student's form; they do not have to be saved first. */
public record AiPlanReviewRequest(
        @Size(max = 4_000) String objectives,
        @Size(max = 6_000) String expectedTasks,
        @Size(max = 4_000) String expectedSkills) {}

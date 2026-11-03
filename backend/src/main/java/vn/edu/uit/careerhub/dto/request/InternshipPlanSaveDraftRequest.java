package vn.edu.uit.careerhub.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record InternshipPlanSaveDraftRequest(
        @Positive Integer expectedVersion,
        @Size(max = 200) String title,
        @Size(max = 200) String department,
        @Size(max = 200) String companySupervisorName,
        @Email @Size(max = 320) String companySupervisorEmail,
        @Size(max = 4_000) String objectives,
        @Size(max = 6_000) String expectedTasks,
        @Size(max = 4_000) String expectedSkills,
        LocalDate startDate,
        LocalDate endDate) {}

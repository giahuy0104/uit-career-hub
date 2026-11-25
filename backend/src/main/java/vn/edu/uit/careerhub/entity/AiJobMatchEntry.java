package vn.edu.uit.careerhub.entity;

import java.util.List;
import java.util.UUID;

public record AiJobMatchEntry(UUID jobId, String title, String description, String requirements, List<String> matchedSkills,
        List<String> missingSkills) {}

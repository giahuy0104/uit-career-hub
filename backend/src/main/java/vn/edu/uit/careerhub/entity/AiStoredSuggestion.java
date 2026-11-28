package vn.edu.uit.careerhub.entity;

import java.util.UUID;

/** Which feature and target a saved suggestion belongs to, for checking who may rate it. */
public record AiStoredSuggestion(UUID id, String feature, UUID targetId) {}

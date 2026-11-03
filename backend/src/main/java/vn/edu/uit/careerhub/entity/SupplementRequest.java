package vn.edu.uit.careerhub.entity;

import java.util.Map;
import java.util.UUID;

public record SupplementRequest(UUID commandId, Map<String, Object> metadata) {}

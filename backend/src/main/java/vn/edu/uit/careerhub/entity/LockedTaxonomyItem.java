package vn.edu.uit.careerhub.entity;

import java.util.UUID;

public record LockedTaxonomyItem(UUID id, String key, String name, boolean active, int version) {}

package vn.edu.uit.careerhub.entity;

import java.util.UUID;

import vn.edu.uit.careerhub.enums.PartnerStatus;

public record LockedCompany(UUID id, PartnerStatus partnerStatus, int version) {}

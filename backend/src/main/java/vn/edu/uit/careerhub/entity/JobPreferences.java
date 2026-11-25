package vn.edu.uit.careerhub.entity;

import java.util.List;

import vn.edu.uit.careerhub.enums.OpportunityType;

/** What a student says they can do and look for. Only active skills and categories are listed. */
public record JobPreferences(List<NamedRef> skills, List<NamedRef> categories, List<OpportunityType> opportunityTypes) {}

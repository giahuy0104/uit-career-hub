package vn.edu.uit.careerhub.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ReportFilters(LocalDate fromDate,LocalDate toDate,String faculty,String major,String cohort,UUID companyId,String status,String opportunityType,String query) {}

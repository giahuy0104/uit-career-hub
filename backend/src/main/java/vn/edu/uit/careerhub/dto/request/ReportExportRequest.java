package vn.edu.uit.careerhub.dto.request;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ReportExportRequest(@NotBlank @Pattern(regexp="CSV|XLSX") String format,LocalDate fromDate,LocalDate toDate,@Size(max=120) String faculty,@Size(max=120) String major,@Size(max=40) String cohort,UUID companyId,String status,String opportunityType,@Size(max=100) String query){}

package vn.edu.uit.careerhub.controller;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.ReportFilters;
import vn.edu.uit.careerhub.dto.request.ReportExportRequest;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.ReportingService;
import vn.edu.uit.careerhub.web.RequestMetadataFactory;

@Validated @RestController @RequestMapping("/api/v1/uit/reports/applications")
public class ReportingController {
    private final ReportingService service;public ReportingController(ReportingService service){this.service=service;}
    @GetMapping Map<String,Object> list(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="25") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) LocalDate fromDate,@RequestParam(required=false) LocalDate toDate,@RequestParam(required=false) String faculty,@RequestParam(required=false) String major,@RequestParam(required=false) String cohort,@RequestParam(required=false) UUID companyId,@RequestParam(required=false) String status,@RequestParam(required=false) String opportunityType,@RequestParam(required=false) String query){AuthContext.requireRole(p,UserRole.UIT_ADMIN);return service.list(new ReportFilters(fromDate,toDate,faculty,major,cohort,companyId,status,opportunityType,query),page,pageSize);}
    @PostMapping("/exports") ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody ReportExportRequest input,HttpServletRequest request){AuthContext.requireRole(p,UserRole.UIT_ADMIN);var file=service.export(p.userId(),input.format(),new ReportFilters(input.fromDate(),input.toDate(),input.faculty(),input.major(),input.cohort(),input.companyId(),input.status(),input.opportunityType(),input.query()),RequestMetadataFactory.from(request));return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.contentType())).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\""+file.fileName()+"\"").header(HttpHeaders.CONTENT_LENGTH,String.valueOf(file.bytes().length)).header("X-Report-Row-Count",String.valueOf(file.rowCount())).body(file.bytes());}
}

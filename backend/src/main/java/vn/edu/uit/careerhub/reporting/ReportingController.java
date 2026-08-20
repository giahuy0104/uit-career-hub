package vn.edu.uit.careerhub.reporting;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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

import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.UserRole;

@Validated @RestController @RequestMapping("/api/v1/uit/reports/applications")
public class ReportingController {
    public record ExportRequest(@NotBlank @Pattern(regexp="CSV|XLSX") String format,LocalDate fromDate,LocalDate toDate,@Size(max=120) String faculty,@Size(max=120) String major,@Size(max=40) String cohort,UUID companyId,String status,String opportunityType,@Size(max=100) String query){}
    private final ReportingService service;public ReportingController(ReportingService service){this.service=service;}
    @GetMapping Map<String,Object> list(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="25") @Min(1) @Max(100) int pageSize,@RequestParam(required=false) LocalDate fromDate,@RequestParam(required=false) LocalDate toDate,@RequestParam(required=false) String faculty,@RequestParam(required=false) String major,@RequestParam(required=false) String cohort,@RequestParam(required=false) UUID companyId,@RequestParam(required=false) String status,@RequestParam(required=false) String opportunityType,@RequestParam(required=false) String query){AuthContext.requireRole(p,UserRole.UIT_ADMIN);return service.list(new ReportingService.Filters(fromDate,toDate,faculty,major,cohort,companyId,status,opportunityType,query),page,pageSize);}
    @PostMapping("/exports") ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody ExportRequest input,HttpServletRequest request){AuthContext.requireRole(p,UserRole.UIT_ADMIN);var file=service.export(p.userId(),input.format(),new ReportingService.Filters(input.fromDate(),input.toDate(),input.faculty(),input.major(),input.cohort(),input.companyId(),input.status(),input.opportunityType(),input.query()),RequestMetadata.from(request));return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.contentType())).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\""+file.fileName()+"\"").header(HttpHeaders.CONTENT_LENGTH,String.valueOf(file.bytes().length)).header("X-Report-Row-Count",String.valueOf(file.rowCount())).body(file.bytes());}
}

package vn.edu.uit.careerhub.service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.ReportFile;
import vn.edu.uit.careerhub.dto.ReportFilters;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.ReportingRepository;

@Service
public class ReportingService {
    private static final int EXPORT_LIMIT=10_000;
    private final ReportingRepository repository;private final AuditRepository audit;
    public ReportingService(ReportingRepository repository,AuditRepository audit){this.repository=repository;this.audit=audit;}

    @Transactional(readOnly=true)
    public Map<String,Object> list(ReportFilters filters,int page,int pageSize){
        validate(filters);
        List<Map<String,Object>> rows=repository.page(filters,page,pageSize);
        Map<String,Object> summary=repository.summary(filters);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("data",rows);
        result.put("summary",summary);
        result.put("filterOptions",repository.filterOptions());
        long total=((Number)summary.get("totalApplications")).longValue();
        result.put("meta",Map.of("page",page,"pageSize",pageSize,"totalItems",total,"totalPages",total==0?0:(total+pageSize-1)/pageSize));
        return result;
    }

    @Transactional
    public ReportFile export(UUID actor,String format,ReportFilters filters,RequestMetadata request){
        validate(filters);
        List<Map<String,Object>> rows=repository.rows(filters,EXPORT_LIMIT+1);
        if(rows.size()>EXPORT_LIMIT)throw new AppException(ErrorType.LIMIT_EXCEEDED,"REPORT_EXPORT_TOO_LARGE","Báo cáo vượt quá 10.000 dòng. Vui lòng thu hẹp bộ lọc.");
        ReportFile file="CSV".equals(format)?csv(rows):xlsx(rows,repository.summary(filters),filters);
        audit.record(actor,"UIT_APPLICATION_REPORT_EXPORTED","REPORT",null,Map.of("report","APPLICATIONS","format",format,"rowCount",rows.size()),request);
        return file;
    }


@Transactional



    private void validate(ReportFilters f){if(f.fromDate()!=null&&f.toDate()!=null&&f.fromDate().isAfter(f.toDate()))throw new AppException(ErrorType.INVALID_INPUT,"VALIDATION_ERROR","Ngày bắt đầu không được sau ngày kết thúc.");}

    private ReportFile csv(List<Map<String,Object>> rows){String[] headers={"Mã hồ sơ","Ngày ứng tuyển","MSSV","Họ và tên","Khoa","Ngành","Khóa","Mã doanh nghiệp","Doanh nghiệp","Tin tuyển dụng","Loại cơ hội","Hình thức","Trạng thái","Kết quả","Phản hồi offer","Ngày bắt đầu"};StringBuilder out=new StringBuilder("\uFEFF").append(String.join(",",headers)).append("\r\n");for(var row:rows)out.append(csvLine(values(row))).append("\r\n");return new ReportFile(out.toString().getBytes(StandardCharsets.UTF_8),"text/csv; charset=utf-8",fileName("csv"),rows.size());}
    private ReportFile xlsx(List<Map<String,Object>> rows,Map<String,Object> summary,ReportFilters filters){try(Workbook book=new XSSFWorkbook();ByteArrayOutputStream out=new ByteArrayOutputStream()){Sheet overview=book.createSheet("Tổng quan");overview.createRow(0).createCell(0).setCellValue("BÁO CÁO HỒ SƠ ỨNG TUYỂN UIT");String[][] metrics={{"Tổng hồ sơ",summary.get("totalApplications").toString()},{"Sinh viên duy nhất",summary.get("uniqueStudents").toString()},{"Doanh nghiệp",summary.get("companyCount").toString()},{"Placement đã xác nhận",summary.get("hiredCount").toString()}};for(int i=0;i<metrics.length;i++){Row r=overview.createRow(i+2);r.createCell(0).setCellValue(metrics[i][0]);r.createCell(1).setCellValue(metrics[i][1]);}
        Sheet data=book.createSheet("Dữ liệu");String[] headers={"Mã hồ sơ","Ngày ứng tuyển","MSSV","Họ và tên","Khoa","Ngành","Khóa","Mã doanh nghiệp","Doanh nghiệp","Tin tuyển dụng","Loại cơ hội","Hình thức","Trạng thái","Kết quả","Phản hồi offer","Ngày bắt đầu"};Row head=data.createRow(0);var style=book.createCellStyle();style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());style.setFillPattern(FillPatternType.SOLID_FOREGROUND);var font=book.createFont();font.setColor(IndexedColors.WHITE.getIndex());font.setBold(true);style.setFont(font);for(int i=0;i<headers.length;i++){var cell=head.createCell(i);cell.setCellValue(headers[i]);cell.setCellStyle(style);data.setColumnWidth(i,Math.min(50,Math.max(14,headers[i].length()+4))*256);}int index=1;for(var source:rows){Row target=data.createRow(index++);List<String> values=values(source);for(int i=0;i<values.size();i++)target.createCell(i).setCellValue(values.get(i));}data.createFreezePane(0,1);data.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0,Math.max(1,rows.size()),0,headers.length-1));book.write(out);return new ReportFile(out.toByteArray(),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",fileName("xlsx"),rows.size());}catch(Exception e){throw new IllegalStateException("Không thể tạo tệp Excel.",e);}}
    @SuppressWarnings("unchecked") private List<String> values(Map<String,Object> row){Map<String,Object> student=(Map<String,Object>)row.get("student"),company=(Map<String,Object>)row.get("company"),job=(Map<String,Object>)row.get("job"),result=(Map<String,Object>)row.get("recruitmentResult");return List.of(text(row.get("applicationId")),text(row.get("submittedAt")),text(student.get("studentCode")),text(student.get("fullName")),text(student.get("faculty")),text(student.get("major")),text(student.get("cohort")),text(company.get("code")),text(company.get("name")),text(job.get("title")),text(job.get("opportunityType")),text(job.get("workMode")),text(row.get("status")),result==null?"":text(result.get("outcome")),result==null?"":text(result.get("studentDecision")),result==null?"":text(result.get("startDate")));}
    private String text(Object v){return v==null?"":v.toString();}private String csvLine(List<String> values){return values.stream().map(this::csvCell).collect(java.util.stream.Collectors.joining(","));}private String csvCell(String value){String v=value;if(v.matches("^[\\t\\r\\n ]*[=+\\-@].*"))v="'"+v;return v.matches(".*[\",\\r\\n].*")?"\""+v.replace("\"","\"\"")+"\"":v;}private String fileName(String ext){return "uit-application-report-"+DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(java.time.Instant.now())+"."+ext;}
}

package vn.edu.uit.careerhub.reporting;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.common.JsonSupport;

@Service
public class ReportingService {
    public record Filters(LocalDate fromDate,LocalDate toDate,String faculty,String major,String cohort,UUID companyId,String status,String opportunityType,String query) {}
    public record File(byte[] bytes,String contentType,String fileName,int rowCount) {}
    private record Where(String sql,Map<String,Object> params) {}
    private static final int EXPORT_LIMIT=10_000;
    private static final String SELECT="""
      SELECT (jsonb_build_object('applicationId',a.id,'submittedAt',a.submitted_at,'lastTransitionAt',a.last_transition_at,
        'student',jsonb_build_object('studentCode',sp.student_code,'fullName',sp.full_name,'faculty',sp.faculty,'major',sp.major,'cohort',sp.cohort),
        'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name),
        'job',jsonb_build_object('title',j.title,'opportunityType',j.opportunity_type,'workMode',j.work_mode),
        'status',a.status,'recruitmentResult',CASE WHEN rr.id IS NULL THEN NULL ELSE jsonb_build_object('outcome',rr.outcome,
          'studentDecision',rr.student_decision,'startDate',rr.start_date) END))::text data
      FROM applications a JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id LEFT JOIN recruitment_results rr ON rr.application_id=a.id
      """;
    private final JdbcClient database;private final JsonSupport json;
    public ReportingService(JdbcClient database,JsonSupport json){this.database=database;this.json=json;}

    @Transactional(readOnly=true)
    public Map<String,Object> list(Filters filters,int page,int pageSize){validate(filters);Where where=where(filters);Map<String,Object> params=new LinkedHashMap<>(where.params());params.put("limit",pageSize);params.put("offset",(page-1)*pageSize);
        List<Map<String,Object>> rows=database.sql(SELECT+where.sql()+" ORDER BY a.submitted_at DESC,a.id DESC LIMIT :limit OFFSET :offset").params(params).query(String.class).list().stream().map(json::object).toList();
        Map<String,Object> summary=summary(filters);Map<String,Object> result=new LinkedHashMap<>();result.put("data",rows);result.put("summary",summary);result.put("filterOptions",filterOptions());
        long total=((Number)summary.get("totalApplications")).longValue();result.put("meta",Map.of("page",page,"pageSize",pageSize,"totalItems",total,"totalPages",total==0?0:(total+pageSize-1)/pageSize));return result;}

    @Transactional
    public File export(UUID actor,String format,Filters filters,RequestMetadata request){validate(filters);Where where=where(filters);var params=new LinkedHashMap<>(where.params());params.put("limit",EXPORT_LIMIT+1);
        List<Map<String,Object>> rows=database.sql(SELECT+where.sql()+" ORDER BY a.submitted_at DESC,a.id DESC LIMIT :limit").params(params).query(String.class).list().stream().map(json::object).toList();
        if(rows.size()>EXPORT_LIMIT)throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY,"REPORT_EXPORT_TOO_LARGE","Báo cáo vượt quá 10.000 dòng. Vui lòng thu hẹp bộ lọc.");
        File file="CSV".equals(format)?csv(rows):xlsx(rows,summary(filters),filters);database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,metadata,ip_address,user_agent)
          VALUES(:actor,'UIT_APPLICATION_REPORT_EXPORTED','REPORT',CAST(:metadata AS jsonb),CAST(:ip AS inet),:agent)
          """).param("actor",actor).param("metadata",json.stringify(Map.of("report","APPLICATIONS","format",format,"rowCount",rows.size())))
                .param("ip",request.ipAddress(),Types.VARCHAR).param("agent",request.userAgent(),Types.VARCHAR).update();return file;}

    private Map<String,Object> summary(Filters filters){Where w=where(filters);String base="""
      FROM applications a JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id LEFT JOIN recruitment_results rr ON rr.application_id=a.id
      """+w.sql();Map<String,Object> totals=database.sql("""
      SELECT count(*) total,count(DISTINCT a.student_profile_id) students,count(DISTINCT j.company_id) companies,
        count(*) FILTER(WHERE a.status='HIRED') hired
      """+base).params(w.params()).query((r,n)->Map.<String,Object>of("total",r.getLong("total"),"students",r.getLong("students"),"companies",r.getLong("companies"),"hired",r.getLong("hired"))).single();
        List<Map<String,Object>> counts=database.sql("SELECT a.status,count(*) count "+base+" GROUP BY a.status ORDER BY count(*) DESC,a.status").params(w.params()).query((r,n)->Map.<String,Object>of("status",r.getString("status"),"count",r.getLong("count"))).list();
        long total=((Number)totals.get("total")).longValue(),hired=((Number)totals.get("hired")).longValue();Map<String,Object> result=new LinkedHashMap<>();result.put("totalApplications",total);result.put("uniqueStudents",totals.get("students"));result.put("companyCount",totals.get("companies"));result.put("hiredCount",hired);result.put("hiredRate",total==0?0d:(double)hired/total);result.put("statusCounts",counts);return result;}

    private Map<String,Object> filterOptions(){List<String> faculties=database.sql("SELECT DISTINCT faculty FROM student_profiles ORDER BY faculty").query(String.class).list();List<String> majors=database.sql("SELECT DISTINCT major FROM student_profiles ORDER BY major").query(String.class).list();List<String> cohorts=database.sql("SELECT DISTINCT cohort FROM student_profiles ORDER BY cohort").query(String.class).list();List<Map<String,Object>> companies=database.sql("""
      SELECT DISTINCT c.id,c.code,c.name FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id ORDER BY c.name,c.id
      """).query((r,n)->Map.<String,Object>of("id",r.getObject("id",UUID.class),"code",r.getString("code"),"name",r.getString("name"))).list();return Map.of("faculties",faculties,"majors",majors,"cohorts",cohorts,"companies",companies);}

    private Where where(Filters f){List<String> clauses=new ArrayList<>();Map<String,Object> p=new LinkedHashMap<>();if(f.fromDate()!=null){clauses.add("a.submitted_at>=(CAST(:fromDate AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')");p.put("fromDate",f.fromDate());}if(f.toDate()!=null){clauses.add("a.submitted_at<(((CAST(:toDate AS date)+1)::timestamp) AT TIME ZONE 'Asia/Ho_Chi_Minh')");p.put("toDate",f.toDate());}
        add(clauses,p,"faculty",f.faculty(),"sp.faculty=:faculty");add(clauses,p,"major",f.major(),"sp.major=:major");add(clauses,p,"cohort",f.cohort(),"sp.cohort=:cohort");add(clauses,p,"companyId",f.companyId(),"c.id=:companyId");add(clauses,p,"status",f.status(),"a.status=:status");add(clauses,p,"opportunityType",f.opportunityType(),"j.opportunity_type=:opportunityType");if(f.query()!=null&&!f.query().isBlank()){p.put("query","%"+f.query().strip()+"%");clauses.add("(sp.student_code ILIKE :query OR sp.full_name ILIKE :query OR j.title ILIKE :query OR c.name ILIKE :query)");}return new Where(clauses.isEmpty()?"":" WHERE "+String.join(" AND ",clauses),p);}
    private void add(List<String> c,Map<String,Object> p,String key,Object value,String clause){if(value!=null&&(!(value instanceof String s)||!s.isBlank())){p.put(key,value);c.add(clause);}}
    private void validate(Filters f){if(f.fromDate()!=null&&f.toDate()!=null&&f.fromDate().isAfter(f.toDate()))throw new AppException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Ngày bắt đầu không được sau ngày kết thúc.");}

    private File csv(List<Map<String,Object>> rows){String[] headers={"Mã hồ sơ","Ngày ứng tuyển","MSSV","Họ và tên","Khoa","Ngành","Khóa","Mã doanh nghiệp","Doanh nghiệp","Tin tuyển dụng","Loại cơ hội","Hình thức","Trạng thái","Kết quả","Phản hồi offer","Ngày bắt đầu"};StringBuilder out=new StringBuilder("\uFEFF").append(String.join(",",headers)).append("\r\n");for(var row:rows)out.append(csvLine(values(row))).append("\r\n");return new File(out.toString().getBytes(StandardCharsets.UTF_8),"text/csv; charset=utf-8",fileName("csv"),rows.size());}
    private File xlsx(List<Map<String,Object>> rows,Map<String,Object> summary,Filters filters){try(Workbook book=new XSSFWorkbook();ByteArrayOutputStream out=new ByteArrayOutputStream()){Sheet overview=book.createSheet("Tổng quan");overview.createRow(0).createCell(0).setCellValue("BÁO CÁO HỒ SƠ ỨNG TUYỂN UIT");String[][] metrics={{"Tổng hồ sơ",summary.get("totalApplications").toString()},{"Sinh viên duy nhất",summary.get("uniqueStudents").toString()},{"Doanh nghiệp",summary.get("companyCount").toString()},{"Placement đã xác nhận",summary.get("hiredCount").toString()}};for(int i=0;i<metrics.length;i++){Row r=overview.createRow(i+2);r.createCell(0).setCellValue(metrics[i][0]);r.createCell(1).setCellValue(metrics[i][1]);}
        Sheet data=book.createSheet("Dữ liệu");String[] headers={"Mã hồ sơ","Ngày ứng tuyển","MSSV","Họ và tên","Khoa","Ngành","Khóa","Mã doanh nghiệp","Doanh nghiệp","Tin tuyển dụng","Loại cơ hội","Hình thức","Trạng thái","Kết quả","Phản hồi offer","Ngày bắt đầu"};Row head=data.createRow(0);var style=book.createCellStyle();style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());style.setFillPattern(FillPatternType.SOLID_FOREGROUND);var font=book.createFont();font.setColor(IndexedColors.WHITE.getIndex());font.setBold(true);style.setFont(font);for(int i=0;i<headers.length;i++){var cell=head.createCell(i);cell.setCellValue(headers[i]);cell.setCellStyle(style);data.setColumnWidth(i,Math.min(50,Math.max(14,headers[i].length()+4))*256);}int index=1;for(var source:rows){Row target=data.createRow(index++);List<String> values=values(source);for(int i=0;i<values.size();i++)target.createCell(i).setCellValue(values.get(i));}data.createFreezePane(0,1);data.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0,Math.max(1,rows.size()),0,headers.length-1));book.write(out);return new File(out.toByteArray(),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",fileName("xlsx"),rows.size());}catch(Exception e){throw new IllegalStateException("Không thể tạo tệp Excel.",e);}}
    @SuppressWarnings("unchecked") private List<String> values(Map<String,Object> row){Map<String,Object> student=(Map<String,Object>)row.get("student"),company=(Map<String,Object>)row.get("company"),job=(Map<String,Object>)row.get("job"),result=(Map<String,Object>)row.get("recruitmentResult");return List.of(text(row.get("applicationId")),text(row.get("submittedAt")),text(student.get("studentCode")),text(student.get("fullName")),text(student.get("faculty")),text(student.get("major")),text(student.get("cohort")),text(company.get("code")),text(company.get("name")),text(job.get("title")),text(job.get("opportunityType")),text(job.get("workMode")),text(row.get("status")),result==null?"":text(result.get("outcome")),result==null?"":text(result.get("studentDecision")),result==null?"":text(result.get("startDate")));}
    private String text(Object v){return v==null?"":v.toString();}private String csvLine(List<String> values){return values.stream().map(this::csvCell).collect(java.util.stream.Collectors.joining(","));}private String csvCell(String value){String v=value;if(v.matches("^[\\t\\r\\n ]*[=+\\-@].*"))v="'"+v;return v.matches(".*[\",\\r\\n].*")?"\""+v.replace("\"","\"\"")+"\"":v;}private String fileName(String ext){return "uit-application-report-"+DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(java.time.Instant.now())+"."+ext;}
}

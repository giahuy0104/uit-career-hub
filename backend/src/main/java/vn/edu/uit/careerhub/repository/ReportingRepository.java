package vn.edu.uit.careerhub.repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.ReportFilters;
import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class ReportingRepository {
    private record Where(String sql,Map<String,Object> params) {}
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
    private final JdbcClient database;
    private final JsonSupport json;

    public ReportingRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public List<Map<String,Object>> page(ReportFilters filters, int page, int pageSize) {
        Where where=where(filters);Map<String,Object> params=new LinkedHashMap<>(where.params());params.put("limit",pageSize);params.put("offset",(page-1)*pageSize);
        return database.sql(SELECT+where.sql()+" ORDER BY a.submitted_at DESC,a.id DESC LIMIT :limit OFFSET :offset").params(params).query(String.class).list().stream().map(json::object).toList();
    }

    public List<Map<String,Object>> rows(ReportFilters filters, int limit) {
        Where where=where(filters);var params=new LinkedHashMap<>(where.params());params.put("limit",limit);
        return database.sql(SELECT+where.sql()+" ORDER BY a.submitted_at DESC,a.id DESC LIMIT :limit").params(params).query(String.class).list().stream().map(json::object).toList();
    }

    public Map<String,Object> summary(ReportFilters filters){Where w=where(filters);String base="""
      FROM applications a JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id LEFT JOIN recruitment_results rr ON rr.application_id=a.id
      """+w.sql();Map<String,Object> totals=database.sql("""
      SELECT count(*) total,count(DISTINCT a.student_profile_id) students,count(DISTINCT j.company_id) companies,
        count(*) FILTER(WHERE a.status='HIRED') hired
      """+base).params(w.params()).query((r,n)->Map.<String,Object>of("total",r.getLong("total"),"students",r.getLong("students"),"companies",r.getLong("companies"),"hired",r.getLong("hired"))).single();
        List<Map<String,Object>> counts=database.sql("SELECT a.status,count(*) count "+base+" GROUP BY a.status ORDER BY count(*) DESC,a.status").params(w.params()).query((r,n)->Map.<String,Object>of("status",r.getString("status"),"count",r.getLong("count"))).list();
        long total=((Number)totals.get("total")).longValue(),hired=((Number)totals.get("hired")).longValue();Map<String,Object> result=new LinkedHashMap<>();result.put("totalApplications",total);result.put("uniqueStudents",totals.get("students"));result.put("companyCount",totals.get("companies"));result.put("hiredCount",hired);result.put("hiredRate",total==0?0d:(double)hired/total);result.put("statusCounts",counts);return result;}

    public Map<String,Object> filterOptions(){List<String> faculties=database.sql("SELECT DISTINCT faculty FROM student_profiles ORDER BY faculty").query(String.class).list();List<String> majors=database.sql("SELECT DISTINCT major FROM student_profiles ORDER BY major").query(String.class).list();List<String> cohorts=database.sql("SELECT DISTINCT cohort FROM student_profiles ORDER BY cohort").query(String.class).list();List<Map<String,Object>> companies=database.sql("""
      SELECT DISTINCT c.id,c.code,c.name FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id ORDER BY c.name,c.id
      """).query((r,n)->Map.<String,Object>of("id",r.getObject("id",UUID.class),"code",r.getString("code"),"name",r.getString("name"))).list();return Map.of("faculties",faculties,"majors",majors,"cohorts",cohorts,"companies",companies);}

    private Where where(ReportFilters f){List<String> clauses=new ArrayList<>();Map<String,Object> p=new LinkedHashMap<>();if(f.fromDate()!=null){clauses.add("a.submitted_at>=(CAST(:fromDate AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')");p.put("fromDate",f.fromDate());}if(f.toDate()!=null){clauses.add("a.submitted_at<(((CAST(:toDate AS date)+1)::timestamp) AT TIME ZONE 'Asia/Ho_Chi_Minh')");p.put("toDate",f.toDate());}
        add(clauses,p,"faculty",f.faculty(),"sp.faculty=:faculty");add(clauses,p,"major",f.major(),"sp.major=:major");add(clauses,p,"cohort",f.cohort(),"sp.cohort=:cohort");add(clauses,p,"companyId",f.companyId(),"c.id=:companyId");add(clauses,p,"status",f.status(),"a.status=:status");add(clauses,p,"opportunityType",f.opportunityType(),"j.opportunity_type=:opportunityType");if(f.query()!=null&&!f.query().isBlank()){p.put("query","%"+f.query().strip()+"%");clauses.add("(sp.student_code ILIKE :query OR sp.full_name ILIKE :query OR j.title ILIKE :query OR c.name ILIKE :query)");}return new Where(clauses.isEmpty()?"":" WHERE "+String.join(" AND ",clauses),p);}

    private void add(List<String> c,Map<String,Object> p,String key,Object value,String clause){if(value!=null&&(!(value instanceof String s)||!s.isBlank())){p.put(key,value);c.add(clause);}}
}

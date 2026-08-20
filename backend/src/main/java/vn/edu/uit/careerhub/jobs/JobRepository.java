package vn.edu.uit.careerhub.jobs;

import java.sql.Date;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.common.JsonSupport;
import vn.edu.uit.careerhub.jobs.JobModels.LockedJob;
import vn.edu.uit.careerhub.jobs.JobModels.OpportunityType;
import vn.edu.uit.careerhub.jobs.JobModels.PageResult;
import vn.edu.uit.careerhub.jobs.JobModels.Status;
import vn.edu.uit.careerhub.jobs.JobModels.WorkMode;
import vn.edu.uit.careerhub.jobs.JobRequests.Draft;

@Repository
public class JobRepository {
    private static final String JOB_SELECT = """
        SELECT (jsonb_build_object(
          'id',j.id,
          'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'industry',c.industry,'partnerStatus',c.partner_status),
          'title',j.title,'opportunityType',j.opportunity_type,'workMode',j.work_mode,'location',j.location,
          'description',j.description,'requirements',j.requirements,'benefits',j.benefits,'positions',j.positions,
          'deadline',to_char(j.deadline,'YYYY-MM-DD'),'status',j.status,'version',j.version,
          'categories',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',cat.id,'code',cat.code,'name',cat.name) ORDER BY cat.name)
            FROM job_post_categories jpc JOIN categories cat ON cat.id=jpc.category_id WHERE jpc.job_post_id=j.id),'[]'::jsonb),
          'skills',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'isRequired',jps.is_required) ORDER BY s.name)
            FROM job_post_skills jps JOIN skills s ON s.id=jps.skill_id WHERE jps.job_post_id=j.id),'[]'::jsonb),
          'latestReview',(SELECT jsonb_build_object('reasonCode',h.reason_code,'note',h.note,'createdAt',h.created_at)
            FROM job_post_status_history h WHERE h.job_post_id=j.id AND h.to_status IN ('REVISION_REQUIRED','REJECTED') ORDER BY h.created_at DESC LIMIT 1),
          'submittedAt',j.submitted_at,'reviewedAt',j.reviewed_at,'createdAt',j.created_at,'updatedAt',j.updated_at
        ))::text AS data
        FROM job_posts j JOIN companies c ON c.id=j.company_id
        """;

    private final JdbcClient database;
    private final JsonSupport json;
    public JobRepository(JdbcClient database, JsonSupport json) { this.database=database; this.json=json; }

    public Optional<Map<String,Object>> findById(UUID id) { return one(JOB_SELECT+" WHERE j.id=:id", "id", id); }
    public Optional<Map<String,Object>> findRecruiting(UUID id) {
        return one(JOB_SELECT+" WHERE j.id=:id AND j.status='RECRUITING' AND j.deadline>=current_date AND c.partner_status='ACTIVE'", "id", id);
    }

    public PageResult listCompany(UUID companyId,int page,int pageSize,Status status) {
        String where=" WHERE j.company_id=:companyId"+(status==null?"":" AND j.status=:status");
        JdbcClient.StatementSpec count=database.sql("SELECT count(*) FROM job_posts j"+where).param("companyId",companyId);
        JdbcClient.StatementSpec items=database.sql(JOB_SELECT+where+" ORDER BY j.updated_at DESC LIMIT :limit OFFSET :offset")
                .param("companyId",companyId).param("limit",pageSize).param("offset",(page-1)*pageSize);
        if(status!=null){count=count.param("status",status.name());items=items.param("status",status.name());}
        return new PageResult(items.query(String.class).list().stream().map(json::object).toList(),count.query(Long.class).single());
    }

    public PageResult reviewQueue(int page,int pageSize) {
        long total=database.sql("SELECT count(*) FROM job_posts WHERE status='PENDING_UIT_REVIEW'").query(Long.class).single();
        List<Map<String,Object>> items=database.sql(JOB_SELECT+" WHERE j.status='PENDING_UIT_REVIEW' ORDER BY j.submitted_at,j.created_at LIMIT :limit OFFSET :offset")
                .param("limit",pageSize).param("offset",(page-1)*pageSize).query(String.class).list().stream().map(json::object).toList();
        return new PageResult(items,total);
    }

    public PageResult recruiting(int page,int pageSize,String query,String category,UUID companyId,WorkMode workMode,OpportunityType opportunityType) {
        StringBuilder where=new StringBuilder(" WHERE j.status='RECRUITING' AND j.deadline>=current_date AND c.partner_status='ACTIVE'");
        if(query!=null&&!query.isBlank()) where.append(" AND (j.title ILIKE :query OR c.name ILIKE :query OR EXISTS(SELECT 1 FROM job_post_skills x JOIN skills s ON s.id=x.skill_id WHERE x.job_post_id=j.id AND s.name ILIKE :query))");
        if(category!=null&&!category.isBlank()) where.append(" AND EXISTS(SELECT 1 FROM job_post_categories x JOIN categories cat ON cat.id=x.category_id WHERE x.job_post_id=j.id AND (cat.code=:category OR cat.id::text=:category))");
        if(companyId!=null) where.append(" AND j.company_id=:companyId");
        if(workMode!=null) where.append(" AND j.work_mode=:workMode");
        if(opportunityType!=null) where.append(" AND j.opportunity_type=:opportunityType");
        JdbcClient.StatementSpec count=database.sql("SELECT count(*) FROM job_posts j JOIN companies c ON c.id=j.company_id"+where);
        JdbcClient.StatementSpec items=database.sql(JOB_SELECT+where+" ORDER BY j.reviewed_at DESC NULLS LAST,j.created_at DESC LIMIT :limit OFFSET :offset")
                .param("limit",pageSize).param("offset",(page-1)*pageSize);
        if(query!=null&&!query.isBlank()){count=count.param("query","%"+query.strip()+"%");items=items.param("query","%"+query.strip()+"%");}
        if(category!=null&&!category.isBlank()){count=count.param("category",category.strip());items=items.param("category",category.strip());}
        if(companyId!=null){count=count.param("companyId",companyId);items=items.param("companyId",companyId);}
        if(workMode!=null){count=count.param("workMode",workMode.name());items=items.param("workMode",workMode.name());}
        if(opportunityType!=null){count=count.param("opportunityType",opportunityType.name());items=items.param("opportunityType",opportunityType.name());}
        return new PageResult(items.query(String.class).list().stream().map(json::object).toList(),count.query(Long.class).single());
    }

    public String companyStatus(UUID companyId) {
        return database.sql("SELECT partner_status FROM companies WHERE id=:id FOR SHARE").param("id",companyId).query(String.class).optional().orElse(null);
    }

    public UUID createDraft(UUID companyId,UUID userId,Draft input) {
        return database.sql("""
            INSERT INTO job_posts(company_id,created_by_user_id,title,opportunity_type,work_mode,location,description,requirements,benefits,positions,deadline,status)
            VALUES(:companyId,:userId,:title,:opportunityType,:workMode,:location,:description,:requirements,:benefits,:positions,:deadline,'DRAFT') RETURNING id
            """).param("companyId",companyId).param("userId",userId).param("title",input.title().strip())
                .param("opportunityType",input.opportunityType().name()).param("workMode",input.workMode().name())
                .param("location",input.location().strip()).param("description",input.description().strip())
                .param("requirements",input.requirements().strip()).param("benefits",blankToNull(input.benefits()))
                .param("positions",input.positions()).param("deadline",Date.valueOf(input.deadline())).query(UUID.class).single();
    }

    public void updateDraft(UUID jobId,Draft input) {
        database.sql("""
            UPDATE job_posts SET title=:title,opportunity_type=:opportunityType,work_mode=:workMode,location=:location,
              description=:description,requirements=:requirements,benefits=:benefits,positions=:positions,deadline=:deadline,version=version+1 WHERE id=:id
            """).param("id",jobId).param("title",input.title().strip()).param("opportunityType",input.opportunityType().name())
                .param("workMode",input.workMode().name()).param("location",input.location().strip())
                .param("description",input.description().strip()).param("requirements",input.requirements().strip())
                .param("benefits",blankToNull(input.benefits())).param("positions",input.positions())
                .param("deadline",Date.valueOf(input.deadline())).update();
    }

    public boolean referencesValid(String table,List<UUID> ids) {
        Set<UUID> unique=new LinkedHashSet<>(ids); if(unique.isEmpty()) return true;
        String placeholders=String.join(",",java.util.Collections.nCopies(unique.size(),"?"));
        List<Object> params=new ArrayList<>(unique);
        Long count=database.sql("SELECT count(*) FROM "+table+" WHERE is_active=true AND id IN ("+placeholders+")")
                .params(params).query(Long.class).single();
        return count==unique.size();
    }

    public void replaceReferences(UUID jobId,Draft input) {
        database.sql("DELETE FROM job_post_categories WHERE job_post_id=:id").param("id",jobId).update();
        database.sql("DELETE FROM job_post_skills WHERE job_post_id=:id").param("id",jobId).update();
        for(UUID category:new LinkedHashSet<>(input.categoryIds())) database.sql("INSERT INTO job_post_categories(job_post_id,category_id) VALUES(:jobId,:id)").param("jobId",jobId).param("id",category).update();
        for(UUID skill:new LinkedHashSet<>(input.skillIds())) database.sql("INSERT INTO job_post_skills(job_post_id,skill_id) VALUES(:jobId,:id)").param("jobId",jobId).param("id",skill).update();
    }

    public Optional<LockedJob> lock(UUID id) {
        return database.sql("SELECT j.id,j.company_id,j.status,j.version,j.deadline,c.partner_status FROM job_posts j JOIN companies c ON c.id=j.company_id WHERE j.id=:id FOR UPDATE OF j")
                .param("id",id).query((r,n)->new LockedJob(r.getObject("id",UUID.class),r.getObject("company_id",UUID.class),
                        Status.valueOf(r.getString("status")),r.getInt("version"),r.getDate("deadline").toLocalDate(),r.getString("partner_status"))).optional();
    }
    public boolean commandExists(UUID jobId,UUID commandId) {
        return database.sql("SELECT count(*) FROM job_post_status_history WHERE job_post_id=:jobId AND command_id=:commandId")
                .param("jobId",jobId).param("commandId",commandId).query(Long.class).single()>0;
    }
    public void addHistory(UUID jobId,UUID commandId,String from,String to,String actor,UUID actorId,String reasonCode,String note) {
        database.sql("""
          INSERT INTO job_post_status_history(job_post_id,command_id,from_status,to_status,actor_type,actor_user_id,reason_code,note)
          VALUES(:jobId,:commandId,:fromStatus,:toStatus,:actorType,:actorId,:reasonCode,:note)
          """).param("jobId",jobId).param("commandId",commandId).param("fromStatus",from).param("toStatus",to)
                .param("actorType",actor).param("actorId",actorId).param("reasonCode",reasonCode).param("note",note).update();
    }
    public void submit(UUID id) { database.sql("UPDATE job_posts SET status='PENDING_UIT_REVIEW',version=version+1,submitted_at=now(),reviewed_at=NULL,reviewed_by_user_id=NULL WHERE id=:id").param("id",id).update(); }
    public void review(UUID id,Status status,UUID reviewer) { database.sql("UPDATE job_posts SET status=:status,version=version+1,reviewed_by_user_id=:reviewer,reviewed_at=now() WHERE id=:id").param("status",status.name()).param("reviewer",reviewer).param("id",id).update(); }

    private Optional<Map<String,Object>> one(String sql,String name,Object value){return database.sql(sql).param(name,value).query(String.class).optional().map(json::object);}
    private String blankToNull(String value){return value==null||value.isBlank()?null:value.strip();}
}

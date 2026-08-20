package vn.edu.uit.careerhub.placements;

import java.sql.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.JsonSupport;
import vn.edu.uit.careerhub.placements.PlacementModels.Locked;
import vn.edu.uit.careerhub.placements.PlacementModels.PageResult;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;

@Repository
public class PlacementRepository {
    private static final String SELECT="""
      SELECT (jsonb_build_object(
        'id',ip.id,'applicationId',ip.application_id,'status',ip.status,'version',ip.version,
        'expectedStartDate',to_char(ip.expected_start_date,'YYYY-MM-DD'),'actualStartDate',to_char(ip.actual_start_date,'YYYY-MM-DD'),
        'completedDate',to_char(ip.completed_date,'YYYY-MM-DD'),'hiredAt',ip.hired_at,'startedAt',ip.started_at,'completedAt',ip.completed_at,
        'availableActions',CASE ip.status WHEN 'HIRED' THEN '["START"]'::jsonb WHEN 'STARTED' THEN '["COMPLETE"]'::jsonb ELSE '[]'::jsonb END,
        'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,'faculty',sp.faculty,'major',sp.major,'cohort',sp.cohort,'email',su.email),
        'job',jsonb_build_object('id',j.id,'title',j.title,'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name)),
        'history',COALESCE((SELECT jsonb_agg(jsonb_build_object('fromStatus',h.from_status,'toStatus',h.to_status,'actorType',h.actor_type,
          'actorUserId',h.actor_user_id,'actorName',COALESCE(us.full_name,h.actor_type),'effectiveDate',to_char(h.effective_date,'YYYY-MM-DD'),'note',h.note,'createdAt',h.created_at)
          ORDER BY h.created_at,h.id) FROM internship_placement_history h LEFT JOIN uit_staff us ON us.user_id=h.actor_user_id WHERE h.placement_id=ip.id),'[]'::jsonb),
        'evaluations',jsonb_build_object(
          'company',(SELECT jsonb_build_object('id',e.id,'respondentRole',e.respondent_role,'workQualityRating',e.work_quality_rating,
            'collaborationRating',e.collaboration_rating,'professionalismRating',e.professionalism_rating,'overallRating',e.overall_rating,
            'recommendation',e.recommendation,'strengths',e.strengths,'improvements',e.improvements,
            'submittedBy',jsonb_build_object('id',e.submitted_by_user_id,'name',COALESCE(cu.full_name,eu.email)),'submittedAt',e.created_at)
            FROM internship_evaluations e JOIN users eu ON eu.id=e.submitted_by_user_id LEFT JOIN company_users cu ON cu.user_id=eu.id
            WHERE e.placement_id=ip.id AND e.respondent_role='COMPANY'),
          'student',(SELECT jsonb_build_object('id',e.id,'respondentRole',e.respondent_role,'workQualityRating',e.work_quality_rating,
            'collaborationRating',e.collaboration_rating,'professionalismRating',e.professionalism_rating,'overallRating',e.overall_rating,
            'recommendation',e.recommendation,'strengths',e.strengths,'improvements',e.improvements,
            'submittedBy',jsonb_build_object('id',e.submitted_by_user_id,'name',COALESCE(esp.full_name,eu.email)),'submittedAt',e.created_at)
            FROM internship_evaluations e JOIN users eu ON eu.id=e.submitted_by_user_id LEFT JOIN student_profiles esp ON esp.user_id=eu.id
            WHERE e.placement_id=ip.id AND e.respondent_role='STUDENT'))
      ))::text data
      FROM internship_placements ip JOIN applications a ON a.id=ip.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN users su ON su.id=sp.user_id JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
      """;
    private final JdbcClient database;private final JsonSupport json;
    public PlacementRepository(JdbcClient database,JsonSupport json){this.database=database;this.json=json;}

    public PageResult list(int page,int pageSize,Status status,String query){
        StringBuilder where=new StringBuilder(" WHERE 1=1");if(status!=null)where.append(" AND ip.status=:status");
        if(query!=null&&!query.isBlank())where.append(" AND (sp.student_code ILIKE :query OR sp.full_name ILIKE :query OR j.title ILIKE :query OR c.name ILIKE :query)");
        String countBase=" FROM internship_placements ip JOIN applications a ON a.id=ip.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id";
        JdbcClient.StatementSpec count=database.sql("SELECT count(*)"+countBase+where);JdbcClient.StatementSpec items=database.sql(SELECT+where+" ORDER BY CASE ip.status WHEN 'STARTED' THEN 0 WHEN 'HIRED' THEN 1 ELSE 2 END,ip.expected_start_date,ip.id LIMIT :limit OFFSET :offset").param("limit",pageSize).param("offset",(page-1)*pageSize);
        if(status!=null){count=count.param("status",status.name());items=items.param("status",status.name());}if(query!=null&&!query.isBlank()){count=count.param("query","%"+query.strip()+"%");items=items.param("query","%"+query.strip()+"%");}
        Map<String,Long> summary=database.sql("SELECT count(*) total,count(*) FILTER(WHERE status='HIRED') hired,count(*) FILTER(WHERE status='STARTED') started,count(*) FILTER(WHERE status='COMPLETED') completed FROM internship_placements")
                .query((r,n)->{Map<String,Long> m=new LinkedHashMap<>();m.put("total",r.getLong("total"));m.put("HIRED",r.getLong("hired"));m.put("STARTED",r.getLong("started"));m.put("COMPLETED",r.getLong("completed"));return m;}).single();
        return new PageResult(items.query(String.class).list().stream().map(json::object).toList(),count.query(Long.class).single(),summary);
    }
    public Optional<Map<String,Object>> find(UUID id){return database.sql(SELECT+" WHERE ip.id=:id").param("id",id).query(String.class).optional().map(json::object);}
    public Optional<Locked> lock(UUID id){return database.sql("""
      SELECT ip.id,ip.application_id,ip.status,ip.version,ip.actual_start_date,sp.user_id student_user_id,sp.full_name,j.title,c.id company_id,c.name company_name
      FROM internship_placements ip JOIN applications a ON a.id=ip.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id WHERE ip.id=:id FOR UPDATE OF ip
      """).param("id",id).query((r,n)->new Locked(r.getObject("id",UUID.class),r.getObject("application_id",UUID.class),Status.valueOf(r.getString("status")),
              r.getInt("version"),r.getDate("actual_start_date")==null?null:r.getDate("actual_start_date").toLocalDate(),r.getObject("student_user_id",UUID.class),
              r.getString("full_name"),r.getString("title"),r.getObject("company_id",UUID.class),r.getString("company_name"))).optional();}
    public Optional<Status> command(UUID id,UUID commandId){return database.sql("SELECT to_status FROM internship_placement_history WHERE placement_id=:id AND command_id=:commandId")
            .param("id",id).param("commandId",commandId).query(String.class).optional().map(Status::valueOf);}

    public void transition(Locked p,UUID actorId,UUID commandId,Status to,java.time.LocalDate date,String note,RequestMetadata request){
        boolean start=to==Status.STARTED;
        database.sql("""
          UPDATE internship_placements SET status=:status,
            actual_start_date=CASE WHEN :status='STARTED' THEN :date ELSE actual_start_date END,
            completed_date=CASE WHEN :status='COMPLETED' THEN :date ELSE completed_date END,
            started_at=CASE WHEN :status='STARTED' THEN now() ELSE started_at END,
            completed_at=CASE WHEN :status='COMPLETED' THEN now() ELSE completed_at END,version=version+1,updated_at=now() WHERE id=:id
          """).param("status",to.name()).param("date",Date.valueOf(date)).param("id",p.id()).update();
        database.sql("""
          INSERT INTO internship_placement_history(placement_id,command_id,from_status,to_status,actor_type,actor_user_id,effective_date,note,metadata)
          VALUES(:id,:commandId,:fromStatus,:toStatus,'UIT_ADMIN',:actorId,:date,:note,jsonb_build_object('applicationId',CAST(:applicationId AS text)))
          """).param("id",p.id()).param("commandId",commandId).param("fromStatus",p.status().name()).param("toStatus",to.name())
                .param("actorId",actorId).param("date",Date.valueOf(date)).param("note",note).param("applicationId",p.applicationId()).update();
        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:action,'INTERNSHIP_PLACEMENT',:id,jsonb_build_object('commandId',CAST(:commandId AS text),'fromStatus',:fromStatus,
            'toStatus',:toStatus,'effectiveDate',CAST(:date AS text),'applicationId',CAST(:applicationId AS text)),CAST(:ip AS inet),:agent)
          """).param("actorId",actorId).param("action",start?"INTERNSHIP_PLACEMENT_STARTED":"INTERNSHIP_PLACEMENT_COMPLETED").param("id",p.id())
                .param("commandId",commandId).param("fromStatus",p.status().name()).param("toStatus",to.name()).param("date",Date.valueOf(date))
                .param("applicationId",p.applicationId()).param("ip",request.ipAddress()).param("agent",request.userAgent()).update();
        notifyTransition(p,commandId,to,date,start);
    }
    private void notifyTransition(Locked p,UUID commandId,Status to,java.time.LocalDate date,boolean start){
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          VALUES(:userId,:type,:title,:body,'INTERNSHIP_PLACEMENT',:placementId,'/applications/'||CAST(:applicationId AS text),
            'placement:'||CAST(:placementId AS text)||':'||CAST(:commandId AS text)||':student',jsonb_build_object('placementId',CAST(:placementId AS text),
            'applicationId',CAST(:applicationId AS text),'status',:status,'effectiveDate',CAST(:date AS text))) ON CONFLICT(dedupe_key) DO NOTHING
          """).param("userId",p.studentUserId()).param("type",start?"INTERNSHIP_PLACEMENT_STARTED":"INTERNSHIP_PLACEMENT_COMPLETED")
                .param("title",start?"UIT đã ghi nhận bạn bắt đầu thực tập":"UIT đã xác nhận hoàn thành thực tập")
                .param("body",start?"UIT đã ghi nhận bạn bắt đầu vị trí “"+p.jobTitle()+"” tại "+p.companyName()+".":"UIT đã xác nhận bạn hoàn thành vị trí “"+p.jobTitle()+"” tại "+p.companyName()+".")
                .param("placementId",p.id()).param("applicationId",p.applicationId()).param("commandId",commandId).param("status",to.name()).param("date",Date.valueOf(date)).update();
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,:type,:title,:studentName||CASE WHEN :status='STARTED' THEN ' bắt đầu' ELSE ' hoàn thành' END||' kỳ thực tập cho vị trí “'||:jobTitle||'”.',
            'INTERNSHIP_PLACEMENT',:placementId,'/company/candidates/'||CAST(:applicationId AS text),
            'placement:'||CAST(:placementId AS text)||':'||CAST(:commandId AS text)||':company:'||CAST(u.id AS text),
            jsonb_build_object('placementId',CAST(:placementId AS text),'applicationId',CAST(:applicationId AS text),'status',:status,'effectiveDate',CAST(:date AS text))
          FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=:companyId AND u.status='ACTIVE' ON CONFLICT(dedupe_key) DO NOTHING
          """).param("type",start?"INTERNSHIP_PLACEMENT_STARTED":"INTERNSHIP_PLACEMENT_COMPLETED").param("title",start?"UIT đã ghi nhận sinh viên bắt đầu thực tập":"UIT đã xác nhận sinh viên hoàn thành thực tập")
                .param("studentName",p.studentName()).param("status",to.name()).param("jobTitle",p.jobTitle()).param("placementId",p.id()).param("applicationId",p.applicationId())
                .param("commandId",commandId).param("date",Date.valueOf(date)).param("companyId",p.companyId()).update();
    }
}

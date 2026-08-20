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
import vn.edu.uit.careerhub.placements.PlacementModels.Context;
import vn.edu.uit.careerhub.placements.PlacementModels.EvaluationRole;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;
import vn.edu.uit.careerhub.placements.PlacementRequests.Evaluation;

@Repository
public class EvaluationRepository {
    private static final String CONTEXT="""
      SELECT ip.id placement_id,ip.application_id,ip.status,ip.expected_start_date,ip.actual_start_date,ip.completed_date,
        sp.id student_profile_id,sp.user_id student_user_id,sp.full_name student_name,c.id company_id,c.name company_name,j.title job_title
      FROM internship_placements ip JOIN applications a ON a.id=ip.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
      """;
    private static final String EVALUATION="""
      SELECT (jsonb_build_object('id',e.id,'respondentRole',e.respondent_role,'workQualityRating',e.work_quality_rating,
        'collaborationRating',e.collaboration_rating,'professionalismRating',e.professionalism_rating,'overallRating',e.overall_rating,
        'recommendation',e.recommendation,'strengths',e.strengths,'improvements',e.improvements,
        'submittedBy',jsonb_build_object('id',e.submitted_by_user_id,'name',COALESCE(sp.full_name,cu.full_name,u.email)),'submittedAt',e.created_at))::text data
      FROM internship_evaluations e JOIN users u ON u.id=e.submitted_by_user_id LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN company_users cu ON cu.user_id=u.id
      """;
    private final JdbcClient database;private final JsonSupport json;
    public EvaluationRepository(JdbcClient database,JsonSupport json){this.database=database;this.json=json;}
    public Optional<Context> context(UUID applicationId,boolean lock){return database.sql(CONTEXT+" WHERE ip.application_id=:id"+(lock?" FOR UPDATE OF ip":""))
            .param("id",applicationId).query((r,n)->new Context(r.getObject("placement_id",UUID.class),r.getObject("application_id",UUID.class),Status.valueOf(r.getString("status")),
                    r.getDate("expected_start_date").toLocalDate(),r.getDate("actual_start_date")==null?null:r.getDate("actual_start_date").toLocalDate(),
                    r.getDate("completed_date")==null?null:r.getDate("completed_date").toLocalDate(),r.getObject("student_profile_id",UUID.class),r.getObject("student_user_id",UUID.class),
                    r.getString("student_name"),r.getObject("company_id",UUID.class),r.getString("company_name"),r.getString("job_title"))).optional();}
    public List<Map<String,Object>> list(UUID placementId){return database.sql(EVALUATION+" WHERE e.placement_id=:id ORDER BY e.created_at,e.id").param("id",placementId)
            .query(String.class).list().stream().map(json::object).toList();}
    public Optional<Map<String,Object>> byCommand(UUID placementId,UUID commandId){return database.sql(EVALUATION+" WHERE e.placement_id=:id AND e.command_id=:commandId")
            .param("id",placementId).param("commandId",commandId).query(String.class).optional().map(json::object);}
    public Map<String,Object> view(Context context,EvaluationRole viewer){List<Map<String,Object>> evaluations=list(context.placementId());
        Map<String,Object> company=evaluations.stream().filter(e->"COMPANY".equals(e.get("respondentRole"))).findFirst().orElse(null);
        Map<String,Object> student=evaluations.stream().filter(e->"STUDENT".equals(e.get("respondentRole"))).findFirst().orElse(null);
        Map<String,Object> placement=new LinkedHashMap<>();placement.put("id",context.placementId());placement.put("applicationId",context.applicationId());placement.put("status",context.status().name());
        placement.put("expectedStartDate",context.expectedStartDate().toString());placement.put("actualStartDate",context.actualStartDate()==null?null:context.actualStartDate().toString());placement.put("completedDate",context.completedDate()==null?null:context.completedDate().toString());
        Map<String,Object> result=new LinkedHashMap<>();result.put("placement",placement);result.put("companyEvaluation",company);result.put("studentEvaluation",viewer==EvaluationRole.COMPANY?null:student);
        result.put("studentEvaluationSubmitted",student!=null);Map<String,Object> own=viewer==EvaluationRole.COMPANY?company:student;result.put("canSubmit",context.status()==Status.COMPLETED&&own==null);return result;}
    public UUID insert(Context c,EvaluationRole role,UUID actorId,UUID commandId,Evaluation input,RequestMetadata request){
        UUID id=database.sql("""
          INSERT INTO internship_evaluations(placement_id,respondent_role,submitted_by_user_id,command_id,work_quality_rating,collaboration_rating,
            professionalism_rating,overall_rating,recommendation,strengths,improvements)
          VALUES(:placementId,:role,:actorId,:commandId,:work,:collaboration,:professionalism,:overall,:recommendation,:strengths,:improvements) RETURNING id
          """).param("placementId",c.placementId()).param("role",role.name()).param("actorId",actorId).param("commandId",commandId)
                .param("work",input.workQualityRating()).param("collaboration",input.collaborationRating()).param("professionalism",input.professionalismRating())
                .param("overall",input.overallRating()).param("recommendation",input.recommendation()).param("strengths",input.strengths().strip())
                .param("improvements",input.improvements()==null?null:input.improvements().strip()).query(UUID.class).single();
        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:action,'INTERNSHIP_EVALUATION',:id,jsonb_build_object('placementId',CAST(:placementId AS text),'applicationId',CAST(:applicationId AS text),
            'respondentRole',:role,'commandId',CAST(:commandId AS text)),CAST(:ip AS inet),:agent)
          """).param("actorId",actorId).param("action",role==EvaluationRole.COMPANY?"COMPANY_INTERNSHIP_EVALUATION_SUBMITTED":"STUDENT_INTERNSHIP_EVALUATION_SUBMITTED")
                .param("id",id).param("placementId",c.placementId()).param("applicationId",c.applicationId()).param("role",role.name()).param("commandId",commandId)
                .param("ip",request.ipAddress()).param("agent",request.userAgent()).update();notify(c,role,id);return id;
    }
    private void notify(Context c,EvaluationRole role,UUID evaluationId){
        if(role==EvaluationRole.COMPANY)database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          VALUES(:userId,'COMPANY_INTERNSHIP_EVALUATION_SUBMITTED','Doanh nghiệp đã gửi đánh giá kỳ thực tập',:body,'INTERNSHIP_EVALUATION',:evaluationId,
            '/applications/'||CAST(:applicationId AS text),'evaluation:'||CAST(:evaluationId AS text)||':student',jsonb_build_object('placementId',CAST(:placementId AS text),
            'applicationId',CAST(:applicationId AS text),'respondentRole','COMPANY')) ON CONFLICT(dedupe_key) DO NOTHING
          """).param("userId",c.studentUserId()).param("body",c.companyName()+" đã gửi đánh giá cho vị trí “"+c.jobTitle()+"”.").param("evaluationId",evaluationId)
                .param("applicationId",c.applicationId()).param("placementId",c.placementId()).update();
        else database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,'STUDENT_INTERNSHIP_EVALUATION_SUBMITTED','Sinh viên đã gửi phản hồi kỳ thực tập',:body,'INTERNSHIP_EVALUATION',:evaluationId,
            '/company/candidates/'||CAST(:applicationId AS text),'evaluation:'||CAST(:evaluationId AS text)||':company:'||CAST(u.id AS text),
            jsonb_build_object('placementId',CAST(:placementId AS text),'applicationId',CAST(:applicationId AS text),'respondentRole','STUDENT','contentVisible',false)
          FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=:companyId AND u.status='ACTIVE' ON CONFLICT(dedupe_key) DO NOTHING
          """).param("body",c.studentName()+" đã gửi phản hồi riêng cho UIT về vị trí “"+c.jobTitle()+"”.").param("evaluationId",evaluationId)
                .param("applicationId",c.applicationId()).param("placementId",c.placementId()).param("companyId",c.companyId()).update();
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,:type,:title,:body,'INTERNSHIP_EVALUATION',:evaluationId,'/uit/placements/'||CAST(:placementId AS text),
            'evaluation:'||CAST(:evaluationId AS text)||':uit:'||CAST(u.id AS text),jsonb_build_object('placementId',CAST(:placementId AS text),
            'applicationId',CAST(:applicationId AS text),'respondentRole',:role) FROM uit_staff s JOIN users u ON u.id=s.user_id WHERE u.status='ACTIVE'
          ON CONFLICT(dedupe_key) DO NOTHING
          """).param("type",role==EvaluationRole.COMPANY?"COMPANY_INTERNSHIP_EVALUATION_SUBMITTED":"STUDENT_INTERNSHIP_EVALUATION_SUBMITTED")
                .param("title",role==EvaluationRole.COMPANY?"Doanh nghiệp đã gửi đánh giá thực tập":"Sinh viên đã gửi phản hồi thực tập")
                .param("body",(role==EvaluationRole.COMPANY?c.companyName():c.studentName())+" đã hoàn tất phiếu cho vị trí “"+c.jobTitle()+"”.")
                .param("evaluationId",evaluationId).param("placementId",c.placementId()).param("applicationId",c.applicationId()).param("role",role.name()).update();
    }
}

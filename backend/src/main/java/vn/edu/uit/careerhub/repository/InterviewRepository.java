package vn.edu.uit.careerhub.repository;

import java.sql.Types;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.request.InterviewRequest;
import vn.edu.uit.careerhub.entity.LockedInterview;
import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class InterviewRepository {
    private static final String INTERVIEW_SELECT = """
      SELECT (jsonb_build_object('id',i.id,'applicationId',i.application_id,'scheduledAt',i.scheduled_at,
        'timeZone',i.time_zone,'mode',i.mode,'location',i.location,'meetingUrl',i.meeting_url,
        'interviewerName',i.interviewer_name,'status',i.status,'version',i.version,
        'applicationStatus',a.status,
        'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,
          'major',sp.major,'gpa',sp.gpa),
        'job',jsonb_build_object('id',j.id,'title',j.title,'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name)),
        'recruitmentResult',CASE WHEN rr.id IS NULL THEN NULL ELSE jsonb_build_object('outcome',rr.outcome,
          'studentDecision',rr.student_decision) END))::text data
      FROM interviews i JOIN applications a ON a.id=i.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
      LEFT JOIN recruitment_results rr ON rr.application_id=a.id
      """;

    private final JdbcClient database;
    private final JsonSupport json;

    public InterviewRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public PageResult interviews(UUID owner,boolean company,int page,int pageSize,String scope){
        String ownership=company?"j.company_id=:owner":"a.student_profile_id=:owner";
        String scopeSql="upcoming".equals(scope)?" AND i.scheduled_at>=now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED')":
                "history".equals(scope)?" AND (i.scheduled_at<now() OR i.status IN ('CANCELLED','COMPLETED','NO_SHOW'))":"";
        long total=database.sql("SELECT count(*) FROM interviews i JOIN applications a ON a.id=i.application_id JOIN job_posts j ON j.id=a.job_post_id WHERE "+ownership+scopeSql)
                .param("owner",owner).query(Long.class).single();
        var items=database.sql(INTERVIEW_SELECT+" WHERE "+ownership+scopeSql+" ORDER BY CASE WHEN i.scheduled_at>=now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED') THEN 0 ELSE 1 END,i.scheduled_at,i.id LIMIT :limit OFFSET :offset")
                .param("owner",owner).param("limit",pageSize).param("offset",(page-1)*pageSize)
                .query(String.class).list().stream().map(json::object).toList();
        return new PageResult(items,total);
    }

    public Optional<Map<String,Object>> interviewByCommand(UUID applicationId,UUID commandId){return database.sql("""
      SELECT (jsonb_build_object('id',id,'applicationId',application_id,'scheduledAt',scheduled_at,'timeZone',time_zone,
        'mode',mode,'location',location,'meetingUrl',meeting_url,'interviewerName',interviewer_name,'status',status,'version',version))::text
      FROM interviews WHERE application_id=:applicationId AND command_id=:commandId
      """).param("applicationId",applicationId).param("commandId",commandId).query(String.class).optional().map(json::object);}

    public Optional<Map<String,Object>> studentInterview(UUID interviewId,UUID studentId){return database.sql(INTERVIEW_SELECT+" WHERE i.id=:id AND a.student_profile_id=:studentId")
            .param("id",interviewId).param("studentId",studentId).query(String.class).optional().map(json::object);}

    public Optional<LockedInterview> lockForStudent(UUID interviewId, UUID studentId) {
        return database.sql("""
          SELECT i.id,i.application_id,i.status,sp.full_name,j.title,c.id company_id FROM interviews i
          JOIN applications a ON a.id=i.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
          JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
          WHERE i.id=:id AND a.student_profile_id=:studentId FOR UPDATE OF i
          """).param("id",interviewId).param("studentId",studentId)
                .query((r,n)->new LockedInterview(r.getString("status"),r.getObject("application_id",UUID.class),r.getObject("company_id",UUID.class))).optional();
    }

    public void confirm(UUID interviewId) {
        database.sql("UPDATE interviews SET status='CONFIRMED',version=version+1 WHERE id=:id").param("id",interviewId).update();
    }

    public void insert(UUID interviewId, UUID applicationId, UUID commandId, UUID actor, InterviewRequest input) {
        database.sql("""
          INSERT INTO interviews(id,application_id,command_id,created_by_user_id,scheduled_at,time_zone,mode,location,meeting_url,interviewer_name)
          VALUES(:id,:applicationId,:commandId,:actor,:scheduled,:zone,:mode,:location,:url,:name)
          """).param("id",interviewId).param("applicationId",applicationId).param("commandId",commandId).param("actor",actor)
                .param("scheduled",input.scheduledAt()).param("zone",input.timeZone()).param("mode",input.mode().name())
                .param("location",input.location(),Types.VARCHAR).param("url",input.meetingUrl(),Types.VARCHAR).param("name",input.interviewerName().strip()).update();
    }

    public Optional<UUID> completeLatest(UUID applicationId) {
        return database.sql("""
          UPDATE interviews SET status='COMPLETED',version=version+1 WHERE id=(SELECT id FROM interviews
          WHERE application_id=:id AND status<>'CANCELLED' ORDER BY scheduled_at DESC,created_at DESC LIMIT 1) RETURNING id
          """).param("id",applicationId).query(UUID.class).optional();
    }

    public int cancelActive(UUID applicationId, String reason) {
        return database.sql("UPDATE interviews SET status='CANCELLED',cancellation_reason=:note,version=version+1 WHERE application_id=:id AND status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED')")
                .param("note",reason).param("id",applicationId).update();
    }

    public void cancelForAcceptedOtherJob(List<UUID> applicationIds) {
        database.sql("UPDATE interviews SET status='CANCELLED',cancellation_reason='ACCEPTED_OTHER_JOB',version=version+1 WHERE application_id IN (:ids) AND status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED')")
                .param("ids",applicationIds).update();
    }
}

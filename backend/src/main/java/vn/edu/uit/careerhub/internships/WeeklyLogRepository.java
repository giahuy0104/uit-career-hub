package vn.edu.uit.careerhub.internships;

import java.sql.Date;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.JsonSupport;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Action;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.ActorType;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.LogContext;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.PlacementContext;
import vn.edu.uit.careerhub.internships.WeeklyLogModels.Status;
import vn.edu.uit.careerhub.internships.WeeklyLogRequests.Save;
import vn.edu.uit.careerhub.placements.PlacementModels;

@Repository
public class WeeklyLogRepository {
    private static final String PLACEMENT_FROM = """
      FROM internship_placements ip
      JOIN applications a ON a.id=ip.application_id
      JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id
      """;

    private static final String PLACEMENT_SELECT = """
      SELECT ip.id placement_id,ip.application_id,ip.status placement_status,ip.expected_start_date,ip.actual_start_date,
        sp.id student_profile_id,sp.user_id student_user_id,sp.full_name student_name,sp.student_code,
        c.id company_id,c.name company_name,j.title job_title
      """;

    private static final String LOG_JSON = """
      jsonb_build_object(
        'id',l.id,'placementId',l.placement_id,'weekNumber',l.week_number,
        'periodStart',to_char(l.period_start,'YYYY-MM-DD'),'periodEnd',to_char(l.period_end,'YYYY-MM-DD'),
        'dueDate',to_char(l.due_date,'YYYY-MM-DD'),'status',l.status,'version',l.version,
        'currentSubmissionNo',l.current_submission_no,'workSummary',l.work_summary,'outcomes',l.outcomes,
        'difficulties',l.difficulties,'nextPlan',l.next_plan,'latestReasonCode',l.latest_reason_code,
        'latestNote',l.latest_note,'submittedAt',l.submitted_at,'companyReviewedAt',l.company_reviewed_at,
        'createdAt',l.created_at,'updatedAt',l.updated_at,
        'overdue',(l.status IN ('DRAFT','COMPANY_REVISION_REQUIRED') AND l.due_date < current_date),
        'lateSubmission',(l.submitted_at IS NOT NULL AND l.submitted_at::date > l.due_date),
        'availableActions','[]'::jsonb,
        'history',COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',h.id,'action',h.action,'fromStatus',h.from_status,'toStatus',h.to_status,
            'actorType',h.actor_type,'actorUserId',h.actor_user_id,
            'actorName',COALESCE(hsp.full_name,hcu.full_name,hu.email,h.actor_type),
            'reasonCode',h.reason_code,'note',h.note,'createdAt',h.created_at
          ) ORDER BY h.created_at,h.id)
          FROM internship_weekly_log_history h
          LEFT JOIN users hu ON hu.id=h.actor_user_id
          LEFT JOIN student_profiles hsp ON hsp.user_id=hu.id
          LEFT JOIN company_users hcu ON hcu.user_id=hu.id
          WHERE h.weekly_log_id=l.id
        ),'[]'::jsonb)
      )
      """;

    private final JdbcClient database;
    private final JsonSupport json;

    public WeeklyLogRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public Optional<PlacementContext> placement(UUID placementId, boolean lock) {
        if (lock && database.sql("SELECT id FROM internship_placements WHERE id=:id FOR UPDATE")
                .param("id", placementId).query(UUID.class).optional().isEmpty()) {
            return Optional.empty();
        }
        return database.sql(PLACEMENT_SELECT + PLACEMENT_FROM + " WHERE ip.id=:id")
                .param("id", placementId).query((row, number) -> new PlacementContext(
                        row.getObject("placement_id", UUID.class), row.getObject("application_id", UUID.class),
                        PlacementModels.Status.valueOf(row.getString("placement_status")),
                        localDate(row.getDate("expected_start_date")), localDate(row.getDate("actual_start_date")),
                        row.getObject("student_profile_id", UUID.class), row.getObject("student_user_id", UUID.class),
                        row.getString("student_name"), row.getString("student_code"),
                        row.getObject("company_id", UUID.class), row.getString("company_name"), row.getString("job_title")))
                .optional();
    }

    public List<Map<String, Object>> logs(UUID placementId) {
        return database.sql("SELECT (" + LOG_JSON + ")::text data FROM internship_weekly_logs l WHERE l.placement_id=:id ORDER BY l.week_number DESC")
                .param("id", placementId).query(String.class).list().stream().map(json::object).toList();
    }

    public Optional<LogContext> lockLog(UUID placementId, UUID logId) {
        return database.sql("""
          SELECT id,placement_id,week_number,period_start,period_end,due_date,status,version,current_submission_no,
            work_summary,outcomes,difficulties,next_plan
          FROM internship_weekly_logs WHERE id=:logId AND placement_id=:placementId FOR UPDATE
          """).param("logId", logId).param("placementId", placementId)
                .query((row, number) -> new LogContext(
                        row.getObject("id", UUID.class), row.getObject("placement_id", UUID.class), row.getInt("week_number"),
                        localDate(row.getDate("period_start")), localDate(row.getDate("period_end")), localDate(row.getDate("due_date")),
                        Status.valueOf(row.getString("status")), row.getInt("version"), row.getInt("current_submission_no"),
                        row.getString("work_summary"), row.getString("outcomes"), row.getString("difficulties"), row.getString("next_plan")))
                .optional();
    }

    public int nextWeekNumber(UUID placementId) {
        return database.sql("SELECT COALESCE(max(week_number),0)+1 FROM internship_weekly_logs WHERE placement_id=:id")
                .param("id", placementId).query(Integer.class).single();
    }

    public Optional<Action> command(UUID logId, UUID commandId) {
        return database.sql("SELECT action FROM internship_weekly_log_history WHERE weekly_log_id=:logId AND command_id=:commandId")
                .param("logId", logId).param("commandId", commandId).query(String.class).optional().map(Action::valueOf);
    }

    public UUID create(PlacementContext placement, UUID actorId, int weekNumber, LocalDate periodStart,
            LocalDate periodEnd, LocalDate dueDate, Save input, RequestMetadata request) {
        UUID id = database.sql("""
          INSERT INTO internship_weekly_logs(placement_id,week_number,period_start,period_end,due_date,
            work_summary,outcomes,difficulties,next_plan)
          VALUES(:placementId,:weekNumber,:periodStart,:periodEnd,:dueDate,:workSummary,:outcomes,:difficulties,:nextPlan)
          RETURNING id
          """).param("placementId", placement.placementId()).param("weekNumber", weekNumber)
                .param("periodStart", Date.valueOf(periodStart)).param("periodEnd", Date.valueOf(periodEnd))
                .param("dueDate", Date.valueOf(dueDate)).param("workSummary", clean(input.workSummary()))
                .param("outcomes", clean(input.outcomes())).param("difficulties", clean(input.difficulties()))
                .param("nextPlan", clean(input.nextPlan())).query(UUID.class).single();
        auditSave(id, placement, actorId, "INTERNSHIP_WEEKLY_LOG_CREATED", request);
        return id;
    }

    public void update(PlacementContext placement, LogContext log, UUID actorId, Save input, RequestMetadata request) {
        database.sql("""
          UPDATE internship_weekly_logs SET work_summary=:workSummary,outcomes=:outcomes,difficulties=:difficulties,
            next_plan=:nextPlan,version=version+1,updated_at=now() WHERE id=:id
          """).param("workSummary", clean(input.workSummary())).param("outcomes", clean(input.outcomes()))
                .param("difficulties", clean(input.difficulties())).param("nextPlan", clean(input.nextPlan()))
                .param("id", log.id()).update();
        auditSave(log.id(), placement, actorId, "INTERNSHIP_WEEKLY_LOG_UPDATED", request);
    }

    private void auditSave(UUID logId, PlacementContext placement, UUID actorId, String action, RequestMetadata request) {
        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:action,'INTERNSHIP_WEEKLY_LOG',:logId,
            jsonb_build_object('placementId',CAST(:placementId AS text),'applicationId',CAST(:applicationId AS text)),
            CAST(:ip AS inet),:agent)
          """).param("actorId", actorId).param("action", action).param("logId", logId)
                .param("placementId", placement.placementId()).param("applicationId", placement.applicationId())
                .param("ip", request.ipAddress()).param("agent", request.userAgent()).update();
    }

    public void transition(PlacementContext placement, LogContext log, UUID actorId, UUID commandId,
            ActorType actorType, Action action, Status next, String reasonCode, String note, RequestMetadata request) {
        int submissionNo = log.currentSubmissionNo() + (action == Action.SUBMIT ? 1 : 0);
        database.sql("""
          UPDATE internship_weekly_logs SET status=:status,version=version+1,current_submission_no=:submissionNo,
            latest_reason_code=:reasonCode,latest_note=:note,
            submitted_at=CASE WHEN :action='SUBMIT' THEN now() ELSE submitted_at END,
            company_reviewed_at=CASE WHEN :action LIKE 'COMPANY_%' THEN now() ELSE company_reviewed_at END,
            updated_at=now() WHERE id=:id
          """).param("status", next.name()).param("submissionNo", submissionNo).param("reasonCode", reasonCode)
                .param("note", note).param("action", action.name()).param("id", log.id()).update();

        if (action == Action.SUBMIT) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("weekNumber", log.weekNumber());
            snapshot.put("periodStart", log.periodStart().toString());
            snapshot.put("periodEnd", log.periodEnd().toString());
            snapshot.put("dueDate", log.dueDate().toString());
            snapshot.put("workSummary", log.workSummary());
            snapshot.put("outcomes", log.outcomes());
            snapshot.put("difficulties", log.difficulties());
            snapshot.put("nextPlan", log.nextPlan());
            database.sql("""
              INSERT INTO internship_weekly_log_submissions(weekly_log_id,submission_no,submitted_by_user_id,snapshot)
              VALUES(:logId,:submissionNo,:actorId,CAST(:snapshot AS jsonb))
              """).param("logId", log.id()).param("submissionNo", submissionNo).param("actorId", actorId)
                    .param("snapshot", json.stringify(snapshot)).update();
        }

        database.sql("""
          INSERT INTO internship_weekly_log_history(weekly_log_id,command_id,action,from_status,to_status,actor_type,
            actor_user_id,reason_code,note,metadata)
          VALUES(:logId,:commandId,:action,:fromStatus,:toStatus,:actorType,:actorId,:reasonCode,:note,
            jsonb_build_object('placementId',CAST(:placementId AS text),'weekNumber',:weekNumber,'submissionNo',:submissionNo))
          """).param("logId", log.id()).param("commandId", commandId).param("action", action.name())
                .param("fromStatus", log.status().name()).param("toStatus", next.name()).param("actorType", actorType.name())
                .param("actorId", actorId).param("reasonCode", reasonCode).param("note", note)
                .param("placementId", placement.placementId()).param("weekNumber", log.weekNumber())
                .param("submissionNo", submissionNo).update();

        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:auditAction,'INTERNSHIP_WEEKLY_LOG',:logId,
            jsonb_build_object('commandId',CAST(:commandId AS text),'placementId',CAST(:placementId AS text),
              'fromStatus',:fromStatus,'toStatus',:toStatus,'reasonCode',CAST(:reasonCode AS text)),
            CAST(:ip AS inet),:agent)
          """).param("actorId", actorId).param("auditAction", "INTERNSHIP_WEEKLY_LOG_" + action.name())
                .param("logId", log.id()).param("commandId", commandId).param("placementId", placement.placementId())
                .param("fromStatus", log.status().name()).param("toStatus", next.name()).param("reasonCode", reasonCode)
                .param("ip", request.ipAddress()).param("agent", request.userAgent()).update();

        notifyTransition(placement, log, commandId, action, next, note);
    }

    public Map<String, Long> summary() {
        return database.sql("""
          SELECT (SELECT count(*) FROM internship_placements WHERE status='STARTED') started_placements,
            count(*) total_logs,
            count(*) FILTER(WHERE status='DRAFT') draft,
            count(*) FILTER(WHERE status='SUBMITTED') submitted,
            count(*) FILTER(WHERE status='COMPANY_REVISION_REQUIRED') revision_required,
            count(*) FILTER(WHERE status='COMPANY_CONFIRMED') confirmed,
            count(*) FILTER(WHERE status IN ('DRAFT','COMPANY_REVISION_REQUIRED') AND due_date<current_date) overdue
          FROM internship_weekly_logs
          """).query((row, number) -> {
              Map<String, Long> result = new LinkedHashMap<>();
              result.put("startedPlacements", row.getLong("started_placements"));
              result.put("totalLogs", row.getLong("total_logs"));
              result.put("draft", row.getLong("draft"));
              result.put("submitted", row.getLong("submitted"));
              result.put("revisionRequired", row.getLong("revision_required"));
              result.put("confirmed", row.getLong("confirmed"));
              result.put("overdue", row.getLong("overdue"));
              return result;
          }).single();
    }

    public List<Map<String, Object>> overdue() {
        String placementJson = """
          jsonb_build_object('id',ip.id,'applicationId',ip.application_id,'status',ip.status,
            'actualStartDate',to_char(ip.actual_start_date,'YYYY-MM-DD'),
            'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,
              'faculty',sp.faculty,'major',sp.major,'cohort',sp.cohort),
            'job',jsonb_build_object('id',j.id,'title',j.title,
              'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name)))
          """;
        return database.sql("SELECT (jsonb_build_object('placement'," + placementJson + ",'log'," + LOG_JSON + "))::text data "
                + PLACEMENT_FROM + " JOIN internship_weekly_logs l ON l.placement_id=ip.id "
                + "WHERE l.status IN ('DRAFT','COMPANY_REVISION_REQUIRED') AND l.due_date<current_date ORDER BY l.due_date,l.id")
                .query(String.class).list().stream().map(json::object).toList();
    }

    private void notifyTransition(PlacementContext placement, LogContext log, UUID commandId,
            Action action, Status next, String note) {
        if (action == Action.SUBMIT) {
            database.sql("""
              INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
              SELECT u.id,'INTERNSHIP_WEEKLY_LOG_SUBMITTED','Sinh viên đã nộp nhật ký thực tập',
                :studentName||' đã nộp nhật ký tuần '||CAST(:weekNumber AS text)||'.',
                'INTERNSHIP_WEEKLY_LOG',:logId,'/company/internships/'||CAST(:placementId AS text),
                'weekly-log:'||CAST(:logId AS text)||':'||CAST(:commandId AS text)||':company:'||CAST(u.id AS text),
                jsonb_build_object('placementId',CAST(:placementId AS text),'weeklyLogId',CAST(:logId AS text),'status',:status)
              FROM company_users cu JOIN users u ON u.id=cu.user_id
              WHERE cu.company_id=:companyId AND u.status='ACTIVE' ON CONFLICT(dedupe_key) DO NOTHING
              """).param("studentName", placement.studentName()).param("weekNumber", log.weekNumber())
                    .param("logId", log.id()).param("placementId", placement.placementId()).param("commandId", commandId)
                    .param("status", next.name()).param("companyId", placement.companyId()).update();
            return;
        }

        boolean confirmed = action == Action.COMPANY_CONFIRM;
        String body = confirmed
                ? placement.companyName() + " đã xác nhận nhật ký tuần " + log.weekNumber() + "."
                : placement.companyName() + " yêu cầu chỉnh sửa nhật ký tuần " + log.weekNumber() + ". " + safe(note);
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          VALUES(:userId,:type,:title,:body,'INTERNSHIP_WEEKLY_LOG',:logId,
            '/student/internships/'||CAST(:placementId AS text),
            'weekly-log:'||CAST(:logId AS text)||':'||CAST(:commandId AS text)||':student',
            jsonb_build_object('placementId',CAST(:placementId AS text),'weeklyLogId',CAST(:logId AS text),'status',:status))
          ON CONFLICT(dedupe_key) DO NOTHING
          """).param("userId", placement.studentUserId())
                .param("type", confirmed ? "INTERNSHIP_WEEKLY_LOG_CONFIRMED" : "INTERNSHIP_WEEKLY_LOG_REVISION_REQUIRED")
                .param("title", confirmed ? "Doanh nghiệp đã xác nhận nhật ký" : "Doanh nghiệp yêu cầu sửa nhật ký")
                .param("body", body).param("logId", log.id()).param("placementId", placement.placementId())
                .param("commandId", commandId).param("status", next.name()).update();
    }

    private static LocalDate localDate(Date value) { return value == null ? null : value.toLocalDate(); }
    private static String clean(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static String safe(String value) { return value == null || value.isBlank() ? "" : value.strip(); }
}

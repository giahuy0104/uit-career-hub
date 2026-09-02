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
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Action;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.ActorType;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Context;
import vn.edu.uit.careerhub.internships.InternshipPlanModels.Status;
import vn.edu.uit.careerhub.internships.InternshipPlanRequests.SaveDraft;
import vn.edu.uit.careerhub.placements.PlacementModels;

@Repository
public class InternshipPlanRepository {
    private static final String FROM = """
      FROM internship_placements ip
      JOIN applications a ON a.id=ip.application_id
      JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN users su ON su.id=sp.user_id
      JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id
      LEFT JOIN internship_plans p ON p.placement_id=ip.id
      """;

    private static final String VIEW = """
      SELECT (jsonb_build_object(
        'placement',jsonb_build_object(
          'id',ip.id,'applicationId',ip.application_id,'status',ip.status,'version',ip.version,
          'expectedStartDate',to_char(ip.expected_start_date,'YYYY-MM-DD'),
          'actualStartDate',to_char(ip.actual_start_date,'YYYY-MM-DD'),
          'completedDate',to_char(ip.completed_date,'YYYY-MM-DD'),
          'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,
            'faculty',sp.faculty,'major',sp.major,'cohort',sp.cohort,'email',su.email),
          'job',jsonb_build_object('id',j.id,'title',j.title,
            'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name))
        ),
        'plan',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id',p.id,'status',p.status,'version',p.version,'title',p.title,'department',p.department,
          'companySupervisorName',p.company_supervisor_name,'companySupervisorEmail',p.company_supervisor_email,
          'objectives',p.objectives,'expectedTasks',p.expected_tasks,'expectedSkills',p.expected_skills,
          'startDate',to_char(p.start_date,'YYYY-MM-DD'),'endDate',to_char(p.end_date,'YYYY-MM-DD'),
          'currentSubmissionNo',p.current_submission_no,'latestReasonCode',p.latest_reason_code,'latestNote',p.latest_note,
          'submittedAt',p.submitted_at,'companyReviewedAt',p.company_reviewed_at,'uitReviewedAt',p.uit_reviewed_at,
          'createdAt',p.created_at,'updatedAt',p.updated_at,
          'history',COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id',h.id,'action',h.action,'fromStatus',h.from_status,'toStatus',h.to_status,
              'actorType',h.actor_type,'actorUserId',h.actor_user_id,
              'actorName',COALESCE(hsp.full_name,hcu.full_name,hus.full_name,hu.email,h.actor_type),
              'reasonCode',h.reason_code,'note',h.note,'createdAt',h.created_at
            ) ORDER BY h.created_at,h.id)
            FROM internship_plan_history h
            LEFT JOIN users hu ON hu.id=h.actor_user_id
            LEFT JOIN student_profiles hsp ON hsp.user_id=hu.id
            LEFT JOIN company_users hcu ON hcu.user_id=hu.id
            LEFT JOIN uit_staff hus ON hus.user_id=hu.id
            WHERE h.plan_id=p.id
          ),'[]'::jsonb)
        ) END
      ))::text data
      """;

    private static final String CONTEXT = """
      SELECT ip.id placement_id,ip.application_id,ip.status placement_status,
        sp.id student_profile_id,sp.user_id student_user_id,sp.full_name student_name,
        c.id company_id,c.name company_name,j.title job_title,
        p.id plan_id,p.status plan_status,p.version plan_version,p.current_submission_no,
        p.title,p.department,p.company_supervisor_name,p.company_supervisor_email,
        p.objectives,p.expected_tasks,p.expected_skills,p.start_date,p.end_date
      """;

    private final JdbcClient database;
    private final JsonSupport json;

    public InternshipPlanRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public List<Map<String, Object>> listForStudent(UUID studentProfileId) {
        return views(" WHERE sp.id=:owner ORDER BY ip.created_at DESC,ip.id", studentProfileId);
    }

    public List<Map<String, Object>> listForCompany(UUID companyId) {
        return views(" WHERE c.id=:owner ORDER BY CASE p.status WHEN 'PENDING_COMPANY_REVIEW' THEN 0 ELSE 1 END,p.updated_at DESC NULLS LAST,ip.created_at DESC", companyId);
    }

    public List<Map<String, Object>> listForUit() {
        return database.sql(VIEW + FROM + " ORDER BY CASE p.status WHEN 'PENDING_UIT_REVIEW' THEN 0 ELSE 1 END,p.updated_at DESC NULLS LAST,ip.created_at DESC")
                .query(String.class).list().stream().map(json::object).toList();
    }

    private List<Map<String, Object>> views(String suffix, UUID owner) {
        return database.sql(VIEW + FROM + suffix).param("owner", owner).query(String.class).list().stream()
                .map(json::object).toList();
    }

    public Optional<Map<String, Object>> find(UUID placementId) {
        return database.sql(VIEW + FROM + " WHERE ip.id=:id").param("id", placementId)
                .query(String.class).optional().map(json::object);
    }

    public Optional<Context> context(UUID placementId, boolean lock) {
        if (lock && database.sql("SELECT id FROM internship_placements WHERE id=:id FOR UPDATE")
                .param("id", placementId).query(UUID.class).optional().isEmpty()) {
            return Optional.empty();
        }
        return database.sql(CONTEXT + FROM + " WHERE ip.id=:id").param("id", placementId)
                .query((row, number) -> new Context(
                        row.getObject("placement_id", UUID.class),
                        row.getObject("application_id", UUID.class),
                        PlacementModels.Status.valueOf(row.getString("placement_status")),
                        row.getObject("student_profile_id", UUID.class),
                        row.getObject("student_user_id", UUID.class),
                        row.getString("student_name"),
                        row.getObject("company_id", UUID.class),
                        row.getString("company_name"),
                        row.getString("job_title"),
                        row.getObject("plan_id", UUID.class),
                        row.getString("plan_status") == null ? null : Status.valueOf(row.getString("plan_status")),
                        row.getObject("plan_version", Integer.class),
                        row.getObject("current_submission_no", Integer.class) == null ? 0 : row.getInt("current_submission_no"),
                        row.getString("title"),
                        row.getString("department"),
                        row.getString("company_supervisor_name"),
                        row.getString("company_supervisor_email"),
                        row.getString("objectives"),
                        row.getString("expected_tasks"),
                        row.getString("expected_skills"),
                        localDate(row.getDate("start_date")),
                        localDate(row.getDate("end_date"))))
                .optional();
    }

    public Optional<Action> command(UUID planId, UUID commandId) {
        return database.sql("SELECT action FROM internship_plan_history WHERE plan_id=:planId AND command_id=:commandId")
                .param("planId", planId).param("commandId", commandId).query(String.class).optional()
                .map(Action::valueOf);
    }

    public UUID create(Context context, UUID actorId, SaveDraft input, RequestMetadata request) {
        UUID planId = database.sql("""
          INSERT INTO internship_plans(placement_id,title,department,company_supervisor_name,company_supervisor_email,
            objectives,expected_tasks,expected_skills,start_date,end_date)
          VALUES(:placementId,:title,:department,:supervisorName,:supervisorEmail,:objectives,:tasks,:skills,:startDate,:endDate)
          RETURNING id
          """).param("placementId", context.placementId())
                .param("title", clean(input.title())).param("department", clean(input.department()))
                .param("supervisorName", clean(input.companySupervisorName())).param("supervisorEmail", clean(input.companySupervisorEmail()))
                .param("objectives", clean(input.objectives())).param("tasks", clean(input.expectedTasks()))
                .param("skills", clean(input.expectedSkills())).param("startDate", date(input.startDate())).param("endDate", date(input.endDate()))
                .query(UUID.class).single();
        auditSave(planId, context, actorId, "INTERNSHIP_PLAN_CREATED", request);
        return planId;
    }

    public void update(Context context, UUID actorId, SaveDraft input, RequestMetadata request) {
        database.sql("""
          UPDATE internship_plans SET title=:title,department=:department,company_supervisor_name=:supervisorName,
            company_supervisor_email=:supervisorEmail,objectives=:objectives,expected_tasks=:tasks,expected_skills=:skills,
            start_date=:startDate,end_date=:endDate,version=version+1,updated_at=now()
          WHERE id=:planId
          """).param("title", clean(input.title())).param("department", clean(input.department()))
                .param("supervisorName", clean(input.companySupervisorName())).param("supervisorEmail", clean(input.companySupervisorEmail()))
                .param("objectives", clean(input.objectives())).param("tasks", clean(input.expectedTasks()))
                .param("skills", clean(input.expectedSkills())).param("startDate", date(input.startDate())).param("endDate", date(input.endDate()))
                .param("planId", context.planId()).update();
        auditSave(context.planId(), context, actorId, "INTERNSHIP_PLAN_UPDATED", request);
    }

    private void auditSave(UUID planId, Context context, UUID actorId, String action, RequestMetadata request) {
        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:action,'INTERNSHIP_PLAN',:planId,
            jsonb_build_object('placementId',CAST(:placementId AS text),'applicationId',CAST(:applicationId AS text)),
            CAST(:ip AS inet),:agent)
          """).param("actorId", actorId).param("action", action).param("planId", planId)
                .param("placementId", context.placementId()).param("applicationId", context.applicationId())
                .param("ip", request.ipAddress()).param("agent", request.userAgent()).update();
    }

    public void transition(Context context, UUID actorId, UUID commandId, ActorType actorType, Action action,
            Status next, String reasonCode, String note, RequestMetadata request) {
        int submissionNo = context.currentSubmissionNo() + (action == Action.SUBMIT ? 1 : 0);
        database.sql("""
          UPDATE internship_plans SET status=:status,version=version+1,
            current_submission_no=:submissionNo,
            latest_reason_code=:reasonCode,latest_note=:note,
            submitted_at=CASE WHEN :action='SUBMIT' THEN now() ELSE submitted_at END,
            company_reviewed_at=CASE WHEN :action LIKE 'COMPANY_%' THEN now() ELSE company_reviewed_at END,
            uit_reviewed_at=CASE WHEN :action LIKE 'UIT_%' THEN now() ELSE uit_reviewed_at END,
            updated_at=now()
          WHERE id=:planId
          """).param("status", next.name()).param("submissionNo", submissionNo)
                .param("reasonCode", reasonCode).param("note", note).param("action", action.name())
                .param("planId", context.planId()).update();

        if (action == Action.SUBMIT) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("title", context.title());
            snapshot.put("department", context.department());
            snapshot.put("companySupervisorName", context.companySupervisorName());
            snapshot.put("companySupervisorEmail", context.companySupervisorEmail());
            snapshot.put("objectives", context.objectives());
            snapshot.put("expectedTasks", context.expectedTasks());
            snapshot.put("expectedSkills", context.expectedSkills());
            snapshot.put("startDate", context.startDate().toString());
            snapshot.put("endDate", context.endDate().toString());
            database.sql("""
              INSERT INTO internship_plan_submissions(plan_id,submission_no,submitted_by_user_id,snapshot)
              VALUES(:planId,:submissionNo,:actorId,CAST(:snapshot AS jsonb))
              """).param("planId", context.planId()).param("submissionNo", submissionNo).param("actorId", actorId)
                    .param("snapshot", json.stringify(snapshot)).update();
        }

        database.sql("""
          INSERT INTO internship_plan_history(plan_id,command_id,action,from_status,to_status,actor_type,actor_user_id,
            reason_code,note,metadata)
          VALUES(:planId,:commandId,:action,:fromStatus,:toStatus,:actorType,:actorId,:reasonCode,:note,
            jsonb_build_object('placementId',CAST(:placementId AS text),'applicationId',CAST(:applicationId AS text),
              'submissionNo',:submissionNo))
          """).param("planId", context.planId()).param("commandId", commandId).param("action", action.name())
                .param("fromStatus", context.planStatus().name()).param("toStatus", next.name()).param("actorType", actorType.name())
                .param("actorId", actorId).param("reasonCode", reasonCode).param("note", note)
                .param("placementId", context.placementId()).param("applicationId", context.applicationId())
                .param("submissionNo", submissionNo).update();

        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:auditAction,'INTERNSHIP_PLAN',:planId,
            jsonb_build_object('commandId',CAST(:commandId AS text),'placementId',CAST(:placementId AS text),
              'fromStatus',:fromStatus,'toStatus',:toStatus,'reasonCode',CAST(:reasonCode AS text)),CAST(:ip AS inet),:agent)
          """).param("actorId", actorId).param("auditAction", "INTERNSHIP_PLAN_" + action.name())
                .param("planId", context.planId()).param("commandId", commandId).param("placementId", context.placementId())
                .param("fromStatus", context.planStatus().name()).param("toStatus", next.name()).param("reasonCode", reasonCode)
                .param("ip", request.ipAddress()).param("agent", request.userAgent()).update();

        notifyTransition(context, commandId, action, next, note);
    }

    private void notifyTransition(Context context, UUID commandId, Action action, Status next, String note) {
        switch (action) {
            case SUBMIT -> {
                if (next == Status.PENDING_COMPANY_REVIEW) {
                    notifyCompany(context, commandId, "INTERNSHIP_PLAN_SUBMITTED",
                            "Sinh viên đã nộp kế hoạch thực tập",
                            context.studentName() + " đã nộp kế hoạch cho vị trí “" + context.jobTitle() + "”.", next);
                } else {
                    notifyUit(context, commandId, "INTERNSHIP_PLAN_RESUBMITTED_TO_UIT",
                            "Sinh viên đã nộp lại kế hoạch thực tập",
                            context.studentName() + " đã cập nhật kế hoạch theo góp ý của UIT.", next);
                }
            }
            case COMPANY_CONFIRM -> notifyUit(context, commandId, "INTERNSHIP_PLAN_COMPANY_CONFIRMED",
                    "Doanh nghiệp đã xác nhận kế hoạch thực tập",
                    context.companyName() + " đã xác nhận kế hoạch của " + context.studentName() + ".", next);
            case COMPANY_REQUEST_REVISION -> notifyStudent(context, commandId, "INTERNSHIP_PLAN_COMPANY_REVISION_REQUIRED",
                    "Doanh nghiệp yêu cầu chỉnh sửa kế hoạch",
                    context.companyName() + " yêu cầu bạn chỉnh sửa kế hoạch. " + safeNote(note), next);
            case UIT_APPROVE -> {
                notifyStudent(context, commandId, "INTERNSHIP_PLAN_APPROVED", "UIT đã phê duyệt kế hoạch thực tập",
                        "Kế hoạch cho vị trí “" + context.jobTitle() + "” đã được phê duyệt.", next);
                notifyCompany(context, commandId, "INTERNSHIP_PLAN_APPROVED", "UIT đã phê duyệt kế hoạch thực tập",
                        "UIT đã phê duyệt kế hoạch của " + context.studentName() + ".", next);
            }
            case UIT_REQUEST_REVISION -> notifyStudent(context, commandId, "INTERNSHIP_PLAN_UIT_REVISION_REQUIRED",
                    "UIT yêu cầu chỉnh sửa kế hoạch",
                    "UIT yêu cầu bạn chỉnh sửa kế hoạch. " + safeNote(note), next);
            case CANCEL -> { }
        }
    }

    private void notifyStudent(Context context, UUID commandId, String type, String title, String body, Status status) {
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          VALUES(:userId,:type,:title,:body,'INTERNSHIP_PLAN',:planId,
            '/student/internships/'||CAST(:placementId AS text),
            'internship-plan:'||CAST(:planId AS text)||':'||CAST(:commandId AS text)||':student',
            jsonb_build_object('placementId',CAST(:placementId AS text),'status',:status))
          ON CONFLICT(dedupe_key) DO NOTHING
          """).param("userId", context.studentUserId()).param("type", type).param("title", title).param("body", body)
                .param("planId", context.planId()).param("placementId", context.placementId()).param("commandId", commandId)
                .param("status", status.name()).update();
    }

    private void notifyCompany(Context context, UUID commandId, String type, String title, String body, Status status) {
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,:type,:title,:body,'INTERNSHIP_PLAN',:planId,
            '/company/internships/'||CAST(:placementId AS text),
            'internship-plan:'||CAST(:planId AS text)||':'||CAST(:commandId AS text)||':company:'||CAST(u.id AS text),
            jsonb_build_object('placementId',CAST(:placementId AS text),'status',:status)
          FROM company_users cu JOIN users u ON u.id=cu.user_id
          WHERE cu.company_id=:companyId AND u.status='ACTIVE'
          ON CONFLICT(dedupe_key) DO NOTHING
          """).param("type", type).param("title", title).param("body", body).param("planId", context.planId())
                .param("placementId", context.placementId()).param("commandId", commandId).param("status", status.name())
                .param("companyId", context.companyId()).update();
    }

    private void notifyUit(Context context, UUID commandId, String type, String title, String body, Status status) {
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,:type,:title,:body,'INTERNSHIP_PLAN',:planId,
            '/uit/internship-supervision/'||CAST(:placementId AS text),
            'internship-plan:'||CAST(:planId AS text)||':'||CAST(:commandId AS text)||':uit:'||CAST(u.id AS text),
            jsonb_build_object('placementId',CAST(:placementId AS text),'status',:status)
          FROM uit_staff s JOIN users u ON u.id=s.user_id WHERE u.status='ACTIVE'
          ON CONFLICT(dedupe_key) DO NOTHING
          """).param("type", type).param("title", title).param("body", body).param("planId", context.planId())
                .param("placementId", context.placementId()).param("commandId", commandId).param("status", status.name()).update();
    }

    private static LocalDate localDate(Date value) { return value == null ? null : value.toLocalDate(); }
    private static Date date(LocalDate value) { return value == null ? null : Date.valueOf(value); }
    private static String clean(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static String safeNote(String value) { return value == null || value.isBlank() ? "" : value.strip(); }
}

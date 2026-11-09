package vn.edu.uit.careerhub.repository;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.entity.AiCachedSuggestion;
import vn.edu.uit.careerhub.entity.AiPlacementContext;
import vn.edu.uit.careerhub.entity.AiWeeklyLogEntry;
import vn.edu.uit.careerhub.enums.AiCallStatus;
import vn.edu.uit.careerhub.enums.AiFeature;
import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.enums.PlacementStatus;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.WeeklyLogStatus;
import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class AiRepository {
    private final JdbcClient database;
    private final JsonSupport json;

    public AiRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public Optional<AiPlacementContext> placement(UUID placementId) {
        return database.sql("""
          SELECT ip.id placement_id,ip.status placement_status,sp.id student_profile_id,j.company_id,
            sp.full_name student_name,sp.student_code,su.email student_email,
            j.title job_title,j.description job_description,j.requirements job_requirements,
            p.status plan_status,p.company_supervisor_name,p.company_supervisor_email
          FROM internship_placements ip
          JOIN applications a ON a.id=ip.application_id
          JOIN student_profiles sp ON sp.id=a.student_profile_id
          JOIN users su ON su.id=sp.user_id
          JOIN job_posts j ON j.id=a.job_post_id
          LEFT JOIN internship_plans p ON p.placement_id=ip.id
          WHERE ip.id=:id
          """).param("id", placementId).query((row, number) -> new AiPlacementContext(
                row.getObject("placement_id", UUID.class), PlacementStatus.valueOf(row.getString("placement_status")),
                row.getObject("student_profile_id", UUID.class), row.getObject("company_id", UUID.class),
                row.getString("student_name"), row.getString("student_code"), row.getString("student_email"),
                row.getString("job_title"), row.getString("job_description"), row.getString("job_requirements"),
                row.getString("plan_status") == null ? null : InternshipPlanStatus.valueOf(row.getString("plan_status")),
                row.getString("company_supervisor_name"), row.getString("company_supervisor_email")))
                .optional();
    }

    /**
     * Logs the student has submitted at least once, with the content of their latest submission.
     * Drafts stay private to the student, and while a log is back for revision the student edits
     * the live row directly, so the content is read from the submission snapshot instead.
     */
    public List<AiWeeklyLogEntry> lastSubmittedLogs(UUID placementId) {
        return database.sql("""
          SELECT l.week_number,l.status,s.snapshot->>'workSummary' work_summary,s.snapshot->>'outcomes' outcomes,
            s.snapshot->>'difficulties' difficulties,s.snapshot->>'nextPlan' next_plan
          FROM internship_weekly_logs l
          JOIN internship_weekly_log_submissions s ON s.weekly_log_id=l.id AND s.submission_no=l.current_submission_no
          WHERE l.placement_id=:id AND l.status IN ('SUBMITTED','COMPANY_REVISION_REQUIRED','COMPANY_CONFIRMED')
          ORDER BY l.week_number
          """).param("id", placementId).query((row, number) -> new AiWeeklyLogEntry(
                row.getInt("week_number"), WeeklyLogStatus.valueOf(row.getString("status")),
                row.getString("work_summary"), row.getString("outcomes"), row.getString("difficulties"),
                row.getString("next_plan"))).list();
    }

    public boolean enabled() {
        return database.sql("SELECT enabled FROM ai_settings WHERE id=1").query(Boolean.class).optional().orElse(false);
    }

    public Map<String, Object> settings() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enabled", false);
        result.put("updatedAt", null);
        result.put("updatedBy", null);
        database.sql("""
          SELECT s.enabled,s.updated_at,COALESCE(st.full_name,u.email) updated_by
          FROM ai_settings s LEFT JOIN users u ON u.id=s.updated_by_user_id
          LEFT JOIN uit_staff st ON st.user_id=u.id WHERE s.id=1
          """).query((row, number) -> {
              result.put("enabled", row.getBoolean("enabled"));
              result.put("updatedAt", row.getObject("updated_at", OffsetDateTime.class).toString());
              result.put("updatedBy", row.getString("updated_by"));
              return true;
          }).optional();
        return result;
    }

    public void updateSettings(boolean enabled, UUID actorId, RequestMetadata request) {
        database.sql("""
          INSERT INTO ai_settings(id,enabled,updated_by_user_id,updated_at) VALUES(1,:enabled,:actorId,now())
          ON CONFLICT(id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=now()
          """).param("enabled", enabled).param("actorId", actorId).update();
        database.sql("""
          INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
          VALUES(:actorId,:action,'AI_SETTINGS',NULL,jsonb_build_object('enabled',CAST(:enabled AS boolean)),CAST(:ip AS inet),:agent)
          """).param("actorId", actorId).param("action", enabled ? "AI_ENABLED" : "AI_DISABLED")
                .param("enabled", enabled).param("ip", request.ipAddress()).param("agent", request.userAgent()).update();
    }

    /**
     * Takes one provider-call slot for today (Vietnam time) if the user still has one. A single
     * upsert holds the row lock while it checks and increments, so concurrent requests cannot both
     * take the last slot. Cache hits never get here, so they stay free.
     */
    public boolean reserveProviderCall(UUID userId, int dailyLimit) {
        return database.sql("""
          INSERT INTO ai_daily_usage(user_id,usage_date,provider_calls)
          VALUES(:userId,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,1)
          ON CONFLICT(user_id,usage_date) DO UPDATE SET provider_calls=ai_daily_usage.provider_calls+1,updated_at=now()
            WHERE ai_daily_usage.provider_calls < :limit
          RETURNING provider_calls
          """).param("userId", userId).param("limit", dailyLimit).query(Integer.class).optional().isPresent();
    }

    public void logCall(UUID userId, UserRole role, AiFeature feature, UUID targetId, AiCallStatus status, String model,
            Integer latencyMs, Integer promptTokens, Integer outputTokens, String errorCode) {
        database.sql("""
          INSERT INTO ai_call_logs(user_id,user_role,feature,target_id,status,model,latency_ms,prompt_tokens,output_tokens,error_code)
          VALUES(:userId,:role,:feature,:targetId,:status,:model,:latency,:promptTokens,:outputTokens,:errorCode)
          """).param("userId", userId).param("role", role.name()).param("feature", feature.name())
                .param("targetId", targetId).param("status", status.name()).param("model", model)
                .param("latency", latencyMs).param("promptTokens", promptTokens).param("outputTokens", outputTokens)
                .param("errorCode", errorCode).update();
    }

    public Optional<AiCachedSuggestion> cached(AiFeature feature, UUID targetId, String contentHash) {
        return database.sql("""
          SELECT model,result::text result,created_at FROM ai_suggestions
          WHERE feature=:feature AND target_id=:targetId AND content_hash=:hash
          """).param("feature", feature.name()).param("targetId", targetId).param("hash", contentHash)
                .query((row, number) -> new AiCachedSuggestion(row.getString("model"), json.object(row.getString("result")),
                        row.getObject("created_at", OffsetDateTime.class)))
                .optional();
    }

    public OffsetDateTime saveSuggestion(AiFeature feature, UUID targetId, String contentHash, String model,
            Map<String, Object> result) {
        return database.sql("""
          INSERT INTO ai_suggestions(feature,target_id,content_hash,model,result)
          VALUES(:feature,:targetId,:hash,:model,CAST(:result AS jsonb))
          ON CONFLICT(feature,target_id,content_hash)
            DO UPDATE SET model=EXCLUDED.model,result=EXCLUDED.result,created_at=now()
          RETURNING created_at
          """).param("feature", feature.name()).param("targetId", targetId).param("hash", contentHash)
                .param("model", model).param("result", json.stringify(result)).query(OffsetDateTime.class).single();
    }

    /** Usage over the last {@code days} days, one row per feature, for the UIT settings screen. */
    public List<Map<String, Object>> usage(int days) {
        return database.sql("""
          SELECT feature,count(*) total,
            count(*) FILTER(WHERE status='SUCCESS') success,
            count(*) FILTER(WHERE status='CACHED') cached,
            count(*) FILTER(WHERE status='FAILED') failed,
            count(*) FILTER(WHERE status IN ('DISABLED','NOT_CONFIGURED','RATE_LIMITED')) skipped,
            round(avg(latency_ms) FILTER(WHERE status='SUCCESS'))::int avg_latency_ms,
            COALESCE(sum(prompt_tokens),0)::bigint prompt_tokens,
            COALESCE(sum(output_tokens),0)::bigint output_tokens
          FROM ai_call_logs WHERE created_at >= now() - make_interval(days => :days)
          GROUP BY feature ORDER BY feature
          """).param("days", days).query((row, number) -> {
              Map<String, Object> result = new LinkedHashMap<>();
              result.put("feature", row.getString("feature"));
              result.put("total", row.getLong("total"));
              result.put("success", row.getLong("success"));
              result.put("cached", row.getLong("cached"));
              result.put("failed", row.getLong("failed"));
              result.put("skipped", row.getLong("skipped"));
              result.put("avgLatencyMs", row.getObject("avg_latency_ms", Integer.class));
              result.put("promptTokens", row.getLong("prompt_tokens"));
              result.put("outputTokens", row.getLong("output_tokens"));
              return result;
          }).list();
    }
}

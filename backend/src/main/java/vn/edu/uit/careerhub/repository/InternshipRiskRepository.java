package vn.edu.uit.careerhub.repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.entity.RiskPlacement;
import vn.edu.uit.careerhub.entity.RiskWeeklyLog;

@Repository
public class InternshipRiskRepository {
    private final JdbcClient database;

    public InternshipRiskRepository(JdbcClient database) { this.database = database; }

    public List<RiskPlacement> startedPlacements() {
        return database.sql("""
          SELECT ip.id,ip.actual_start_date,
            (SELECT count(*) FROM internship_plan_history h JOIN internship_plans p ON p.id=h.plan_id
              WHERE p.placement_id=ip.id AND h.action IN ('COMPANY_REQUEST_REVISION','UIT_REQUEST_REVISION')) plan_revisions
          FROM internship_placements ip WHERE ip.status='STARTED' AND ip.actual_start_date IS NOT NULL
          """).query((row, n) -> new RiskPlacement(row.getObject("id", UUID.class), row.getDate("actual_start_date").toLocalDate(),
                row.getInt("plan_revisions"))).list();
    }

    public List<RiskWeeklyLog> logs() { return logs("STARTED"); }

    public List<RiskWeeklyLog> logs(String placementStatus) {
        return database.sql("""
          SELECT l.placement_id,l.week_number,l.current_submission_no>0 submitted,
            (l.submitted_at IS NOT NULL AND l.submitted_at::date>l.due_date) late,
            EXISTS(SELECT 1 FROM internship_weekly_log_history h WHERE h.weekly_log_id=l.id AND h.action='COMPANY_REQUEST_REVISION') revised,
            (l.submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date submitted_on,
            s.snapshot->>'workSummary' work_summary,s.snapshot->>'outcomes' outcomes,s.snapshot->>'difficulties' difficulties
          FROM internship_weekly_logs l
          JOIN internship_placements ip ON ip.id=l.placement_id AND ip.status=:status
          LEFT JOIN internship_weekly_log_submissions s ON s.weekly_log_id=l.id AND s.submission_no=l.current_submission_no
          WHERE l.status<>'CANCELLED'
          ORDER BY l.placement_id,l.week_number
          """).param("status", placementStatus).query((row, n) -> {
              Date submittedOn = row.getDate("submitted_on");
              return new RiskWeeklyLog(row.getObject("placement_id", UUID.class), row.getInt("week_number"),
                      row.getBoolean("submitted"), row.getBoolean("late"), row.getBoolean("revised"),
                      submittedOn == null ? null : submittedOn.toLocalDate(), row.getString("work_summary"),
                      row.getString("outcomes"), row.getString("difficulties"));
          }).list();
    }

    /**
     * Finished internships with the host company's evaluation. Label 1 = ended badly: overall rating 1-2 or
     * the company would not recommend the student.
     */
    public List<LabelledPlacement> completedWithEvaluation() {
        return database.sql("""
          SELECT ip.id,ip.actual_start_date,ip.completed_date,
            (SELECT count(*) FROM internship_plan_history h JOIN internship_plans p ON p.id=h.plan_id
              WHERE p.placement_id=ip.id AND h.action IN ('COMPANY_REQUEST_REVISION','UIT_REQUEST_REVISION')) plan_revisions,
            (e.overall_rating<=2 OR NOT e.recommendation) bad
          FROM internship_placements ip
          JOIN internship_evaluations e ON e.placement_id=ip.id AND e.respondent_role='COMPANY'
          WHERE ip.status='COMPLETED' AND ip.actual_start_date IS NOT NULL
          """).query((row, n) -> new LabelledPlacement(new RiskPlacement(row.getObject("id", UUID.class),
                row.getDate("actual_start_date").toLocalDate(), row.getInt("plan_revisions")),
                row.getDate("completed_date").toLocalDate(), row.getBoolean("bad"))).list();
    }

    public record LabelledPlacement(RiskPlacement placement, LocalDate completedDate, boolean bad) {}

    public LocalDate today() {
        return database.sql("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date").query(LocalDate.class).single();
    }
}

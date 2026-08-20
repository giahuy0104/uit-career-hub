package vn.edu.uit.careerhub.dashboard;

import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.common.JsonSupport;

@Repository
public class DashboardRepository {
    private final JdbcClient database;
    private final JsonSupport json;
    public DashboardRepository(JdbcClient database, JsonSupport json) { this.database = database; this.json = json; }

    public Map<String, Object> admin() {
        Object value = database.sql("""
            WITH metrics AS (
              SELECT
                (SELECT count(*) FROM job_posts WHERE status='PENDING_UIT_REVIEW') AS pending_jobs,
                (SELECT count(*) FROM applications WHERE status='UIT_REVIEWING') AS pending_apps,
                (SELECT count(*) FROM applications WHERE status IN ('FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED')) AS awaiting_company,
                (SELECT count(*) FROM applications WHERE status='HIRED' AND placement_confirmed_at >= date_trunc('month',now())) AS hires_month,
                (SELECT count(*) FROM applications WHERE status='UIT_REVIEWING' AND last_transition_at < now()-interval '24 hours') AS overdue_apps,
                (SELECT round(max(extract(epoch FROM (now()-last_transition_at)))/3600) FROM applications WHERE status='UIT_REVIEWING') AS oldest_app,
                (SELECT count(*) FROM job_posts WHERE status='PENDING_UIT_REVIEW' AND submitted_at < now()-interval '24 hours') AS overdue_jobs,
                (SELECT count(DISTINCT company_id) FROM job_posts WHERE status='PENDING_UIT_REVIEW') AS job_companies,
                (SELECT count(*) FROM applications WHERE status='ACCEPTED_PENDING_UIT_CONFIRMATION') AS placements,
                (SELECT round(max(extract(epoch FROM (now()-last_transition_at)))/3600) FROM applications WHERE status='ACCEPTED_PENDING_UIT_CONFIRMATION') AS oldest_placement,
                ((SELECT count(*) FROM application_status_history WHERE actor_type='UIT_ADMIN' AND created_at>=date_trunc('day',now()))
                 +(SELECT count(*) FROM job_post_status_history WHERE actor_type='UIT_ADMIN' AND created_at>=date_trunc('day',now()))) AS completed,
                ((SELECT count(*) FROM applications WHERE submitted_at>=date_trunc('day',now()))
                 +(SELECT count(*) FROM job_posts WHERE submitted_at>=date_trunc('day',now()))) AS incoming
            ), funnel AS (
              SELECT bucket AS status,count(*) AS count FROM (
                SELECT CASE WHEN status IN ('UIT_REVIEWING','NEEDS_SUPPLEMENT') THEN 'UIT_REVIEW'
                  WHEN status IN ('FORWARDED_TO_COMPANY','COMPANY_REVIEWING') THEN 'COMPANY_REVIEW'
                  WHEN status='INTERVIEW_INVITED' THEN 'INTERVIEW'
                  WHEN status IN ('OFFER_PENDING_STUDENT','ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED') THEN 'OFFER_OR_HIRED'
                  ELSE 'CLOSED' END bucket FROM applications
              ) grouped GROUP BY bucket
            ), companies AS (
              SELECT c.id,c.name,
                count(DISTINCT j.id) FILTER(WHERE j.status='RECRUITING') recruiting_jobs,
                count(a.id) applications
              FROM companies c LEFT JOIN job_posts j ON j.company_id=c.id LEFT JOIN applications a ON a.job_post_id=j.id
              WHERE c.partner_status='ACTIVE' GROUP BY c.id,c.name
              HAVING count(DISTINCT j.id) FILTER(WHERE j.status='RECRUITING')>0 OR count(a.id)>0
              ORDER BY count(a.id) DESC,count(DISTINCT j.id) FILTER(WHERE j.status='RECRUITING') DESC,c.name LIMIT 4
            )
            SELECT (jsonb_build_object(
              'metrics',jsonb_build_object('pendingJobReviews',pending_jobs,'pendingUitApplications',pending_apps,
                'awaitingCompany',awaiting_company,'hiresThisMonth',hires_month),
              'queues',jsonb_build_object(
                'uitApplications',jsonb_build_object('total',pending_apps,'overdue',overdue_apps,'oldestWaitingHours',oldest_app),
                'jobReviews',jsonb_build_object('total',pending_jobs,'overdue',overdue_jobs,'companyCount',job_companies),
                'placementConfirmations',jsonb_build_object('total',placements,'oldestWaitingHours',oldest_placement)),
              'handledToday',jsonb_build_object('completed',completed,'incoming',incoming,'completionRate',
                CASE WHEN completed+pending_jobs+pending_apps+placements=0 THEN 100
                     ELSE round(completed*100.0/(completed+pending_jobs+pending_apps+placements)) END),
              'applicationFunnel',COALESCE((SELECT jsonb_agg(jsonb_build_object('status',status,'count',count)) FROM funnel),'[]'::jsonb),
              'topCompanies',COALESCE((SELECT jsonb_agg(jsonb_build_object('companyId',id,'companyName',name,
                'recruitingJobs',recruiting_jobs,'applications',applications)) FROM companies),'[]'::jsonb)))::text
            FROM metrics
            """).query(String.class).single();
        return json.object(value);
    }

    public Map<String, Object> company(UUID companyId) {
        Object value = database.sql("""
            WITH metrics AS (
              SELECT
                (SELECT count(*) FROM job_posts WHERE company_id=:companyId AND status='RECRUITING') recruiting_jobs,
                (SELECT count(*) FROM job_posts WHERE company_id=:companyId AND status='PENDING_UIT_REVIEW') pending_jobs,
                (SELECT count(*) FROM applications a JOIN job_posts j ON j.id=a.job_post_id WHERE j.company_id=:companyId AND a.status='FORWARDED_TO_COMPANY') new_candidates,
                (SELECT count(*) FROM interviews i JOIN applications a ON a.id=i.application_id JOIN job_posts j ON j.id=a.job_post_id
                  WHERE j.company_id=:companyId AND i.scheduled_at>=date_trunc('week',now()) AND i.scheduled_at<date_trunc('week',now())+interval '7 days'
                    AND i.status NOT IN ('CANCELLED','NO_SHOW')) interviews_week,
                (SELECT count(*) FROM applications a JOIN job_posts j ON j.id=a.job_post_id WHERE j.company_id=:companyId AND a.status='HIRED'
                  AND a.placement_confirmed_at>=date_trunc('month',now())) hires_month,
                (SELECT count(*) FROM applications a JOIN job_posts j ON j.id=a.job_post_id WHERE j.company_id=:companyId
                  AND a.status IN ('FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED') AND a.last_transition_at<now()-interval '48 hours') overdue,
                (SELECT count(*) FROM job_posts WHERE company_id=:companyId AND status='REVISION_REQUIRED') revisions
            ), candidates AS (
              SELECT a.id,sp.full_name,sp.student_code,sp.gpa,j.title,a.status,a.last_transition_at
              FROM applications a JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id
              WHERE j.company_id=:companyId AND a.status IN ('FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED')
              ORDER BY a.last_transition_at,a.id LIMIT 5
            ), performance AS (
              SELECT j.id,j.title,count(DISTINCT a.id) applications,
                count(DISTINCT a.id) FILTER(WHERE a.status IN ('FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED','INTERVIEW_FAILED',
                  'OFFER_PENDING_STUDENT','ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED','OFFER_DECLINED')) forwarded,
                count(DISTINCT i.application_id) interviews,count(DISTINCT a.id) FILTER(WHERE a.status='HIRED') hires
              FROM job_posts j LEFT JOIN applications a ON a.job_post_id=j.id LEFT JOIN interviews i ON i.application_id=a.id
              WHERE j.company_id=:companyId AND j.status='RECRUITING' GROUP BY j.id,j.title,j.updated_at ORDER BY j.updated_at DESC LIMIT 5
            )
            SELECT (jsonb_build_object(
              'metrics',jsonb_build_object('recruitingJobs',recruiting_jobs,'pendingJobReviews',pending_jobs,'newCandidates',new_candidates,
                'interviewsThisWeek',interviews_week,'hiresThisMonth',hires_month),
              'actionQueue',jsonb_build_object('overdueCandidates',overdue,'revisionRequiredJobs',revisions),
              'recentCandidates',COALESCE((SELECT jsonb_agg(jsonb_build_object('applicationId',id,'studentName',full_name,'studentCode',student_code,
                'gpa',gpa,'jobTitle',title,'status',status,'lastTransitionAt',last_transition_at) ORDER BY last_transition_at,id) FROM candidates),'[]'::jsonb),
              'jobPerformance',COALESCE((SELECT jsonb_agg(jsonb_build_object('jobId',id,'title',title,'applications',applications,
                'forwarded',forwarded,'interviews',interviews,'hires',hires)) FROM performance),'[]'::jsonb)))::text FROM metrics
            """).param("companyId", companyId).query(String.class).single();
        return json.object(value);
    }

    public Map<String, Object> student(UUID studentProfileId) {
        Object value = database.sql("""
            WITH profile AS (
              SELECT sp.*,
                (sp.phone IS NOT NULL AND btrim(sp.phone)<>'') phone_present,(sp.gpa IS NOT NULL) gpa_present,
                EXISTS(SELECT 1 FROM student_documents d WHERE d.student_profile_id=sp.id AND d.document_type='CV' AND d.is_default AND d.verification_status='VERIFIED') has_cv,
                EXISTS(SELECT 1 FROM student_documents d WHERE d.student_profile_id=sp.id AND d.document_type='TRANSCRIPT' AND d.verification_status='VERIFIED') has_transcript,
                EXISTS(SELECT 1 FROM student_documents d WHERE d.student_profile_id=sp.id AND d.document_type='STUDENT_CONFIRMATION' AND d.verification_status='VERIFIED') has_confirmation
              FROM student_profiles sp WHERE sp.id=:studentId
            ), metrics AS (
              SELECT p.*,
                (SELECT count(*) FROM applications a WHERE a.student_profile_id=p.id AND a.status IN ('UIT_REVIEWING','NEEDS_SUPPLEMENT','FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED','OFFER_PENDING_STUDENT','ACCEPTED_PENDING_UIT_CONFIRMATION')) active_apps,
                (SELECT count(*) FROM interviews i JOIN applications a ON a.id=i.application_id WHERE a.student_profile_id=p.id AND i.scheduled_at>=now() AND i.status NOT IN ('CANCELLED','COMPLETED','NO_SHOW')) upcoming,
                (SELECT count(*) FROM applications a WHERE a.student_profile_id=p.id AND a.status='OFFER_PENDING_STUDENT') offers
              FROM profile p
            ), tasks AS (
              SELECT * FROM (
                SELECT 'SUPPLEMENT_DOCUMENTS' type,a.id,j.title,('Bổ sung hồ sơ theo yêu cầu của UIT · '||c.name) description,NULL::timestamptz due_at,1 priority
                FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id WHERE a.student_profile_id=:studentId AND a.status='NEEDS_SUPPLEMENT'
                UNION ALL SELECT 'RESPOND_OFFER',a.id,j.title,('Phản hồi kết quả tuyển dụng từ '||c.name),NULL::timestamptz,2
                FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id WHERE a.student_profile_id=:studentId AND a.status='OFFER_PENDING_STUDENT'
                UNION ALL SELECT 'UPCOMING_INTERVIEW',a.id,j.title,('Phỏng vấn với '||c.name),i.scheduled_at,3
                FROM interviews i JOIN applications a ON a.id=i.application_id JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
                WHERE a.student_profile_id=:studentId AND i.scheduled_at>=now() AND i.status NOT IN ('CANCELLED','COMPLETED','NO_SHOW')
              ) q ORDER BY priority,due_at NULLS LAST LIMIT 5
            )
            SELECT (jsonb_build_object(
              'metrics',jsonb_build_object('profileCompleteness',25+(CASE WHEN phone_present THEN 10 ELSE 0 END)+(CASE WHEN gpa_present THEN 10 ELSE 0 END)
                +(CASE WHEN has_cv THEN 30 ELSE 0 END)+(CASE WHEN has_transcript THEN 15 ELSE 0 END)+(CASE WHEN has_confirmation THEN 10 ELSE 0 END),
                'activeApplications',active_apps,'upcomingInterviews',upcoming,'pendingOffers',offers),
              'profile',jsonb_build_object('missingItems',array_remove(ARRAY[CASE WHEN NOT phone_present THEN 'Số điện thoại' END,
                CASE WHEN NOT gpa_present THEN 'GPA' END,CASE WHEN NOT has_cv THEN 'CV mặc định đã xác minh' END,
                CASE WHEN NOT has_transcript THEN 'Bảng điểm đã xác minh' END,CASE WHEN NOT has_confirmation THEN 'Giấy xác nhận sinh viên' END],NULL)),
              'tasks',COALESCE((SELECT jsonb_agg(jsonb_build_object('type',type,'applicationId',id,'title',title,'description',description,'dueAt',due_at)) FROM tasks),'[]'::jsonb),
              'latestApplication',(SELECT jsonb_build_object('applicationId',a.id,'status',a.status,'jobTitle',j.title,'companyName',c.name,'lastTransitionAt',a.last_transition_at)
                FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id WHERE a.student_profile_id=:studentId ORDER BY a.last_transition_at DESC,a.id DESC LIMIT 1),
              'opportunities',COALESCE((SELECT jsonb_agg(jsonb_build_object('jobId',x.id,'title',x.title,'companyName',x.company_name,'workMode',x.work_mode,'deadline',to_char(x.deadline,'YYYY-MM-DD')))
                FROM (SELECT j.id,j.title,c.name company_name,j.work_mode,j.deadline FROM job_posts j JOIN companies c ON c.id=j.company_id
                  WHERE j.status='RECRUITING' AND j.deadline>=current_date AND c.partner_status='ACTIVE'
                    AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.job_post_id=j.id AND a.student_profile_id=:studentId)
                  ORDER BY j.deadline,j.created_at DESC LIMIT 3) x),'[]'::jsonb)))::text FROM metrics
            """).param("studentId", studentProfileId).query(String.class).single();
        return json.object(value);
    }
}

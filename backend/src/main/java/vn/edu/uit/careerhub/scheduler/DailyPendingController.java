package vn.edu.uit.careerhub.scheduler;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.email.EmailDeliveryService;

@RestController @RequestMapping("/api/v1/cron")
public class DailyPendingController {
    private final JdbcClient database;private final AppProperties properties;private final EmailDeliveryService email;
    public DailyPendingController(JdbcClient database,AppProperties properties,EmailDeliveryService email){this.database=database;this.properties=properties;this.email=email;}
    @GetMapping("/daily-pending-notifications") ApiEnvelope<Map<String,Object>> run(@RequestHeader(value="Authorization",required=false) String authorization){
        String expected="Bearer "+properties.cronSecret();if(properties.cronSecret()==null||properties.cronSecret().isBlank()||authorization==null||!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),authorization.getBytes(StandardCharsets.UTF_8)))throw new AppException(HttpStatus.UNAUTHORIZED,"CRON_UNAUTHORIZED","Cron request không hợp lệ.");
        LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));Map<String,Object> summary=database.sql("""
          WITH uit_stats AS (SELECT count(*)::integer pending_count FROM applications WHERE status='UIT_REVIEWING'),
          uit_recipients AS (SELECT u.id user_id,s.pending_count FROM users u CROSS JOIN uit_stats s WHERE u.role='UIT_ADMIN' AND u.status='ACTIVE' AND s.pending_count>0),
          company_stats AS (SELECT j.company_id,count(*)::integer pending_count FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id WHERE a.status IN ('FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED') AND c.partner_status='ACTIVE' GROUP BY j.company_id),
          company_recipients AS (SELECT cu.user_id,cs.company_id,cs.pending_count FROM company_stats cs JOIN company_users cu ON cu.company_id=cs.company_id JOIN users u ON u.id=cu.user_id WHERE u.role='COMPANY' AND u.status='ACTIVE'),
          inserted_uit AS (INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,deep_link,dedupe_key,payload)
            SELECT user_id,'DAILY_UIT_PENDING_APPLICATIONS','Tổng hợp hồ sơ UIT cần xử lý',format('Có %s hồ sơ đang chờ UIT kiểm duyệt.',pending_count),'APPLICATION_QUEUE','/uit/applications','daily-pending:uit:'||CAST(:date AS date)::text||':'||user_id::text,jsonb_build_object('summaryDate',CAST(:date AS date)::text,'pendingCount',pending_count,'queue','UIT_REVIEW') FROM uit_recipients ON CONFLICT(dedupe_key) DO NOTHING RETURNING id),
          inserted_company AS (INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,deep_link,dedupe_key,payload)
            SELECT user_id,'DAILY_COMPANY_PENDING_APPLICATIONS','Tổng hợp hồ sơ doanh nghiệp cần xử lý',format('Có %s hồ sơ cần tiếp tục xử lý.',pending_count),'APPLICATION_QUEUE','/company/candidates','daily-pending:company:'||CAST(:date AS date)::text||':'||user_id::text,jsonb_build_object('summaryDate',CAST(:date AS date)::text,'pendingCount',pending_count,'companyId',company_id,'queue','COMPANY_ACTION_REQUIRED') FROM company_recipients ON CONFLICT(dedupe_key) DO NOTHING RETURNING id)
          SELECT (SELECT pending_count FROM uit_stats) uit_pending_count,COALESCE((SELECT sum(pending_count) FROM company_stats),0) company_pending_count,
            (SELECT count(*) FROM company_stats) company_count,(SELECT count(*) FROM uit_recipients) uit_recipient_count,
            (SELECT count(*) FROM company_recipients) company_recipient_count,((SELECT count(*) FROM inserted_uit)+(SELECT count(*) FROM inserted_company)) notifications_created
          """).param("date",date).query((r,n)->{Map<String,Object> m=new LinkedHashMap<>();m.put("summaryDate",date.toString());m.put("uitPendingCount",r.getLong("uit_pending_count"));m.put("companyPendingCount",r.getLong("company_pending_count"));m.put("companyCount",r.getLong("company_count"));m.put("uitRecipientCount",r.getLong("uit_recipient_count"));m.put("companyRecipientCount",r.getLong("company_recipient_count"));m.put("notificationsCreated",r.getLong("notifications_created"));return m;}).single();summary.put("emailDelivery",email.dispatchPending(null));return ApiEnvelope.of(summary);
    }
}

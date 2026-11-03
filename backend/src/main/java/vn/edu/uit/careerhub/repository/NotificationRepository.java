package vn.edu.uit.careerhub.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.NotificationDto;
import vn.edu.uit.careerhub.dto.NotificationPageResult;
import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class NotificationRepository {
    private final JdbcClient database;
    private final JsonSupport json;

    public NotificationRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public NotificationPageResult list(UUID recipientUserId, int page, int pageSize, boolean unreadOnly) {
        String unread = unreadOnly ? " AND read_at IS NULL" : "";
        List<NotificationDto> items = database.sql("""
                SELECT id, type, title, body, resource_type, resource_id, deep_link,
                       payload, read_at, created_at
                FROM notifications
                WHERE recipient_user_id = :userId
                """ + unread + " ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset")
                .param("userId", recipientUserId).param("limit", pageSize).param("offset", (page - 1) * pageSize)
                .query(this::map).list();
        Long total = database.sql("SELECT count(*) FROM notifications WHERE recipient_user_id = :userId" + unread)
                .param("userId", recipientUserId).query(Long.class).single();
        return new NotificationPageResult(items, total == null ? 0 : total);
    }

    public long unreadCount(UUID recipientUserId) {
        Long count = database.sql("SELECT count(*) FROM notifications WHERE recipient_user_id = :userId AND read_at IS NULL")
                .param("userId", recipientUserId).query(Long.class).single();
        return count == null ? 0 : count;
    }

    public boolean markRead(UUID recipientUserId, UUID notificationId) {
        return database.sql("""
                UPDATE notifications SET read_at = COALESCE(read_at, now())
                WHERE id = :notificationId AND recipient_user_id = :userId
                """).param("notificationId", notificationId).param("userId", recipientUserId).update() > 0;
    }

    public void markAllRead(UUID recipientUserId) {
        database.sql("UPDATE notifications SET read_at = now() WHERE recipient_user_id = :userId AND read_at IS NULL")
                .param("userId", recipientUserId).update();
    }

    private NotificationDto map(ResultSet result, int row) throws SQLException {
        return new NotificationDto(result.getObject("id", UUID.class), result.getString("type"),
                result.getString("title"), result.getString("body"), result.getString("resource_type"),
                result.getObject("resource_id", UUID.class), result.getString("deep_link"),
                json.object(result.getObject("payload")), instant(result, "read_at"), instant(result, "created_at"));
    }

    private java.time.Instant instant(ResultSet result, String name) throws SQLException {
        Timestamp value = result.getTimestamp(name);
        return value == null ? null : value.toInstant();
    }

    public void notifyUser(UUID user,String type,String title,String body,String resourceType,UUID resourceId,String link,String dedupe){database.sql("""
      INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key)
      VALUES(:user,:type,:title,:body,:resourceType,:resourceId,:link,:dedupe) ON CONFLICT(dedupe_key) DO NOTHING
      """).param("user",user).param("type",type).param("title",title).param("body",body).param("resourceType",resourceType).param("resourceId",resourceId).param("link",link).param("dedupe",dedupe).update();}

    public void notifyUitAdmins(String type,String title,String body,String resourceType,UUID resourceId,String link,String dedupePrefix){database.sql("""
      INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key)
      SELECT id,:type,:title,:body,:resourceType,:resourceId,:link,:prefix||id::text FROM users WHERE role='UIT_ADMIN' AND status='ACTIVE'
      ON CONFLICT(dedupe_key) DO NOTHING
      """).param("type",type).param("title",title).param("body",body).param("resourceType",resourceType).param("resourceId",resourceId).param("link",link).param("prefix",dedupePrefix).update();}

    public void notifyCompanyOfApplication(UUID companyId,String type,String title,String body,UUID applicationId,UUID commandId){database.sql("""
      INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key)
      SELECT u.id,:type,:title,:body,'APPLICATION',:applicationId,'/company/candidates/'||CAST(:applicationId AS text),
        'application:'||CAST(:applicationId AS text)||':'||CAST(:commandId AS text)||':company:'||CAST(u.id AS text)
      FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=:companyId AND u.status='ACTIVE'
      ON CONFLICT(dedupe_key) DO NOTHING
      """).param("type",type).param("title",title).param("body",body).param("applicationId",applicationId).param("commandId",commandId).param("companyId",companyId).update();}

    /** Creates the daily digest notifications; the returned map is mutable so callers can add delivery results. */
    public Map<String,Object> createDailyPendingSummaries(LocalDate date){return database.sql("""
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
          """).param("date",date).query((r,n)->{Map<String,Object> m=new LinkedHashMap<>();m.put("summaryDate",date.toString());m.put("uitPendingCount",r.getLong("uit_pending_count"));m.put("companyPendingCount",r.getLong("company_pending_count"));m.put("companyCount",r.getLong("company_count"));m.put("uitRecipientCount",r.getLong("uit_recipient_count"));m.put("companyRecipientCount",r.getLong("company_recipient_count"));m.put("notificationsCreated",r.getLong("notifications_created"));return m;}).single();}
}

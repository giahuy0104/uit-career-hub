package vn.edu.uit.careerhub.repository;

import java.sql.Types;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.entity.EmailDelivery;

@Repository
public class EmailDeliveryRepository {
    private final JdbcClient database;

    public EmailDeliveryRepository(JdbcClient database) { this.database = database; }

    public List<EmailDelivery> claim(UUID resourceId, int maxAttempts, int batchSize) {
        return database.sql("""
      WITH candidates AS (SELECT ed.id FROM email_deliveries ed JOIN notifications n ON n.id=ed.notification_id
        WHERE ed.attempt_count<:maxAttempts AND ((ed.status IN ('PENDING','FAILED') AND ed.next_attempt_at<=now()) OR (ed.status='PROCESSING' AND ed.locked_at<now()-interval '10 minutes'))
          AND (CAST(:resourceId AS uuid) IS NULL OR n.resource_id=CAST(:resourceId AS uuid)) ORDER BY ed.created_at,ed.id FOR UPDATE OF ed SKIP LOCKED LIMIT :limit),
      claimed AS (UPDATE email_deliveries ed SET status='PROCESSING',attempt_count=attempt_count+1,locked_at=now() FROM candidates c WHERE ed.id=c.id RETURNING ed.id,ed.notification_id,ed.recipient_user_id)
      SELECT c.id,u.email,n.title,n.body,n.deep_link,n.dedupe_key FROM claimed c JOIN notifications n ON n.id=c.notification_id JOIN users u ON u.id=c.recipient_user_id ORDER BY n.created_at,c.id
      """).param("maxAttempts", maxAttempts).param("resourceId", resourceId, Types.OTHER).param("limit", batchSize)
                .query((r, n) -> new EmailDelivery(r.getObject("id", UUID.class), r.getString("email"), r.getString("title"),
                        r.getString("body"), r.getString("deep_link"), r.getString("dedupe_key"))).list();
    }

    public void markSent(UUID id, String messageId) {
        database.sql("UPDATE email_deliveries SET status='SENT',provider_message_id=:messageId,sent_at=now(),locked_at=NULL,last_error=NULL WHERE id=:id AND status='PROCESSING'")
                .param("messageId", messageId).param("id", id).update();
    }

    public void markFailed(UUID id, String error) {
        database.sql("""
          UPDATE email_deliveries SET status='FAILED',next_attempt_at=now()+LEAST(3600*power(2,GREATEST(attempt_count-1,0)),86400)*interval '1 second',locked_at=NULL,last_error=left(:error,1000) WHERE id=:id AND status='PROCESSING'
          """).param("error", error).param("id", id).update();
    }
}

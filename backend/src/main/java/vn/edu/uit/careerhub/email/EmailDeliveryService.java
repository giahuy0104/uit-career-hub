package vn.edu.uit.careerhub.email;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Types;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.common.JsonSupport;
import vn.edu.uit.careerhub.config.AppProperties;

@Service
public class EmailDeliveryService {
    private record Delivery(UUID id,String recipient,String title,String body,String deepLink,String dedupeKey) {}
    private final JdbcClient database;private final AppProperties properties;private final JsonSupport json;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    public EmailDeliveryService(JdbcClient database,AppProperties properties,JsonSupport json){this.database=database;this.properties=properties;this.json=json;}

    public Map<String,Object> dispatchPending(UUID resourceId){if(!properties.email().enabled())return Map.of("enabled",false,"claimed",0,"sent",0,"failed",0);int claimed=0,sent=0,failed=0;while(true){List<Delivery> batch=claim(resourceId);claimed+=batch.size();for(var delivery:batch){try{String id=send(delivery);database.sql("UPDATE email_deliveries SET status='SENT',provider_message_id=:messageId,sent_at=now(),locked_at=NULL,last_error=NULL WHERE id=:id AND status='PROCESSING'").param("messageId",id).param("id",delivery.id()).update();sent++;}catch(Exception error){database.sql("""
          UPDATE email_deliveries SET status='FAILED',next_attempt_at=now()+LEAST(3600*power(2,GREATEST(attempt_count-1,0)),86400)*interval '1 second',locked_at=NULL,last_error=left(:error,1000) WHERE id=:id AND status='PROCESSING'
          """).param("error",error.getMessage()==null?error.getClass().getSimpleName():error.getMessage()).param("id",delivery.id()).update();failed++;}}if(batch.size()<properties.email().batchSize())break;}return Map.of("enabled",true,"claimed",claimed,"sent",sent,"failed",failed);}

    @Transactional
    protected List<Delivery> claim(UUID resourceId){return database.sql("""
      WITH candidates AS (SELECT ed.id FROM email_deliveries ed JOIN notifications n ON n.id=ed.notification_id
        WHERE ed.attempt_count<:maxAttempts AND ((ed.status IN ('PENDING','FAILED') AND ed.next_attempt_at<=now()) OR (ed.status='PROCESSING' AND ed.locked_at<now()-interval '10 minutes'))
          AND (CAST(:resourceId AS uuid) IS NULL OR n.resource_id=CAST(:resourceId AS uuid)) ORDER BY ed.created_at,ed.id FOR UPDATE OF ed SKIP LOCKED LIMIT :limit),
      claimed AS (UPDATE email_deliveries ed SET status='PROCESSING',attempt_count=attempt_count+1,locked_at=now() FROM candidates c WHERE ed.id=c.id RETURNING ed.id,ed.notification_id,ed.recipient_user_id)
      SELECT c.id,u.email,n.title,n.body,n.deep_link,n.dedupe_key FROM claimed c JOIN notifications n ON n.id=c.notification_id JOIN users u ON u.id=c.recipient_user_id ORDER BY n.created_at,c.id
      """).param("maxAttempts",properties.email().maxAttempts()).param("resourceId",resourceId,Types.OTHER).param("limit",properties.email().batchSize())
            .query((r,n)->new Delivery(r.getObject("id",UUID.class),r.getString("email"),r.getString("title"),r.getString("body"),r.getString("deep_link"),r.getString("dedupe_key"))).list();}

    private String send(Delivery d)throws Exception{String base=properties.publicUrl().endsWith("/")?properties.publicUrl():properties.publicUrl()+"/";String link=URI.create(base).resolve(d.deepLink().replaceFirst("^/","")).toString();String html="<!doctype html><html lang=\"vi\"><body><h1>"+escape(d.title())+"</h1><p>"+escape(d.body())+"</p><p><a href=\""+escape(link)+"\">Xem chi tiết</a></p></body></html>";Map<String,Object> payload=Map.of("from",properties.email().from(),"to",List.of(d.recipient()),"subject","[UIT Career Hub] "+d.title(),"html",html,"text",d.title()+"\n\n"+d.body()+"\n\nXem chi tiết: "+link);HttpRequest request=HttpRequest.newBuilder(URI.create("https://api.resend.com/emails")).timeout(Duration.ofSeconds(20)).header("Authorization","Bearer "+properties.email().apiKey()).header("Content-Type","application/json").header("Idempotency-Key","notification/"+d.id()).POST(HttpRequest.BodyPublishers.ofString(json.stringify(payload))).build();var response=client.send(request,HttpResponse.BodyHandlers.ofString());if(response.statusCode()<200||response.statusCode()>=300)throw new IllegalStateException("Resend từ chối email (HTTP "+response.statusCode()+").");Object id=json.object(response.body()).get("id");if(id==null)throw new IllegalStateException("Resend không trả về mã email.");return id.toString();}
    private String escape(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#039;");}
}

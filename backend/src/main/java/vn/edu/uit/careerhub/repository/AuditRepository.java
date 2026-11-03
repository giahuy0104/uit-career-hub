package vn.edu.uit.careerhub.repository;

import java.sql.Types;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class AuditRepository {
    private final JdbcClient database;
    private final JsonSupport json;

    public AuditRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public void record(UUID actorUserId, String action, String targetType, UUID targetId, Object metadata,
            RequestMetadata request) {
        database.sql("""
                INSERT INTO audit_logs
                  (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
                VALUES (:actorUserId, :action, :targetType, :targetId, CAST(:metadata AS jsonb),
                        CAST(:ip AS inet), :userAgent)
                """)
                .param("actorUserId", actorUserId, Types.OTHER).param("action", action).param("targetType", targetType)
                .param("targetId", targetId, Types.OTHER).param("metadata", json.stringify(metadata == null ? Map.of() : metadata))
                .param("ip", request.ipAddress(), Types.VARCHAR).param("userAgent", request.userAgent(), Types.VARCHAR).update();
    }
}

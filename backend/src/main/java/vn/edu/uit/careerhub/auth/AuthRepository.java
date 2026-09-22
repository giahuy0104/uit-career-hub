package vn.edu.uit.careerhub.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class AuthRepository {
    private static final String AUTH_USER_SELECT = """
            SELECT
              u.id, u.email, u.role, u.status, u.password_hash,
              u.failed_login_attempts, u.locked_until,
              COALESCE(sp.full_name, us.full_name, cu.full_name) AS display_name,
              CASE
                WHEN u.role = 'UIT_ADMIN' THEN us.department
                WHEN u.role = 'COMPANY' THEN c.name
                ELSE sp.student_code
              END AS organization,
              sp.id AS student_profile_id,
              c.id AS company_id
            FROM users u
            LEFT JOIN student_profiles sp ON sp.user_id = u.id
            LEFT JOIN uit_staff us ON us.user_id = u.id
            LEFT JOIN company_users cu ON cu.user_id = u.id
            LEFT JOIN companies c ON c.id = cu.company_id
            """;

    private static final RowMapper<AuthUser> USER_MAPPER = (result, rowNumber) -> new AuthUser(
            result.getObject("id", UUID.class),
            result.getString("email"),
            UserRole.valueOf(result.getString("role")),
            UserStatus.valueOf(result.getString("status")),
            result.getString("password_hash"),
            result.getInt("failed_login_attempts"),
            instant(result, "locked_until"),
            result.getString("display_name"),
            result.getString("organization"),
            result.getObject("student_profile_id", UUID.class),
            result.getObject("company_id", UUID.class));

    private final JdbcClient database;
    private final TransactionTemplate transactions;
    private final ObjectMapper json;

    public AuthRepository(JdbcClient database, TransactionTemplate transactions, ObjectMapper json) {
        this.database = database;
        this.transactions = transactions;
        this.json = json;
    }

    public Optional<AuthUser> findUserByEmail(String email) {
        return database.sql(AUTH_USER_SELECT + " WHERE u.email = :email")
                .param("email", email).query(USER_MAPPER).optional();
    }

    public Optional<AuthUser> findUserById(UUID userId) {
        return database.sql(AUTH_USER_SELECT + " WHERE u.id = :userId")
                .param("userId", userId).query(USER_MAPPER).optional();
    }

    public UUID createStudentAccount(String email, String passwordHash, String fullName, String studentCode) {
        return transactions.execute(status -> {
            UUID userId = database.sql("""
                    INSERT INTO users (email, role, status, password_hash, password_changed_at)
                    VALUES (:email, 'STUDENT', 'ACTIVE', :passwordHash, now())
                    RETURNING id
                    """)
                    .param("email", email)
                    .param("passwordHash", passwordHash)
                    .query(UUID.class)
                    .single();
            database.sql("""
                    INSERT INTO student_profiles
                      (user_id, student_code, full_name, faculty, major, cohort)
                    VALUES (:userId, :studentCode, :fullName, 'Chưa cập nhật', 'Chưa cập nhật', 'Chưa cập nhật')
                    """)
                    .param("userId", userId)
                    .param("studentCode", studentCode)
                    .param("fullName", fullName)
                    .update();
            return userId;
        });
    }

    public void recordFailedLogin(UUID userId) {
        database.sql("""
                UPDATE users
                SET failed_login_attempts = failed_login_attempts + 1,
                    status = CASE WHEN failed_login_attempts + 1 >= 5 THEN 'LOCKED' ELSE status END,
                    locked_until = CASE WHEN failed_login_attempts + 1 >= 5
                        THEN now() + interval '15 minutes' ELSE locked_until END
                WHERE id = :userId
                """).param("userId", userId).update();
    }

    public void unlockIfExpired(UUID userId) {
        database.sql("""
                UPDATE users SET status = 'ACTIVE', failed_login_attempts = 0, locked_until = NULL
                WHERE id = :userId AND status = 'LOCKED' AND locked_until <= now()
                """).param("userId", userId).update();
    }

    public void markLoginSucceeded(UUID userId) {
        database.sql("""
                UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
                WHERE id = :userId
                """).param("userId", userId).update();
    }

    public void createRefreshToken(UUID id, UUID userId, UUID familyId, String tokenHash,
            Instant expiresAt, RequestMetadata metadata) {
        database.sql("""
                INSERT INTO refresh_tokens
                  (id, user_id, family_id, token_hash, expires_at, created_ip, user_agent)
                VALUES (:id, :userId, :familyId, :tokenHash, :expiresAt, CAST(:ip AS inet), :userAgent)
                """)
                .param("id", id).param("userId", userId).param("familyId", familyId)
                .param("tokenHash", tokenHash).param("expiresAt", Timestamp.from(expiresAt))
                .param("ip", metadata.ipAddress()).param("userAgent", metadata.userAgent()).update();
    }

    public Optional<AuthUser> rotateRefreshToken(String currentHash, UUID nextId, String nextHash,
            Instant nextExpiresAt, RequestMetadata metadata) {
        AuthUser user = transactions.execute(status -> {
            Optional<RefreshTokenRow> found = database.sql("""
                    SELECT au.*, rt.id AS refresh_token_id, rt.family_id, rt.expires_at, rt.revoked_at
                    FROM (%s) au
                    JOIN refresh_tokens rt ON rt.user_id = au.id
                    WHERE rt.token_hash = :tokenHash
                    FOR UPDATE OF rt
                    """.formatted(AUTH_USER_SELECT))
                    .param("tokenHash", currentHash).query(this::mapRefreshToken).optional();
            if (found.isEmpty()) return null;
            RefreshTokenRow token = found.get();
            if (token.revokedAt() != null) {
                database.sql("UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = :familyId")
                        .param("familyId", token.familyId()).update();
                return null;
            }
            if (!token.expiresAt().isAfter(Instant.now()) || token.user().status() != UserStatus.ACTIVE) {
                database.sql("UPDATE refresh_tokens SET revoked_at = now() WHERE id = :id")
                        .param("id", token.refreshTokenId()).update();
                return null;
            }
            createRefreshToken(nextId, token.user().id(), token.familyId(), nextHash, nextExpiresAt, metadata);
            database.sql("UPDATE refresh_tokens SET revoked_at = now(), replaced_by_token_id = :nextId WHERE id = :id")
                    .param("nextId", nextId).param("id", token.refreshTokenId()).update();
            return token.user();
        });
        return Optional.ofNullable(user);
    }

    public void revokeRefreshToken(String tokenHash) {
        database.sql("UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = :tokenHash")
                .param("tokenHash", tokenHash).update();
    }

    public Optional<UUID> activateCompanyAccount(String tokenHash, String passwordHash) {
        return Optional.ofNullable(transactions.execute(status -> {
            Optional<ActivationToken> found = database.sql("""
                    SELECT at.id, at.user_id, at.expires_at
                    FROM account_activation_tokens at
                    JOIN users u ON u.id = at.user_id
                    WHERE at.token_hash = :tokenHash
                      AND at.token_type = 'COMPANY_ACTIVATION'
                      AND at.used_at IS NULL
                      AND u.role = 'COMPANY'
                      AND u.status = 'PENDING_ACTIVATION'
                    FOR UPDATE OF at, u
                    """).param("tokenHash", tokenHash).query((result, row) -> new ActivationToken(
                            result.getObject("id", UUID.class), result.getObject("user_id", UUID.class),
                            instant(result, "expires_at"))).optional();
            if (found.isEmpty() || !found.get().expiresAt().isAfter(Instant.now())) return null;
            ActivationToken token = found.get();
            database.sql("""
                    UPDATE users SET password_hash = :passwordHash, status = 'ACTIVE',
                        email_verified_at = COALESCE(email_verified_at, now()), password_changed_at = now()
                    WHERE id = :userId
                    """).param("passwordHash", passwordHash).param("userId", token.userId()).update();
            database.sql("UPDATE account_activation_tokens SET used_at = now() WHERE id = :id")
                    .param("id", token.id()).update();
            return token.userId();
        }));
    }

    public void recordAudit(UUID actorUserId, String action, String targetType, UUID targetId,
            Map<String, Object> metadata, RequestMetadata request) {
        database.sql("""
                INSERT INTO audit_logs
                  (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
                VALUES (:actorUserId, :action, :targetType, :targetId, CAST(:metadata AS jsonb),
                        CAST(:ip AS inet), :userAgent)
                """)
                .param("actorUserId", actorUserId).param("action", action).param("targetType", targetType)
                .param("targetId", targetId).param("metadata", json(metadata == null ? Map.of() : metadata))
                .param("ip", request.ipAddress()).param("userAgent", request.userAgent()).update();
    }

    private RefreshTokenRow mapRefreshToken(ResultSet result, int rowNumber) throws SQLException {
        return new RefreshTokenRow(USER_MAPPER.mapRow(result, rowNumber),
                result.getObject("refresh_token_id", UUID.class), result.getObject("family_id", UUID.class),
                instant(result, "expires_at"), instant(result, "revoked_at"));
    }

    private String json(Map<String, Object> value) {
        try { return json.writeValueAsString(value); }
        catch (JsonProcessingException error) { throw new IllegalArgumentException("Metadata không hợp lệ.", error); }
    }

    private static Instant instant(ResultSet result, String column) throws SQLException {
        Timestamp value = result.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private record RefreshTokenRow(AuthUser user, UUID refreshTokenId, UUID familyId,
            Instant expiresAt, Instant revokedAt) {}
    private record ActivationToken(UUID id, UUID userId, Instant expiresAt) {}
}

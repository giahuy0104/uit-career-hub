import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import type { AuthUser, RequestMetadata, UserRole, UserStatus } from "./auth.types.js";

export type AuthDatabase = Pick<Pool, "query" | "connect">;

type AuthUserRow = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  password_hash: string | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  display_name: string | null;
  organization: string | null;
  student_profile_id: string | null;
  company_id: string | null;
};

type RefreshTokenRow = AuthUserRow & {
  refresh_token_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
};

const authUserSelect = `
  SELECT
    u.id,
    u.email,
    u.role,
    u.status,
    u.password_hash,
    u.failed_login_attempts,
    u.locked_until,
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
`;

function mapAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    displayName: row.display_name,
    organization: row.organization,
    studentProfileId: row.student_profile_id,
    companyId: row.company_id,
  };
}

async function queryOne<Row extends QueryResultRow>(
  database: Pick<Pool, "query"> | PoolClient,
  sql: string,
  values: unknown[],
) {
  const result: QueryResult<Row> = await database.query<Row>(sql, values);
  return result.rows[0] ?? null;
}

export class AuthRepository {
  constructor(private readonly database: AuthDatabase) {}

  async findUserByEmail(email: string) {
    const row = await queryOne<AuthUserRow>(
      this.database,
      `${authUserSelect} WHERE u.email = $1`,
      [email],
    );
    return row ? mapAuthUser(row) : null;
  }

  async findUserById(userId: string) {
    const row = await queryOne<AuthUserRow>(
      this.database,
      `${authUserSelect} WHERE u.id = $1`,
      [userId],
    );
    return row ? mapAuthUser(row) : null;
  }

  async recordFailedLogin(userId: string) {
    await this.database.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           status = CASE WHEN failed_login_attempts + 1 >= 5 THEN 'LOCKED' ELSE status END,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes'
             ELSE locked_until
           END
       WHERE id = $1`,
      [userId],
    );
  }

  async unlockIfExpired(userId: string) {
    await this.database.query(
      `UPDATE users
       SET status = 'ACTIVE', failed_login_attempts = 0, locked_until = NULL
       WHERE id = $1 AND status = 'LOCKED' AND locked_until <= now()`,
      [userId],
    );
  }

  async markLoginSucceeded(userId: string) {
    await this.database.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
       WHERE id = $1`,
      [userId],
    );
  }

  async createRefreshToken(input: {
    id: string;
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    metadata: RequestMetadata;
  }) {
    await this.database.query(
      `INSERT INTO refresh_tokens
       (id, user_id, family_id, token_hash, expires_at, created_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.id,
        input.userId,
        input.familyId,
        input.tokenHash,
        input.expiresAt,
        input.metadata.ipAddress,
        input.metadata.userAgent,
      ],
    );
  }

  async rotateRefreshToken(input: {
    currentTokenHash: string;
    nextTokenId: string;
    nextTokenHash: string;
    nextExpiresAt: Date;
    metadata: RequestMetadata;
  }) {
    const client = await this.database.connect();
    await client.query("BEGIN");

    try {
      const row = await queryOne<RefreshTokenRow>(
        client,
        `SELECT au.*, rt.id AS refresh_token_id, rt.family_id, rt.expires_at, rt.revoked_at
         FROM (${authUserSelect}) au
         JOIN refresh_tokens rt ON rt.user_id = au.id
         WHERE rt.token_hash = $1
         FOR UPDATE OF rt`,
        [input.currentTokenHash],
      );

      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }

      if (row.revoked_at) {
        await client.query(
          "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1",
          [row.family_id],
        );
        await client.query("COMMIT");
        return null;
      }

      if (row.expires_at.getTime() <= Date.now() || row.status !== "ACTIVE") {
        await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [
          row.refresh_token_id,
        ]);
        await client.query("COMMIT");
        return null;
      }

      await client.query(
        `INSERT INTO refresh_tokens
         (id, user_id, family_id, token_hash, expires_at, created_ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.nextTokenId,
          row.id,
          row.family_id,
          input.nextTokenHash,
          input.nextExpiresAt,
          input.metadata.ipAddress,
          input.metadata.userAgent,
        ],
      );
      await client.query(
        "UPDATE refresh_tokens SET revoked_at = now(), replaced_by_token_id = $2 WHERE id = $1",
        [row.refresh_token_id, input.nextTokenId],
      );
      await client.query("COMMIT");
      return mapAuthUser(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeRefreshToken(tokenHash: string) {
    await this.database.query(
      "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1",
      [tokenHash],
    );
  }

  async activateCompanyAccount(tokenHash: string, passwordHash: string) {
    const client = await this.database.connect();
    await client.query("BEGIN");

    try {
      const token = await queryOne<{ id: string; user_id: string; expires_at: Date }>(
        client,
        `SELECT at.id, at.user_id, at.expires_at
         FROM account_activation_tokens at
         JOIN users u ON u.id = at.user_id
         WHERE at.token_hash = $1
           AND at.token_type = 'COMPANY_ACTIVATION'
           AND at.used_at IS NULL
           AND u.role = 'COMPANY'
           AND u.status = 'PENDING_ACTIVATION'
         FOR UPDATE OF at, u`,
        [tokenHash],
      );

      if (!token || token.expires_at.getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(
        `UPDATE users
         SET password_hash = $2,
             status = 'ACTIVE',
             email_verified_at = COALESCE(email_verified_at, now()),
             password_changed_at = now()
         WHERE id = $1`,
        [token.user_id, passwordHash],
      );
      await client.query("UPDATE account_activation_tokens SET used_at = now() WHERE id = $1", [
        token.id,
      ]);
      await client.query("COMMIT");
      return token.user_id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordAudit(input: {
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata?: Record<string, unknown>;
    request: RequestMetadata;
  }) {
    await this.database.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        input.actorUserId,
        input.action,
        input.targetType,
        input.targetId,
        JSON.stringify(input.metadata ?? {}),
        input.request.ipAddress,
        input.request.userAgent,
      ],
    );
  }
}

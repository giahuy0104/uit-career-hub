import type { Pool, PoolClient, QueryResultRow } from "pg";

import type { RequestMetadata, UserStatus } from "../auth/auth.types.js";
import type { CompanyDetailDto, CompanyDto, PartnerStatus, RecruiterDto } from "./company.types.js";

export type CompanyDatabase = Pick<Pool, "query" | "connect">;

type CompanyRow = QueryResultRow & {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  tax_code: string | null;
  industry: string | null;
  company_size: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
  partner_status: PartnerStatus;
  version: number;
  verified_at: Date | null;
  recruiter_count: string;
  active_recruiter_count: string;
  recruiting_job_count: string;
  created_at: Date;
  updated_at: Date;
};

type RecruiterRow = QueryResultRow & {
  user_id: string;
  email: string;
  full_name: string;
  title: string | null;
  is_primary: boolean;
  status: UserStatus;
  password_hash: string | null;
  suspension_reason: string | null;
  last_login_at: Date | null;
  created_at: Date;
};

export type LockedCompany = {
  id: string;
  partnerStatus: PartnerStatus;
  version: number;
};

export type LockedRecruiter = {
  userId: string;
  companyId: string;
  status: UserStatus;
  passwordHash: string | null;
  suspensionReason: string | null;
};

const companySelect = `
  SELECT c.id, c.code, c.name, c.legal_name, c.tax_code, c.industry, c.company_size,
         c.description, c.website, c.address, c.partner_status, c.version, c.verified_at,
         (SELECT count(*)::text FROM company_users cu WHERE cu.company_id = c.id) AS recruiter_count,
         (SELECT count(*)::text FROM company_users cu JOIN users u ON u.id = cu.user_id
          WHERE cu.company_id = c.id AND u.status IN ('ACTIVE', 'PENDING_ACTIVATION')) AS active_recruiter_count,
         (SELECT count(*)::text FROM job_posts j
          WHERE j.company_id = c.id AND j.status = 'RECRUITING'
            AND j.deadline >= current_date) AS recruiting_job_count,
         c.created_at, c.updated_at
  FROM companies c
`;

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}
function mapCompany(row: CompanyRow): CompanyDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    legalName: row.legal_name,
    taxCode: row.tax_code,
    industry: row.industry,
    companySize: row.company_size,
    description: row.description,
    website: row.website,
    address: row.address,
    partnerStatus: row.partner_status,
    version: row.version,
    verifiedAt: iso(row.verified_at),
    recruiterCount: Number(row.recruiter_count),
    activeRecruiterCount: Number(row.active_recruiter_count),
    recruitingJobCount: Number(row.recruiting_job_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRecruiter(row: RecruiterRow): RecruiterDto {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    title: row.title,
    isPrimary: row.is_primary,
    status: row.status,
    lastLoginAt: iso(row.last_login_at),
    createdAt: row.created_at.toISOString(),
  };
}

export class CompanyRepository {
  constructor(readonly database: CompanyDatabase) {}

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.database.connect();
    await client.query("BEGIN");
    try {
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async list(input: { page: number; pageSize: number; query?: string; status?: PartnerStatus }) {
    const filters: string[] = [];
    const values: unknown[] = [];
    if (input.query) {
      values.push(`%${input.query}%`);
      filters.push(`(c.name ILIKE $${values.length} OR c.code ILIKE $${values.length}
        OR c.legal_name ILIKE $${values.length} OR c.tax_code ILIKE $${values.length})`);
    }
    if (input.status) {
      values.push(input.status);
      filters.push(`c.partner_status = $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM companies c ${where}`,
      values,
    );
    const offset = (input.page - 1) * input.pageSize;
    values.push(input.pageSize, offset);
    const result = await this.database.query<CompanyRow>(
      `${companySelect} ${where} ORDER BY c.updated_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(mapCompany), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listActiveDirectory(input: {
    page: number;
    pageSize: number;
    query?: string;
    industry?: string;
    hasRecruitingJobs?: boolean;
  }) {
    const filters = ["c.partner_status = 'ACTIVE'"];
    const values: unknown[] = [];
    if (input.query) {
      values.push(`%${input.query}%`);
      filters.push(`(c.name ILIKE $${values.length} OR c.code ILIKE $${values.length}
        OR c.industry ILIKE $${values.length} OR c.address ILIKE $${values.length})`);
    }
    if (input.industry) {
      values.push(input.industry);
      filters.push(`c.industry = $${values.length}`);
    }
    if (input.hasRecruitingJobs) {
      filters.push(`EXISTS (
        SELECT 1 FROM job_posts j
        WHERE j.company_id = c.id AND j.status = 'RECRUITING' AND j.deadline >= current_date
      )`);
    }
    const where = `WHERE ${filters.join(" AND ")}`;
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM companies c ${where}`,
      values,
    );
    const offset = (input.page - 1) * input.pageSize;
    values.push(input.pageSize, offset);
    const result = await this.database.query<CompanyRow>(
      `${companySelect} ${where}
       ORDER BY (SELECT count(*) FROM job_posts j
                 WHERE j.company_id = c.id AND j.status = 'RECRUITING'
                   AND j.deadline >= current_date) DESC,
                c.name ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(mapCompany), total: Number(count.rows[0]?.total ?? 0) };
  }

  async findActiveDirectoryById(companyId: string) {
    const result = await this.database.query<CompanyRow>(
      `${companySelect} WHERE c.id = $1 AND c.partner_status = 'ACTIVE'`,
      [companyId],
    );
    return result.rows[0] ? mapCompany(result.rows[0]) : null;
  }

  async findById(companyId: string, database: Pick<Pool, "query"> | PoolClient = this.database) {
    const company = await database.query<CompanyRow>(`${companySelect} WHERE c.id = $1`, [companyId]);
    if (!company.rows[0]) return null;
    const recruiters = await database.query<RecruiterRow>(
      `SELECT u.id AS user_id, u.email, cu.full_name, cu.title, cu.is_primary, u.status,
              u.password_hash, u.suspension_reason, u.last_login_at, cu.created_at
       FROM company_users cu JOIN users u ON u.id = cu.user_id
       WHERE cu.company_id = $1 ORDER BY cu.is_primary DESC, cu.created_at ASC`,
      [companyId],
    );
    return { ...mapCompany(company.rows[0]), recruiters: recruiters.rows.map(mapRecruiter) } as CompanyDetailDto;
  }

  async findByUserId(userId: string) {
    const result = await this.database.query<{ company_id: string }>(
      "SELECT company_id FROM company_users WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ? this.findById(result.rows[0].company_id) : null;
  }

  async lockCompany(client: PoolClient, companyId: string): Promise<LockedCompany | null> {
    const result = await client.query<{ id: string; partner_status: PartnerStatus; version: number }>(
      "SELECT id, partner_status, version FROM companies WHERE id = $1 FOR UPDATE",
      [companyId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, partnerStatus: row.partner_status, version: row.version } : null;
  }

  async lockRecruiter(client: PoolClient, companyId: string, userId: string): Promise<LockedRecruiter | null> {
    const result = await client.query<RecruiterRow & { company_id: string }>(
      `SELECT u.id AS user_id, cu.company_id, u.status, u.password_hash, u.suspension_reason,
              u.email, cu.full_name, cu.title, cu.is_primary, u.last_login_at, cu.created_at
       FROM company_users cu JOIN users u ON u.id = cu.user_id
       WHERE cu.company_id = $1 AND u.id = $2 FOR UPDATE OF u`,
      [companyId, userId],
    );
    const row = result.rows[0];
    return row
      ? {
          userId: row.user_id,
          companyId: row.company_id,
          status: row.status,
          passwordHash: row.password_hash,
          suspensionReason: row.suspension_reason,
        }
      : null;
  }

  async writeAudit(
    client: PoolClient,
    input: {
      actorUserId: string;
      action: string;
      targetType: "COMPANY" | "USER";
      targetId: string;
      metadata?: Record<string, unknown>;
      request: RequestMetadata;
    },
  ) {
    await client.query(
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

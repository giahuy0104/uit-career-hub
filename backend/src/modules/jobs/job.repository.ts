import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  JobDraftInput,
  JobDto,
  JobStatus,
  OpportunityType,
  RequestMetadata,
  WorkMode,
} from "./job.types.js";

export type JobDatabase = Pick<Pool, "query" | "connect">;

type JobRow = QueryResultRow & {
  id: string;
  company_id: string;
  company_code: string;
  company_name: string;
  company_industry: string | null;
  partner_status: string;
  title: string;
  opportunity_type: OpportunityType;
  work_mode: WorkMode;
  location: string;
  description: string;
  requirements: string;
  benefits: string | null;
  positions: number;
  deadline: string | Date;
  status: JobStatus;
  version: number;
  categories: Array<{ id: string; code: string; name: string }> | null;
  skills: Array<{ id: string; slug: string; name: string; isRequired: boolean }> | null;
  latest_review: { reasonCode: string; note: string | null; createdAt: string } | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type LockedJob = {
  id: string;
  companyId: string;
  status: JobStatus;
  version: number;
  deadline: string | Date;
  partnerStatus: string;
};

const jobSelect = `
  SELECT
    j.id,
    j.company_id,
    c.code AS company_code,
    c.name AS company_name,
    c.industry AS company_industry,
    c.partner_status,
    j.title,
    j.opportunity_type,
    j.work_mode,
    j.location,
    j.description,
    j.requirements,
    j.benefits,
    j.positions,
    j.deadline,
    j.status,
    j.version,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', cat.id, 'code', cat.code, 'name', cat.name)
                       ORDER BY cat.name)
      FROM job_post_categories jpc
      JOIN categories cat ON cat.id = jpc.category_id
      WHERE jpc.job_post_id = j.id
    ), '[]'::jsonb) AS categories,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name,
                                         'isRequired', jps.is_required)
                       ORDER BY s.name)
      FROM job_post_skills jps
      JOIN skills s ON s.id = jps.skill_id
      WHERE jps.job_post_id = j.id
    ), '[]'::jsonb) AS skills,
    (
      SELECT jsonb_build_object('reasonCode', h.reason_code, 'note', h.note,
                                'createdAt', h.created_at)
      FROM job_post_status_history h
      WHERE h.job_post_id = j.id
        AND h.to_status IN ('REVISION_REQUIRED', 'REJECTED')
      ORDER BY h.created_at DESC
      LIMIT 1
    ) AS latest_review,
    j.submitted_at,
    j.reviewed_at,
    j.created_at,
    j.updated_at
  FROM job_posts j
  JOIN companies c ON c.id = j.company_id
`;

function iso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

function dateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function mapJob(row: JobRow): JobDto {
  return {
    id: row.id,
    company: {
      id: row.company_id,
      code: row.company_code,
      name: row.company_name,
      industry: row.company_industry,
      partnerStatus: row.partner_status,
    },
    title: row.title,
    opportunityType: row.opportunity_type,
    workMode: row.work_mode,
    location: row.location,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    positions: row.positions,
    deadline: dateOnly(row.deadline),
    status: row.status,
    version: row.version,
    categories: row.categories ?? [],
    skills: row.skills ?? [],
    latestReview: row.latest_review,
    submittedAt: iso(row.submitted_at),
    reviewedAt: iso(row.reviewed_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export class JobRepository {
  constructor(readonly database: JobDatabase) {}

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

  async findById(jobId: string, client: Pick<PoolClient, "query"> = this.database) {
    const result = await client.query<JobRow>(`${jobSelect} WHERE j.id = $1`, [jobId]);
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  }

  async listCompanyJobs(companyId: string, input: { page: number; pageSize: number; status?: JobStatus }) {
    const offset = (input.page - 1) * input.pageSize;
    const filters = ["j.company_id = $1"];
    const values: unknown[] = [companyId];
    if (input.status) {
      values.push(input.status);
      filters.push(`j.status = $${values.length}`);
    }
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM job_posts j WHERE ${filters.join(" AND ")}`,
      values,
    );
    values.push(input.pageSize, offset);
    const result = await this.database.query<JobRow>(
      `${jobSelect} WHERE ${filters.join(" AND ")}
       ORDER BY j.updated_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(mapJob), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listReviewQueue(input: { page: number; pageSize: number }) {
    const offset = (input.page - 1) * input.pageSize;
    const count = await this.database.query<{ total: string }>(
      "SELECT count(*)::text AS total FROM job_posts WHERE status = 'PENDING_UIT_REVIEW'",
    );
    const result = await this.database.query<JobRow>(
      `${jobSelect} WHERE j.status = 'PENDING_UIT_REVIEW'
       ORDER BY j.submitted_at ASC, j.created_at ASC LIMIT $1 OFFSET $2`,
      [input.pageSize, offset],
    );
    return { items: result.rows.map(mapJob), total: Number(count.rows[0]?.total ?? 0) };
  }

  async assertReferenceIds(client: PoolClient, table: "categories" | "skills", ids: string[]) {
    if (ids.length === 0) return true;
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${table} WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return Number(result.rows[0]?.count ?? 0) === new Set(ids).size;
  }

  async replaceReferences(client: PoolClient, jobId: string, input: JobDraftInput) {
    await client.query("DELETE FROM job_post_categories WHERE job_post_id = $1", [jobId]);
    await client.query("DELETE FROM job_post_skills WHERE job_post_id = $1", [jobId]);
    if (input.categoryIds.length) {
      await client.query(
        `INSERT INTO job_post_categories (job_post_id, category_id)
         SELECT $1, unnest($2::uuid[])`,
        [jobId, [...new Set(input.categoryIds)]],
      );
    }
    if (input.skillIds.length) {
      await client.query(
        `INSERT INTO job_post_skills (job_post_id, skill_id)
         SELECT $1, unnest($2::uuid[])`,
        [jobId, [...new Set(input.skillIds)]],
      );
    }
  }

  async lockJob(client: PoolClient, jobId: string): Promise<LockedJob | null> {
    const result = await client.query<{
      id: string;
      company_id: string;
      status: JobStatus;
      version: number;
      deadline: string | Date;
      partner_status: string;
    }>(
      `SELECT j.id, j.company_id, j.status, j.version, j.deadline, c.partner_status
       FROM job_posts j JOIN companies c ON c.id = j.company_id
       WHERE j.id = $1 FOR UPDATE OF j`,
      [jobId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          companyId: row.company_id,
          status: row.status,
          version: row.version,
          deadline: row.deadline,
          partnerStatus: row.partner_status,
        }
      : null;
  }

  async commandExists(client: PoolClient, jobId: string, commandId: string) {
    const result = await client.query(
      "SELECT 1 FROM job_post_status_history WHERE job_post_id = $1 AND command_id = $2",
      [jobId, commandId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async writeAudit(
    client: PoolClient,
    input: {
      actorUserId: string;
      action: string;
      jobId: string;
      metadata?: Record<string, unknown>;
      request: RequestMetadata;
    },
  ) {
    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, 'JOB_POST', $3, $4::jsonb, $5, $6)`,
      [
        input.actorUserId,
        input.action,
        input.jobId,
        JSON.stringify(input.metadata ?? {}),
        input.request.ipAddress,
        input.request.userAgent,
      ],
    );
  }
}


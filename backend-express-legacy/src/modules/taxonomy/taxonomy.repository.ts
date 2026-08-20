import type { Pool, PoolClient, QueryResultRow } from "pg";

import type { RequestMetadata } from "../auth/auth.types.js";
import type { CategoryDto, SkillDto, TaxonomyKind, TaxonomyListInput, TaxonomyStatus } from "./taxonomy.types.js";

export type TaxonomyDatabase = Pick<Pool, "query" | "connect">;

type TaxonomyRow = QueryResultRow & {
  id: string;
  code?: string;
  slug?: string;
  name: string;
  is_active: boolean;
  version: number;
  job_count: string;
  open_job_count: string;
  created_at: Date;
  updated_at: Date;
};

export type LockedTaxonomyItem = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  version: number;
};

const openJobStatuses = ["DRAFT", "PENDING_UIT_REVIEW", "REVISION_REQUIRED", "RECRUITING", "PAUSED"];

const configs = {
  category: {
    table: "categories",
    alias: "c",
    keyColumn: "code",
    linkTable: "job_post_categories",
    linkAlias: "jpc",
    foreignKey: "category_id",
    targetType: "CATEGORY",
  },
  skill: {
    table: "skills",
    alias: "s",
    keyColumn: "slug",
    linkTable: "job_post_skills",
    linkAlias: "jps",
    foreignKey: "skill_id",
    targetType: "SKILL",
  },
} as const;

function mapStatus(isActive: boolean): TaxonomyStatus {
  return isActive ? "ACTIVE" : "INACTIVE";
}

function mapCategory(row: TaxonomyRow): CategoryDto {
  return {
    id: row.id,
    code: row.code!,
    name: row.name,
    status: mapStatus(row.is_active),
    version: row.version,
    jobCount: Number(row.job_count),
    openJobCount: Number(row.open_job_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkill(row: TaxonomyRow): SkillDto {
  return {
    id: row.id,
    slug: row.slug!,
    name: row.name,
    status: mapStatus(row.is_active),
    version: row.version,
    jobCount: Number(row.job_count),
    openJobCount: Number(row.open_job_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class TaxonomyRepository {
  constructor(readonly database: TaxonomyDatabase) {}

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

  listCategories(input: TaxonomyListInput) {
    return this.list("category", input, mapCategory);
  }

  listSkills(input: TaxonomyListInput) {
    return this.list("skill", input, mapSkill);
  }

  findCategoryById(id: string, database: Pick<Pool, "query"> | PoolClient = this.database) {
    return this.findById("category", id, database, mapCategory);
  }

  findSkillById(id: string, database: Pick<Pool, "query"> | PoolClient = this.database) {
    return this.findById("skill", id, database, mapSkill);
  }

  async lock(client: PoolClient, kind: TaxonomyKind, id: string): Promise<LockedTaxonomyItem | null> {
    const config = configs[kind];
    const result = await client.query<{
      id: string;
      item_key: string;
      name: string;
      is_active: boolean;
      version: number;
    }>(
      `SELECT id, ${config.keyColumn} AS item_key, name, is_active, version
       FROM ${config.table} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const row = result.rows[0];
    return row
      ? { id: row.id, key: row.item_key, name: row.name, isActive: row.is_active, version: row.version }
      : null;
  }

  async countOpenJobReferences(client: PoolClient, kind: TaxonomyKind, id: string) {
    const config = configs[kind];
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM ${config.linkTable} link
       JOIN job_posts j ON j.id = link.job_post_id
       WHERE link.${config.foreignKey} = $1 AND j.status = ANY($2::text[])`,
      [id, openJobStatuses],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async writeAudit(
    client: PoolClient,
    input: {
      actorUserId: string;
      action: string;
      kind: TaxonomyKind;
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
        configs[input.kind].targetType,
        input.targetId,
        JSON.stringify(input.metadata ?? {}),
        input.request.ipAddress,
        input.request.userAgent,
      ],
    );
  }

  private async list<T>(kind: TaxonomyKind, input: TaxonomyListInput, map: (row: TaxonomyRow) => T) {
    const config = configs[kind];
    const filters: string[] = [];
    const values: unknown[] = [];
    if (input.query) {
      values.push(`%${input.query}%`);
      filters.push(`(${config.alias}.name ILIKE $${values.length} OR ${config.alias}.${config.keyColumn} ILIKE $${values.length})`);
    }
    if (input.status) {
      values.push(input.status === "ACTIVE");
      filters.push(`${config.alias}.is_active = $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const count = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM ${config.table} ${config.alias} ${where}`,
      values,
    );
    const offset = (input.page - 1) * input.pageSize;
    values.push(input.pageSize, offset);
    const result = await this.database.query<TaxonomyRow>(
      `${this.select(kind)} ${where}
       GROUP BY ${config.alias}.id
       ORDER BY ${config.alias}.is_active DESC, ${config.alias}.name ASC, ${config.alias}.id ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(map), total: Number(count.rows[0]?.total ?? 0) };
  }

  private async findById<T>(
    kind: TaxonomyKind,
    id: string,
    database: Pick<Pool, "query"> | PoolClient,
    map: (row: TaxonomyRow) => T,
  ) {
    const config = configs[kind];
    const result = await database.query<TaxonomyRow>(
      `${this.select(kind)} WHERE ${config.alias}.id = $1 GROUP BY ${config.alias}.id`,
      [id],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  private select(kind: TaxonomyKind) {
    const config = configs[kind];
    return `SELECT ${config.alias}.id, ${config.alias}.${config.keyColumn}, ${config.alias}.name,
                   ${config.alias}.is_active, ${config.alias}.version,
                   count(DISTINCT ${config.linkAlias}.job_post_id)::text AS job_count,
                   count(DISTINCT ${config.linkAlias}.job_post_id)
                     FILTER (WHERE j.status = ANY(ARRAY['DRAFT', 'PENDING_UIT_REVIEW', 'REVISION_REQUIRED', 'RECRUITING', 'PAUSED']))::text
                     AS open_job_count,
                   ${config.alias}.created_at, ${config.alias}.updated_at
            FROM ${config.table} ${config.alias}
            LEFT JOIN ${config.linkTable} ${config.linkAlias}
              ON ${config.linkAlias}.${config.foreignKey} = ${config.alias}.id
            LEFT JOIN job_posts j ON j.id = ${config.linkAlias}.job_post_id`;
  }
}

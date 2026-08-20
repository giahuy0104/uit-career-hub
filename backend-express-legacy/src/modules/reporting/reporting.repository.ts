import type { Pool, PoolClient, QueryResultRow } from "pg";

import type { RequestMetadata } from "../auth/auth.types.js";
import type {
  ApplicationReportData,
  ApplicationReportFilterOptions,
  ApplicationReportFilters,
  ApplicationReportListInput,
  ApplicationReportRow,
  ApplicationReportSummary,
} from "./reporting.types.js";

export type ReportingDatabase = Pick<Pool, "query" | "connect">;
type Queryable = Pick<Pool, "query"> | PoolClient;

type ReportRow = QueryResultRow & {
  application_id: string;
  submitted_at: Date;
  last_transition_at: Date;
  student_code: string;
  full_name: string;
  faculty: string;
  major: string;
  cohort: string;
  company_id: string;
  company_code: string;
  company_name: string;
  job_title: string;
  opportunity_type: ApplicationReportRow["job"]["opportunityType"];
  work_mode: ApplicationReportRow["job"]["workMode"];
  status: ApplicationReportRow["status"];
  outcome: "PASS" | "FAIL" | null;
  student_decision: "ACCEPTED" | "DECLINED" | null;
  start_date: string | null;
};

const selectReportRows = `
  SELECT a.id AS application_id, a.submitted_at, a.last_transition_at,
         sp.student_code, sp.full_name, sp.faculty, sp.major, sp.cohort,
         c.id AS company_id, c.code AS company_code, c.name AS company_name,
         j.title AS job_title, j.opportunity_type, j.work_mode, a.status,
         rr.outcome, rr.student_decision, rr.start_date::text AS start_date
  FROM applications a
  JOIN student_profiles sp ON sp.id = a.student_profile_id
  JOIN job_posts j ON j.id = a.job_post_id
  JOIN companies c ON c.id = j.company_id
  LEFT JOIN recruitment_results rr ON rr.application_id = a.id`;

function mapRow(row: ReportRow): ApplicationReportRow {
  return {
    applicationId: row.application_id,
    submittedAt: row.submitted_at.toISOString(),
    lastTransitionAt: row.last_transition_at.toISOString(),
    student: {
      studentCode: row.student_code,
      fullName: row.full_name,
      faculty: row.faculty,
      major: row.major,
      cohort: row.cohort,
    },
    company: { id: row.company_id, code: row.company_code, name: row.company_name },
    job: {
      title: row.job_title,
      opportunityType: row.opportunity_type,
      workMode: row.work_mode,
    },
    status: row.status,
    recruitmentResult: row.outcome
      ? { outcome: row.outcome, studentDecision: row.student_decision, startDate: row.start_date }
      : null,
  };
}

function buildWhere(filters: ApplicationReportFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const add = (value: unknown, clause: (parameter: string) => string) => {
    values.push(value);
    clauses.push(clause(`$${values.length}`));
  };

  if (filters.fromDate) {
    add(filters.fromDate, (parameter) =>
      `a.submitted_at >= (${parameter}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
  }
  if (filters.toDate) {
    add(filters.toDate, (parameter) =>
      `a.submitted_at < (((${parameter}::date + 1)::timestamp) AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
  }
  if (filters.faculty) add(filters.faculty, (parameter) => `sp.faculty = ${parameter}`);
  if (filters.major) add(filters.major, (parameter) => `sp.major = ${parameter}`);
  if (filters.cohort) add(filters.cohort, (parameter) => `sp.cohort = ${parameter}`);
  if (filters.companyId) add(filters.companyId, (parameter) => `c.id = ${parameter}`);
  if (filters.status) add(filters.status, (parameter) => `a.status = ${parameter}`);
  if (filters.opportunityType) add(filters.opportunityType, (parameter) => `j.opportunity_type = ${parameter}`);
  if (filters.query) {
    add(`%${filters.query}%`, (parameter) =>
      `(sp.student_code ILIKE ${parameter} OR sp.full_name ILIKE ${parameter} OR j.title ILIKE ${parameter} OR c.name ILIKE ${parameter})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}

export class ReportingRepository {
  constructor(readonly database: ReportingDatabase) {}

  async withTransaction<T>(readOnly: boolean, callback: (client: PoolClient) => Promise<T>) {
    const client = await this.database.connect();
    await client.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${readOnly ? " READ ONLY" : ""}`);
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

  async getReport(client: Queryable, input: ApplicationReportListInput): Promise<ApplicationReportData> {
    const [summary, filterOptions] = await Promise.all([
      this.getSummary(client, input),
      this.getFilterOptions(client),
    ]);
    const { where, values } = buildWhere(input);
    const offset = (input.page - 1) * input.pageSize;
    const pagedValues = [...values, input.pageSize, offset];
    const result = await client.query<ReportRow>(
      `${selectReportRows} ${where}
       ORDER BY a.submitted_at DESC, a.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      pagedValues,
    );
    return {
      items: result.rows.map(mapRow),
      total: summary.totalApplications,
      summary,
      filterOptions,
    };
  }

  async getExportRows(client: Queryable, filters: ApplicationReportFilters, limit: number) {
    const { where, values } = buildWhere(filters);
    const result = await client.query<ReportRow>(
      `${selectReportRows} ${where}
       ORDER BY a.submitted_at DESC, a.id DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );
    return result.rows.map(mapRow);
  }

  async getSummary(client: Queryable, filters: ApplicationReportFilters): Promise<ApplicationReportSummary> {
    const { where, values } = buildWhere(filters);
    const base = `FROM applications a
      JOIN student_profiles sp ON sp.id = a.student_profile_id
      JOIN job_posts j ON j.id = a.job_post_id
      JOIN companies c ON c.id = j.company_id
      LEFT JOIN recruitment_results rr ON rr.application_id = a.id ${where}`;
    const totals = await client.query<{
      total_applications: string;
      unique_students: string;
      company_count: string;
      hired_count: string;
    }>(
      `SELECT count(*)::text AS total_applications,
              count(DISTINCT a.student_profile_id)::text AS unique_students,
              count(DISTINCT j.company_id)::text AS company_count,
              count(*) FILTER (WHERE a.status = 'HIRED')::text AS hired_count
       ${base}`,
      values,
    );
    const statusCounts = await client.query<{ status: ApplicationReportRow["status"]; count: string }>(
      `SELECT a.status, count(*)::text AS count ${base}
       GROUP BY a.status ORDER BY count(*) DESC, a.status ASC`,
      values,
    );
    const row = totals.rows[0]!;
    const totalApplications = Number(row.total_applications);
    const hiredCount = Number(row.hired_count);
    return {
      totalApplications,
      uniqueStudents: Number(row.unique_students),
      companyCount: Number(row.company_count),
      hiredCount,
      hiredRate: totalApplications ? hiredCount / totalApplications : 0,
      statusCounts: statusCounts.rows.map((item) => ({ status: item.status, count: Number(item.count) })),
    };
  }

  async getFilterOptions(client: Queryable): Promise<ApplicationReportFilterOptions> {
    const dimensions = await client.query<{
      faculties: string[];
      majors: string[];
      cohorts: string[];
    }>(
      `SELECT coalesce(array_agg(DISTINCT sp.faculty ORDER BY sp.faculty), '{}') AS faculties,
              coalesce(array_agg(DISTINCT sp.major ORDER BY sp.major), '{}') AS majors,
              coalesce(array_agg(DISTINCT sp.cohort ORDER BY sp.cohort), '{}') AS cohorts
       FROM applications a JOIN student_profiles sp ON sp.id = a.student_profile_id`,
    );
    const companies = await client.query<{ id: string; code: string; name: string }>(
      `SELECT DISTINCT c.id, c.code, c.name
       FROM applications a
       JOIN job_posts j ON j.id = a.job_post_id
       JOIN companies c ON c.id = j.company_id
       ORDER BY c.name, c.id`,
    );
    return {
      faculties: dimensions.rows[0]?.faculties ?? [],
      majors: dimensions.rows[0]?.majors ?? [],
      cohorts: dimensions.rows[0]?.cohorts ?? [],
      companies: companies.rows,
    };
  }

  async writeExportAudit(
    client: PoolClient,
    input: {
      actorUserId: string;
      format: string;
      rowCount: number;
      filters: ApplicationReportFilters;
      request: RequestMetadata;
    },
  ) {
    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, metadata, ip_address, user_agent)
       VALUES ($1, 'UIT_APPLICATION_REPORT_EXPORTED', 'REPORT', $2::jsonb, $3, $4)`,
      [
        input.actorUserId,
        JSON.stringify({ report: "APPLICATIONS", format: input.format, rowCount: input.rowCount, filters: input.filters }),
        input.request.ipAddress,
        input.request.userAgent,
      ],
    );
  }
}

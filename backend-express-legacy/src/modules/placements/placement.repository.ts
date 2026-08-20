import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  PlacementDto,
  PlacementListInput,
  PlacementStatus,
  PlacementSummary,
  RequestMetadata,
} from "./placement.types.js";

export type PlacementDatabase = Pick<Pool, "query" | "connect">;
type Queryable = Pick<Pool, "query"> | PoolClient;

type PlacementRow = QueryResultRow & {
  id: string;
  application_id: string;
  status: PlacementStatus;
  version: number;
  expected_start_date: string;
  actual_start_date: string | null;
  completed_date: string | null;
  hired_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  student_profile_id: string;
  student_user_id: string;
  student_code: string;
  student_full_name: string;
  student_faculty: string;
  student_major: string;
  student_cohort: string;
  student_email: string;
  job_id: string;
  job_title: string;
  company_id: string;
  company_code: string;
  company_name: string;
  history: PlacementDto["history"] | null;
  company_evaluation: PlacementDto["evaluations"]["company"];
  student_evaluation: PlacementDto["evaluations"]["student"];
};

const placementSelect = `
  SELECT ip.id, ip.application_id, ip.status, ip.version,
         ip.expected_start_date::text, ip.actual_start_date::text, ip.completed_date::text,
         ip.hired_at, ip.started_at, ip.completed_at,
         sp.id AS student_profile_id, sp.user_id AS student_user_id, sp.student_code,
         sp.full_name AS student_full_name, sp.faculty AS student_faculty,
         sp.major AS student_major, sp.cohort AS student_cohort, su.email AS student_email,
         j.id AS job_id, j.title AS job_title,
         c.id AS company_id, c.code AS company_code, c.name AS company_name,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'fromStatus', iph.from_status,
             'toStatus', iph.to_status,
             'actorType', iph.actor_type,
             'actorUserId', iph.actor_user_id,
             'actorName', COALESCE(us.full_name, iph.actor_type),
             'effectiveDate', iph.effective_date,
             'note', iph.note,
             'createdAt', iph.created_at
           ) ORDER BY iph.created_at, iph.id)
           FROM internship_placement_history iph
           LEFT JOIN uit_staff us ON us.user_id = iph.actor_user_id
           WHERE iph.placement_id = ip.id
         ), '[]'::jsonb) AS history,
         (
           SELECT jsonb_build_object(
             'id', ie.id,
             'respondentRole', ie.respondent_role,
             'workQualityRating', ie.work_quality_rating,
             'collaborationRating', ie.collaboration_rating,
             'professionalismRating', ie.professionalism_rating,
             'overallRating', ie.overall_rating,
             'recommendation', ie.recommendation,
             'strengths', ie.strengths,
             'improvements', ie.improvements,
             'submittedBy', jsonb_build_object(
               'id', ie.submitted_by_user_id,
               'name', COALESCE(cu.full_name, eu.email)
             ),
             'submittedAt', ie.created_at
           )
           FROM internship_evaluations ie
           JOIN users eu ON eu.id = ie.submitted_by_user_id
           LEFT JOIN company_users cu ON cu.user_id = eu.id
           WHERE ie.placement_id = ip.id AND ie.respondent_role = 'COMPANY'
         ) AS company_evaluation,
         (
           SELECT jsonb_build_object(
             'id', ie.id,
             'respondentRole', ie.respondent_role,
             'workQualityRating', ie.work_quality_rating,
             'collaborationRating', ie.collaboration_rating,
             'professionalismRating', ie.professionalism_rating,
             'overallRating', ie.overall_rating,
             'recommendation', ie.recommendation,
             'strengths', ie.strengths,
             'improvements', ie.improvements,
             'submittedBy', jsonb_build_object(
               'id', ie.submitted_by_user_id,
               'name', COALESCE(esp.full_name, eu.email)
             ),
             'submittedAt', ie.created_at
           )
           FROM internship_evaluations ie
           JOIN users eu ON eu.id = ie.submitted_by_user_id
           LEFT JOIN student_profiles esp ON esp.user_id = eu.id
           WHERE ie.placement_id = ip.id AND ie.respondent_role = 'STUDENT'
         ) AS student_evaluation
  FROM internship_placements ip
  JOIN applications a ON a.id = ip.application_id
  JOIN student_profiles sp ON sp.id = a.student_profile_id
  JOIN users su ON su.id = sp.user_id
  JOIN job_posts j ON j.id = a.job_post_id
  JOIN companies c ON c.id = j.company_id`;

function availableActions(status: PlacementStatus) {
  if (status === "HIRED") return ["START"] as const;
  if (status === "STARTED") return ["COMPLETE"] as const;
  return [];
}

function mapPlacement(row: PlacementRow): PlacementDto {
  const normalizeEvaluation = (evaluation: PlacementDto["evaluations"]["company"]) => (
    evaluation ? { ...evaluation, submittedAt: new Date(evaluation.submittedAt).toISOString() } : null
  );
  return {
    id: row.id,
    applicationId: row.application_id,
    status: row.status,
    version: row.version,
    expectedStartDate: row.expected_start_date,
    actualStartDate: row.actual_start_date,
    completedDate: row.completed_date,
    hiredAt: row.hired_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    availableActions: [...availableActions(row.status)],
    student: {
      id: row.student_profile_id,
      studentCode: row.student_code,
      fullName: row.student_full_name,
      faculty: row.student_faculty,
      major: row.student_major,
      cohort: row.student_cohort,
      email: row.student_email,
    },
    job: {
      id: row.job_id,
      title: row.job_title,
      company: { id: row.company_id, code: row.company_code, name: row.company_name },
    },
    history: (row.history ?? []).map((item) => ({
      ...item,
      effectiveDate: String(item.effectiveDate).slice(0, 10),
      createdAt: new Date(item.createdAt).toISOString(),
    })),
    evaluations: {
      company: normalizeEvaluation(row.company_evaluation),
      student: normalizeEvaluation(row.student_evaluation),
    },
  };
}

export class PlacementRepository {
  constructor(private readonly database: PlacementDatabase) {}

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
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

  async list(input: PlacementListInput) {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (input.status) {
      values.push(input.status);
      clauses.push(`ip.status = $${values.length}`);
    }
    if (input.query) {
      values.push(`%${input.query}%`);
      clauses.push(`(sp.student_code ILIKE $${values.length} OR sp.full_name ILIKE $${values.length}
        OR j.title ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const countResult = await this.database.query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM internship_placements ip
       JOIN applications a ON a.id = ip.application_id
       JOIN student_profiles sp ON sp.id = a.student_profile_id
       JOIN job_posts j ON j.id = a.job_post_id
       JOIN companies c ON c.id = j.company_id${where}`,
      values,
    );
    values.push(input.pageSize, (input.page - 1) * input.pageSize);
    const result = await this.database.query<PlacementRow>(
      `${placementSelect}${where}
       ORDER BY CASE ip.status WHEN 'STARTED' THEN 0 WHEN 'HIRED' THEN 1 ELSE 2 END,
                ip.expected_start_date, ip.id
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const summaryResult = await this.database.query<{
      total: string;
      hired: string;
      started: string;
      completed: string;
    }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE status = 'HIRED')::text AS hired,
              count(*) FILTER (WHERE status = 'STARTED')::text AS started,
              count(*) FILTER (WHERE status = 'COMPLETED')::text AS completed
       FROM internship_placements`,
    );
    const summaryRow = summaryResult.rows[0];
    const summary: PlacementSummary = {
      total: Number(summaryRow?.total ?? 0),
      HIRED: Number(summaryRow?.hired ?? 0),
      STARTED: Number(summaryRow?.started ?? 0),
      COMPLETED: Number(summaryRow?.completed ?? 0),
    };
    return {
      items: result.rows.map(mapPlacement),
      total: Number(countResult.rows[0]?.total ?? 0),
      summary,
    };
  }

  async findById(placementId: string, client: Queryable = this.database) {
    const result = await client.query<PlacementRow>(`${placementSelect} WHERE ip.id = $1`, [placementId]);
    return result.rows[0] ? mapPlacement(result.rows[0]) : null;
  }

  async lockById(client: PoolClient, placementId: string) {
    const result = await client.query<{
      id: string;
      application_id: string;
      status: PlacementStatus;
      version: number;
      actual_start_date: string | null;
      student_user_id: string;
      student_full_name: string;
      job_title: string;
      company_id: string;
      company_name: string;
    }>(
      `SELECT ip.id, ip.application_id, ip.status, ip.version, ip.actual_start_date::text,
              sp.user_id AS student_user_id, sp.full_name AS student_full_name,
              j.title AS job_title, c.id AS company_id, c.name AS company_name
       FROM internship_placements ip
       JOIN applications a ON a.id = ip.application_id
       JOIN student_profiles sp ON sp.id = a.student_profile_id
       JOIN job_posts j ON j.id = a.job_post_id
       JOIN companies c ON c.id = j.company_id
       WHERE ip.id = $1
       FOR UPDATE OF ip`,
      [placementId],
    );
    return result.rows[0] ?? null;
  }

  async findCommand(client: PoolClient, placementId: string, commandId: string) {
    const result = await client.query<{ to_status: PlacementStatus }>(
      `SELECT to_status FROM internship_placement_history
       WHERE placement_id = $1 AND command_id = $2`,
      [placementId, commandId],
    );
    return result.rows[0]?.to_status ?? null;
  }

  async transition(
    client: PoolClient,
    input: {
      placementId: string;
      actorUserId: string;
      commandId: string;
      fromStatus: PlacementStatus;
      toStatus: PlacementStatus;
      effectiveDate: string;
      note?: string;
      request: RequestMetadata;
      applicationId: string;
      studentUserId: string;
      studentFullName: string;
      jobTitle: string;
      companyId: string;
      companyName: string;
    },
  ) {
    const isStart = input.toStatus === "STARTED";
    await client.query(
      `UPDATE internship_placements
       SET status = $2,
           actual_start_date = CASE WHEN $2 = 'STARTED' THEN $3::date ELSE actual_start_date END,
           completed_date = CASE WHEN $2 = 'COMPLETED' THEN $3::date ELSE completed_date END,
           started_at = CASE WHEN $2 = 'STARTED' THEN now() ELSE started_at END,
           completed_at = CASE WHEN $2 = 'COMPLETED' THEN now() ELSE completed_at END,
           version = version + 1,
           updated_at = now()
       WHERE id = $1`,
      [input.placementId, input.toStatus, input.effectiveDate],
    );
    await client.query(
      `INSERT INTO internship_placement_history
       (placement_id, command_id, from_status, to_status, actor_type, actor_user_id,
        effective_date, note, metadata)
       VALUES ($1, $2, $3, $4, 'UIT_ADMIN', $5, $6, $7,
               jsonb_build_object('applicationId', $8::text))`,
      [
        input.placementId,
        input.commandId,
        input.fromStatus,
        input.toStatus,
        input.actorUserId,
        input.effectiveDate,
        input.note ?? null,
        input.applicationId,
      ],
    );
    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, 'INTERNSHIP_PLACEMENT', $3,
               jsonb_build_object('commandId', $4::text, 'fromStatus', $5::text,
                                  'toStatus', $6::text, 'effectiveDate', $7::text,
                                  'applicationId', $8::text), $9, $10)`,
      [
        input.actorUserId,
        isStart ? "INTERNSHIP_PLACEMENT_STARTED" : "INTERNSHIP_PLACEMENT_COMPLETED",
        input.placementId,
        input.commandId,
        input.fromStatus,
        input.toStatus,
        input.effectiveDate,
        input.applicationId,
        input.request.ipAddress,
        input.request.userAgent,
      ],
    );
    await client.query(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
       VALUES ($1, $2, $3, $4, 'INTERNSHIP_PLACEMENT', $5::uuid, '/applications/' || $6::text,
               'placement:' || $5::uuid::text || ':' || $7::text || ':student',
               jsonb_build_object('placementId', $5::uuid::text, 'applicationId', $6::text,
                                  'status', $8::text, 'effectiveDate', $9::text))
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        input.studentUserId,
        isStart ? "INTERNSHIP_PLACEMENT_STARTED" : "INTERNSHIP_PLACEMENT_COMPLETED",
        isStart ? "UIT đã ghi nhận bạn bắt đầu thực tập" : "UIT đã xác nhận hoàn thành thực tập",
        isStart
          ? `UIT đã ghi nhận bạn bắt đầu vị trí “${input.jobTitle}” tại ${input.companyName}.`
          : `UIT đã xác nhận bạn hoàn thành vị trí “${input.jobTitle}” tại ${input.companyName}.`,
        input.placementId,
        input.applicationId,
        input.commandId,
        input.toStatus,
        input.effectiveDate,
      ],
    );
    await client.query(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
       SELECT u.id, $2, $3,
              $4 || CASE WHEN $5 = 'STARTED' THEN ' bắt đầu' ELSE ' hoàn thành' END ||
              ' kỳ thực tập cho vị trí “' || $6 || '”.',
              'INTERNSHIP_PLACEMENT', $7::uuid, '/company/candidates/' || $8::text,
               'placement:' || $7::uuid::text || ':' || $9::text || ':company:' || u.id::text,
               jsonb_build_object('placementId', $7::uuid::text, 'applicationId', $8::text,
                                 'status', $5::text, 'effectiveDate', $10::text)
       FROM company_users cu JOIN users u ON u.id = cu.user_id
       WHERE cu.company_id = $1 AND u.status = 'ACTIVE'
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        input.companyId,
        isStart ? "INTERNSHIP_PLACEMENT_STARTED" : "INTERNSHIP_PLACEMENT_COMPLETED",
        isStart ? "UIT đã ghi nhận sinh viên bắt đầu thực tập" : "UIT đã xác nhận sinh viên hoàn thành thực tập",
        input.studentFullName,
        input.toStatus,
        input.jobTitle,
        input.placementId,
        input.applicationId,
        input.commandId,
        input.effectiveDate,
      ],
    );
  }
}

import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  InternshipEvaluationDto,
  InternshipEvaluationRole,
  InternshipEvaluationSubmit,
  InternshipEvaluationView,
} from "./evaluation.types.js";
import type { PlacementStatus } from "./placement.types.js";

export type InternshipEvaluationDatabase = Pick<Pool, "query" | "connect">;
type Queryable = Pick<Pool, "query"> | PoolClient;

type PlacementContextRow = QueryResultRow & {
  placement_id: string;
  application_id: string;
  placement_status: PlacementStatus;
  expected_start_date: string;
  actual_start_date: string | null;
  completed_date: string | null;
  student_profile_id: string;
  student_user_id: string;
  student_name: string;
  company_id: string;
  company_name: string;
  job_title: string;
};

type EvaluationRow = QueryResultRow & {
  id: string;
  placement_id: string;
  respondent_role: InternshipEvaluationRole;
  submitted_by_user_id: string;
  submitted_by_name: string;
  command_id: string;
  work_quality_rating: number;
  collaboration_rating: number;
  professionalism_rating: number;
  overall_rating: number;
  recommendation: boolean;
  strengths: string;
  improvements: string | null;
  created_at: Date;
};

const contextSelect = `
  SELECT ip.id AS placement_id, ip.application_id, ip.status AS placement_status,
         ip.expected_start_date::text, ip.actual_start_date::text, ip.completed_date::text,
         sp.id AS student_profile_id, sp.user_id AS student_user_id, sp.full_name AS student_name,
         c.id AS company_id, c.name AS company_name, j.title AS job_title
  FROM internship_placements ip
  JOIN applications a ON a.id = ip.application_id
  JOIN student_profiles sp ON sp.id = a.student_profile_id
  JOIN job_posts j ON j.id = a.job_post_id
  JOIN companies c ON c.id = j.company_id`;

const evaluationSelect = `
  SELECT ie.*,
         COALESCE(sp.full_name, cu.full_name, u.email) AS submitted_by_name
  FROM internship_evaluations ie
  JOIN users u ON u.id = ie.submitted_by_user_id
  LEFT JOIN student_profiles sp ON sp.user_id = u.id
  LEFT JOIN company_users cu ON cu.user_id = u.id`;

function mapEvaluation(row: EvaluationRow): InternshipEvaluationDto {
  return {
    id: row.id,
    respondentRole: row.respondent_role,
    workQualityRating: row.work_quality_rating,
    collaborationRating: row.collaboration_rating,
    professionalismRating: row.professionalism_rating,
    overallRating: row.overall_rating,
    recommendation: row.recommendation,
    strengths: row.strengths,
    improvements: row.improvements,
    submittedBy: { id: row.submitted_by_user_id, name: row.submitted_by_name },
    submittedAt: row.created_at.toISOString(),
  };
}

export class InternshipEvaluationRepository {
  constructor(private readonly database: InternshipEvaluationDatabase) {}

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

  async findContextByApplication(applicationId: string, client: Queryable = this.database, lock = false) {
    const result = await client.query<PlacementContextRow>(
      `${contextSelect} WHERE ip.application_id = $1${lock ? " FOR UPDATE OF ip" : ""}`,
      [applicationId],
    );
    return result.rows[0] ?? null;
  }

  async listForPlacement(placementId: string, client: Queryable = this.database) {
    const result = await client.query<EvaluationRow>(
      `${evaluationSelect} WHERE ie.placement_id = $1 ORDER BY ie.created_at, ie.id`,
      [placementId],
    );
    return result.rows.map(mapEvaluation);
  }

  async findByCommand(placementId: string, commandId: string, client: Queryable = this.database) {
    const result = await client.query<EvaluationRow>(
      `${evaluationSelect} WHERE ie.placement_id = $1 AND ie.command_id = $2`,
      [placementId, commandId],
    );
    return result.rows[0] ? mapEvaluation(result.rows[0]) : null;
  }

  async insert(client: PoolClient, input: InternshipEvaluationSubmit, context: PlacementContextRow) {
    await client.query(
      `INSERT INTO internship_evaluations
       (placement_id, respondent_role, submitted_by_user_id, command_id,
        work_quality_rating, collaboration_rating, professionalism_rating, overall_rating,
        recommendation, strengths, improvements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        context.placement_id,
        input.role,
        input.actor.userId,
        input.commandId,
        input.input.workQualityRating,
        input.input.collaborationRating,
        input.input.professionalismRating,
        input.input.overallRating,
        input.input.recommendation,
        input.input.strengths,
        input.input.improvements ?? null,
      ],
    );
    const evaluation = await this.findByCommand(context.placement_id, input.commandId, client);
    if (!evaluation) throw new Error("Không thể đọc lại phiếu đánh giá vừa tạo.");
    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, 'INTERNSHIP_EVALUATION', $3,
               jsonb_build_object('placementId', $4::text, 'applicationId', $5::text,
                                  'respondentRole', $6::text, 'commandId', $7::text), $8, $9)`,
      [
        input.actor.userId,
        input.role === "COMPANY"
          ? "COMPANY_INTERNSHIP_EVALUATION_SUBMITTED"
          : "STUDENT_INTERNSHIP_EVALUATION_SUBMITTED",
        evaluation.id,
        context.placement_id,
        context.application_id,
        input.role,
        input.commandId,
        input.request.ipAddress,
        input.request.userAgent,
      ],
    );
    await this.createNotifications(client, input, context, evaluation.id);
    return evaluation;
  }

  private async createNotifications(
    client: PoolClient,
    input: InternshipEvaluationSubmit,
    context: PlacementContextRow,
    evaluationId: string,
  ) {
    if (input.role === "COMPANY") {
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         VALUES ($1, 'COMPANY_INTERNSHIP_EVALUATION_SUBMITTED', 'Doanh nghiệp đã gửi đánh giá kỳ thực tập',
                 $2, 'INTERNSHIP_EVALUATION', $3::uuid, '/applications/' || $4::text,
                 'evaluation:' || $3::text || ':student',
                 jsonb_build_object('placementId', $5::text, 'applicationId', $4::text,
                                    'respondentRole', 'COMPANY'))
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          context.student_user_id,
          `${context.company_name} đã gửi đánh giá cho vị trí “${context.job_title}”.`,
          evaluationId,
          context.application_id,
          context.placement_id,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
         SELECT u.id, 'STUDENT_INTERNSHIP_EVALUATION_SUBMITTED',
                'Sinh viên đã gửi phản hồi kỳ thực tập', $2,
                'INTERNSHIP_EVALUATION', $3::uuid, '/company/candidates/' || $4::text,
                'evaluation:' || $3::text || ':company:' || u.id::text,
                jsonb_build_object('placementId', $5::text, 'applicationId', $4::text,
                                   'respondentRole', 'STUDENT', 'contentVisible', false)
         FROM company_users cu JOIN users u ON u.id = cu.user_id
         WHERE cu.company_id = $1 AND u.status = 'ACTIVE'
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          context.company_id,
          `${context.student_name} đã gửi phản hồi riêng cho UIT về vị trí “${context.job_title}”.`,
          evaluationId,
          context.application_id,
          context.placement_id,
        ],
      );
    }
    await client.query(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key, payload)
       SELECT u.id, $1, $2, $3, 'INTERNSHIP_EVALUATION', $4::uuid,
              '/uit/placements/' || $5::text,
              'evaluation:' || $4::text || ':uit:' || u.id::text,
              jsonb_build_object('placementId', $5::text, 'applicationId', $6::text,
                                 'respondentRole', $7::text)
       FROM uit_staff us JOIN users u ON u.id = us.user_id
       WHERE u.status = 'ACTIVE'
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        input.role === "COMPANY"
          ? "COMPANY_INTERNSHIP_EVALUATION_SUBMITTED"
          : "STUDENT_INTERNSHIP_EVALUATION_SUBMITTED",
        input.role === "COMPANY" ? "Doanh nghiệp đã gửi đánh giá thực tập" : "Sinh viên đã gửi phản hồi thực tập",
        `${input.role === "COMPANY" ? context.company_name : context.student_name} đã hoàn tất phiếu cho vị trí “${context.job_title}”.`,
        evaluationId,
        context.placement_id,
        context.application_id,
        input.role,
      ],
    );
  }

  async viewFor(
    context: PlacementContextRow,
    viewerRole: InternshipEvaluationRole,
    client: Queryable = this.database,
  ): Promise<InternshipEvaluationView> {
    const evaluations = await this.listForPlacement(context.placement_id, client);
    const companyEvaluation = evaluations.find((item) => item.respondentRole === "COMPANY") ?? null;
    const rawStudentEvaluation = evaluations.find((item) => item.respondentRole === "STUDENT") ?? null;
    const ownEvaluation = viewerRole === "COMPANY" ? companyEvaluation : rawStudentEvaluation;
    return {
      placement: {
        id: context.placement_id,
        applicationId: context.application_id,
        status: context.placement_status,
        expectedStartDate: context.expected_start_date,
        actualStartDate: context.actual_start_date,
        completedDate: context.completed_date,
      },
      companyEvaluation,
      studentEvaluation: viewerRole === "COMPANY" ? null : rawStudentEvaluation,
      studentEvaluationSubmitted: Boolean(rawStudentEvaluation),
      canSubmit: context.placement_status === "COMPLETED" && !ownEvaluation,
    };
  }
}

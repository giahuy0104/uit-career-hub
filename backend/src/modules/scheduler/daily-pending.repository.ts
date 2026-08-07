import type { Pool, QueryResultRow } from "pg";

export type DailyPendingDatabase = Pick<Pool, "query">;

export type DailyPendingSummary = {
  summaryDate: string;
  uitPendingCount: number;
  companyPendingCount: number;
  companyCount: number;
  uitRecipientCount: number;
  companyRecipientCount: number;
  notificationsCreated: number;
};

type DailyPendingSummaryRow = QueryResultRow & {
  uit_pending_count: string;
  company_pending_count: string;
  company_count: string;
  uit_recipient_count: string;
  company_recipient_count: string;
  notifications_created: string;
};

export class DailyPendingRepository {
  constructor(private readonly database: DailyPendingDatabase) {}

  async createSummaryNotifications(summaryDate: string): Promise<DailyPendingSummary> {
    const result = await this.database.query<DailyPendingSummaryRow>(
      `WITH uit_stats AS (
         SELECT count(*)::integer AS pending_count
         FROM applications
         WHERE status = 'UIT_REVIEWING'
       ),
       uit_recipients AS (
         SELECT u.id AS user_id, s.pending_count
         FROM users u
         CROSS JOIN uit_stats s
         WHERE u.role = 'UIT_ADMIN'
           AND u.status = 'ACTIVE'
           AND s.pending_count > 0
       ),
       company_stats AS (
         SELECT j.company_id, count(*)::integer AS pending_count
         FROM applications a
         JOIN job_posts j ON j.id = a.job_post_id
         JOIN companies c ON c.id = j.company_id
         WHERE a.status IN ('FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED')
           AND c.partner_status = 'ACTIVE'
         GROUP BY j.company_id
       ),
       company_recipients AS (
         SELECT cu.user_id, cs.company_id, cs.pending_count
         FROM company_stats cs
         JOIN company_users cu ON cu.company_id = cs.company_id
         JOIN users u ON u.id = cu.user_id
         WHERE u.role = 'COMPANY'
           AND u.status = 'ACTIVE'
       ),
       inserted_uit AS (
         INSERT INTO notifications
           (recipient_user_id, type, title, body, resource_type, resource_id,
            deep_link, dedupe_key, payload)
         SELECT ur.user_id,
                'DAILY_UIT_PENDING_APPLICATIONS',
                'Tổng hợp hồ sơ UIT cần xử lý',
                format('Có %s hồ sơ ứng tuyển đang chờ UIT kiểm duyệt.', ur.pending_count),
                'APPLICATION_QUEUE',
                NULL,
                '/uit/applications',
                'daily-pending:uit:' || $1::date::text || ':' || ur.user_id::text,
                jsonb_build_object(
                  'summaryDate', $1::date::text,
                  'pendingCount', ur.pending_count,
                  'queue', 'UIT_REVIEW',
                  'statuses', jsonb_build_array('UIT_REVIEWING')
                )
         FROM uit_recipients ur
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING id
       ),
       inserted_company AS (
         INSERT INTO notifications
           (recipient_user_id, type, title, body, resource_type, resource_id,
            deep_link, dedupe_key, payload)
         SELECT cr.user_id,
                'DAILY_COMPANY_PENDING_APPLICATIONS',
                'Tổng hợp hồ sơ doanh nghiệp cần xử lý',
                format('Có %s hồ sơ cần doanh nghiệp tiếp tục xử lý.', cr.pending_count),
                'APPLICATION_QUEUE',
                NULL,
                '/company/candidates',
                'daily-pending:company:' || $1::date::text || ':' || cr.user_id::text,
                jsonb_build_object(
                  'summaryDate', $1::date::text,
                  'pendingCount', cr.pending_count,
                  'companyId', cr.company_id,
                  'queue', 'COMPANY_ACTION_REQUIRED',
                  'statuses', jsonb_build_array(
                    'FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED'
                  )
                )
         FROM company_recipients cr
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING id
       )
       SELECT
         (SELECT pending_count FROM uit_stats)::text AS uit_pending_count,
         COALESCE((SELECT sum(pending_count) FROM company_stats), 0)::text AS company_pending_count,
         (SELECT count(*) FROM company_stats)::text AS company_count,
         (SELECT count(*) FROM uit_recipients)::text AS uit_recipient_count,
         (SELECT count(*) FROM company_recipients)::text AS company_recipient_count,
         ((SELECT count(*) FROM inserted_uit) +
          (SELECT count(*) FROM inserted_company))::text AS notifications_created`,
      [summaryDate],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Daily pending summary query did not return a result.");
    }

    return {
      summaryDate,
      uitPendingCount: Number(row.uit_pending_count),
      companyPendingCount: Number(row.company_pending_count),
      companyCount: Number(row.company_count),
      uitRecipientCount: Number(row.uit_recipient_count),
      companyRecipientCount: Number(row.company_recipient_count),
      notificationsCreated: Number(row.notifications_created),
    };
  }
}

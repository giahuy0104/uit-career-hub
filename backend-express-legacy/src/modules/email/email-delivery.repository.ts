import type { Pool, QueryResultRow } from "pg";

import type { ClaimedEmailDelivery } from "./email.types.js";

export type EmailDeliveryDatabase = Pick<Pool, "query">;

type EmailDeliveryRow = QueryResultRow & {
  id: string;
  recipient_email: string;
  notification_type: string;
  title: string;
  body: string;
  deep_link: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
};

function toDelivery(row: EmailDeliveryRow): ClaimedEmailDelivery {
  return {
    id: row.id,
    recipientEmail: row.recipient_email,
    notificationType: row.notification_type,
    title: row.title,
    body: row.body,
    deepLink: row.deep_link,
    dedupeKey: row.dedupe_key,
    payload: row.payload ?? {},
  };
}

export class EmailDeliveryRepository {
  constructor(private readonly database: EmailDeliveryDatabase) {}

  async claimPending(input: { resourceId?: string; limit: number; maxAttempts: number }) {
    const result = await this.database.query<EmailDeliveryRow>(
      `WITH candidates AS (
         SELECT ed.id
         FROM email_deliveries ed
         JOIN notifications n ON n.id = ed.notification_id
         WHERE ed.attempt_count < $1
           AND (
             (ed.status IN ('PENDING', 'FAILED') AND ed.next_attempt_at <= now())
             OR (ed.status = 'PROCESSING' AND ed.locked_at < now() - interval '10 minutes')
           )
           AND ($2::uuid IS NULL OR n.resource_id = $2::uuid)
         ORDER BY ed.created_at, ed.id
         FOR UPDATE OF ed SKIP LOCKED
         LIMIT $3
       ),
       claimed AS (
         UPDATE email_deliveries ed
         SET status = 'PROCESSING',
             attempt_count = attempt_count + 1,
             locked_at = now(),
             updated_at = now()
         FROM candidates c
         WHERE ed.id = c.id
         RETURNING ed.id, ed.notification_id, ed.recipient_user_id
       )
       SELECT c.id,
              u.email AS recipient_email,
              n.type AS notification_type,
              n.title,
              n.body,
              n.deep_link,
              n.dedupe_key,
              n.payload
       FROM claimed c
       JOIN notifications n ON n.id = c.notification_id
       JOIN users u ON u.id = c.recipient_user_id
       ORDER BY n.created_at, c.id`,
      [input.maxAttempts, input.resourceId ?? null, input.limit],
    );

    return result.rows.map(toDelivery);
  }

  async markSent(deliveryId: string, providerMessageId: string) {
    await this.database.query(
      `UPDATE email_deliveries
       SET status = 'SENT', provider_message_id = $2, sent_at = now(),
           locked_at = NULL, last_error = NULL, updated_at = now()
       WHERE id = $1 AND status = 'PROCESSING'`,
      [deliveryId, providerMessageId],
    );
  }

  async markFailed(deliveryId: string, errorMessage: string) {
    await this.database.query(
      `UPDATE email_deliveries
       SET status = 'FAILED',
           next_attempt_at = now() +
             LEAST(3600 * power(2, GREATEST(attempt_count - 1, 0)), 86400) * interval '1 second',
           locked_at = NULL,
           last_error = left($2, 1000),
           updated_at = now()
       WHERE id = $1 AND status = 'PROCESSING'`,
      [deliveryId, errorMessage],
    );
  }
}

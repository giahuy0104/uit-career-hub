import type { Pool, QueryResultRow } from "pg";

import type { NotificationDto, NotificationListQuery } from "./notification.types.js";

export type NotificationDatabase = Pick<Pool, "query">;

type NotificationRow = QueryResultRow & {
  id: string;
  type: string;
  title: string;
  body: string;
  resource_type: string;
  resource_id: string | null;
  deep_link: string;
  payload: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
};

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    deepLink: row.deep_link,
    payload: row.payload ?? {},
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

const notificationSelect = `
  SELECT id, type, title, body, resource_type, resource_id, deep_link,
         payload, read_at, created_at
  FROM notifications
`;

export class NotificationRepository {
  constructor(private readonly database: NotificationDatabase) {}

  async list(recipientUserId: string, query: NotificationListQuery) {
    const unreadClause = query.unreadOnly ? "AND read_at IS NULL" : "";
    const offset = (query.page - 1) * query.pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.database.query<NotificationRow>(
        `${notificationSelect}
         WHERE recipient_user_id = $1 ${unreadClause}
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [recipientUserId, query.pageSize, offset],
      ),
      this.database.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM notifications
         WHERE recipient_user_id = $1 ${unreadClause}`,
        [recipientUserId],
      ),
    ]);

    return {
      items: itemsResult.rows.map(toDto),
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  }

  async unreadCount(recipientUserId: string) {
    const result = await this.database.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM notifications
       WHERE recipient_user_id = $1 AND read_at IS NULL`,
      [recipientUserId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async markRead(recipientUserId: string, notificationId: string) {
    const result = await this.database.query<{ id: string }>(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND recipient_user_id = $2
       RETURNING id`,
      [notificationId, recipientUserId],
    );
    return Boolean(result.rowCount);
  }

  async markAllRead(recipientUserId: string) {
    await this.database.query(
      `UPDATE notifications
       SET read_at = now()
       WHERE recipient_user_id = $1 AND read_at IS NULL`,
      [recipientUserId],
    );
  }
}

import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import { createDatabasePool } from "../../db/pool.js";
import type { AuthUser } from "../auth/auth.types.js";
import { TokenService } from "../auth/token.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("notification inbox", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-notification-test",
  });
  const tokenService = new TokenService();
  const app = createApp({ database, notificationDatabase: database, tokenService });
  const userIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    if (!userIds.length) return;
    await client.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    userIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function createUser() {
    const id = randomUUID();
    const user: AuthUser = {
      id,
      email: `notification-${randomUUID()}@uit.test`,
      role: "UIT_ADMIN",
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: "Notification test",
      organization: "UIT",
      studentProfileId: null,
      companyId: null,
    };
    userIds.push(id);
    await client.query(
      "INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'UIT_ADMIN', 'ACTIVE')",
      [id, user.email],
    );
    const signed = await tokenService.signAccessToken(user);
    return { id, token: signed.accessToken };
  }

  async function createNotification(userId: string, title: string, read = false) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO notifications
         (recipient_user_id, type, title, body, resource_type, deep_link, dedupe_key, payload, read_at)
       VALUES ($1, 'TEST_EVENT', $2, 'Nội dung kiểm thử', 'APPLICATION', '/uit/applications/test',
               $3, '{"source":"integration"}'::jsonb, CASE WHEN $4 THEN now() ELSE NULL END)
       RETURNING id`,
      [userId, title, randomUUID(), read],
    );
    return result.rows[0]!.id;
  }

  it("lists only the current user's notifications and supports the unread filter", async () => {
    const owner = await createUser();
    const anotherUser = await createUser();
    await createNotification(owner.id, "Đã đọc", true);
    await createNotification(owner.id, "Chưa đọc");
    await createNotification(anotherUser.id, "Không được nhìn thấy");

    const all = await request(app)
      .get("/api/v1/notifications?page=1&pageSize=20")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(all.status).toBe(200);
    expect(all.body.meta).toMatchObject({ totalItems: 2, totalPages: 1 });
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data[0]).toMatchObject({ payload: { source: "integration" } });

    const unread = await request(app)
      .get("/api/v1/notifications?unreadOnly=true")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(unread.status).toBe(200);
    expect(unread.body.meta.totalItems).toBe(1);
    expect(unread.body.data[0]).toMatchObject({ title: "Chưa đọc", readAt: null });

    const count = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(count.status).toBe(200);
    expect(count.body.data).toEqual({ count: 1 });
  });

  it("marks one or all notifications read without exposing another user's item", async () => {
    const owner = await createUser();
    const anotherUser = await createUser();
    const firstId = await createNotification(owner.id, "Thông báo một");
    await createNotification(owner.id, "Thông báo hai");
    const foreignId = await createNotification(anotherUser.id, "Thông báo riêng");

    const marked = await request(app)
      .post(`/api/v1/notifications/${firstId}/read`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(marked.status).toBe(204);

    const repeated = await request(app)
      .post(`/api/v1/notifications/${firstId}/read`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(repeated.status).toBe(204);

    const foreign = await request(app)
      .post(`/api/v1/notifications/${foreignId}/read`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(foreign.status).toBe(404);

    const readAll = await request(app)
      .post("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(readAll.status).toBe(204);

    const ownerCount = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM notifications WHERE recipient_user_id = $1 AND read_at IS NULL",
      [owner.id],
    );
    const foreignCount = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM notifications WHERE recipient_user_id = $1 AND read_at IS NULL",
      [anotherUser.id],
    );
    expect(ownerCount.rows[0]!.count).toBe("0");
    expect(foreignCount.rows[0]!.count).toBe("1");
  });
});

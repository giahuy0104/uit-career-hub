import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import {
  EmailDeliveryRepository,
  type EmailDeliveryDatabase,
} from "./email-delivery.repository.js";
import { EmailDeliveryService } from "./email-delivery.service.js";
import type { EmailProvider } from "./email.types.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("email delivery outbox", () => {
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-email-delivery-test",
  });

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("BEGIN");
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
  });

  afterAll(async () => {
    await client.end();
  });

  async function createPendingDelivery() {
    const userId = randomUUID();
    const resourceId = randomUUID();
    await client.query(
      "INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'UIT_ADMIN', 'ACTIVE')",
      [userId, `email-${userId}@uit.edu.vn`],
    );
    const notification = await client.query<{ id: string }>(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key)
       VALUES ($1, 'APPLICATION_SUBMITTED', 'Có hồ sơ mới', 'Có đơn mới cần xử lý',
               'APPLICATION', $2::uuid, '/uit/applications/' || $2::uuid::text, $3)
       RETURNING id`,
      [userId, resourceId, `email-integration:${randomUUID()}`],
    );
    return { notificationId: notification.rows[0]!.id, resourceId };
  }

  it("claims and marks a delivery sent once", async () => {
    const fixture = await createPendingDelivery();
    const send = vi.fn(async () => ({ messageId: "resend-message-1" }));
    const service = new EmailDeliveryService(
      new EmailDeliveryRepository(client as unknown as EmailDeliveryDatabase),
      { send } as EmailProvider,
      { appBaseUrl: "https://career.uit.example", batchSize: 25, maxAttempts: 5 },
    );

    await expect(service.dispatchPending(fixture.resourceId)).resolves.toEqual({
      enabled: true,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    await expect(service.dispatchPending(fixture.resourceId)).resolves.toEqual({
      enabled: true,
      claimed: 0,
      sent: 0,
      failed: 0,
    });

    const delivery = await client.query<{
      status: string;
      attempt_count: number;
      provider_message_id: string;
      sent_at: Date | null;
    }>(
      `SELECT status, attempt_count, provider_message_id, sent_at
       FROM email_deliveries WHERE notification_id = $1`,
      [fixture.notificationId],
    );
    expect(delivery.rows[0]).toMatchObject({
      status: "SENT",
      attempt_count: 1,
      provider_message_id: "resend-message-1",
    });
    expect(delivery.rows[0]?.sent_at).toBeInstanceOf(Date);
    expect(send).toHaveBeenCalledOnce();
  });

  it("records provider failures for a later retry without losing the notification", async () => {
    const fixture = await createPendingDelivery();
    const service = new EmailDeliveryService(
      new EmailDeliveryRepository(client as unknown as EmailDeliveryDatabase),
      { send: vi.fn(async () => { throw new Error("temporary provider failure"); }) } as EmailProvider,
      { appBaseUrl: "https://career.uit.example", batchSize: 25, maxAttempts: 5 },
    );

    await expect(service.dispatchPending(fixture.resourceId)).resolves.toEqual({
      enabled: true,
      claimed: 1,
      sent: 0,
      failed: 1,
    });

    const delivery = await client.query<{
      status: string;
      attempt_count: number;
      last_error: string;
      retry_scheduled: boolean;
    }>(
      `SELECT status, attempt_count, last_error, next_attempt_at > now() AS retry_scheduled
       FROM email_deliveries WHERE notification_id = $1`,
      [fixture.notificationId],
    );
    expect(delivery.rows[0]).toEqual({
      status: "FAILED",
      attempt_count: 1,
      last_error: "temporary provider failure",
      retry_scheduled: true,
    });
  });
});

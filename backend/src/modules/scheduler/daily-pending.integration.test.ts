import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import { createDatabasePool } from "../../db/pool.js";
import { DailyPendingRepository } from "./daily-pending.repository.js";
import { DailyPendingService } from "./daily-pending.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;
const testSummaryDate = "2099-12-30";
const testNow = new Date("2099-12-30T01:15:00.000Z");

describeWithDatabase("daily pending summaries", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-daily-pending-test",
  });
  const service = new DailyPendingService(new DailyPendingRepository(database));
  const userIds: string[] = [];
  const companyIds: string[] = [];
  const jobIds: string[] = [];
  const applicationIds: string[] = [];
  const studentProfileIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    await client.query(
      "DELETE FROM notifications WHERE dedupe_key LIKE $1",
      [`daily-pending:%:${testSummaryDate}:%`],
    );
    if (userIds.length) {
      await client.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])", [userIds]);
    }
    if (applicationIds.length) {
      await client.query("DELETE FROM applications WHERE id = ANY($1::uuid[])", [applicationIds]);
    }
    if (jobIds.length) {
      await client.query("DELETE FROM job_posts WHERE id = ANY($1::uuid[])", [jobIds]);
    }
    if (userIds.length) {
      await client.query("DELETE FROM company_users WHERE user_id = ANY($1::uuid[])", [userIds]);
    }
    if (studentProfileIds.length) {
      await client.query("DELETE FROM student_profiles WHERE id = ANY($1::uuid[])", [studentProfileIds]);
    }
    if (companyIds.length) {
      await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [companyIds]);
    }
    if (userIds.length) {
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
    userIds.length = 0;
    companyIds.length = 0;
    jobIds.length = 0;
    applicationIds.length = 0;
    studentProfileIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function createFixture() {
    const uitUserId = randomUUID();
    const inactiveUitUserId = randomUUID();
    const recruiterUserId = randomUUID();
    const inactiveRecruiterUserId = randomUUID();
    const studentUserId = randomUUID();
    userIds.push(uitUserId, inactiveUitUserId, recruiterUserId, inactiveRecruiterUserId, studentUserId);

    await client.query(
      `INSERT INTO users (id, email, role, status) VALUES
       ($1, $6, 'UIT_ADMIN', 'ACTIVE'),
       ($2, $7, 'UIT_ADMIN', 'SUSPENDED'),
       ($3, $8, 'COMPANY', 'ACTIVE'),
       ($4, $9, 'COMPANY', 'SUSPENDED'),
       ($5, $10, 'STUDENT', 'ACTIVE')`,
      [
        uitUserId,
        inactiveUitUserId,
        recruiterUserId,
        inactiveRecruiterUserId,
        studentUserId,
        `uit-${uitUserId}@scheduler.test`,
        `uit-${inactiveUitUserId}@scheduler.test`,
        `company-${recruiterUserId}@scheduler.test`,
        `company-${inactiveRecruiterUserId}@scheduler.test`,
        `student-${studentUserId}@scheduler.test`,
      ],
    );

    const companyId = randomUUID();
    companyIds.push(companyId);
    await client.query(
      `INSERT INTO companies (id, code, name, partner_status, created_by_user_id)
       VALUES ($1, $2, 'Scheduler Company', 'ACTIVE', $3)`,
      [companyId, `scheduler-${companyId}`, uitUserId],
    );
    await client.query(
      `INSERT INTO company_users (user_id, company_id, full_name, is_primary) VALUES
       ($1, $3, 'Active Recruiter', true),
       ($2, $3, 'Inactive Recruiter', false)`,
      [recruiterUserId, inactiveRecruiterUserId, companyId],
    );

    const studentProfileId = randomUUID();
    studentProfileIds.push(studentProfileId);
    await client.query(
      `INSERT INTO student_profiles
         (id, user_id, student_code, full_name, faculty, major, cohort)
       VALUES ($1, $2, $3, 'Scheduler Student', 'CNTT', 'KTPM', '2026')`,
      [studentProfileId, studentUserId, `SC-${studentProfileId}`],
    );

    const statuses = [
      "UIT_REVIEWING",
      "FORWARDED_TO_COMPANY",
      "COMPANY_REVIEWING",
      "INTERVIEW_INVITED",
    ] as const;
    for (const [index, status] of statuses.entries()) {
      const jobId = randomUUID();
      const applicationId = randomUUID();
      jobIds.push(jobId);
      applicationIds.push(applicationId);
      await client.query(
        `INSERT INTO job_posts
           (id, company_id, created_by_user_id, title, opportunity_type, work_mode,
            location, description, requirements, deadline, status)
         VALUES ($1, $2, $3, $4, 'INTERNSHIP', 'HYBRID', 'TP.HCM',
                 'Scheduler integration test', 'Test requirements', current_date + 30, 'RECRUITING')`,
        [jobId, companyId, recruiterUserId, `Scheduler Job ${index + 1}`],
      );
      await client.query(
        `INSERT INTO applications (id, student_profile_id, job_post_id, status, consented_at)
         VALUES ($1, $2, $3, $4, now())`,
        [applicationId, studentProfileId, jobId, status],
      );
    }

    return { uitUserId, recruiterUserId };
  }

  it("creates one per-recipient daily summary and deduplicates retries", async () => {
    const fixture = await createFixture();
    const first = await service.run(testNow);

    expect(first.summaryDate).toBe(testSummaryDate);
    expect(first.uitPendingCount).toBeGreaterThanOrEqual(1);
    expect(first.companyPendingCount).toBeGreaterThanOrEqual(3);
    expect(first.companyCount).toBeGreaterThanOrEqual(1);
    expect(first.uitRecipientCount).toBeGreaterThanOrEqual(1);
    expect(first.companyRecipientCount).toBeGreaterThanOrEqual(1);
    expect(first.notificationsCreated).toBeGreaterThanOrEqual(2);

    const notifications = await client.query<{
      recipient_user_id: string;
      type: string;
      deep_link: string;
      payload: { pendingCount: number; summaryDate: string };
    }>(
      `SELECT recipient_user_id, type, deep_link, payload
       FROM notifications
       WHERE recipient_user_id = ANY($1::uuid[])
       ORDER BY type`,
      [userIds],
    );
    expect(notifications.rows).toHaveLength(2);
    expect(notifications.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipient_user_id: fixture.uitUserId,
        type: "DAILY_UIT_PENDING_APPLICATIONS",
        deep_link: "/uit/applications",
        payload: expect.objectContaining({
          pendingCount: first.uitPendingCount,
          summaryDate: testSummaryDate,
        }),
      }),
      expect.objectContaining({
        recipient_user_id: fixture.recruiterUserId,
        type: "DAILY_COMPANY_PENDING_APPLICATIONS",
        deep_link: "/company/candidates",
        payload: expect.objectContaining({ pendingCount: 3, summaryDate: testSummaryDate }),
      }),
    ]));

    const retried = await service.run(new Date("2099-12-30T08:00:00.000Z"));
    expect(retried.notificationsCreated).toBe(0);
    const count = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM notifications WHERE recipient_user_id = ANY($1::uuid[])",
      [userIds],
    );
    expect(count.rows[0]?.count).toBe("2");
  });
});

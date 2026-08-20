import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { env } from "../config/env.js";
import { runMigrations } from "./migrate.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("database constraints", () => {
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-integration-test",
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

  async function createScenario() {
    const suffix = randomUUID();
    const adminId = randomUUID();
    const studentUserId = randomUUID();
    const companyUserId = randomUUID();
    const studentProfileId = randomUUID();
    const companyId = randomUUID();
    const firstJobId = randomUUID();
    const secondJobId = randomUUID();

    await client.query(
      `INSERT INTO users (id, email, role, status) VALUES
       ($1, $4, 'UIT_ADMIN', 'ACTIVE'),
       ($2, $5, 'STUDENT', 'ACTIVE'),
       ($3, $6, 'COMPANY', 'ACTIVE')`,
      [
        adminId,
        studentUserId,
        companyUserId,
        `admin-${suffix}@uit.edu.vn`,
        `student-${suffix}@student.uit.edu.vn`,
        `company-${suffix}@example.com`,
      ],
    );
    await client.query(
      `INSERT INTO student_profiles
       (id, user_id, student_code, full_name, faculty, major, cohort)
       VALUES ($1, $2, $3, 'Sinh viên test', 'CNTT', 'Kỹ thuật phần mềm', '2026')`,
      [studentProfileId, studentUserId, `SV-${suffix}`],
    );
    await client.query(
      `INSERT INTO companies (id, code, name, partner_status, created_by_user_id)
       VALUES ($1, $2, 'Công ty test', 'ACTIVE', $3)`,
      [companyId, `COMPANY-${suffix}`, adminId],
    );
    await client.query(
      `INSERT INTO company_users (user_id, company_id, full_name, is_primary)
       VALUES ($1, $2, 'Recruiter test', true)`,
      [companyUserId, companyId],
    );
    await client.query(
      `INSERT INTO job_posts
       (id, company_id, created_by_user_id, title, opportunity_type, work_mode,
        location, description, requirements, positions, deadline, status)
       VALUES
       ($1, $3, $4, 'Job test 1', 'INTERNSHIP', 'HYBRID', 'TP.HCM', 'Mô tả', 'Yêu cầu', 1, current_date + 30, 'RECRUITING'),
       ($2, $3, $4, 'Job test 2', 'INTERNSHIP', 'HYBRID', 'TP.HCM', 'Mô tả', 'Yêu cầu', 1, current_date + 30, 'RECRUITING')`,
      [firstJobId, secondJobId, companyId, companyUserId],
    );

    return { adminId, studentProfileId, studentUserId, firstJobId, secondJobId };
  }

  it("should_prevent_two_active_applications_for_same_student_and_job", async () => {
    const scenario = await createScenario();
    await client.query(
      `INSERT INTO applications
       (student_profile_id, job_post_id, status, consented_at)
       VALUES ($1, $2, 'UIT_REVIEWING', now())`,
      [scenario.studentProfileId, scenario.firstJobId],
    );

    await expect(
      client.query(
        `INSERT INTO applications
         (student_profile_id, job_post_id, status, consented_at)
         VALUES ($1, $2, 'COMPANY_REVIEWING', now())`,
        [scenario.studentProfileId, scenario.firstJobId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("should_prevent_two_accepted_or_hired_placements_for_one_student", async () => {
    const scenario = await createScenario();
    await client.query(
      `INSERT INTO applications
       (student_profile_id, job_post_id, status, consented_at, accepted_at)
       VALUES ($1, $2, 'ACCEPTED_PENDING_UIT_CONFIRMATION', now(), now())`,
      [scenario.studentProfileId, scenario.firstJobId],
    );

    await expect(
      client.query(
        `INSERT INTO applications
         (student_profile_id, job_post_id, status, consented_at, placement_confirmed_at)
         VALUES ($1, $2, 'HIRED', now(), now())`,
        [scenario.studentProfileId, scenario.secondJobId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("should_deduplicate_notifications", async () => {
    const scenario = await createScenario();
    const dedupeKey = `test:${randomUUID()}`;
    const values = [
      scenario.studentUserId,
      "APPLICATION_SUBMITTED",
      "Thông báo test",
      "Nội dung test",
      "APPLICATION",
      "/applications/test",
      dedupeKey,
    ];
    const sql = `INSERT INTO notifications
      (recipient_user_id, type, title, body, resource_type, deep_link, dedupe_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`;

    await client.query(sql, values);
    await expect(client.query(sql, values)).rejects.toMatchObject({ code: "23505" });
  });

  it("should_queue_email_only_for_selected_notification_types", async () => {
    const scenario = await createScenario();
    const selectedNotification = await client.query<{ id: string }>(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, deep_link, dedupe_key)
       VALUES ($1, 'APPLICATION_SUBMITTED', 'Có hồ sơ mới', 'Cần UIT xử lý',
               'APPLICATION', '/uit/applications', $2)
       RETURNING id`,
      [scenario.adminId, `email-selected:${randomUUID()}`],
    );
    await client.query(
      `INSERT INTO notifications
       (recipient_user_id, type, title, body, resource_type, deep_link, dedupe_key)
       VALUES ($1, 'JOB_APPROVED', 'Tin đã duyệt', 'Thông báo chỉ trong ứng dụng',
               'JOB_POST', '/company/jobs', $2)`,
      [scenario.adminId, `email-ignored:${randomUUID()}`],
    );

    const deliveries = await client.query<{ notification_id: string; status: string }>(
      `SELECT notification_id, status
       FROM email_deliveries
       WHERE recipient_user_id = $1`,
      [scenario.adminId],
    );

    expect(deliveries.rows).toEqual([{
      notification_id: selectedNotification.rows[0]!.id,
      status: "PENDING",
    }]);
  });
});

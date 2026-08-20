import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import { createDatabasePool } from "../../db/pool.js";
import type { AuthUser, UserRole } from "../auth/auth.types.js";
import { TokenService } from "../auth/token.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("job post review flow", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-job-flow-test",
  });
  const tokenService = new TokenService();
  const app = createApp({ database, authDatabase: database, jobDatabase: database, tokenService });
  const userIds: string[] = [];
  const companyIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    if (!userIds.length) return;
    await client.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])", [userIds]);
    if (companyIds.length) {
      await client.query(
        "DELETE FROM job_post_status_history WHERE job_post_id IN (SELECT id FROM job_posts WHERE company_id = ANY($1::uuid[]))",
        [companyIds],
      );
      await client.query("DELETE FROM job_posts WHERE company_id = ANY($1::uuid[])", [companyIds]);
      await client.query("DELETE FROM company_users WHERE company_id = ANY($1::uuid[])", [companyIds]);
      await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [companyIds]);
    }
    await client.query("DELETE FROM uit_staff WHERE user_id = ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    userIds.length = 0;
    companyIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function createUser(role: UserRole, companyId: string | null = null) {
    const id = randomUUID();
    const user: AuthUser = {
      id,
      email: `${role.toLowerCase()}-${randomUUID()}@example.test`,
      role,
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: `${role} test`,
      organization: null,
      studentProfileId: null,
      companyId,
    };
    userIds.push(id);
    await client.query(
      "INSERT INTO users (id, email, role, status) VALUES ($1, $2, $3, 'ACTIVE')",
      [id, user.email, role],
    );
    if (role === "UIT_ADMIN") {
      await client.query(
        "INSERT INTO uit_staff (user_id, full_name, department) VALUES ($1, 'Admin test', 'Phòng QHDN')",
        [id],
      );
    }
    if (role === "COMPANY" && companyId) {
      await client.query(
        "INSERT INTO company_users (user_id, company_id, full_name, is_primary) VALUES ($1, $2, 'Recruiter test', true)",
        [id, companyId],
      );
    }
    const signed = await tokenService.signAccessToken(user);
    return { ...user, token: signed.accessToken };
  }

  async function createScenario() {
    const admin = await createUser("UIT_ADMIN");
    const companyId = randomUUID();
    companyIds.push(companyId);
    await client.query(
      `INSERT INTO companies (id, code, name, industry, partner_status, created_by_user_id)
       VALUES ($1, $2, 'Công ty kiểm thử', 'Công nghệ', 'ACTIVE', $3)`,
      [companyId, `TEST-${randomUUID()}`, admin.id],
    );
    const recruiter = await createUser("COMPANY", companyId);
    return { admin, recruiter, companyId };
  }

  const draft = {
    title: "Thực tập sinh Backend Node.js",
    opportunityType: "INTERNSHIP",
    workMode: "HYBRID",
    location: "Thành phố Hồ Chí Minh",
    description: "Tham gia phát triển và kiểm thử các API cho nền tảng tuyển dụng nội bộ.",
    requirements: "Biết TypeScript, SQL và có tinh thần học hỏi trong quá trình thực tập.",
    benefits: "Được hướng dẫn bởi kỹ sư có kinh nghiệm.",
    positions: 2,
    deadline: "2099-12-31",
    categoryIds: [],
    skillIds: [],
  };

  it("runs create, submit, revision, resubmit and approve end to end", async () => {
    const { admin, recruiter } = await createScenario();

    const created = await request(app)
      .post("/api/v1/companies/me/jobs")
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send(draft);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: "DRAFT", version: 1 });
    const jobId = created.body.data.id as string;

    const firstSubmitCommand = randomUUID();
    const submitted = await request(app)
      .post(`/api/v1/companies/me/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", firstSubmitCommand);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data).toMatchObject({ status: "PENDING_UIT_REVIEW", version: 2 });

    const repeated = await request(app)
      .post(`/api/v1/companies/me/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", firstSubmitCommand);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.version).toBe(2);

    const revision = await request(app)
      .post(`/api/v1/uit/jobs/${jobId}/request-revision`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reasonCode: "CONTENT_INCOMPLETE", note: "Vui lòng mô tả rõ hơn công việc hằng ngày." });
    expect(revision.status).toBe(200);
    expect(revision.body.data).toMatchObject({
      status: "REVISION_REQUIRED",
      version: 3,
      latestReview: { reasonCode: "CONTENT_INCOMPLETE" },
    });

    const updated = await request(app)
      .patch(`/api/v1/companies/me/jobs/${jobId}`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send({ ...draft, description: `${draft.description} Công việc được giao theo sprint hai tuần.`, expectedVersion: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ status: "REVISION_REQUIRED", version: 4 });

    const resubmitted = await request(app)
      .post(`/api/v1/companies/me/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", randomUUID());
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data).toMatchObject({ status: "PENDING_UIT_REVIEW", version: 5 });

    const approved = await request(app)
      .post(`/api/v1/uit/jobs/${jobId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", randomUUID());
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: "RECRUITING", version: 6 });

    const history = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM job_post_status_history WHERE job_post_id = $1",
      [jobId],
    );
    expect(Number(history.rows[0]?.count)).toBe(5);
    const notifications = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM notifications WHERE resource_id = $1 AND recipient_user_id = ANY($2::uuid[])",
      [jobId, [admin.id, recruiter.id]],
    );
    expect(Number(notifications.rows[0]?.count)).toBe(4);
  });

  it("supports rejection and prevents a second review decision", async () => {
    const { admin, recruiter } = await createScenario();
    const created = await request(app)
      .post("/api/v1/companies/me/jobs")
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send(draft);
    const jobId = created.body.data.id as string;
    await request(app)
      .post(`/api/v1/companies/me/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", randomUUID());

    const rejected = await request(app)
      .post(`/api/v1/uit/jobs/${jobId}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reasonCode: "POLICY_VIOLATION", note: "Nội dung chưa phù hợp quy định của nhà trường." });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");

    const secondDecision = await request(app)
      .post(`/api/v1/uit/jobs/${jobId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", randomUUID());
    expect(secondDecision.status).toBe(409);
    expect(secondDecision.body.error.code).toBe("JOB_STATE_CONFLICT");
  });

  it("enforces ownership, roles, required reasons and optimistic locking", async () => {
    const { admin, recruiter } = await createScenario();
    const created = await request(app)
      .post("/api/v1/companies/me/jobs")
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send(draft);
    const jobId = created.body.data.id as string;

    const otherCompanyId = randomUUID();
    companyIds.push(otherCompanyId);
    await client.query(
      "INSERT INTO companies (id, code, name, partner_status, created_by_user_id) VALUES ($1, $2, 'Khác', 'ACTIVE', $3)",
      [otherCompanyId, `OTHER-${randomUUID()}`, admin.id],
    );
    const otherRecruiter = await createUser("COMPANY", otherCompanyId);
    const hidden = await request(app)
      .get(`/api/v1/companies/me/jobs/${jobId}`)
      .set("Authorization", `Bearer ${otherRecruiter.token}`);
    expect(hidden.status).toBe(404);

    const stale = await request(app)
      .patch(`/api/v1/companies/me/jobs/${jobId}`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send({ ...draft, expectedVersion: 99 });
    expect(stale.status).toBe(409);

    const forbidden = await request(app)
      .get("/api/v1/uit/jobs/review-queue")
      .set("Authorization", `Bearer ${recruiter.token}`);
    expect(forbidden.status).toBe(403);

    await request(app)
      .post(`/api/v1/companies/me/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", randomUUID());
    const missingReason = await request(app)
      .post(`/api/v1/uit/jobs/${jobId}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({});
    expect(missingReason.status).toBe(400);
    expect(missingReason.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows only one UIT decision when two reviewers act at the same time", async () => {
    const { admin, recruiter } = await createScenario();
    const secondAdmin = await createUser("UIT_ADMIN");
    const created = await request(app)
      .post("/api/v1/companies/me/jobs")
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send(draft);
    const jobId = created.body.data.id as string;
    await request(app)
      .post(`/api/v1/companies/me/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", randomUUID());

    const [approved, rejected] = await Promise.all([
      request(app)
        .post(`/api/v1/uit/jobs/${jobId}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .set("Idempotency-Key", randomUUID()),
      request(app)
        .post(`/api/v1/uit/jobs/${jobId}/reject`)
        .set("Authorization", `Bearer ${secondAdmin.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ reasonCode: "UIT_REJECTED", note: "Không phù hợp quy định kiểm thử." }),
    ]);

    expect([approved.status, rejected.status].sort()).toEqual([200, 409]);
    const finalState = await client.query<{ status: string }>(
      "SELECT status FROM job_posts WHERE id = $1",
      [jobId],
    );
    expect(["RECRUITING", "REJECTED"]).toContain(finalState.rows[0]?.status);
  });
});

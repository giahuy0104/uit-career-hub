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

describeWithDatabase("student job application flow", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-application-flow-test",
  });
  const tokenService = new TokenService();
  const app = createApp({
    database,
    authDatabase: database,
    jobDatabase: database,
    applicationDatabase: database,
    tokenService,
  });
  const userIds: string[] = [];
  const companyIds: string[] = [];
  const studentProfileIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    if (!userIds.length) return;
    await client.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])", [userIds]);
    await client.query(
      `DELETE FROM audit_logs
       WHERE actor_user_id = ANY($1::uuid[])
          OR target_id IN (SELECT id FROM applications WHERE student_profile_id = ANY($2::uuid[]))`,
      [userIds, studentProfileIds],
    );
    await client.query(
      "DELETE FROM application_documents WHERE application_id IN (SELECT id FROM applications WHERE student_profile_id = ANY($1::uuid[]))",
      [studentProfileIds],
    );
    await client.query(
      "DELETE FROM application_status_history WHERE application_id IN (SELECT id FROM applications WHERE student_profile_id = ANY($1::uuid[]))",
      [studentProfileIds],
    );
    await client.query("DELETE FROM applications WHERE student_profile_id = ANY($1::uuid[])", [studentProfileIds]);
    await client.query("DELETE FROM student_documents WHERE student_profile_id = ANY($1::uuid[])", [studentProfileIds]);
    await client.query("DELETE FROM student_profiles WHERE id = ANY($1::uuid[])", [studentProfileIds]);
    if (companyIds.length) {
      await client.query(
        "DELETE FROM job_post_status_history WHERE job_post_id IN (SELECT id FROM job_posts WHERE company_id = ANY($1::uuid[]))",
        [companyIds],
      );
      await client.query("DELETE FROM job_posts WHERE company_id = ANY($1::uuid[])", [companyIds]);
      await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [companyIds]);
    }
    await client.query("DELETE FROM uit_staff WHERE user_id = ANY($1::uuid[])", [userIds]);
    await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    userIds.length = 0;
    companyIds.length = 0;
    studentProfileIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function createUser(role: UserRole, studentProfileId: string | null = null) {
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
      studentProfileId,
      companyId: null,
    };
    userIds.push(id);
    await client.query("INSERT INTO users (id, email, role, status) VALUES ($1, $2, $3, 'ACTIVE')", [
      id,
      user.email,
      role,
    ]);
    if (role === "UIT_ADMIN") {
      await client.query(
        "INSERT INTO uit_staff (user_id, full_name, department) VALUES ($1, 'Admin test', 'Phòng QHDN')",
        [id],
      );
    }
    const signed = await tokenService.signAccessToken(user);
    return { ...user, token: signed.accessToken };
  }

  async function createStudent() {
    const userId = randomUUID();
    const profileId = randomUUID();
    const email = `student-${randomUUID()}@student.uit.edu.vn`;
    userIds.push(userId);
    studentProfileIds.push(profileId);
    await client.query("INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'STUDENT', 'ACTIVE')", [
      userId,
      email,
    ]);
    await client.query(
      `INSERT INTO student_profiles
       (id, user_id, student_code, full_name, faculty, major, cohort, gpa, academic_status)
       VALUES ($1, $2, $3, 'Sinh viên kiểm thử', 'Khoa Công nghệ Phần mềm',
               'Kỹ thuật Phần mềm', '2022', 3.25, 'ACTIVE')`,
      [profileId, userId, `TEST-${randomUUID()}`],
    );
    const cvId = randomUUID();
    const transcriptId = randomUUID();
    const pendingDocumentId = randomUUID();
    await client.query(
      `INSERT INTO student_documents
       (id, student_profile_id, document_type, file_name, mime_type, file_size_bytes,
        storage_key, version, is_default, verification_status)
       VALUES
       ($1, $4, 'CV', 'cv.pdf', 'application/pdf', 1024, $5, 1, true, 'VERIFIED'),
       ($2, $4, 'TRANSCRIPT', 'bang-diem.pdf', 'application/pdf', 2048, $6, 1, false, 'VERIFIED'),
       ($3, $4, 'OTHER', 'chua-xac-minh.pdf', 'application/pdf', 512, $7, 1, false, 'PENDING')`,
      [cvId, transcriptId, pendingDocumentId, profileId, `test/${cvId}`, `test/${transcriptId}`, `test/${pendingDocumentId}`],
    );
    const authUser: AuthUser = {
      id: userId,
      email,
      role: "STUDENT",
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: "Sinh viên kiểm thử",
      organization: null,
      studentProfileId: profileId,
      companyId: null,
    };
    const signed = await tokenService.signAccessToken(authUser);
    return { ...authUser, token: signed.accessToken, cvId, transcriptId, pendingDocumentId };
  }

  async function createScenario() {
    const admin = await createUser("UIT_ADMIN");
    const companyId = randomUUID();
    companyIds.push(companyId);
    await client.query(
      `INSERT INTO companies (id, code, name, industry, partner_status, created_by_user_id)
       VALUES ($1, $2, 'Công ty kiểm thử hồ sơ', 'Công nghệ', 'ACTIVE', $3)`,
      [companyId, `TEST-${randomUUID()}`, admin.id],
    );
    const jobId = randomUUID();
    const unavailableJobId = randomUUID();
    await client.query(
      `INSERT INTO job_posts
       (id, company_id, created_by_user_id, reviewed_by_user_id, title, opportunity_type,
        work_mode, location, description, requirements, positions, deadline, status, reviewed_at)
       VALUES
       ($1, $3, $4, $4, 'Thực tập sinh kiểm thử tự động', 'INTERNSHIP', 'HYBRID',
        'TP. Hồ Chí Minh', 'Tham gia kiểm thử ứng dụng web và API trong dự án.',
        'Biết kiểm thử phần mềm và có tinh thần học hỏi.', 2, '2099-12-31', 'RECRUITING', now()),
       ($2, $3, $4, NULL, 'Tin chưa được duyệt', 'INTERNSHIP', 'ONSITE',
        'TP. Hồ Chí Minh', 'Nội dung tin chưa được duyệt để kiểm thử khả năng ẩn tin.',
        'Yêu cầu tối thiểu cho dữ liệu kiểm thử.', 1, '2099-12-31', 'DRAFT', NULL)`,
      [jobId, unavailableJobId, companyId, admin.id],
    );
    const student = await createStudent();
    return { admin, companyId, jobId, unavailableJobId, student };
  }

  function submit(token: string, jobId: string, documentIds: string[], commandId = randomUUID()) {
    return request(app)
      .post("/api/v1/applications")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send({
        jobId,
        documents: documentIds.map((documentId) => ({ documentId })),
        consentToShare: true,
      });
  }

  it("lists only active recruiting jobs and returns their details", async () => {
    const { jobId, unavailableJobId, student } = await createScenario();

    const list = await request(app)
      .get("/api/v1/jobs?query=kiểm%20thử&pageSize=100")
      .set("Authorization", `Bearer ${student.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((job: { id: string }) => job.id)).toContain(jobId);
    expect(list.body.data.map((job: { id: string }) => job.id)).not.toContain(unavailableJobId);

    const detail = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set("Authorization", `Bearer ${student.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: jobId, status: "RECRUITING" });

    const hidden = await request(app)
      .get(`/api/v1/jobs/${unavailableJobId}`)
      .set("Authorization", `Bearer ${student.token}`);
    expect(hidden.status).toBe(404);
  });

  it("submits a two-step application idempotently and notifies UIT", async () => {
    const { admin, jobId, student } = await createScenario();
    const commandId = randomUUID();

    const profile = await request(app)
      .get("/api/v1/students/me")
      .set("Authorization", `Bearer ${student.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data).toMatchObject({ studentCode: expect.any(String), academicStatus: "ACTIVE" });

    const created = await submit(student.token, jobId, [student.cvId, student.transcriptId], commandId);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: "UIT_REVIEWING", version: 1 });
    expect(created.body.data.documents).toHaveLength(2);
    expect(created.body.data.timeline).toHaveLength(1);

    const repeated = await submit(student.token, jobId, [student.cvId, student.transcriptId], commandId);
    expect(repeated.status).toBe(201);
    expect(repeated.body.data.id).toBe(created.body.data.id);

    const duplicate = await submit(student.token, jobId, [student.cvId], randomUUID());
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("APPLICATION_ALREADY_ACTIVE");

    const notification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2 AND type = 'APPLICATION_SUBMITTED'`,
      [admin.id, created.body.data.id],
    );
    expect(Number(notification.rows[0]?.count)).toBe(1);
  });

  it("rejects unverified or foreign documents and enforces student ownership", async () => {
    const { admin, jobId, student } = await createScenario();
    const otherStudent = await createStudent();

    const pending = await submit(student.token, jobId, [student.cvId, student.pendingDocumentId]);
    expect(pending.status).toBe(400);
    expect(pending.body.error.code).toBe("APPLICATION_DOCUMENT_NOT_VERIFIED");

    const foreign = await submit(otherStudent.token, jobId, [student.cvId]);
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe("APPLICATION_DOCUMENT_INVALID");

    const companyOrAdminCannotApply = await submit(admin.token, jobId, [student.cvId]);
    expect(companyOrAdminCannotApply.status).toBe(403);

    const created = await submit(student.token, jobId, [student.cvId]);
    const hidden = await request(app)
      .get(`/api/v1/applications/${created.body.data.id}`)
      .set("Authorization", `Bearer ${otherStudent.token}`);
    expect(hidden.status).toBe(404);
  });

  it("creates only one active application when two submissions race", async () => {
    const { jobId, student } = await createScenario();
    const [first, second] = await Promise.all([
      submit(student.token, jobId, [student.cvId], randomUUID()),
      submit(student.token, jobId, [student.cvId], randomUUID()),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const applications = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM applications WHERE student_profile_id = $1 AND job_post_id = $2",
      [student.studentProfileId, jobId],
    );
    expect(Number(applications.rows[0]?.count)).toBe(1);
  });
});

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
      "DELETE FROM recruitment_results WHERE application_id IN (SELECT id FROM applications WHERE student_profile_id = ANY($1::uuid[]))",
      [studentProfileIds],
    );
    await client.query(
      "DELETE FROM interviews WHERE application_id IN (SELECT id FROM applications WHERE student_profile_id = ANY($1::uuid[]))",
      [studentProfileIds],
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
      await client.query("DELETE FROM company_users WHERE company_id = ANY($1::uuid[])", [companyIds]);
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

  async function createUser(
    role: UserRole,
    studentProfileId: string | null = null,
    companyId: string | null = null,
    isPrimaryCompanyUser = true,
  ) {
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
      companyId,
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
    if (role === "COMPANY" && companyId) {
      await client.query(
        "INSERT INTO company_users (user_id, company_id, full_name, is_primary) VALUES ($1, $2, 'Recruiter test', $3)",
        [id, companyId, isPrimaryCompanyUser],
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
    const recruiter = await createUser("COMPANY", null, companyId);
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
    return { admin, recruiter, companyId, jobId, unavailableJobId, student };
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

  function forward(token: string, applicationId: string, commandId = randomUUID()) {
    return request(app)
      .post(`/api/v1/uit/applications/${applicationId}/forward`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId);
  }

  function startCompanyReview(token: string, applicationId: string, commandId = randomUUID()) {
    return request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/start-review`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId);
  }

  function scheduleInterview(token: string, applicationId: string, commandId = randomUUID()) {
    return request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/interviews`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send({
        scheduledAt: "2099-12-20T09:30:00+07:00",
        timeZone: "Asia/Ho_Chi_Minh",
        mode: "ONLINE",
        meetingUrl: "https://meet.example/interview-result-test",
        interviewerName: "Trần Minh Anh",
      });
  }

  function recordResult(
    token: string,
    applicationId: string,
    body: Record<string, unknown>,
    commandId = randomUUID(),
  ) {
    return request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/results`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
  }

  async function prepareInterview() {
    const scenario = await createScenario();
    const created = await submit(scenario.student.token, scenario.jobId, [scenario.student.cvId]);
    const applicationId = created.body.data.id as string;
    await forward(scenario.admin.token, applicationId);
    await startCompanyReview(scenario.recruiter.token, applicationId);
    const interview = await scheduleInterview(scenario.recruiter.token, applicationId);
    expect(interview.status).toBe(201);
    return { ...scenario, applicationId };
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

  it("lists UIT_REVIEWING applications for UIT admins only", async () => {
    const { admin, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId, student.transcriptId]);

    const queue = await request(app)
      .get("/api/v1/uit/applications/review-queue?page=1&pageSize=100")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: created.body.data.id,
        status: "UIT_REVIEWING",
        student: expect.objectContaining({ fullName: "Sinh viên kiểm thử", academicStatus: "ACTIVE" }),
      }),
    ]));

    const forbidden = await request(app)
      .get("/api/v1/uit/applications/review-queue")
      .set("Authorization", `Bearer ${student.token}`);
    expect(forbidden.status).toBe(403);
  });

  it("requests a supplement idempotently with reason, requirements and student notification", async () => {
    const { admin, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;
    const commandId = randomUUID();
    const body = {
      reasonCode: "MISSING_TRANSCRIPT",
      note: "Vui lòng bổ sung bảng điểm đã được xác nhận bởi nhà trường.",
      requiredDocumentTypes: ["TRANSCRIPT"],
      dueAt: "2099-12-20T17:00:00+07:00",
    };

    const supplement = await request(app)
      .post(`/api/v1/uit/applications/${applicationId}/request-supplement`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
    expect(supplement.status).toBe(200);
    expect(supplement.body.data).toMatchObject({ status: "NEEDS_SUPPLEMENT", version: 2 });
    expect(supplement.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "UIT_REVIEWING",
      toStatus: "NEEDS_SUPPLEMENT",
      reasonCode: "MISSING_TRANSCRIPT",
      metadata: { requiredDocumentTypes: ["TRANSCRIPT"], dueAt: body.dueAt },
    });

    const repeated = await request(app)
      .post(`/api/v1/uit/applications/${applicationId}/request-supplement`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.version).toBe(2);

    const notification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2
         AND type = 'APPLICATION_SUPPLEMENT_REQUESTED'`,
      [student.id, applicationId],
    );
    expect(Number(notification.rows[0]?.count)).toBe(1);
  });

  it("forwards the application to the correct company and blocks a second decision", async () => {
    const { admin, recruiter, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId, student.transcriptId]);
    const applicationId = created.body.data.id as string;
    const commandId = randomUUID();

    const forwarded = await request(app)
      .post(`/api/v1/uit/applications/${applicationId}/forward`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", commandId);
    expect(forwarded.status).toBe(200);
    expect(forwarded.body.data).toMatchObject({ status: "FORWARDED_TO_COMPANY", version: 2 });

    const companyNotification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2 AND type = 'APPLICATION_RECEIVED'`,
      [recruiter.id, applicationId],
    );
    expect(Number(companyNotification.rows[0]?.count)).toBe(1);

    const secondDecision = await request(app)
      .post(`/api/v1/uit/applications/${applicationId}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reasonCode: "UIT_REJECTED", note: "Hồ sơ không còn ở trạng thái UIT xử lý." });
    expect(secondDecision.status).toBe(409);
    expect(secondDecision.body.error.code).toBe("APPLICATION_STATE_CONFLICT");
  });

  it("allows only one UIT decision when two admins review concurrently", async () => {
    const { admin, jobId, student } = await createScenario();
    const secondAdmin = await createUser("UIT_ADMIN");
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;

    const [forwarded, rejected] = await Promise.all([
      request(app)
        .post(`/api/v1/uit/applications/${applicationId}/forward`)
        .set("Authorization", `Bearer ${admin.token}`)
        .set("Idempotency-Key", randomUUID()),
      request(app)
        .post(`/api/v1/uit/applications/${applicationId}/reject`)
        .set("Authorization", `Bearer ${secondAdmin.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ reasonCode: "UIT_REJECTED", note: "Hồ sơ chưa đáp ứng quy định kiểm thử." }),
    ]);

    expect([forwarded.status, rejected.status].sort()).toEqual([200, 409]);
    const finalState = await client.query<{ status: string }>("SELECT status FROM applications WHERE id = $1", [applicationId]);
    expect(["FORWARDED_TO_COMPANY", "UIT_REJECTED"]).toContain(finalState.rows[0]?.status);
  });

  it("lists only applications forwarded to the authenticated company", async () => {
    const first = await createScenario();
    const second = await createScenario();
    const firstApplication = await submit(first.student.token, first.jobId, [first.student.cvId]);
    const secondApplication = await submit(second.student.token, second.jobId, [second.student.cvId]);
    await forward(first.admin.token, firstApplication.body.data.id);
    await forward(second.admin.token, secondApplication.body.data.id);

    const list = await request(app)
      .get("/api/v1/companies/me/candidates?page=1&pageSize=100")
      .set("Authorization", `Bearer ${first.recruiter.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((item: { id: string }) => item.id)).toContain(firstApplication.body.data.id);
    expect(list.body.data.map((item: { id: string }) => item.id)).not.toContain(secondApplication.body.data.id);

    const forbidden = await request(app)
      .get("/api/v1/companies/me/candidates")
      .set("Authorization", `Bearer ${first.student.token}`);
    expect(forbidden.status).toBe(403);
  });

  it("starts company review idempotently and hides applications owned by another company", async () => {
    const scenario = await createScenario();
    const otherCompany = await createScenario();
    const created = await submit(scenario.student.token, scenario.jobId, [scenario.student.cvId]);
    const applicationId = created.body.data.id as string;
    await forward(scenario.admin.token, applicationId);

    const hidden = await startCompanyReview(otherCompany.recruiter.token, applicationId);
    expect(hidden.status).toBe(404);

    const commandId = randomUUID();
    const started = await startCompanyReview(scenario.recruiter.token, applicationId, commandId);
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ status: "COMPANY_REVIEWING", version: 3 });
    const repeated = await startCompanyReview(scenario.recruiter.token, applicationId, commandId);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.version).toBe(3);

    const notification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2
         AND type = 'APPLICATION_COMPANY_REVIEWING'`,
      [scenario.student.id, applicationId],
    );
    expect(Number(notification.rows[0]?.count)).toBe(1);
  });

  it("requires screening before marking a candidate not suitable and records the reason", async () => {
    const { admin, recruiter, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;
    await forward(admin.token, applicationId);

    const premature = await request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/reject`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reasonCode: "COMPANY_NOT_SUITABLE", note: "Kinh nghiá»‡m chÆ°a phÃ¹ há»£p vá»›i vá»‹ trÃ­ Ä‘ang tuyá»ƒn." });
    expect(premature.status).toBe(409);

    await startCompanyReview(recruiter.token, applicationId);
    const commandId = randomUUID();
    const rejected = await request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/reject`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", commandId)
      .send({ reasonCode: "COMPANY_NOT_SUITABLE", note: "Kinh nghiá»‡m chÆ°a phÃ¹ há»£p vá»›i vá»‹ trÃ­ Ä‘ang tuyá»ƒn." });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data).toMatchObject({ status: "NOT_SUITABLE", version: 4 });
    expect(rejected.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "COMPANY_REVIEWING",
      toStatus: "NOT_SUITABLE",
      reasonCode: "COMPANY_NOT_SUITABLE",
    });

    const repeated = await request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/reject`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", commandId)
      .send({ reasonCode: "COMPANY_NOT_SUITABLE", note: "Kinh nghiá»‡m chÆ°a phÃ¹ há»£p vá»›i vá»‹ trÃ­ Ä‘ang tuyá»ƒn." });
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.version).toBe(4);

    const notifications = await client.query<{ type: string; role: string }>(
      `SELECT n.type, u.role FROM notifications n JOIN users u ON u.id = n.recipient_user_id
       WHERE n.resource_id = $1
       AND type IN ('APPLICATION_NOT_SUITABLE', 'APPLICATION_NOT_SUITABLE_RECORDED')`,
      [applicationId],
    );
    expect(notifications.rows.filter((item) => item.type === "APPLICATION_NOT_SUITABLE" && item.role === "STUDENT")).toHaveLength(1);
    expect(notifications.rows.some((item) => item.type === "APPLICATION_NOT_SUITABLE_RECORDED" && item.role === "UIT_ADMIN")).toBe(true);
  });

  it("schedules an interview idempotently and notifies the student", async () => {
    const { admin, recruiter, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId, student.transcriptId]);
    const applicationId = created.body.data.id as string;
    await forward(admin.token, applicationId);
    await startCompanyReview(recruiter.token, applicationId);

    const invalid = await request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/interviews`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        scheduledAt: "2099-12-20T09:30:00+07:00",
        timeZone: "Asia/Ho_Chi_Minh",
        mode: "ONLINE",
        interviewerName: "Tráº§n Minh Anh",
      });
    expect(invalid.status).toBe(400);

    const commandId = randomUUID();
    const body = {
      scheduledAt: "2099-12-20T09:30:00+07:00",
      timeZone: "Asia/Ho_Chi_Minh",
      mode: "ONLINE",
      meetingUrl: "https://meet.example/interview-test",
      interviewerName: "Tráº§n Minh Anh",
    };
    const scheduled = await request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/interviews`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
    expect(scheduled.status).toBe(201);
    expect(scheduled.body.data).toMatchObject({
      applicationId,
      mode: "ONLINE",
      meetingUrl: body.meetingUrl,
      status: "PENDING_STUDENT_CONFIRMATION",
    });

    const repeated = await request(app)
      .post(`/api/v1/companies/me/applications/${applicationId}/interviews`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
    expect(repeated.status).toBe(201);
    expect(repeated.body.data.id).toBe(scheduled.body.data.id);

    const state = await client.query<{ status: string }>("SELECT status FROM applications WHERE id = $1", [applicationId]);
    expect(state.rows[0]?.status).toBe("INTERVIEW_INVITED");
    const notification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2 AND type = 'INTERVIEW_INVITED'`,
      [student.id, applicationId],
    );
    expect(Number(notification.rows[0]?.count)).toBe(1);
  });

  it("allows only one company decision while an application is being screened", async () => {
    const { admin, recruiter, jobId, student } = await createScenario();
    const secondRecruiter = await createUser("COMPANY", null, recruiter.companyId, false);
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;
    await forward(admin.token, applicationId);
    await startCompanyReview(recruiter.token, applicationId);

    const [rejected, interviewed] = await Promise.all([
      request(app)
        .post(`/api/v1/companies/me/applications/${applicationId}/reject`)
        .set("Authorization", `Bearer ${recruiter.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ reasonCode: "COMPANY_NOT_SUITABLE", note: "KhÃ´ng phÃ¹ há»£p vá»›i yÃªu cáº§u hiá»‡n táº¡i cá»§a doanh nghiá»‡p." }),
      request(app)
        .post(`/api/v1/companies/me/applications/${applicationId}/interviews`)
        .set("Authorization", `Bearer ${secondRecruiter.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({
          scheduledAt: "2099-12-21T09:30:00+07:00",
          timeZone: "Asia/Ho_Chi_Minh",
          mode: "PHONE",
          interviewerName: "LÃª Minh Anh",
        }),
    ]);

    expect([rejected.status, interviewed.status].filter((status) => [200, 201].includes(status))).toHaveLength(1);
    expect([rejected.status, interviewed.status]).toContain(409);
    const finalState = await client.query<{ status: string }>("SELECT status FROM applications WHERE id = $1", [applicationId]);
    expect(["NOT_SUITABLE", "INTERVIEW_INVITED"]).toContain(finalState.rows[0]?.status);
  });

  it("records a PASS result idempotently, creates an offer and notifies student and UIT", async () => {
    const scenario = await prepareInterview();
    const commandId = randomUUID();
    const body = {
      outcome: "PASS",
      startDate: "2099-12-28",
      offerStorageKey: "offers/offer-result-test.pdf",
      internalNote: "Mức phụ cấp theo chính sách thực tập sinh.",
    };

    const passed = await recordResult(scenario.recruiter.token, scenario.applicationId, body, commandId);
    expect(passed.status).toBe(200);
    expect(passed.body.data).toMatchObject({
      status: "OFFER_PENDING_STUDENT",
      version: 5,
      recruitmentResult: {
        outcome: "PASS",
        studentDecision: null,
        startDate: body.startDate,
        offerStorageKey: body.offerStorageKey,
      },
    });
    expect(passed.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "INTERVIEW_INVITED",
      toStatus: "OFFER_PENDING_STUDENT",
      metadata: { outcome: "PASS", startDate: body.startDate, hasOfferDocument: true },
    });

    const repeated = await recordResult(scenario.recruiter.token, scenario.applicationId, body, commandId);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.version).toBe(5);

    const interview = await client.query<{ status: string }>(
      "SELECT status FROM interviews WHERE application_id = $1",
      [scenario.applicationId],
    );
    expect(interview.rows[0]?.status).toBe("COMPLETED");
    const notifications = await client.query<{ type: string; role: string }>(
      `SELECT n.type, u.role FROM notifications n JOIN users u ON u.id = n.recipient_user_id
       WHERE n.resource_id = $1 AND n.type IN ('OFFER_AVAILABLE', 'INTERVIEW_RESULT_RECORDED')`,
      [scenario.applicationId],
    );
    expect(notifications.rows).toEqual(expect.arrayContaining([
      { type: "OFFER_AVAILABLE", role: "STUDENT" },
      { type: "INTERVIEW_RESULT_RECORDED", role: "UIT_ADMIN" },
    ]));
  });

  it("records a FAIL result with a required reason and closes the interview step", async () => {
    const scenario = await prepareInterview();
    const failed = await recordResult(scenario.recruiter.token, scenario.applicationId, {
      outcome: "FAIL",
      reasonCode: "INTERVIEW_SKILL_GAP",
      note: "Kỹ năng thực hành hiện chưa đáp ứng yêu cầu của vị trí.",
    });

    expect(failed.status).toBe(200);
    expect(failed.body.data).toMatchObject({
      status: "INTERVIEW_FAILED",
      version: 5,
      recruitmentResult: { outcome: "FAIL", studentDecision: null, offeredAt: null },
    });
    expect(failed.body.data.timeline.at(-1)).toMatchObject({
      toStatus: "INTERVIEW_FAILED",
      reasonCode: "INTERVIEW_SKILL_GAP",
    });

    const invalidSecondResult = await recordResult(scenario.recruiter.token, scenario.applicationId, {
      outcome: "PASS",
      startDate: "2099-12-28",
    });
    expect(invalidSecondResult.status).toBe(409);
    expect(invalidSecondResult.body.error.code).toBe("APPLICATION_STATE_CONFLICT");
  });

  it("lets the owning student accept an offer idempotently and requests UIT confirmation", async () => {
    const scenario = await prepareInterview();
    await recordResult(scenario.recruiter.token, scenario.applicationId, {
      outcome: "PASS",
      startDate: "2099-12-28",
    });
    const commandId = randomUUID();

    const accepted = await request(app)
      .post(`/api/v1/applications/${scenario.applicationId}/offer/accept`)
      .set("Authorization", `Bearer ${scenario.student.token}`)
      .set("Idempotency-Key", commandId);
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toMatchObject({
      status: "ACCEPTED_PENDING_UIT_CONFIRMATION",
      version: 6,
      recruitmentResult: { outcome: "PASS", studentDecision: "ACCEPTED" },
    });

    const repeated = await request(app)
      .post(`/api/v1/applications/${scenario.applicationId}/offer/accept`)
      .set("Authorization", `Bearer ${scenario.student.token}`)
      .set("Idempotency-Key", commandId);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.version).toBe(6);

    const notifications = await client.query<{ type: string; role: string }>(
      `SELECT n.type, u.role FROM notifications n JOIN users u ON u.id = n.recipient_user_id
       WHERE n.resource_id = $1 AND n.type IN ('OFFER_ACCEPTED', 'PLACEMENT_CONFIRMATION_REQUIRED')`,
      [scenario.applicationId],
    );
    expect(notifications.rows).toEqual(expect.arrayContaining([
      { type: "OFFER_ACCEPTED", role: "COMPANY" },
      { type: "PLACEMENT_CONFIRMATION_REQUIRED", role: "UIT_ADMIN" },
    ]));
  });

  it("requires a reason when the owning student declines an offer", async () => {
    const scenario = await prepareInterview();
    await recordResult(scenario.recruiter.token, scenario.applicationId, {
      outcome: "PASS",
      startDate: "2099-12-28",
    });

    const missingReason = await request(app)
      .post(`/api/v1/applications/${scenario.applicationId}/offer/decline`)
      .set("Authorization", `Bearer ${scenario.student.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({});
    expect(missingReason.status).toBe(400);

    const declined = await request(app)
      .post(`/api/v1/applications/${scenario.applicationId}/offer/decline`)
      .set("Authorization", `Bearer ${scenario.student.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reasonCode: "ACCEPTED_OTHER_OFFER", note: "Tôi đã lựa chọn một cơ hội phù hợp hơn." });
    expect(declined.status).toBe(200);
    expect(declined.body.data).toMatchObject({
      status: "OFFER_DECLINED",
      recruitmentResult: { studentDecision: "DECLINED" },
    });
    expect(declined.body.data.timeline.at(-1)).toMatchObject({
      toStatus: "OFFER_DECLINED",
      reasonCode: "ACCEPTED_OTHER_OFFER",
    });
  });

  it("allows only one student decision when accept and decline race", async () => {
    const scenario = await prepareInterview();
    await recordResult(scenario.recruiter.token, scenario.applicationId, {
      outcome: "PASS",
      startDate: "2099-12-28",
    });

    const [accepted, declined] = await Promise.all([
      request(app)
        .post(`/api/v1/applications/${scenario.applicationId}/offer/accept`)
        .set("Authorization", `Bearer ${scenario.student.token}`)
        .set("Idempotency-Key", randomUUID()),
      request(app)
        .post(`/api/v1/applications/${scenario.applicationId}/offer/decline`)
        .set("Authorization", `Bearer ${scenario.student.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ reasonCode: "OTHER_REASON", note: "Tôi chưa thể bắt đầu trong thời gian đề xuất." }),
    ]);

    expect([accepted.status, declined.status].sort()).toEqual([200, 409]);
    const finalState = await client.query<{ status: string }>("SELECT status FROM applications WHERE id = $1", [scenario.applicationId]);
    expect(["ACCEPTED_PENDING_UIT_CONFIRMATION", "OFFER_DECLINED"]).toContain(finalState.rows[0]?.status);
  });
});

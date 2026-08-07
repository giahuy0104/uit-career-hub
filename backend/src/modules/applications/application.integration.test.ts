import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import { createDatabasePool } from "../../db/pool.js";
import type { AuthUser, UserRole } from "../auth/auth.types.js";
import { TokenService } from "../auth/token.service.js";
import type { EmailDeliveryService } from "../email/email-delivery.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("student job application flow", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-application-flow-test",
  });
  const tokenService = new TokenService();
  const dispatchPending = vi.fn(async () => ({ enabled: true, claimed: 1, sent: 1, failed: 0 }));
  const app = createApp({
    database,
    authDatabase: database,
    jobDatabase: database,
    applicationDatabase: database,
    tokenService,
    emailDeliveryService: { dispatchPending } as unknown as EmailDeliveryService,
  });
  const userIds: string[] = [];
  const companyIds: string[] = [];
  const studentProfileIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    dispatchPending.mockClear();
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

  function requestSupplement(
    token: string,
    applicationId: string,
    body: Record<string, unknown>,
    commandId = randomUUID(),
  ) {
    return request(app)
      .post(`/api/v1/uit/applications/${applicationId}/request-supplement`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
  }

  function resubmitApplication(
    token: string,
    applicationId: string,
    documentIds: string[],
    commandId = randomUUID(),
  ) {
    return request(app)
      .post(`/api/v1/applications/${applicationId}/resubmit`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send({
        documents: documentIds.map((documentId) => ({ documentId })),
        consentToShare: true,
      });
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

  function confirmInterview(token: string, interviewId: string) {
    return request(app)
      .post(`/api/v1/students/me/interviews/${interviewId}/confirm`)
      .set("Authorization", `Bearer ${token}`);
  }

  function withdrawApplication(
    token: string,
    applicationId: string,
    body: Record<string, unknown>,
    commandId = randomUUID(),
  ) {
    return request(app)
      .post(`/api/v1/applications/${applicationId}/withdraw`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
  }

  function cancelInterviewParticipation(
    token: string,
    applicationId: string,
    body: Record<string, unknown>,
    commandId = randomUUID(),
  ) {
    return request(app)
      .post(`/api/v1/applications/${applicationId}/cancel-interview`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
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

  async function prepareAcceptedOffer() {
    const scenario = await prepareInterview();
    const result = await recordResult(scenario.recruiter.token, scenario.applicationId, {
      outcome: "PASS",
      startDate: "2099-12-28",
    });
    expect(result.status).toBe(200);
    const accepted = await request(app)
      .post(`/api/v1/applications/${scenario.applicationId}/offer/accept`)
      .set("Authorization", `Bearer ${scenario.student.token}`)
      .set("Idempotency-Key", randomUUID());
    expect(accepted.status).toBe(200);
    return scenario;
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

  it("updates the student phone and selects only a verified CV as default", async () => {
    const { student } = await createScenario();
    const replacementCvId = randomUUID();
    await client.query(
      `INSERT INTO student_documents
       (id, student_profile_id, document_type, file_name, mime_type, file_size_bytes,
        storage_key, version, is_default, verification_status)
       VALUES ($1, $2, 'CV', 'cv-v2.pdf', 'application/pdf', 4096, $3, 2, false, 'VERIFIED')`,
      [replacementCvId, student.studentProfileId, `test/${replacementCvId}`],
    );

    const updatedProfile = await request(app)
      .patch("/api/v1/students/me")
      .set("Authorization", `Bearer ${student.token}`)
      .send({ phone: "+84 912 345 678" });
    expect(updatedProfile.status).toBe(200);
    expect(updatedProfile.body.data.phone).toBe("+84 912 345 678");

    const selected = await request(app)
      .post(`/api/v1/students/me/documents/${replacementCvId}/default`)
      .set("Authorization", `Bearer ${student.token}`);
    expect(selected.status).toBe(200);
    expect(selected.body.data.filter((document: { isDefault: boolean }) => document.isDefault)).toEqual([
      expect.objectContaining({ id: replacementCvId, documentType: "CV" }),
    ]);

    const invalidType = await request(app)
      .post(`/api/v1/students/me/documents/${student.transcriptId}/default`)
      .set("Authorization", `Bearer ${student.token}`);
    expect(invalidType.status).toBe(409);
    expect(invalidType.body.error.code).toBe("STUDENT_DOCUMENT_NOT_CV");

    const audits = await client.query<{ action: string }>(
      `SELECT action FROM audit_logs
       WHERE actor_user_id = $1 AND action IN ('STUDENT_PROFILE_UPDATED', 'STUDENT_DEFAULT_CV_CHANGED')
       ORDER BY created_at`,
      [student.id],
    );
    expect(audits.rows.map((row) => row.action)).toEqual([
      "STUDENT_PROFILE_UPDATED",
      "STUDENT_DEFAULT_CV_CHANGED",
    ]);
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
    expect(dispatchPending).toHaveBeenCalledOnce();
    expect(dispatchPending).toHaveBeenCalledWith(created.body.data.id);
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

  it("lets the student withdraw a forwarded application idempotently with history and notifications", async () => {
    const { admin, recruiter, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;
    await forward(admin.token, applicationId);
    const commandId = randomUUID();
    const reason = {
      reasonCode: "STUDENT_CHANGED_PLAN",
      note: "Tôi thay đổi kế hoạch học tập nên chưa thể tham gia đợt thực tập này.",
    };

    const withdrawn = await withdrawApplication(student.token, applicationId, reason, commandId);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data).toMatchObject({ status: "WITHDRAWN", version: 3, availableActions: [] });
    expect(withdrawn.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "FORWARDED_TO_COMPANY",
      toStatus: "WITHDRAWN",
      actorType: "STUDENT",
      reasonCode: reason.reasonCode,
      note: reason.note,
      metadata: { action: "withdraw" },
    });

    const repeated = await withdrawApplication(student.token, applicationId, reason, commandId);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data).toMatchObject({ status: "WITHDRAWN", version: 3 });

    const notifications = await client.query<{ recipient_user_id: string; type: string }>(
      `SELECT recipient_user_id, type FROM notifications
       WHERE resource_id = $1
         AND recipient_user_id = ANY($2::uuid[])
         AND type IN ('APPLICATION_WITHDRAWN_RECORDED', 'APPLICATION_WITHDRAWN_BY_STUDENT')`,
      [applicationId, [admin.id, recruiter.id]],
    );
    expect(notifications.rows).toEqual(expect.arrayContaining([
      { recipient_user_id: admin.id, type: "APPLICATION_WITHDRAWN_RECORDED" },
      { recipient_user_id: recruiter.id, type: "APPLICATION_WITHDRAWN_BY_STUDENT" },
    ]));
    expect(notifications.rows).toHaveLength(2);

    const audit = await client.query<{ action: string }>(
      "SELECT action FROM audit_logs WHERE target_id = $1 AND action = 'APPLICATION_WITHDRAWN_BY_STUDENT'",
      [applicationId],
    );
    expect(audit.rows).toHaveLength(1);
  });

  it("requires the interview cancellation action and cancels the active interview", async () => {
    const scenario = await prepareInterview();
    const reason = {
      reasonCode: "STUDENT_CANNOT_ATTEND",
      note: "Tôi không thể tiếp tục tham gia lịch phỏng vấn vì trùng lịch học bắt buộc.",
    };

    const genericWithdraw = await withdrawApplication(scenario.student.token, scenario.applicationId, reason);
    expect(genericWithdraw.status).toBe(409);
    expect(genericWithdraw.body.error.code).toBe("APPLICATION_WITHDRAWAL_NOT_ALLOWED");

    const commandId = randomUUID();
    const cancelled = await cancelInterviewParticipation(
      scenario.student.token,
      scenario.applicationId,
      reason,
      commandId,
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data).toMatchObject({ status: "WITHDRAWN", version: 5, availableActions: [] });
    expect(cancelled.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "INTERVIEW_INVITED",
      toStatus: "WITHDRAWN",
      actorType: "STUDENT",
      reasonCode: reason.reasonCode,
      metadata: { action: "cancel-interview" },
    });

    const interview = await client.query<{ status: string; cancellation_reason: string; version: number }>(
      "SELECT status, cancellation_reason, version FROM interviews WHERE application_id = $1",
      [scenario.applicationId],
    );
    expect(interview.rows[0]).toEqual({ status: "CANCELLED", cancellation_reason: reason.note, version: 2 });

    const repeated = await cancelInterviewParticipation(
      scenario.student.token,
      scenario.applicationId,
      reason,
      commandId,
    );
    expect(repeated.status).toBe(200);
    expect(repeated.body.data).toMatchObject({ status: "WITHDRAWN", version: 5 });

    const companyNotification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2 AND type = 'INTERVIEW_CANCELLED_BY_STUDENT'`,
      [scenario.recruiter.id, scenario.applicationId],
    );
    expect(Number(companyNotification.rows[0]?.count)).toBe(1);
  });

  it("blocks withdrawal in protected stages and hides applications owned by another student", async () => {
    const { jobId, student } = await createScenario();
    const otherStudent = await createStudent();
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;
    const reason = { reasonCode: "STUDENT_CHANGED_PLAN", note: "Tôi muốn dừng quy trình ứng tuyển này." };

    const foreign = await withdrawApplication(otherStudent.token, applicationId, reason);
    expect(foreign.status).toBe(404);

    const wrongAction = await cancelInterviewParticipation(student.token, applicationId, reason);
    expect(wrongAction.status).toBe(409);
    expect(wrongAction.body.error.code).toBe("APPLICATION_WITHDRAWAL_NOT_ALLOWED");

    const invalidReason = await withdrawApplication(student.token, applicationId, {
      reasonCode: "X",
      note: "Ngắn",
    });
    expect(invalidReason.status).toBe(400);
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

  it("resubmits verified requested documents idempotently and preserves every snapshot", async () => {
    const { admin, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;
    const requestBody = {
      reasonCode: "MISSING_TRANSCRIPT",
      note: "Vui lòng bổ sung bảng điểm đã được xác nhận bởi nhà trường.",
      requiredDocumentTypes: ["TRANSCRIPT"],
      dueAt: "2099-12-20T17:00:00+07:00",
    };
    await requestSupplement(admin.token, applicationId, requestBody);

    const commandId = randomUUID();
    const resubmitted = await resubmitApplication(
      student.token,
      applicationId,
      [student.transcriptId],
      commandId,
    );
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data).toMatchObject({
      status: "UIT_REVIEWING",
      version: 3,
      availableActions: ["WITHDRAW"],
    });
    expect(resubmitted.body.data.documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceDocumentId: student.cvId, documentType: "CV" }),
      expect.objectContaining({ sourceDocumentId: student.transcriptId, documentType: "TRANSCRIPT" }),
    ]));
    expect(resubmitted.body.data.documents).toHaveLength(2);
    expect(resubmitted.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "NEEDS_SUPPLEMENT",
      toStatus: "UIT_REVIEWING",
      actorType: "STUDENT",
      metadata: {
        requiredDocumentTypes: ["TRANSCRIPT"],
        documents: [expect.objectContaining({
          sourceDocumentId: student.transcriptId,
          documentType: "TRANSCRIPT",
          sourceVersion: 1,
        })],
      },
    });

    const repeated = await resubmitApplication(
      student.token,
      applicationId,
      [student.transcriptId],
      commandId,
    );
    expect(repeated.status).toBe(200);
    expect(repeated.body.data).toMatchObject({ status: "UIT_REVIEWING", version: 3 });
    expect(repeated.body.data.documents).toHaveLength(2);

    const notification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND resource_id = $2 AND type = 'APPLICATION_RESUBMITTED'`,
      [admin.id, applicationId],
    );
    expect(Number(notification.rows[0]?.count)).toBe(1);
    const audit = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_logs
       WHERE actor_user_id = $1 AND target_id = $2 AND action = 'APPLICATION_RESUBMITTED'`,
      [student.id, applicationId],
    );
    expect(Number(audit.rows[0]?.count)).toBe(1);
  });

  it("validates supplement ownership, verification, requested types and deadline", async () => {
    const { admin, jobId, student } = await createScenario();
    const otherStudent = await createStudent();
    const created = await submit(student.token, jobId, [student.cvId]);
    const applicationId = created.body.data.id as string;

    const wrongState = await resubmitApplication(student.token, applicationId, [student.transcriptId]);
    expect(wrongState.status).toBe(409);
    expect(wrongState.body.error.code).toBe("APPLICATION_STATE_CONFLICT");

    const expiredRequest = await requestSupplement(admin.token, applicationId, {
      reasonCode: "MISSING_TRANSCRIPT",
      note: "Yêu cầu có thời hạn không hợp lệ để kiểm thử.",
      requiredDocumentTypes: ["TRANSCRIPT"],
      dueAt: "2020-01-01T00:00:00+07:00",
    });
    expect(expiredRequest.status).toBe(400);
    expect(expiredRequest.body.error.code).toBe("APPLICATION_SUPPLEMENT_DUE_DATE_INVALID");

    await requestSupplement(admin.token, applicationId, {
      reasonCode: "MISSING_STUDENT_CONFIRMATION",
      note: "Vui lòng bổ sung giấy xác nhận sinh viên còn hiệu lực.",
      requiredDocumentTypes: ["STUDENT_CONFIRMATION"],
      dueAt: "2099-12-20T17:00:00+07:00",
    });

    const foreign = await resubmitApplication(student.token, applicationId, [otherStudent.transcriptId]);
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe("APPLICATION_DOCUMENT_INVALID");

    const pending = await resubmitApplication(student.token, applicationId, [student.pendingDocumentId]);
    expect(pending.status).toBe(400);
    expect(pending.body.error.code).toBe("APPLICATION_DOCUMENT_NOT_VERIFIED");

    const existing = await resubmitApplication(student.token, applicationId, [student.cvId]);
    expect(existing.status).toBe(400);
    expect(existing.body.error.code).toBe("APPLICATION_DOCUMENT_ALREADY_SUBMITTED");

    const missingType = await resubmitApplication(student.token, applicationId, [student.transcriptId]);
    expect(missingType.status).toBe(400);
    expect(missingType.body.error.code).toBe("APPLICATION_REQUIRED_DOCUMENTS_MISSING");

    const hidden = await resubmitApplication(otherStudent.token, applicationId, [otherStudent.transcriptId]);
    expect(hidden.status).toBe(404);
  });

  it("forwards the application to the correct company and blocks a second decision", async () => {
    const { admin, recruiter, jobId, student } = await createScenario();
    const created = await submit(student.token, jobId, [student.cvId, student.transcriptId]);
    const applicationId = created.body.data.id as string;
    const commandId = randomUUID();
    dispatchPending.mockClear();

    const forwarded = await request(app)
      .post(`/api/v1/uit/applications/${applicationId}/forward`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Idempotency-Key", commandId);
    expect(forwarded.status).toBe(200);
    expect(forwarded.body.data).toMatchObject({ status: "FORWARDED_TO_COMPANY", version: 2 });
    expect(dispatchPending).toHaveBeenCalledOnce();
    expect(dispatchPending).toHaveBeenCalledWith(applicationId);

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

  it("lists interviews by tenant and lets the owning student confirm idempotently", async () => {
    const scenario = await prepareInterview();
    const interview = await request(app)
      .get("/api/v1/students/me/interviews?page=1&pageSize=100&scope=all")
      .set("Authorization", `Bearer ${scenario.student.token}`);
    expect(interview.status).toBe(200);
    expect(interview.body.meta.totalItems).toBe(1);
    expect(interview.body.data[0]).toMatchObject({
      applicationId: scenario.applicationId,
      status: "PENDING_STUDENT_CONFIRMATION",
      applicationStatus: "INTERVIEW_INVITED",
      student: { id: scenario.student.studentProfileId },
      job: { company: { id: scenario.recruiter.companyId } },
    });

    const companyList = await request(app)
      .get("/api/v1/companies/me/interviews?page=1&pageSize=100&scope=all")
      .set("Authorization", `Bearer ${scenario.recruiter.token}`);
    expect(companyList.status).toBe(200);
    expect(companyList.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: interview.body.data[0].id, applicationId: scenario.applicationId }),
    ]));

    const confirmed = await confirmInterview(scenario.student.token, interview.body.data[0].id);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data).toMatchObject({
      id: interview.body.data[0].id,
      status: "CONFIRMED",
      version: 2,
    });
    const repeated = await confirmInterview(scenario.student.token, interview.body.data[0].id);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data).toMatchObject({ status: "CONFIRMED", version: 2 });

    const companyNotification = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM notifications n JOIN users u ON u.id = n.recipient_user_id
       WHERE n.resource_id = $1 AND n.type = 'INTERVIEW_CONFIRMED_BY_STUDENT' AND u.role = 'COMPANY'`,
      [interview.body.data[0].id],
    );
    expect(Number(companyNotification.rows[0]?.count)).toBe(1);
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

  it("confirms placement idempotently and auto-withdraws every other active application", async () => {
    const selected = await prepareAcceptedOffer();
    const otherCompany = await createScenario();
    const otherCreated = await submit(selected.student.token, otherCompany.jobId, [selected.student.cvId]);
    const otherApplicationId = otherCreated.body.data.id as string;
    await forward(otherCompany.admin.token, otherApplicationId);
    await startCompanyReview(otherCompany.recruiter.token, otherApplicationId);
    const otherInterview = await scheduleInterview(otherCompany.recruiter.token, otherApplicationId);
    expect(otherInterview.status).toBe(201);

    const queue = await request(app)
      .get("/api/v1/uit/applications/placement-queue?page=1&pageSize=100")
      .set("Authorization", `Bearer ${selected.admin.token}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: selected.applicationId,
        status: "ACCEPTED_PENDING_UIT_CONFIRMATION",
        recruitmentResult: expect.objectContaining({ studentDecision: "ACCEPTED" }),
      }),
    ]));

    const commandId = randomUUID();
    const body = { startDate: "2099-12-30", note: "Đã đối chiếu offer và xác nhận với sinh viên." };
    const confirmed = await request(app)
      .post(`/api/v1/uit/applications/${selected.applicationId}/confirm-placement`)
      .set("Authorization", `Bearer ${selected.admin.token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data).toMatchObject({
      selectedApplication: {
        id: selected.applicationId,
        status: "HIRED",
        version: 7,
        recruitmentResult: { studentDecision: "ACCEPTED", startDate: body.startDate },
      },
      autoWithdrawnApplicationIds: [otherApplicationId],
    });
    expect(confirmed.body.data.selectedApplication.timeline.at(-1)).toMatchObject({
      fromStatus: "ACCEPTED_PENDING_UIT_CONFIRMATION",
      toStatus: "HIRED",
      actorType: "UIT_ADMIN",
      note: body.note,
      metadata: { startDate: body.startDate, autoWithdrawnApplicationIds: [otherApplicationId] },
    });

    const withdrawn = await request(app)
      .get(`/api/v1/applications/${otherApplicationId}`)
      .set("Authorization", `Bearer ${selected.student.token}`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.status).toBe("WITHDRAWN");
    expect(withdrawn.body.data.timeline.at(-1)).toMatchObject({
      fromStatus: "INTERVIEW_INVITED",
      toStatus: "WITHDRAWN",
      actorType: "SYSTEM",
      reasonCode: "ACCEPTED_OTHER_JOB",
      metadata: { selectedApplicationId: selected.applicationId },
    });
    const cancelledInterview = await client.query<{ status: string; cancellation_reason: string | null }>(
      "SELECT status, cancellation_reason FROM interviews WHERE application_id = $1",
      [otherApplicationId],
    );
    expect(cancelledInterview.rows[0]).toEqual({ status: "CANCELLED", cancellation_reason: "ACCEPTED_OTHER_JOB" });

    const repeated = await request(app)
      .post(`/api/v1/uit/applications/${selected.applicationId}/confirm-placement`)
      .set("Authorization", `Bearer ${selected.admin.token}`)
      .set("Idempotency-Key", commandId)
      .send(body);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.selectedApplication.version).toBe(7);
    expect(repeated.body.data.autoWithdrawnApplicationIds).toEqual([otherApplicationId]);

    const notifications = await client.query<{ recipient_user_id: string; type: string }>(
      `SELECT recipient_user_id, type FROM notifications
       WHERE resource_id IN ($1, $2)
         AND type IN ('PLACEMENT_CONFIRMED', 'PLACEMENT_CONFIRMED_BY_UIT', 'APPLICATION_AUTO_WITHDRAWN')`,
      [selected.applicationId, otherApplicationId],
    );
    expect(notifications.rows).toEqual(expect.arrayContaining([
      { recipient_user_id: selected.student.id, type: "PLACEMENT_CONFIRMED" },
      { recipient_user_id: selected.recruiter.id, type: "PLACEMENT_CONFIRMED_BY_UIT" },
      { recipient_user_id: otherCompany.recruiter.id, type: "APPLICATION_AUTO_WITHDRAWN" },
    ]));

    const queueAfter = await request(app)
      .get("/api/v1/uit/applications/placement-queue?page=1&pageSize=100")
      .set("Authorization", `Bearer ${selected.admin.token}`);
    expect(queueAfter.body.data.map((item: { id: string }) => item.id)).not.toContain(selected.applicationId);
  }, 30_000);

  it("allows only one UIT placement confirmation and rejects invalid states", async () => {
    const pendingInterview = await prepareInterview();
    const invalid = await request(app)
      .post(`/api/v1/uit/applications/${pendingInterview.applicationId}/confirm-placement`)
      .set("Authorization", `Bearer ${pendingInterview.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ startDate: "2099-12-30" });
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("APPLICATION_STATE_CONFLICT");

    const accepted = await prepareAcceptedOffer();
    const secondAdmin = await createUser("UIT_ADMIN");
    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/uit/applications/${accepted.applicationId}/confirm-placement`)
        .set("Authorization", `Bearer ${accepted.admin.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ startDate: "2099-12-30" }),
      request(app)
        .post(`/api/v1/uit/applications/${accepted.applicationId}/confirm-placement`)
        .set("Authorization", `Bearer ${secondAdmin.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ startDate: "2099-12-30" }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const forbidden = await request(app)
      .get("/api/v1/uit/applications/placement-queue")
      .set("Authorization", `Bearer ${accepted.recruiter.token}`);
    expect(forbidden.status).toBe(403);
  }, 30_000);
});

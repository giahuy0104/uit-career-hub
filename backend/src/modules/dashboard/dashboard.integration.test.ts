import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import { createDatabasePool } from "../../db/pool.js";
import type { AuthUser } from "../auth/auth.types.js";
import { TokenService } from "../auth/token.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("live dashboard API", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-dashboard-test",
  });
  const tokenService = new TokenService();
  const app = createApp({ database, dashboardDatabase: database, tokenService });

  const adminUserId = randomUUID();
  const companyUserId = randomUUID();
  const studentUserId = randomUUID();
  const companyId = randomUUID();
  const studentProfileId = randomUUID();
  const jobIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const applicationIds = [randomUUID(), randomUUID(), randomUUID()];
  let tokens: Record<"admin" | "company" | "student", string>;

  function authUser(role: AuthUser["role"]): AuthUser {
    return {
      id: role === "UIT_ADMIN" ? adminUserId : role === "COMPANY" ? companyUserId : studentUserId,
      email: `${role.toLowerCase()}-${randomUUID()}@dashboard.test`,
      role,
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: `${role} dashboard test`,
      organization: null,
      studentProfileId: role === "STUDENT" ? studentProfileId : null,
      companyId: role === "COMPANY" ? companyId : null,
    };
  }

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();

    await client.query(
      `INSERT INTO users (id, email, role, status) VALUES
       ($1, $2, 'UIT_ADMIN', 'ACTIVE'),
       ($3, $4, 'COMPANY', 'ACTIVE'),
       ($5, $6, 'STUDENT', 'ACTIVE')`,
      [
        adminUserId, `admin-${adminUserId}@dashboard.test`,
        companyUserId, `company-${companyUserId}@dashboard.test`,
        studentUserId, `student-${studentUserId}@dashboard.test`,
      ],
    );
    await client.query(
      `INSERT INTO companies (id, code, name, partner_status, verified_at, created_by_user_id)
       VALUES ($1, $2, 'Dashboard Partner', 'ACTIVE', now(), $3)`,
      [companyId, `DASH-${companyId.slice(0, 8)}`, adminUserId],
    );
    await client.query(
      `INSERT INTO company_users (user_id, company_id, full_name, is_primary)
       VALUES ($1, $2, 'Dashboard Recruiter', true)`,
      [companyUserId, companyId],
    );
    await client.query(
      `INSERT INTO student_profiles
       (id, user_id, student_code, full_name, faculty, major, cohort, gpa, phone, academic_status)
       VALUES ($1, $2, $3, 'Dashboard Student', 'CNTT', 'Kỹ thuật phần mềm', '2026', 3.5, '0900000000', 'ACTIVE')`,
      [studentProfileId, studentUserId, `DS${studentProfileId.replaceAll("-", "").slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO student_documents
       (student_profile_id, document_type, file_name, mime_type, file_size_bytes, storage_key,
        version, is_default, verification_status)
       VALUES
       ($1, 'CV', 'dashboard-cv.pdf', 'application/pdf', 1024, $2, 1, true, 'VERIFIED'),
       ($1, 'TRANSCRIPT', 'dashboard-transcript.pdf', 'application/pdf', 1024, $3, 1, false, 'VERIFIED')`,
      [studentProfileId, `dashboard/${studentProfileId}/cv`, `dashboard/${studentProfileId}/transcript`],
    );

    for (const [index, jobId] of jobIds.entries()) {
      const pending = index === jobIds.length - 1;
      await client.query(
        `INSERT INTO job_posts
         (id, company_id, created_by_user_id, title, opportunity_type, work_mode, location,
          description, requirements, positions, deadline, status, submitted_at, reviewed_at)
         VALUES ($1, $2, $3, $4, 'INTERNSHIP', 'HYBRID', 'TP. Hồ Chí Minh',
                 'Dashboard test job', 'Dashboard test requirements', 1, current_date + 30,
                 $5, now() - interval '2 days', $6)`,
        [jobId, companyId, companyUserId, `Dashboard Job ${index + 1}`,
          pending ? "PENDING_UIT_REVIEW" : "RECRUITING", pending ? null : new Date()],
      );
    }

    const statuses = ["FORWARDED_TO_COMPANY", "OFFER_PENDING_STUDENT", "INTERVIEW_INVITED"];
    for (const [index, applicationId] of applicationIds.entries()) {
      await client.query(
        `INSERT INTO applications
         (id, student_profile_id, job_post_id, status, consented_at, submitted_at, last_transition_at)
         VALUES ($1, $2, $3, $4, now() - interval '3 days', now() - interval '3 days',
                 now() - ($5::text || ' hours')::interval)`,
        [applicationId, studentProfileId, jobIds[index], statuses[index], String(3 - index)],
      );
    }
    await client.query(
      `INSERT INTO interviews
       (application_id, created_by_user_id, scheduled_at, mode, meeting_url, status)
       VALUES
       ($1, $2, now() + interval '1 day', 'ONLINE', 'https://meet.example/dashboard-upcoming', 'CONFIRMED'),
       ($1, $2, date_trunc('week', now()) + interval '1 hour', 'ONLINE',
        'https://meet.example/dashboard-week', 'COMPLETED')`,
      [applicationIds[2], companyUserId],
    );

    tokens = {
      admin: (await tokenService.signAccessToken(authUser("UIT_ADMIN"))).accessToken,
      company: (await tokenService.signAccessToken(authUser("COMPANY"))).accessToken,
      student: (await tokenService.signAccessToken(authUser("STUDENT"))).accessToken,
    };
  });

  afterAll(async () => {
    await client.query("DELETE FROM interviews WHERE application_id = ANY($1::uuid[])", [applicationIds]);
    await client.query("DELETE FROM applications WHERE id = ANY($1::uuid[])", [applicationIds]);
    await client.query("DELETE FROM job_posts WHERE id = ANY($1::uuid[])", [jobIds]);
    await client.query("DELETE FROM student_documents WHERE student_profile_id = $1", [studentProfileId]);
    await client.query("DELETE FROM company_users WHERE company_id = $1", [companyId]);
    await client.query("DELETE FROM student_profiles WHERE id = $1", [studentProfileId]);
    await client.query("DELETE FROM companies WHERE id = $1", [companyId]);
    await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[adminUserId, companyUserId, studentUserId]]);
    await client.end();
    await database.end();
  });

  it("returns UIT-wide operational metrics", async () => {
    const response = await request(app)
      .get("/api/v1/uit/dashboard")
      .set("Authorization", `Bearer ${tokens.admin}`);

    expect(response.status).toBe(200);
    expect(response.body.data.metrics).toEqual(expect.objectContaining({
      pendingJobReviews: expect.any(Number),
      pendingUitApplications: expect.any(Number),
      awaitingCompany: expect.any(Number),
      hiresThisMonth: expect.any(Number),
    }));
    expect(response.body.data.metrics.pendingJobReviews).toBeGreaterThanOrEqual(1);
    expect(response.body.data.applicationFunnel).toEqual(expect.any(Array));
    expect(response.body.data.topCompanies).toEqual(expect.any(Array));
  });

  it("scopes company metrics and queues to the authenticated partner", async () => {
    const response = await request(app)
      .get("/api/v1/companies/me/dashboard")
      .set("Authorization", `Bearer ${tokens.company}`);

    expect(response.status).toBe(200);
    expect(response.body.data.metrics).toMatchObject({
      recruitingJobs: 3,
      pendingJobReviews: 1,
      newCandidates: 1,
      hiresThisMonth: 0,
    });
    expect(response.body.data.metrics.interviewsThisWeek).toBeGreaterThanOrEqual(1);
    expect(response.body.data.recentCandidates).toHaveLength(2);
    expect(response.body.data.jobPerformance).toHaveLength(3);
  });

  it("returns the student's profile readiness, tasks and application totals", async () => {
    const response = await request(app)
      .get("/api/v1/students/me/dashboard")
      .set("Authorization", `Bearer ${tokens.student}`);

    expect(response.status).toBe(200);
    expect(response.body.data.metrics).toMatchObject({
      profileCompleteness: 90,
      activeApplications: 3,
      pendingOffers: 1,
    });
    expect(response.body.data.metrics.upcomingInterviews).toBeGreaterThanOrEqual(1);
    expect(response.body.data.profile.missingItems).toContain("Giấy xác nhận sinh viên");
    expect(response.body.data.tasks.map((task: { type: string }) => task.type)).toContain("RESPOND_OFFER");
    expect(response.body.data.latestApplication).toMatchObject({ status: "INTERVIEW_INVITED" });
  });
});

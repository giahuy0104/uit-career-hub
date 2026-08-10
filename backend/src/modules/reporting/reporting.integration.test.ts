import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
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

function binaryParser(response: any, callback: (error: Error | null, body?: unknown) => void) {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
  response.on("error", callback);
}

describeWithDatabase("UIT application reporting API", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-reporting-test",
  });
  const tokenService = new TokenService();
  const app = createApp({ database, reportingDatabase: database, tokenService });
  const userIds: string[] = [];
  const studentProfileIds: string[] = [];
  const companyIds: string[] = [];
  const jobIds: string[] = [];
  const applicationIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    if (userIds.length) {
      await client.query("DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])", [userIds]);
    }
    if (applicationIds.length) {
      await client.query("DELETE FROM recruitment_results WHERE application_id = ANY($1::uuid[])", [applicationIds]);
      await client.query("DELETE FROM applications WHERE id = ANY($1::uuid[])", [applicationIds]);
    }
    if (jobIds.length) await client.query("DELETE FROM job_posts WHERE id = ANY($1::uuid[])", [jobIds]);
    if (companyIds.length) await client.query("DELETE FROM company_users WHERE company_id = ANY($1::uuid[])", [companyIds]);
    if (studentProfileIds.length) await client.query("DELETE FROM student_profiles WHERE id = ANY($1::uuid[])", [studentProfileIds]);
    if (userIds.length) await client.query("DELETE FROM uit_staff WHERE user_id = ANY($1::uuid[])", [userIds]);
    if (companyIds.length) await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [companyIds]);
    if (userIds.length) await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    userIds.length = 0;
    studentProfileIds.length = 0;
    companyIds.length = 0;
    jobIds.length = 0;
    applicationIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function tokenFor(user: AuthUser) {
    return (await tokenService.signAccessToken(user)).accessToken;
  }

  async function createUser(role: UserRole, context: { studentProfileId?: string; companyId?: string } = {}) {
    const id = randomUUID();
    const user: AuthUser = {
      id,
      email: `report-${role.toLowerCase()}-${randomUUID()}@example.com`,
      role,
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: `${role} report test`,
      organization: null,
      studentProfileId: context.studentProfileId ?? null,
      companyId: context.companyId ?? null,
    };
    userIds.push(id);
    await client.query("INSERT INTO users (id, email, role, status) VALUES ($1, $2, $3, 'ACTIVE')", [id, user.email, role]);
    return { user, token: await tokenFor(user) };
  }

  async function seedReport() {
    const marker = `REPORT-${randomUUID().slice(0, 8)}`;
    const admin = await createUser("UIT_ADMIN");
    await client.query(
      "INSERT INTO uit_staff (user_id, full_name, department) VALUES ($1, 'Quản trị báo cáo', 'Phòng Quan hệ Doanh nghiệp')",
      [admin.user.id],
    );

    const companies = [];
    for (const name of ["Công ty Alpha", "Công ty Beta"]) {
      const companyId = randomUUID();
      companyIds.push(companyId);
      const recruiter = await createUser("COMPANY", { companyId });
      const code = `RPT-${randomUUID().slice(0, 6).toUpperCase()}`;
      await client.query(
        `INSERT INTO companies (id, code, name, partner_status, verified_at, created_by_user_id)
         VALUES ($1, $2, $3, 'ACTIVE', now(), $4)`,
        [companyId, code, name, admin.user.id],
      );
      await client.query(
        "INSERT INTO company_users (user_id, company_id, full_name, is_primary) VALUES ($1, $2, $3, true)",
        [recruiter.user.id, companyId, `Recruiter ${name}`],
      );
      companies.push({ id: companyId, code, recruiter });
    }

    const students = [];
    const studentData = [
      { fullName: "Nguyễn An", faculty: "Khoa Công nghệ Phần mềm", major: "Kỹ thuật phần mềm", cohort: "K17" },
      { fullName: "=SUM(1,1)", faculty: "Khoa Hệ thống Thông tin", major: "Hệ thống thông tin", cohort: "K18" },
    ];
    for (const [index, item] of studentData.entries()) {
      const profileId = randomUUID();
      studentProfileIds.push(profileId);
      const student = await createUser("STUDENT", { studentProfileId: profileId });
      await client.query(
        `INSERT INTO student_profiles (id, user_id, student_code, full_name, faculty, major, cohort)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [profileId, student.user.id, `RPT${index + 1}0001`, item.fullName, item.faculty, item.major, item.cohort],
      );
      students.push({ id: profileId, account: student, ...item });
    }

    const jobs = [];
    for (const [index, company] of companies.entries()) {
      const jobId = randomUUID();
      jobIds.push(jobId);
      await client.query(
        `INSERT INTO job_posts
         (id, company_id, created_by_user_id, title, opportunity_type, work_mode, location,
          description, requirements, positions, deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'TP.HCM', 'Mô tả báo cáo', 'Yêu cầu báo cáo', 2, '2026-12-31', 'RECRUITING')`,
        [
          jobId,
          company.id,
          company.recruiter.user.id,
          index === 0 ? `Thực tập sinh Backend ${marker}` : `Kỹ sư dữ liệu ${marker}`,
          index === 0 ? "INTERNSHIP" : "FULL_TIME",
          index === 0 ? "HYBRID" : "ONSITE",
        ],
      );
      jobs.push({ id: jobId });
    }

    const applications = [
      { student: students[0]!, job: jobs[0]!, status: "HIRED", submittedAt: "2026-08-01T02:00:00.000Z" },
      { student: students[1]!, job: jobs[1]!, status: "UIT_REVIEWING", submittedAt: "2026-08-05T03:00:00.000Z" },
      { student: students[0]!, job: jobs[0]!, status: "WITHDRAWN", submittedAt: "2026-07-15T04:00:00.000Z" },
    ] as const;
    for (const item of applications) {
      const applicationId = randomUUID();
      applicationIds.push(applicationId);
      await client.query(
        `INSERT INTO applications
         (id, student_profile_id, job_post_id, status, consented_at, submitted_at, last_transition_at)
         VALUES ($1, $2, $3, $4, $5, $5, $5)`,
        [applicationId, item.student.id, item.job.id, item.status, item.submittedAt],
      );
    }
    await client.query(
      `INSERT INTO recruitment_results
       (application_id, decided_by_user_id, outcome, student_decision, offered_at, responded_at, start_date)
       VALUES ($1, $2, 'PASS', 'ACCEPTED', '2026-08-06T02:00:00Z', '2026-08-07T02:00:00Z', '2026-09-01')`,
      [applicationIds[0], companies[0]!.recruiter.user.id],
    );

    return { admin, companies, students, marker };
  }

  it("filters a consistent report and returns summary plus filter options", async () => {
    const fixture = await seedReport();
    const response = await request(app)
      .get("/api/v1/uit/reports/applications")
      .query({
        fromDate: "2026-08-01",
        toDate: "2026-08-01",
        faculty: fixture.students[0]!.faculty,
        companyId: fixture.companies[0]!.id,
        status: "HIRED",
      })
      .set("Authorization", `Bearer ${fixture.admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: 1, totalPages: 1 });
    expect(response.body.summary).toMatchObject({
      totalApplications: 1,
      uniqueStudents: 1,
      companyCount: 1,
      hiredCount: 1,
      hiredRate: 1,
    });
    expect(response.body.data[0]).toMatchObject({
      status: "HIRED",
      student: { fullName: "Nguyễn An", cohort: "K17" },
      company: { name: "Công ty Alpha" },
      job: { opportunityType: "INTERNSHIP" },
      recruitmentResult: { outcome: "PASS", studentDecision: "ACCEPTED", startDate: "2026-09-01" },
    });
    expect(response.body.filterOptions.faculties).toEqual(expect.arrayContaining([
      "Khoa Công nghệ Phần mềm",
      "Khoa Hệ thống Thông tin",
    ]));
    expect(response.body.filterOptions.companies).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.companies[0]!.id, name: "Công ty Alpha" }),
      expect.objectContaining({ id: fixture.companies[1]!.id, name: "Công ty Beta" }),
    ]));
  });

  it("rejects an inverted reporting period before querying data", async () => {
    const fixture = await seedReport();
    const response = await request(app)
      .get("/api/v1/uit/reports/applications?fromDate=2026-08-10&toDate=2026-08-01")
      .set("Authorization", `Bearer ${fixture.admin.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("exports UTF-8 CSV safely and records the exact export in audit", async () => {
    const fixture = await seedReport();
    const response = await request(app)
      .post("/api/v1/uit/reports/applications/exports")
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .set("User-Agent", "reporting-integration-test")
      .send({ format: "CSV", faculty: "Khoa Hệ thống Thông tin" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toMatch(/uit-application-report-\d{8}-\d{6}\.csv/);
    expect(response.headers["x-report-row-count"]).toBe("1");
    expect(response.text.charCodeAt(0)).toBe(0xfeff);
    expect(response.text).toContain("'=SUM(1,1)");

    const audit = await client.query<{ action: string; metadata: Record<string, unknown>; user_agent: string }>(
      `SELECT action, metadata, user_agent FROM audit_logs
       WHERE actor_user_id = $1 AND action = 'UIT_APPLICATION_REPORT_EXPORTED'`,
      [fixture.admin.user.id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ action: "UIT_APPLICATION_REPORT_EXPORTED", user_agent: "reporting-integration-test" });
    expect(audit.rows[0]!.metadata).toMatchObject({
      report: "APPLICATIONS",
      format: "CSV",
      rowCount: 1,
      filters: { faculty: "Khoa Hệ thống Thông tin" },
    });
  });

  it("exports a styled XLSX workbook with formulas and typed data", async () => {
    const fixture = await seedReport();
    const response = await request(app)
      .post("/api/v1/uit/reports/applications/exports")
      .set("Authorization", `Bearer ${fixture.admin.token}`)
      .send({ format: "XLSX", fromDate: "2026-08-01", toDate: "2026-08-31", query: fixture.marker })
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(response.headers["x-report-row-count"]).toBe("2");
    const workbook = new ExcelJS.Workbook();
    const responseBuffer = response.body as globalThis.Buffer;
    const workbookBuffer = responseBuffer.buffer.slice(
      responseBuffer.byteOffset,
      responseBuffer.byteOffset + responseBuffer.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(workbookBuffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Tổng quan", "Dữ liệu"]);
    expect(workbook.getWorksheet("Tổng quan")?.getCell("B5").value).toMatchObject({
      formula: "COUNTA('Dữ liệu'!A2:A3)",
      result: 2,
    });
    const data = workbook.getWorksheet("Dữ liệu")!;
    expect(data.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(data.autoFilter).toBe("A1:P1");
    expect(data.getCell("B2").value).toBeInstanceOf(Date);
    expect(data.getCell("M2").value).toBe("UIT_REVIEWING");
  });

  it("allows only UIT administrators to view and export reports", async () => {
    const fixture = await seedReport();
    for (const account of [fixture.students[0]!.account, fixture.companies[0]!.recruiter]) {
      const list = await request(app)
        .get("/api/v1/uit/reports/applications")
        .set("Authorization", `Bearer ${account.token}`);
      expect(list.status).toBe(403);
      const exported = await request(app)
        .post("/api/v1/uit/reports/applications/exports")
        .set("Authorization", `Bearer ${account.token}`)
        .send({ format: "CSV" });
      expect(exported.status).toBe(403);
    }
  });
});

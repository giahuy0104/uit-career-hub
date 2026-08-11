import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { runMigrations } from "../../db/migrate.js";
import { createDatabasePool } from "../../db/pool.js";
import type { AuthUser } from "../auth/auth.types.js";
import { hashPassword } from "../auth/password.js";
import { TokenService } from "../auth/token.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("company partner management API", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-company-management-test",
  });
  const tokenService = new TokenService();
  const app = createApp({
    database,
    authDatabase: database,
    companyDatabase: database,
    tokenService,
  });
  const adminIds: string[] = [];
  const studentIds: string[] = [];
  const companyCodes: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    const companies = companyCodes.length
      ? await client.query<{ id: string }>("SELECT id FROM companies WHERE code = ANY($1::text[])", [companyCodes])
      : { rows: [] };
    const companyIds = companies.rows.map((row) => row.id);
    const companyUsers = companyIds.length
      ? await client.query<{ user_id: string }>(
          "SELECT user_id FROM company_users WHERE company_id = ANY($1::uuid[])",
          [companyIds],
        )
      : { rows: [] };
    const userIds = [...adminIds, ...studentIds, ...companyUsers.rows.map((row) => row.user_id)];
    if (userIds.length) {
      await client.query(
        "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])",
        [userIds],
      );
    }
    if (companyIds.length) {
      await client.query("DELETE FROM audit_logs WHERE target_id = ANY($1::uuid[])", [companyIds]);
      await client.query(
        "DELETE FROM job_post_status_history WHERE job_post_id IN (SELECT id FROM job_posts WHERE company_id = ANY($1::uuid[]))",
        [companyIds],
      );
      await client.query("DELETE FROM job_posts WHERE company_id = ANY($1::uuid[])", [companyIds]);
      await client.query("DELETE FROM company_users WHERE company_id = ANY($1::uuid[])", [companyIds]);
      await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [companyIds]);
    }
    if (adminIds.length) {
      await client.query("DELETE FROM uit_staff WHERE user_id = ANY($1::uuid[])", [adminIds]);
    }
    if (studentIds.length) {
      await client.query("DELETE FROM student_profiles WHERE user_id = ANY($1::uuid[])", [studentIds]);
    }
    if (userIds.length) {
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
    adminIds.length = 0;
    studentIds.length = 0;
    companyCodes.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function createAdmin() {
    const id = randomUUID();
    const user: AuthUser = {
      id,
      email: `admin-${randomUUID()}@uit.edu.vn`,
      role: "UIT_ADMIN",
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: "Admin quản lý đối tác",
      organization: "Phòng Quan hệ Doanh nghiệp",
      studentProfileId: null,
      companyId: null,
    };
    adminIds.push(id);
    await client.query(
      "INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'UIT_ADMIN', 'ACTIVE')",
      [id, user.email],
    );
    await client.query(
      "INSERT INTO uit_staff (user_id, full_name, department) VALUES ($1, $2, $3)",
      [id, user.displayName, user.organization],
    );
    return { ...user, token: (await tokenService.signAccessToken(user)).accessToken };
  }

  async function createStudentToken() {
    const user: AuthUser = {
      id: randomUUID(),
      email: `student-${randomUUID()}@student.uit.edu.vn`,
      role: "STUDENT",
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: "Sinh viên xem đối tác",
      organization: null,
      studentProfileId: randomUUID(),
      companyId: null,
    };
    studentIds.push(user.id);
    await client.query(
      "INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'STUDENT', 'ACTIVE')",
      [user.id, user.email],
    );
    await client.query(
      `INSERT INTO student_profiles
       (id, user_id, student_code, full_name, faculty, major, cohort, academic_status)
       VALUES ($1, $2, $3, $4, 'CNTT', 'Kỹ thuật phần mềm', '2026', 'ACTIVE')`,
      [
        user.studentProfileId,
        user.id,
        `DIR${user.id.replaceAll("-", "").slice(0, 8)}`,
        user.displayName,
      ],
    );
    return (await tokenService.signAccessToken(user)).accessToken;
  }

  it("exposes only active partners and public fields in the student directory", async () => {
    const admin = await createAdmin();
    const studentToken = await createStudentToken();
    const code = `DIR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const suspendedCode = `${code}-S`;
    const activeCompanyId = randomUUID();
    const suspendedCompanyId = randomUUID();
    companyCodes.push(code, suspendedCode);
    await client.query(
      `INSERT INTO companies
       (id, code, name, legal_name, tax_code, industry, company_size, description,
        website, address, partner_status, verified_at, created_by_user_id)
       VALUES
       ($1, $2, 'Đối tác Công nghệ Sinh viên', 'Tên pháp lý nội bộ', 'PRIVATE-TAX',
        'Công nghệ thông tin', '100-499', 'Phát triển sản phẩm số cho người dùng Việt Nam.',
        'https://partner-directory.test', 'TP. Hồ Chí Minh', 'ACTIVE', now(), $5),
       ($3, $4, 'Đối tác đang tạm ngưng', NULL, NULL, 'Công nghệ thông tin', NULL, NULL,
        NULL, NULL, 'SUSPENDED', now(), $5)`,
      [activeCompanyId, code, suspendedCompanyId, suspendedCode, admin.id],
    );
    await client.query(
      `INSERT INTO job_posts
       (company_id, created_by_user_id, title, opportunity_type, work_mode, location,
        description, requirements, positions, deadline, status)
       VALUES
       ($1, $2, 'Thực tập sinh đang tuyển', 'INTERNSHIP', 'HYBRID', 'TP. Hồ Chí Minh',
        'Cơ hội còn hạn cho sinh viên.', 'Có kiến thức lập trình cơ bản.', 2, '2099-12-31', 'RECRUITING'),
       ($1, $2, 'Tin đã hết hạn', 'INTERNSHIP', 'REMOTE', 'Từ xa',
        'Tin cũ không tính vào số vị trí đang tuyển.', 'Có kiến thức lập trình cơ bản.', 1, '2000-01-01', 'RECRUITING')`,
      [activeCompanyId, admin.id],
    );

    const list = await request(app)
      .get(`/api/v1/companies?query=${code}&hasRecruitingJobs=true`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.totalItems).toBe(1);
    expect(list.body.data[0]).toMatchObject({
      id: activeCompanyId,
      code,
      recruitingJobCount: 1,
      industry: "Công nghệ thông tin",
    });
    expect(list.body.data[0]).not.toHaveProperty("legalName");
    expect(list.body.data[0]).not.toHaveProperty("taxCode");
    expect(list.body.data[0]).not.toHaveProperty("recruiters");
    expect(list.body.data[0]).not.toHaveProperty("version");

    const detail = await request(app)
      .get(`/api/v1/companies/${activeCompanyId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: activeCompanyId, recruitingJobCount: 1 });

    const hidden = await request(app)
      .get(`/api/v1/companies/${suspendedCompanyId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(hidden.status).toBe(404);
  });

  it("runs creation, manual activation, profile update and suspension rules end to end", async () => {
    const admin = await createAdmin();
    const code = `IT-${randomUUID().slice(0, 8).toUpperCase()}`;
    companyCodes.push(code);
    const primaryEmail = `primary-${randomUUID()}@partner.test`;

    const created = await request(app)
      .post("/api/v1/uit/companies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        code,
        name: "Công ty Đối tác Kiểm thử",
        legalName: "Công ty TNHH Đối tác Kiểm thử",
        taxCode: `TAX-${randomUUID().slice(0, 12)}`,
        industry: "Công nghệ thông tin",
        companySize: "100-499",
        description: "Đối tác dùng cho kiểm thử luồng quản lý doanh nghiệp.",
        website: "https://partner.test",
        address: "Thành phố Hồ Chí Minh",
        primaryRecruiter: {
          email: primaryEmail,
          fullName: "Nguyễn Nhà Tuyển Dụng",
          title: "Trưởng bộ phận tuyển dụng",
        },
      });

    expect(created.status).toBe(201);
    expect(created.body.data.company).toMatchObject({ code, partnerStatus: "ACTIVE", version: 1 });
    expect(created.body.data.activation.token).toHaveLength(64);
    const companyId = created.body.data.company.id as string;
    const primaryUserId = created.body.data.company.recruiters[0].userId as string;
    const firstActivationToken = created.body.data.activation.token as string;

    const storedToken = await client.query<{ token_hash: string }>(
      "SELECT token_hash FROM account_activation_tokens WHERE user_id = $1 AND used_at IS NULL",
      [primaryUserId],
    );
    expect(storedToken.rows[0]?.token_hash).not.toBe(firstActivationToken);

    const activated = await request(app)
      .post("/api/v1/auth/company-activation")
      .send({ token: firstActivationToken, password: "PartnerPass123", acceptedTerms: true });
    expect(activated.status).toBe(204);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: primaryEmail, password: "PartnerPass123" });
    expect(login.status).toBe(200);
    const companyToken = login.body.data.accessToken as string;
    const refreshCookie = login.headers["set-cookie"]?.[0]?.split(";")[0];

    const ownProfile = await request(app)
      .get("/api/v1/companies/me/profile")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.data.recruiters).toHaveLength(1);

    const updated = await request(app)
      .patch("/api/v1/companies/me/profile")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({
        name: "Công ty Đối tác Kiểm thử - Cập nhật",
        industry: "Phần mềm",
        companySize: "100-499",
        description: "Hồ sơ đã được doanh nghiệp tự cập nhật qua API.",
        website: "https://partner.test",
        address: "Thành phố Thủ Đức",
        expectedVersion: 1,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ version: 2, name: "Công ty Đối tác Kiểm thử - Cập nhật" });

    const listed = await request(app)
      .get(`/api/v1/uit/companies?query=${code}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.meta.totalItems).toBe(1);

    const secondaryEmail = `secondary-${randomUUID()}@partner.test`;
    const added = await request(app)
      .post(`/api/v1/uit/companies/${companyId}/recruiters`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: secondaryEmail, fullName: "Trần Tuyển Dụng", title: "Recruiter" });
    expect(added.status).toBe(201);
    const secondaryUserId = added.body.data.userId as string;
    const obsoleteToken = added.body.data.activation.token as string;

    const regenerated = await request(app)
      .post(`/api/v1/uit/companies/${companyId}/recruiters/${secondaryUserId}/activation-link`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(regenerated.status).toBe(200);
    const currentToken = regenerated.body.data.activation.token as string;
    expect(currentToken).not.toBe(obsoleteToken);

    const obsoleteActivation = await request(app)
      .post("/api/v1/auth/company-activation")
      .send({ token: obsoleteToken, password: "Secondary123", acceptedTerms: true });
    expect(obsoleteActivation.status).toBe(400);
    expect(
      (await request(app)
        .post("/api/v1/auth/company-activation")
        .send({ token: currentToken, password: "Secondary123", acceptedTerms: true })).status,
    ).toBe(204);

    const suspendedRecruiter = await request(app)
      .post(`/api/v1/uit/companies/${companyId}/recruiters/${secondaryUserId}/suspend`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reason: "Tạm khóa tài khoản theo yêu cầu kiểm thử." });
    expect(suspendedRecruiter.status).toBe(200);

    const suspendedCompany = await request(app)
      .post(`/api/v1/uit/companies/${companyId}/suspend`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 2, reason: "Tạm ngưng quan hệ đối tác để xác minh." });
    expect(suspendedCompany.status).toBe(200);
    expect(suspendedCompany.body.data).toMatchObject({ partnerStatus: "SUSPENDED", version: 3 });

    const revokedRefresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", refreshCookie!);
    expect(revokedRefresh.status).toBe(401);

    const reactivated = await request(app)
      .post(`/api/v1/uit/companies/${companyId}/reactivate`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 3, reason: "Đã hoàn thành xác minh doanh nghiệp." });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data).toMatchObject({ partnerStatus: "ACTIVE", version: 4 });

    const userStates = await client.query<{ id: string; status: string; suspension_reason: string | null }>(
      "SELECT id, status, suspension_reason FROM users WHERE id = ANY($1::uuid[]) ORDER BY id",
      [[primaryUserId, secondaryUserId]],
    );
    expect(userStates.rows.find((row) => row.id === primaryUserId)).toMatchObject({
      status: "ACTIVE",
      suspension_reason: null,
    });
    expect(userStates.rows.find((row) => row.id === secondaryUserId)).toMatchObject({
      status: "SUSPENDED",
      suspension_reason: "ADMIN_SUSPENDED",
    });

    const audits = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM audit_logs WHERE actor_user_id = $1 AND target_id = $2",
      [admin.id, companyId],
    );
    expect(Number(audits.rows[0]?.count)).toBeGreaterThanOrEqual(3);
  });

  it("enforces admin RBAC, uniqueness and optimistic version checks", async () => {
    const admin = await createAdmin();
    const code = `IT-${randomUUID().slice(0, 8).toUpperCase()}`;
    companyCodes.push(code);
    const body = {
      code,
      name: "Công ty Kiểm thử Ràng buộc",
      legalName: null,
      taxCode: `TAX-${randomUUID().slice(0, 12)}`,
      industry: null,
      companySize: null,
      description: null,
      website: null,
      address: null,
      primaryRecruiter: {
        email: `unique-${randomUUID()}@partner.test`,
        fullName: "Tài khoản Chính",
        title: null,
      },
    };
    const created = await request(app)
      .post("/api/v1/uit/companies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(body);
    expect(created.status).toBe(201);
    const companyId = created.body.data.company.id as string;

    const forbidden = await request(app).get("/api/v1/uit/companies");
    expect(forbidden.status).toBe(401);

    const duplicate = await request(app)
      .post("/api/v1/uit/companies")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        ...body,
        code: `IT-${randomUUID().slice(0, 8).toUpperCase()}`,
        taxCode: `OTHER-${randomUUID().slice(0, 8)}`,
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("COMPANY_RECRUITER_EMAIL_EXISTS");

    const stale = await request(app)
      .patch(`/api/v1/uit/companies/${companyId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ ...body, primaryRecruiter: undefined, expectedVersion: 99 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("COMPANY_VERSION_CONFLICT");
  });
});

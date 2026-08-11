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

describeWithDatabase("UIT taxonomy administration API", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const client = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-taxonomy-test",
  });
  const tokenService = new TokenService();
  const app = createApp({
    database,
    authDatabase: database,
    jobDatabase: database,
    taxonomyDatabase: database,
    tokenService,
  });
  const userIds: string[] = [];
  const companyIds: string[] = [];
  const categoryIds: string[] = [];
  const skillIds: string[] = [];

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await client.connect();
  });

  afterEach(async () => {
    if (companyIds.length) {
      await client.query(
        "DELETE FROM job_post_status_history WHERE job_post_id IN (SELECT id FROM job_posts WHERE company_id = ANY($1::uuid[]))",
        [companyIds],
      );
      await client.query("DELETE FROM job_posts WHERE company_id = ANY($1::uuid[])", [companyIds]);
    }
    if (categoryIds.length) {
      await client.query("DELETE FROM audit_logs WHERE target_id = ANY($1::uuid[])", [categoryIds]);
      await client.query("DELETE FROM categories WHERE id = ANY($1::uuid[])", [categoryIds]);
    }
    if (skillIds.length) {
      await client.query("DELETE FROM audit_logs WHERE target_id = ANY($1::uuid[])", [skillIds]);
      await client.query("DELETE FROM skills WHERE id = ANY($1::uuid[])", [skillIds]);
    }
    if (userIds.length) {
      await client.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1::uuid[])", [userIds]);
      await client.query("DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[])", [userIds]);
    }
    if (companyIds.length) {
      await client.query("DELETE FROM company_users WHERE company_id = ANY($1::uuid[])", [companyIds]);
      await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [companyIds]);
    }
    if (userIds.length) {
      await client.query("DELETE FROM uit_staff WHERE user_id = ANY($1::uuid[])", [userIds]);
      await client.query("DELETE FROM student_profiles WHERE user_id = ANY($1::uuid[])", [userIds]);
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
    userIds.length = 0;
    companyIds.length = 0;
    categoryIds.length = 0;
    skillIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
    await database.end();
  });

  async function tokenFor(user: AuthUser) {
    return (await tokenService.signAccessToken(user)).accessToken;
  }

  async function createAdmin() {
    const id = randomUUID();
    const user: AuthUser = {
      id,
      email: `taxonomy-admin-${randomUUID()}@uit.edu.vn`,
      role: "UIT_ADMIN",
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: "Quản trị danh mục UIT",
      organization: "Phòng Quan hệ Doanh nghiệp",
      studentProfileId: null,
      companyId: null,
    };
    userIds.push(id);
    await client.query("INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'UIT_ADMIN', 'ACTIVE')", [id, user.email]);
    await client.query(
      "INSERT INTO uit_staff (user_id, full_name, department) VALUES ($1, $2, $3)",
      [id, user.displayName, user.organization],
    );
    return { ...user, token: await tokenFor(user) };
  }

  async function createCompany(adminId: string) {
    const userId = randomUUID();
    const companyId = randomUUID();
    const user: AuthUser = {
      id: userId,
      email: `taxonomy-company-${randomUUID()}@example.com`,
      role: "COMPANY",
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: "Nhà tuyển dụng taxonomy",
      organization: "Doanh nghiệp kiểm thử",
      studentProfileId: null,
      companyId,
    };
    userIds.push(userId);
    companyIds.push(companyId);
    await client.query("INSERT INTO users (id, email, role, status) VALUES ($1, $2, 'COMPANY', 'ACTIVE')", [userId, user.email]);
    await client.query(
      `INSERT INTO companies (id, code, name, partner_status, verified_at, created_by_user_id)
       VALUES ($1, $2, 'Doanh nghiệp kiểm thử taxonomy', 'ACTIVE', now(), $3)`,
      [companyId, `TAX-${randomUUID().slice(0, 8).toUpperCase()}`, adminId],
    );
    await client.query(
      "INSERT INTO company_users (user_id, company_id, full_name, is_primary) VALUES ($1, $2, $3, true)",
      [userId, companyId, user.displayName],
    );
    return { ...user, token: await tokenFor(user) };
  }

  async function tokenForRole(role: UserRole) {
    if (role === "UIT_ADMIN") return (await createAdmin()).token;
    if (role === "COMPANY") {
      const creator = await createAdmin();
      return (await createCompany(creator.id)).token;
    }

    const user: AuthUser = {
      id: randomUUID(),
      email: `${role.toLowerCase()}-${randomUUID()}@example.com`,
      role,
      status: "ACTIVE",
      passwordHash: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayName: role,
      organization: null,
      studentProfileId: randomUUID(),
      companyId: null,
    };
    userIds.push(user.id);
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
        `TAX${user.id.replaceAll("-", "").slice(0, 8)}`,
        user.displayName,
      ],
    );
    return tokenFor(user);
  }

  async function createCategory(token: string, suffix = randomUUID().slice(0, 8).toUpperCase()) {
    const response = await request(app)
      .post("/api/v1/uit/taxonomy/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: `TEST_${suffix}`, name: `Nhóm ngành ${suffix}` });
    if (response.body.data?.id) categoryIds.push(response.body.data.id);
    return response;
  }

  async function createSkill(token: string, suffix = randomUUID().slice(0, 8).toLowerCase()) {
    const response = await request(app)
      .post("/api/v1/uit/taxonomy/skills")
      .set("Authorization", `Bearer ${token}`)
      .send({ slug: `test-${suffix}`, name: `Kỹ năng ${suffix}` });
    if (response.body.data?.id) skillIds.push(response.body.data.id);
    return response;
  }

  it("lets UIT create, search, rename, archive and reactivate taxonomy with audit history", async () => {
    const admin = await createAdmin();
    const category = await createCategory(admin.token);
    const skill = await createSkill(admin.token);
    expect(category.status).toBe(201);
    expect(category.body.data).toMatchObject({ status: "ACTIVE", version: 1, jobCount: 0, openJobCount: 0 });
    expect(skill.status).toBe(201);

    const list = await request(app)
      .get(`/api/v1/uit/taxonomy/categories?query=${encodeURIComponent(category.body.data.code)}&status=ACTIVE`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.totalItems).toBe(1);
    expect(list.body.data[0].id).toBe(category.body.data.id);

    const renamed = await request(app)
      .patch(`/api/v1/uit/taxonomy/categories/${category.body.data.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Kỹ thuật phần mềm nâng cao", expectedVersion: 1 });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({
      code: category.body.data.code,
      name: "Kỹ thuật phần mềm nâng cao",
      version: 2,
    });

    const archived = await request(app)
      .post(`/api/v1/uit/taxonomy/categories/${category.body.data.id}/archive`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 2, reason: "Tạm ngừng để chuẩn hóa chương trình đào tạo." });
    expect(archived.status).toBe(200);
    expect(archived.body.data).toMatchObject({ status: "INACTIVE", version: 3 });

    const reactivated = await request(app)
      .post(`/api/v1/uit/taxonomy/categories/${category.body.data.id}/reactivate`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 3, reason: "Đã hoàn tất đối chiếu với chương trình đào tạo." });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data).toMatchObject({ status: "ACTIVE", version: 4 });

    const audit = await client.query<{ action: string }>(
      "SELECT action FROM audit_logs WHERE target_id = $1 ORDER BY created_at, action",
      [category.body.data.id],
    );
    expect(audit.rows.map((row) => row.action)).toEqual(expect.arrayContaining([
      "CATEGORY_CREATED",
      "CATEGORY_UPDATED",
      "CATEGORY_ARCHIVED",
      "CATEGORY_REACTIVATED",
    ]));
  });

  it("enforces UIT-only RBAC for every taxonomy route", async () => {
    const studentToken = await tokenForRole("STUDENT");
    const companyToken = await tokenForRole("COMPANY");

    const anonymous = await request(app).get("/api/v1/uit/taxonomy/categories");
    expect(anonymous.status).toBe(401);
    for (const token of [studentToken, companyToken]) {
      const list = await request(app)
        .get("/api/v1/uit/taxonomy/categories")
        .set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(403);
      const create = await request(app)
        .post("/api/v1/uit/taxonomy/skills")
        .set("Authorization", `Bearer ${token}`)
        .send({ slug: "forbidden-skill", name: "Forbidden skill" });
      expect(create.status).toBe(403);
    }
  });

  it("rejects duplicate identifiers, duplicate names and stale versions", async () => {
    const admin = await createAdmin();
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const created = await createCategory(admin.token, suffix);
    expect(created.status).toBe(201);

    const duplicateKey = await request(app)
      .post("/api/v1/uit/taxonomy/categories")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ code: created.body.data.code, name: "Tên khác hợp lệ" });
    expect(duplicateKey.status).toBe(409);
    expect(duplicateKey.body.error.code).toBe("TAXONOMY_KEY_EXISTS");

    const duplicateName = await request(app)
      .post("/api/v1/uit/taxonomy/categories")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ code: `OTHER_${suffix}`, name: created.body.data.name.toUpperCase() });
    expect(duplicateName.status).toBe(409);
    expect(duplicateName.body.error.code).toBe("TAXONOMY_NAME_EXISTS");

    const stale = await request(app)
      .patch(`/api/v1/uit/taxonomy/categories/${created.body.data.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Tên cập nhật bị cũ", expectedVersion: 99 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("TAXONOMY_VERSION_CONFLICT");
  });

  it("protects open jobs from archival and rejects inactive references in new drafts", async () => {
    const admin = await createAdmin();
    const company = await createCompany(admin.id);
    const inUse = await createCategory(admin.token);
    const inactive = await createCategory(admin.token);
    const skill = await createSkill(admin.token);
    const job = await client.query<{ id: string }>(
      `INSERT INTO job_posts
       (company_id, created_by_user_id, title, opportunity_type, work_mode, location,
        description, requirements, positions, deadline, status)
       VALUES ($1, $2, 'Tin đang dùng danh mục', 'INTERNSHIP', 'HYBRID', 'TP. Hồ Chí Minh',
        'Mô tả đủ dài cho tin tuyển dụng kiểm thử.', 'Yêu cầu hợp lệ.', 1, '2099-12-31', 'DRAFT')
       RETURNING id`,
      [company.companyId, company.id],
    );
    await client.query("INSERT INTO job_post_categories (job_post_id, category_id) VALUES ($1, $2)", [
      job.rows[0]!.id,
      inUse.body.data.id,
    ]);

    const blocked = await request(app)
      .post(`/api/v1/uit/taxonomy/categories/${inUse.body.data.id}/archive`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 1, reason: "Chuẩn hóa lại danh mục ngành nghề." });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("TAXONOMY_IN_USE");

    const archived = await request(app)
      .post(`/api/v1/uit/taxonomy/categories/${inactive.body.data.id}/archive`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 1, reason: "Danh mục thử nghiệm không còn sử dụng." });
    expect(archived.status).toBe(200);

    const draft = await request(app)
      .post("/api/v1/companies/me/jobs")
      .set("Authorization", `Bearer ${company.token}`)
      .send({
        title: "Thực tập sinh kiểm thử taxonomy",
        opportunityType: "INTERNSHIP",
        workMode: "HYBRID",
        location: "TP. Hồ Chí Minh",
        description: "Tham gia phát triển và kiểm thử chức năng danh mục nghề nghiệp.",
        requirements: "Có kiến thức lập trình và kỹ năng kiểm thử cơ bản.",
        benefits: null,
        positions: 1,
        deadline: "2099-12-31",
        categoryIds: [inactive.body.data.id],
        skillIds: [skill.body.data.id],
      });
    expect(draft.status).toBe(400);
    expect(draft.body.error.code).toBe("JOB_REFERENCE_INVALID");
  });
});

import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { createDatabasePool } from "../../db/pool.js";
import { runMigrations } from "../../db/migrate.js";
import { hashPassword } from "./password.js";
import { TokenService } from "./token.service.js";

const { Client } = pg;
const describeWithDatabase = env.databaseUrlTest ? describe : describe.skip;

describeWithDatabase("auth API", () => {
  const database = createDatabasePool(env.databaseUrlTest);
  const cleanupClient = new Client({
    connectionString: env.databaseUrlTest,
    application_name: "uit-career-hub-auth-test-cleanup",
  });
  const createdUserIds: string[] = [];
  const app = createApp({ database, authDatabase: database });

  beforeAll(async () => {
    await runMigrations({ databaseUrl: env.databaseUrlTest, log: () => undefined });
    await cleanupClient.connect();
  });

  afterEach(async () => {
    if (createdUserIds.length === 0) return;
    await cleanupClient.query(
      "DELETE FROM audit_logs WHERE actor_user_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])",
      [createdUserIds],
    );
    await cleanupClient.query("DELETE FROM student_profiles WHERE user_id = ANY($1::uuid[])", [createdUserIds]);
    await cleanupClient.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [createdUserIds]);
    createdUserIds.length = 0;
  });

  afterAll(async () => {
    await cleanupClient.end();
    await database.end();
  });

  async function createStudent() {
    const id = randomUUID();
    const email = `${randomUUID()}@student.uit.edu.vn`;
    createdUserIds.push(id);
    await cleanupClient.query(
      `INSERT INTO users (id, email, role, status, password_hash, email_verified_at)
       VALUES ($1, $2, 'STUDENT', 'ACTIVE', $3, now())`,
      [id, email, await hashPassword("Student@12345")],
    );
    return { id, email };
  }

  it("should_login_and_return_the_current_user", async () => {
    const student = await createStudent();
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: student.email.toUpperCase(), password: "Student@12345" });

    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ id: student.id, role: "STUDENT" });
    expect(login.body.data).not.toHaveProperty("refreshToken");
    expect(login.headers["set-cookie"]?.[0]).toContain("HttpOnly");

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(student.email);
  });

  it("should_register_a_student_and_start_a_session", async () => {
    const studentCode = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Nguyễn Văn An",
        studentCode,
        email: `${studentCode}@student.uit.edu.vn`,
        password: "Student@67890",
        acceptedTerms: true,
      });

    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({
      email: `${studentCode}@student.uit.edu.vn`,
      role: "STUDENT",
      status: "ACTIVE",
    });
    expect(registration.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    createdUserIds.push(registration.body.data.user.id);

    const profile = await cleanupClient.query<{ student_code: string; full_name: string }>(
      "SELECT student_code, full_name FROM student_profiles WHERE user_id = $1",
      [registration.body.data.user.id],
    );
    expect(profile.rows[0]).toEqual({ student_code: studentCode, full_name: "Nguyễn Văn An" });
  });

  it("should_revoke_an_existing_access_token_when_the_user_becomes_inactive", async () => {
    const student = await createStudent();
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: student.email, password: "Student@12345" });
    expect(login.status).toBe(200);

    await cleanupClient.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [student.id]);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(401);
    expect(me.body.error).toMatchObject({ code: "AUTH_ACCESS_REVOKED" });
  });

  it("should_reject_an_invalid_password_with_the_standard_error_shape", async () => {
    const student = await createStudent();
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: student.email, password: "Wrong@12345" });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    expect(response.body.error.traceId).toBeTruthy();
  });

  it("should_rotate_refresh_tokens_and_reject_replay", async () => {
    const student = await createStudent();
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: student.email, password: "Student@12345" });
    const originalCookie = login.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(originalCookie).toBeTruthy();

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", originalCookie!);
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers["set-cookie"]?.[0]).not.toContain(originalCookie!);

    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", originalCookie!);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("AUTH_INVALID_REFRESH_TOKEN");
  });

  it("should_activate_a_precreated_company_account_once", async () => {
    const userId = randomUUID();
    const rawToken = new TokenService().createRefreshToken();
    const tokenHash = new TokenService().hashOpaqueToken(rawToken);
    createdUserIds.push(userId);
    await cleanupClient.query(
      `INSERT INTO users (id, email, role, status)
       VALUES ($1, $2, 'COMPANY', 'PENDING_ACTIVATION')`,
      [userId, `${randomUUID()}@company.example`],
    );
    await cleanupClient.query(
      `INSERT INTO account_activation_tokens
       (user_id, token_type, token_hash, expires_at)
       VALUES ($1, 'COMPANY_ACTIVATION', $2, now() + interval '1 hour')`,
      [userId, tokenHash],
    );

    const activation = await request(app)
      .post("/api/v1/auth/company-activation")
      .send({ token: rawToken, password: "Company@67890", acceptedTerms: true });
    expect(activation.status).toBe(204);

    const user = await cleanupClient.query<{ status: string; password_hash: string | null }>(
      "SELECT status, password_hash FROM users WHERE id = $1",
      [userId],
    );
    expect(user.rows[0]).toMatchObject({ status: "ACTIVE" });
    expect(user.rows[0]?.password_hash).toMatch(/^\$2[aby]\$/);

    const replay = await request(app)
      .post("/api/v1/auth/company-activation")
      .send({ token: rawToken, password: "Company@67890", acceptedTerms: true });
    expect(replay.status).toBe(400);
  });
});

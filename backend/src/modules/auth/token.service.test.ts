import { describe, expect, it } from "vitest";

import type { AuthUser } from "./auth.types.js";
import { TokenService } from "./token.service.js";

const user: AuthUser = {
  id: "00000000-0000-4000-8000-000000000011",
  email: "20521067@student.uit.edu.vn",
  role: "STUDENT",
  status: "ACTIVE",
  passwordHash: "not-returned-in-token",
  failedLoginAttempts: 0,
  lockedUntil: null,
  displayName: "Nguyễn Minh Khoa",
  organization: "20521067",
  studentProfileId: "00000000-0000-4000-8000-000000002001",
  companyId: null,
};

describe("TokenService", () => {
  it("should_sign_and_verify_access_token_with_scope", async () => {
    const service = new TokenService({
      secret: "test-secret-with-at-least-32-characters",
      issuer: "test-issuer",
      audience: "test-audience",
      accessTokenTtlSeconds: 900,
    });

    const signed = await service.signAccessToken(user);
    const principal = await service.verifyAccessToken(signed.accessToken);

    expect(signed.expiresIn).toBe(900);
    expect(principal).toMatchObject({
      userId: user.id,
      email: user.email,
      role: "STUDENT",
      studentProfileId: user.studentProfileId,
      companyId: null,
    });
  });

  it("should_hash_refresh_tokens_without_storing_the_plain_value", () => {
    const service = new TokenService({
      secret: "test-secret-with-at-least-32-characters",
      issuer: "test-issuer",
      audience: "test-audience",
      accessTokenTtlSeconds: 900,
    });
    const token = service.createRefreshToken();
    const hash = service.hashOpaqueToken(token);

    expect(token.length).toBeGreaterThanOrEqual(64);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });
});

import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthenticate,
  requireCompanyOwnership,
  requireRoles,
  requireStudentOwnership,
  type AccessPrincipalStore,
} from "./auth.js";
import type { AuthPrincipal, AuthUser } from "../modules/auth/auth.types.js";
import type { TokenService } from "../modules/auth/token.service.js";
import { AppError } from "../shared/app-error.js";

const principal: AuthPrincipal = {
  userId: "user-1",
  email: "user@example.com",
  role: "STUDENT",
  tokenId: "token-1",
  studentProfileId: "student-1",
  companyId: null,
};

function activeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: principal.userId,
    email: principal.email,
    role: principal.role,
    status: "ACTIVE",
    passwordHash: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    displayName: "Student",
    organization: null,
    studentProfileId: principal.studentProfileId,
    companyId: principal.companyId,
    ...overrides,
  };
}

async function authenticateWith(user: AuthUser | null) {
  const request = {
    header: vi.fn(() => "Bearer signed-token"),
  } as unknown as Request;
  const next = vi.fn() as NextFunction;
  const tokenService = {
    verifyAccessToken: vi.fn(async () => principal),
  } as unknown as TokenService;
  const accessPrincipalStore: AccessPrincipalStore = {
    findUserById: vi.fn(async () => user),
  };

  await createAuthenticate(tokenService, accessPrincipalStore)(request, {} as Response, next);
  return { request, next };
}

function requestWithAuth(role: "STUDENT" | "UIT_ADMIN" | "COMPANY") {
  return {
    auth: {
      userId: "user-1",
      email: "user@example.com",
      role,
      tokenId: "token-1",
      studentProfileId: role === "STUDENT" ? "student-1" : null,
      companyId: role === "COMPANY" ? "company-1" : null,
    },
    params: {},
  } as unknown as Request;
}

describe("RBAC middleware", () => {
  it("accepts an active principal whose role and ownership context are current", async () => {
    const { request, next } = await authenticateWith(activeUser());

    expect(request.auth).toEqual(principal);
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ["missing user", null],
    ["inactive user", activeUser({ status: "SUSPENDED" })],
    ["changed role", activeUser({ role: "UIT_ADMIN", studentProfileId: null })],
    ["changed ownership context", activeUser({ studentProfileId: "student-2" })],
  ])("revokes access for a %s", async (_case, user) => {
    const { request, next } = await authenticateWith(user);

    expect(request.auth).toBeUndefined();
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      code: "AUTH_ACCESS_REVOKED",
    });
  });

  it("fails closed when the current principal lookup fails", async () => {
    const request = {
      header: vi.fn(() => "Bearer signed-token"),
    } as unknown as Request;
    const next = vi.fn() as NextFunction;
    const tokenService = {
      verifyAccessToken: vi.fn(async () => principal),
    } as unknown as TokenService;
    const databaseError = new Error("database unavailable");

    await createAuthenticate(tokenService, {
      findUserById: vi.fn(async () => {
        throw databaseError;
      }),
    })(request, {} as Response, next);

    expect(request.auth).toBeUndefined();
    expect(next).toHaveBeenCalledWith(databaseError);
  });

  it("should_reject_a_request_without_an_authenticated_principal", () => {
    const next = vi.fn() as NextFunction;
    requireRoles("UIT_ADMIN")({} as Request, {} as Response, next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      code: "AUTH_ACCESS_TOKEN_MISSING",
    });
  });

  it("should_reject_a_role_not_in_the_allow_list", () => {
    const next = vi.fn() as NextFunction;
    requireRoles("UIT_ADMIN")(
      requestWithAuth("STUDENT"),
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ status: 403 });
  });

  it("should_reject_a_student_without_a_linked_student_profile", () => {
    const request = requestWithAuth("STUDENT");
    request.auth!.studentProfileId = null;
    const next = vi.fn() as NextFunction;
    requireRoles("STUDENT")(request, {} as Response, next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      status: 403,
      code: "AUTH_CONTEXT_MISSING",
    });
  });

  it("should_reject_a_company_user_without_a_linked_company", () => {
    const request = requestWithAuth("COMPANY");
    request.auth!.companyId = null;
    const next = vi.fn() as NextFunction;
    requireRoles("COMPANY")(request, {} as Response, next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      status: 403,
      code: "AUTH_CONTEXT_MISSING",
    });
  });

  it("should_allow_a_role_with_its_required_context", () => {
    const next = vi.fn() as NextFunction;
    requireRoles("COMPANY")(requestWithAuth("COMPANY"), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should_hide_another_company_resource_as_not_found", () => {
    const request = requestWithAuth("COMPANY");
    request.params = { companyId: "company-2" };
    const next = vi.fn() as NextFunction;
    requireCompanyOwnership()(request, {} as Response, next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ status: 404 });
  });

  it("should_allow_a_company_to_access_its_own_resource", () => {
    const request = requestWithAuth("COMPANY");
    request.params = { companyId: "company-1" };
    const next = vi.fn() as NextFunction;
    requireCompanyOwnership()(request, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should_hide_another_student_resource_as_not_found", () => {
    const request = requestWithAuth("STUDENT");
    request.params = { studentProfileId: "student-2" };
    const next = vi.fn() as NextFunction;
    requireStudentOwnership()(request, {} as Response, next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ status: 404 });
  });

  it("should_allow_an_admin_to_access_student_owned_resources", () => {
    const request = requestWithAuth("UIT_ADMIN");
    request.params = { studentProfileId: "student-2" };
    const next = vi.fn() as NextFunction;
    requireStudentOwnership()(request, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});

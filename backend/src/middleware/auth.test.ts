import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requireCompanyOwnership, requireRoles, requireStudentOwnership } from "./auth.js";
import { AppError } from "../shared/app-error.js";

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

  it("should_hide_another_company_resource_as_not_found", () => {
    const request = requestWithAuth("COMPANY");
    request.params = { companyId: "company-2" };
    const next = vi.fn() as NextFunction;
    requireCompanyOwnership()(request, {} as Response, next);

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

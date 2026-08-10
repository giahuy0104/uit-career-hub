import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import type { ApplicationService } from "../modules/applications/application.service.js";
import type { AuthUser, UserRole } from "../modules/auth/auth.types.js";
import { TokenService } from "../modules/auth/token.service.js";
import type { CompanyService } from "../modules/companies/company.service.js";
import type { DashboardService } from "../modules/dashboard/dashboard.service.js";
import type { JobService } from "../modules/jobs/job.service.js";
import type { NotificationService } from "../modules/notifications/notification.service.js";

type HttpMethod = "get" | "post" | "patch";
type RestrictedEndpoint = { method: HttpMethod; path: string; role: UserRole };

const resourceId = randomUUID();
const restrictedEndpoints: RestrictedEndpoint[] = [
  { method: "get", path: "/api/v1/students/me", role: "STUDENT" },
  { method: "get", path: "/api/v1/companies", role: "STUDENT" },
  { method: "get", path: `/api/v1/companies/${resourceId}`, role: "STUDENT" },
  { method: "patch", path: "/api/v1/students/me", role: "STUDENT" },
  { method: "get", path: "/api/v1/students/me/dashboard", role: "STUDENT" },
  { method: "get", path: "/api/v1/students/me/documents", role: "STUDENT" },
  { method: "post", path: "/api/v1/students/me/documents/uploads", role: "STUDENT" },
  { method: "post", path: `/api/v1/students/me/documents/uploads/${resourceId}/complete`, role: "STUDENT" },
  { method: "post", path: `/api/v1/students/me/documents/${resourceId}/download`, role: "STUDENT" },
  { method: "post", path: `/api/v1/students/me/documents/${resourceId}/default`, role: "STUDENT" },
  { method: "get", path: "/api/v1/students/me/interviews", role: "STUDENT" },
  { method: "post", path: `/api/v1/students/me/interviews/${resourceId}/confirm`, role: "STUDENT" },
  { method: "get", path: "/api/v1/applications", role: "STUDENT" },
  { method: "post", path: "/api/v1/applications", role: "STUDENT" },
  { method: "get", path: `/api/v1/applications/${resourceId}`, role: "STUDENT" },
  { method: "post", path: `/api/v1/applications/${resourceId}/resubmit`, role: "STUDENT" },
  { method: "post", path: `/api/v1/applications/${resourceId}/withdraw`, role: "STUDENT" },
  { method: "post", path: `/api/v1/applications/${resourceId}/cancel-interview`, role: "STUDENT" },
  { method: "post", path: `/api/v1/applications/${resourceId}/offer/accept`, role: "STUDENT" },
  { method: "post", path: `/api/v1/applications/${resourceId}/offer/decline`, role: "STUDENT" },
  { method: "post", path: `/api/v1/applications/${resourceId}/offer-document/download`, role: "STUDENT" },

  { method: "get", path: "/api/v1/uit/jobs/review-queue", role: "UIT_ADMIN" },
  { method: "get", path: "/api/v1/uit/dashboard", role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/jobs/${resourceId}/approve`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/jobs/${resourceId}/request-revision`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/jobs/${resourceId}/reject`, role: "UIT_ADMIN" },
  { method: "get", path: "/api/v1/uit/student-documents", role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/student-documents/${resourceId}/download`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/student-documents/${resourceId}/review`, role: "UIT_ADMIN" },
  { method: "get", path: "/api/v1/uit/applications/review-queue", role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/applications/${resourceId}/documents/${resourceId}/download`, role: "UIT_ADMIN" },
  { method: "get", path: "/api/v1/uit/applications/placement-queue", role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/applications/${resourceId}/offer-document/download`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/applications/${resourceId}/request-supplement`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/applications/${resourceId}/reject`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/applications/${resourceId}/forward`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/applications/${resourceId}/confirm-placement`, role: "UIT_ADMIN" },
  { method: "get", path: "/api/v1/uit/companies", role: "UIT_ADMIN" },
  { method: "post", path: "/api/v1/uit/companies", role: "UIT_ADMIN" },
  { method: "get", path: `/api/v1/uit/companies/${resourceId}`, role: "UIT_ADMIN" },
  { method: "patch", path: `/api/v1/uit/companies/${resourceId}`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/companies/${resourceId}/suspend`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/companies/${resourceId}/reactivate`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/companies/${resourceId}/recruiters`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/companies/${resourceId}/recruiters/${resourceId}/suspend`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/companies/${resourceId}/recruiters/${resourceId}/reactivate`, role: "UIT_ADMIN" },
  { method: "post", path: `/api/v1/uit/companies/${resourceId}/recruiters/${resourceId}/activation-link`, role: "UIT_ADMIN" },

  { method: "get", path: "/api/v1/companies/me/jobs", role: "COMPANY" },
  { method: "get", path: "/api/v1/companies/me/dashboard", role: "COMPANY" },
  { method: "post", path: "/api/v1/companies/me/jobs", role: "COMPANY" },
  { method: "get", path: `/api/v1/companies/me/jobs/${resourceId}`, role: "COMPANY" },
  { method: "patch", path: `/api/v1/companies/me/jobs/${resourceId}`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/jobs/${resourceId}/submit`, role: "COMPANY" },
  { method: "get", path: "/api/v1/companies/me/candidates", role: "COMPANY" },
  { method: "get", path: "/api/v1/companies/me/interviews", role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/documents/${resourceId}/download`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/offer-document/uploads`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/offer-document/uploads/${resourceId}/complete`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/offer-document/download`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/start-review`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/reject`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/interviews`, role: "COMPANY" },
  { method: "post", path: `/api/v1/companies/me/applications/${resourceId}/results`, role: "COMPANY" },
  { method: "get", path: "/api/v1/companies/me/profile", role: "COMPANY" },
  { method: "patch", path: "/api/v1/companies/me/profile", role: "COMPANY" },
];

function user(role: UserRole, withContext = true): AuthUser {
  return {
    id: randomUUID(),
    email: `${role.toLowerCase()}-${randomUUID()}@security.test`,
    role,
    status: "ACTIVE",
    passwordHash: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    displayName: `${role} security test`,
    organization: null,
    studentProfileId: role === "STUDENT" && withContext ? randomUUID() : null,
    companyId: role === "COMPANY" && withContext ? randomUUID() : null,
  };
}

describe("HTTP RBAC matrix", () => {
  const tokenService = new TokenService();
  const jobService = {
    listRecruitingJobs: vi.fn(async () => ({ items: [], total: 0 })),
  } as unknown as JobService;
  const notificationService = {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    unreadCount: vi.fn(async () => ({ count: 0 })),
    markRead: vi.fn(async () => undefined),
    markAllRead: vi.fn(async () => undefined),
  } as unknown as NotificationService;
  const applicationService = {} as ApplicationService;
  const companyService = {} as CompanyService;
  const dashboardService = {} as DashboardService;
  const app = createApp({
    tokenService,
    jobService,
    applicationService,
    notificationService,
    companyService,
    dashboardService,
  });
  const tokens = new Map<UserRole, string>();

  beforeAll(async () => {
    for (const role of ["STUDENT", "UIT_ADMIN", "COMPANY"] as const) {
      const signed = await tokenService.signAccessToken(user(role));
      tokens.set(role, signed.accessToken);
    }
  });

  function invoke(method: HttpMethod, path: string, token?: string) {
    const test = request(app)[method](path);
    if (token) test.set("Authorization", `Bearer ${token}`);
    return test;
  }

  it.each(restrictedEndpoints)(
    "$method $path rejects every role except $role",
    async ({ method, path, role }) => {
      const deniedRoles = (["STUDENT", "UIT_ADMIN", "COMPANY"] as const).filter(
        (candidate) => candidate !== role,
      );

      for (const deniedRole of deniedRoles) {
        const response = await invoke(method, path, tokens.get(deniedRole));
        expect(response.status, `${deniedRole} unexpectedly accessed ${method.toUpperCase()} ${path}`).toBe(403);
        expect(response.body.error).toMatchObject({ code: "AUTH_FORBIDDEN" });
      }
    },
  );

  it.each([
    ["jobs", "/api/v1/jobs"],
    ["applications", "/api/v1/applications"],
    ["notifications", "/api/v1/notifications"],
  ])("rejects unauthenticated access to %s", async (_name, path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_ACCESS_TOKEN_MISSING");
  });

  it("rejects malformed and invalid bearer tokens", async () => {
    for (const authorization of ["Basic abc", "Bearer", "Bearer invalid.token.value", "Bearer token extra"]) {
      const response = await request(app).get("/api/v1/jobs").set("Authorization", authorization);
      expect(response.status).toBe(401);
    }
  });

  it("requires a linked student profile for student-only endpoints", async () => {
    const signed = await tokenService.signAccessToken(user("STUDENT", false));
    const response = await invoke("get", "/api/v1/students/me", signed.accessToken);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("AUTH_CONTEXT_MISSING");
  });

  it("requires a linked company for company-only endpoints", async () => {
    const signed = await tokenService.signAccessToken(user("COMPANY", false));
    const response = await invoke("get", "/api/v1/companies/me/jobs", signed.accessToken);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("AUTH_CONTEXT_MISSING");
  });

  it.each(["STUDENT", "UIT_ADMIN", "COMPANY"] as const)(
    "allows %s to read the shared authenticated job catalog and notification count",
    async (role) => {
      const jobResponse = await invoke("get", "/api/v1/jobs", tokens.get(role));
      const notificationResponse = await invoke("get", "/api/v1/notifications/unread-count", tokens.get(role));

      expect(jobResponse.status).toBe(200);
      expect(notificationResponse.status).toBe(200);
    },
  );

  it("sets private no-store and baseline browser security headers on protected responses", async () => {
    const response = await invoke("get", "/api/v1/notifications/unread-count", tokens.get("STUDENT"));

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toBeTruthy();
  });
});

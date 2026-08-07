import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./env.js";

describe("parseEnvironment", () => {
  it("should_use_safe_defaults_when_optional_values_are_missing", () => {
    const result = parseEnvironment({ NODE_ENV: "test" });

    expect(result.backendPort).toBe(3000);
    expect(result.corsOrigin).toBe("http://localhost:5173");
    expect(result.databaseUrl).toContain("localhost");
    expect(result.databaseUrlDirect).toBeUndefined();
    expect(result.databasePoolMax).toBe(10);
    expect(result.allowDemoReset).toBe(false);
  });

  it("should_accept_a_small_serverless_database_pool", () => {
    const result = parseEnvironment({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a-production-secret-with-at-least-32-characters",
      DATABASE_POOL_MAX: "2",
    });

    expect(result.databasePoolMax).toBe(2);
  });

  it("should_only_enable_demo_reset_when_explicitly_requested", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      ALLOW_DEMO_RESET: "true",
    });

    expect(result.allowDemoReset).toBe(true);
  });

  it("should_accept_neon_urls_when_ssl_is_required", () => {
    const result = parseEnvironment({
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://user:password@ep-demo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      DATABASE_URL_DIRECT:
        "postgresql://user:password@ep-demo.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    });

    expect(result.databaseUrl).toContain("-pooler");
    expect(result.databaseUrlDirect).not.toContain("-pooler");
  });

  it("should_reject_neon_urls_without_ssl_mode", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:password@ep-demo-pooler.neon.tech/neondb",
      }),
    ).toThrow(/sslmode/);
  });
});

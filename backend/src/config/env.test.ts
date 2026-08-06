import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./env.js";

describe("parseEnvironment", () => {
  it("should_use_safe_defaults_when_optional_values_are_missing", () => {
    const result = parseEnvironment({ NODE_ENV: "test" });

    expect(result.backendPort).toBe(3000);
    expect(result.corsOrigin).toBe("http://localhost:5173");
    expect(result.databaseUrl).toContain("localhost");
    expect(result.databaseUrlDirect).toBeUndefined();
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

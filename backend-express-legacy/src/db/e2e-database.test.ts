import { describe, expect, it } from "vitest";

import { assertSafeE2eDatabaseTarget } from "./e2e-database.js";

const runtimeUrls = [
  "postgresql://user:password@runtime.example:5432/uit_career_hub",
  "postgresql://user:password@runtime.example:5432/uit_career_hub_test",
  "postgresql://user:password@runtime.example:5432/uit_career_hub_e2e",
];

describe("assertSafeE2eDatabaseTarget", () => {
  it("accepts a dedicated E2E database", () => {
    expect(assertSafeE2eDatabaseTarget({
      databaseUrl: "postgresql://user:password@127.0.0.1:55432/uit_career_hub_e2e",
      allowReset: true,
      runtimeDatabaseUrls: runtimeUrls,
    })).toContain("uit_career_hub_e2e");
  });

  it("requires an explicit reset flag", () => {
    expect(() => assertSafeE2eDatabaseTarget({
      databaseUrl: "postgresql://user:password@127.0.0.1:55432/uit_career_hub_e2e",
      allowReset: false,
      runtimeDatabaseUrls: runtimeUrls,
    })).toThrow(/ALLOW_E2E_RESET/);
  });

  it("rejects targets without an E2E database name", () => {
    expect(() => assertSafeE2eDatabaseTarget({
      databaseUrl: "postgresql://user:password@127.0.0.1:55432/uit_career_hub",
      allowReset: true,
      runtimeDatabaseUrls: runtimeUrls,
    })).toThrow(/chứa 'e2e'/);
  });

  it("rejects the same target as any protected runtime or test database", () => {
    expect(() => assertSafeE2eDatabaseTarget({
      databaseUrl: "postgresql://other:credentials@runtime.example:5432/uit_career_hub_e2e",
      allowReset: true,
      runtimeDatabaseUrls: runtimeUrls,
    })).toThrow(/phải tách biệt/);
  });
});

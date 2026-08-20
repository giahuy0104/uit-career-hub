import { describe, expect, it } from "vitest";

import {
  getDatabaseProvider,
  isLocalDatabaseUrl,
  resolveMigrationDatabaseUrl,
} from "./database-url.js";

describe("database URL helpers", () => {
  const pooledNeon =
    "postgresql://user:password@ep-demo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const directNeon =
    "postgresql://user:password@ep-demo.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const local = "postgresql://user:password@localhost:5432/uit_career_hub";

  it("should_detect_neon_and_local_postgresql", () => {
    expect(getDatabaseProvider(pooledNeon)).toBe("neon");
    expect(getDatabaseProvider(local)).toBe("postgresql");
    expect(isLocalDatabaseUrl(local)).toBe(true);
  });

  it("should_require_direct_url_for_neon_pooler_migrations", () => {
    expect(() => resolveMigrationDatabaseUrl(pooledNeon)).toThrow(/DATABASE_URL_DIRECT/);
    expect(resolveMigrationDatabaseUrl(pooledNeon, directNeon)).toBe(directNeon);
  });

  it("should_allow_runtime_url_for_local_migrations", () => {
    expect(resolveMigrationDatabaseUrl(local)).toBe(local);
  });
});

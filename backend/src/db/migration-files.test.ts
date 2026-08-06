import { describe, expect, it } from "vitest";

import { loadMigrationFiles } from "./migration-files.js";

describe("loadMigrationFiles", () => {
  it("should_load_ordered_migrations_with_sha256_checksum", async () => {
    const migrations = await loadMigrationFiles();

    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0]).toMatchObject({
      version: "0001",
      name: "initial_mvp_schema",
      fileName: "0001_initial_mvp_schema.sql",
    });
    expect(migrations[0]?.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(migrations[0]?.sql).toContain("CREATE TABLE applications");
  });
});
